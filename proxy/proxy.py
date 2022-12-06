import tornado.ioloop
from tornado import ioloop, web, websocket, httpserver
from tornado.options import define, options
from typing import Dict, Callable, Optional, Coroutine, Any
import ipaddress

import bson
import socket
import select
import os
import logging

define("local", type=bool, default=False, help="Local setup")
define("origin", type=str, default="https://speccytools.org/emu", help="Access-Control-Allow-Origin to allow")
access_log = logging.getLogger("tornado.access")


class RequestError(Exception):
    def __init__(self, msg):
        self.msg = msg


class ClientSocket(object):
    ALLOWED_SOCKET_TYPES = [0, 1]

    SOCKET_TYPE_TCP = 0
    SOCKET_TYPE_UDP = 1

    def __init__(self, session: 'ClientSession', socket_id: int, socket_type: int,
                 recv: Callable[[int, bytes], Coroutine],
                 closed: Callable[[int], Coroutine],
                 connected: Callable[[int, int], Coroutine]):
        self.session = session
        self.socket_id = socket_id
        self.recv = recv
        self.connected = connected
        self.closed = closed
        self.socket_type = socket_type
        self.local_port: int = 0
        self.bound_port: Optional[int] = None
        self.socket: Optional[socket.socket] = None
        self.connecting = False

        self.session.log("New {0} socket: {1}".format(
            "UDP" if socket_type == ClientSocket.SOCKET_TYPE_UDP else "TCP", socket_id))

    async def bind(self, port: int):
        self.bound_port = port

    def _do_bind(self):
        self.socket.bind(('', 0))
        self.local_port = self.socket.getsockname()[1]
        if self.bound_port == 0:
            self.bound_port = self.local_port
        ProxyApp.INSTANCE.register_socket(self.socket, self.poll_event)

    def define_udp(self):
        self.socket = socket.socket(family=socket.AF_INET, type=socket.SOCK_DGRAM)
        self.socket.setblocking(False)
        self._do_bind()

    def define_tcp(self):
        self.socket = socket.socket(family=socket.AF_INET, type=socket.SOCK_STREAM)
        self.socket.setblocking(False)
        self._do_bind()

    def unregister(self):
        ProxyApp.INSTANCE.unregister_socket(self.socket)

    def unregister_write(self):
        ProxyApp.INSTANCE.unregister_write(self.socket)

    async def poll_event(self, event: int):
        if not self.socket:
            return
        if event & select.POLLERR:
            if self.connecting:
                await self.connected(self.socket_id, 0)
                self.session.error("Socket {0} connect failed".format(self.socket_id))
                self.connecting = False
        if event & select.POLLOUT:
            self.unregister_write()
            if self.connecting:
                await self.connected(self.socket_id, 1)
                self.session.log("Socket {0} connected".format(self.socket_id))
                self.connecting = False
        if event & select.POLLIN:
            if self.socket:
                try:
                    data = self.socket.recv(2048)
                    await self.recv(self.socket_id, data)
                except Exception as e:
                    self.session.error("Failure doing recv: {0} on socket {1}".format(str(e), self.socket_id))
                    self.close()
        if event & select.POLLHUP:
            await self.closed(self.socket_id)
            if self.socket:
                self.close()

    async def sendto(self, address: bytes, port: int, data: bytes):
        data = bytes(data)
        if self.socket_type != ClientSocket.SOCKET_TYPE_UDP:
            self.session.error("sendto: not a udp on socket {0}".format(self.socket_id))
            return

        if port == 53:
            # make sure DNS always goes to google
            target_host = '8.8.8.8'
        else:
            try:
                target_host = ipaddress.ip_address(bytes(address))
            except Exception as e:
                self.session.error("sendto: {0} on socket {1}".format(str(e), self.socket_id))
                return

        if self.socket is None:
            if self.bound_port is None:
                self.session.error("sendto: not bound on socket {0}".format(self.socket_id))
                return
            self.define_udp()

        # self.session.log("> {0}".format(len(data)))
        self.socket.sendto(data, (str(target_host), port))

    async def send(self, data: bytes):
        data = bytes(data)
        if self.socket_type != ClientSocket.SOCKET_TYPE_TCP:
            self.session.error("send: not a tcp on socket {0}".format(self.socket_id))
            return

        if self.socket is None:
            self.session.error("unknown socket on socket {0}".format(self.socket_id))
            return

        # self.session.log("> {0}".format(len(data)))
        self.socket.send(data)

    async def connect(self, address: bytes, port: int):
        if self.socket_type != ClientSocket.SOCKET_TYPE_TCP:
            self.session.error("connect: not a tcp on socket {0}".format(self.socket_id))
            return

        if self.socket:
            self.session.error("unknown socket on socket {0}".format(self.socket_id))
            return

        if self.connecting:
            self.session.error("connecting already on socket {0}".format(self.socket_id))
            return

        if port == 53:
            # make sure DNS always goes to google
            target_host = '8.8.8.8'
        else:
            try:
                target_host = ipaddress.ip_address(bytes(address))
            except Exception as e:
                self.session.error("connect: {0} on socket {1}".format(str(e), self.socket_id))
                return

        if self.socket is None:
            if self.bound_port is None:
                self.session.error("sendto: not bound on socket {0}".format(self.socket_id))
                return
            self.define_tcp()

        # self.session.log("> {0}".format(len(data)))
        conn = self.socket.connect_ex((str(target_host), port))
        if conn == 0:
            await self.connected(self.socket_id, 1)
            self.session.log("Socket {0} connected")
        elif conn == socket.EAGAIN or conn == socket.EWOULDBLOCK or conn == 115 or conn == 36:
            self.connecting = True
        else:
            await self.connected(self.socket_id, 0)
            self.session.log("Socket {0} connect failed".format(self.socket_id))

    def close(self):
        if self.socket_id in self.session.allocated_sockets:
            del self.session.allocated_sockets[self.socket_id]
        if self.socket:
            self.unregister()
            self.socket.close()
            self.socket = None
            self.session.log("Socket {0} closed".format(self.socket_id))


class ClientSession(object):
    MAX_SOCKETS = 4

    def __init__(self, writer: Callable[[bytes], Coroutine[Any, Any, None]], session_id: int):
        self.allocated_sockets: Dict[int, ClientSocket] = {}
        self.writer = writer
        self.session_id = session_id
        self.dns_mapping: Dict[int, str] = {}
        self.dns_mapping_address_pool = 16909060
        self.methods = {
            "socket": self.socket,
            "socket_close": self.socket_close,
            "bind": self.bind,
            "sendto": self.sendto,
            "send": self.send,
            "connect": self.connect
        }

    def log(self, m: str):
        access_log.info("{0} | {1}".format(self.session_id, m))

    def error(self, m: str):
        access_log.error("{0} | {1}".format(self.session_id, m))

    async def call_client_method(self, method, args):
        await self.writer(bson.dumps({"m": method, "a": args}))

    async def client_recv(self, sockfd: int, data: bytes):
        await self.call_client_method("recv", [sockfd, data])

    async def client_closed(self, sockfd: int):
        await self.call_client_method("closed", [sockfd])

    async def client_connected(self, sockfd: int, success: int):
        await self.call_client_method("connected", [sockfd, success])

    def close(self):
        socks = self.allocated_sockets
        self.allocated_sockets = {}
        for k, v in socks.items():
            v.close()

    async def recv(self, msg: bytes):
        # self.log("< {0}".format(len(msg)))
        try:
            decoded = bson.loads(msg)
        except ValueError as e:
            self.log("Cannot process a request: {0}".format(str(e)))
            return
        if "m" not in decoded:
            self.log("Request method is not defined")
            return
        if "a" not in decoded:
            self.log("Request args are not defined")
            return
        m = decoded["m"]
        a = decoded["a"]
        if not isinstance(m, str):
            self.log("Request method is not a string")
            return
        if not isinstance(a, list):
            self.log("Request args are not a list")
            return
        if m not in self.methods:
            self.log("Unknown method: {0}".format(m))
            return
        try:
            await self.methods[m](*a)
        except RequestError as e:
            self.log("Error while processing a request: {0}".format(e.msg))
            return
        except TypeError:
            self.log("Cannot process a request: {0}, type error".format(m))
            return

    async def socket(self, socket_id: int, socket_type: int):
        if len(self.allocated_sockets) >= ClientSession.MAX_SOCKETS:
            raise RequestError("Too many sockets")
        if socket_type not in ClientSocket.ALLOWED_SOCKET_TYPES:
            raise RequestError("Not supported socket type")
        new_socket = ClientSocket(
            self, socket_id, socket_type,
            self.client_recv, self.client_closed, self.client_connected)
        if socket_id in self.allocated_sockets:
            raise RequestError("Socket ID already exists: {0}".format(socket_id))
        self.allocated_sockets[socket_id] = new_socket

    async def bind(self, socket_id: int, port: int):
        if socket_id not in self.allocated_sockets:
            return
        await self.allocated_sockets[socket_id].bind(port)

    async def sendto(self, socket_id: int, address: bytes, port: int, data: bytes):
        if socket_id not in self.allocated_sockets:
            return
        await self.allocated_sockets[socket_id].sendto(address, port, data)

    async def send(self, socket_id: int, data: bytes):
        if socket_id not in self.allocated_sockets:
            return
        await self.allocated_sockets[socket_id].send(data)

    async def connect(self, socket_id: int, address: bytes, port: int):
        if socket_id not in self.allocated_sockets:
            return
        await self.allocated_sockets[socket_id].connect(address, port)

    async def socket_close(self, socket_id: int):
        if socket_id not in self.allocated_sockets:
            return
        s = self.allocated_sockets[socket_id]
        s.close()
        try:
            del self.allocated_sockets[socket_id]
        except KeyError:
            pass


class ProxyApp(web.Application):
    NEXT_SESSION_ID = 0
    INSTANCE: 'ProxyApp' = None
    IOLOOP: tornado.ioloop.IOLoop = None

    def __init__(self):
        super().__init__([(r"/", ProxyHandler)])
        ProxyApp.INSTANCE = self
        self.sockets: Dict[int, Callable[[int], Coroutine]] = {}
        self.polling = select.poll()
        self.cb = tornado.ioloop.PeriodicCallback(self.poll_loop, 5.0)
        self.cb.start()

    def register_socket(self, sock: socket.socket, handler: Callable[[int], Coroutine]):
        self.sockets[sock.fileno()] = handler
        self.polling.register(sock.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLOUT)

    def unregister_write(self, sock: socket.socket):
        self.polling.modify(sock.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR)

    def unregister_socket(self, sock: socket.socket):
        self.polling.unregister(sock.fileno())
        del self.sockets[sock.fileno()]

    async def poll_loop(self):
        for fd, event in self.polling.poll(0):
            handler = self.sockets.get(fd)
            if handler:
                await handler(event)


# noinspection PyAbstractClass
class ProxyHandler(websocket.WebSocketHandler):

    def __init__(self, application: ProxyApp, request, **kwargs):
        super().__init__(application, request, **kwargs)
        self.application: ProxyApp = application
        self.client_session = ClientSession(self.write_serialized_message, application.NEXT_SESSION_ID)
        application.NEXT_SESSION_ID += 1
        self.connection_closed = False

    async def write_serialized_message(self, payload: bytes):
        try:
            await self.write_message(payload, True)
        except websocket.WebSocketClosedError:
            self.close()

    def set_default_headers(self) -> None:
        if options.local:
            self.set_header("Access-Control-Allow-Origin", "*")
        else:
            self.set_header("Access-Control-Allow-Origin", options.origin)

        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header('Access-Control-Allow-Methods', 'GET, OPTIONS')

    def options(self, *args):
        self.set_status(204)
        self.finish()

    def check_origin(self, origin):
        return True

    def open(self):
        self.client_session.log("A new session opened")

    def on_connection_close(self):
        super().on_connection_close()
        # The client has given up and gone home.
        self.connection_closed = True

    async def on_message(self, message):
        if self.connection_closed:
            return
        await self.client_session.recv(message)

    def on_close(self):
        if self.client_session:
            self.client_session.close()
            self.client_session.log("Session closed")
            self.client_session = None


if __name__ == "__main__":
    tornado.options.parse_command_line()

    app = ProxyApp()
    ProxyApp.IOLOOP = ioloop.IOLoop.current()

    if options.local:
        http_server = httpserver.HTTPServer(app)
        http_server.listen(5000)
    else:
        http_server = httpserver.HTTPServer(app, ssl_options={
            "certfile": os.environ["PROXY_CERTFILE"],
            "keyfile": os.environ["PROXY_PRIVFILE"],
        })
        http_server.listen(443)

    ProxyApp.IOLOOP.start()
