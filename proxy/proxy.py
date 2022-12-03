import tornado.ioloop
from tornado import ioloop, web, websocket, httpserver
from typing import Dict, Callable, Optional
import ipaddress

import bson
import socket
import select
import threading
import argparse
import os

class RequestError(Exception):
    def __init__(self, msg):
        self.msg = msg


class ClientSocket(object):
    ALLOWED_SOCKET_TYPES = [0, 1]

    SOCKET_TYPE_TCP = 0
    SOCKET_TYPE_UDP = 1

    def __init__(self, session: 'ClientSession', socket_id: int, socket_type: int,
                 recv: Callable[[int, bytes], None],
                 closed: Callable[[int], None],
                 connected: Callable[[int, int], None]):
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

    def bind(self, port: int):
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

    def poll_event(self, event: int, s: threading.Semaphore):
        if not self.socket:
            return
        if event & select.POLLERR:
            if self.connecting:
                self.connected(self.socket_id, 0)
                self.session.log("Socket {0} connect failed".format(self.socket_id))
                self.connecting = False
        if event & select.POLLOUT:
            self.unregister_write()
            if self.connecting:
                self.connected(self.socket_id, 1)
                self.session.log("Socket {0} connected".format(self.socket_id))
                self.connecting = False
        if event & select.POLLHUP:
            if self.socket:
                self.closed(self.socket_id)
                self.close()
        if event & select.POLLIN:
            if self.socket:
                try:
                    data = self.socket.recv(2048)
                    self.recv(self.socket_id, data)
                except Exception as e:
                    self.session.log("Failure doing recv: {0} on socket {1}".format(str(e), self.socket_id))
        s.release()

    def sendto(self, address: bytes, port: int, data: bytes):
        data = bytes(data)
        if self.socket_type != ClientSocket.SOCKET_TYPE_UDP:
            return

        if port == 53:
            # make sure DNS always goes to google
            target_host = '8.8.8.8'
        else:
            try:
                target_host = ipaddress.ip_address(bytes(address))
            except ValueError:
                return

        if self.socket is None:
            if self.bound_port is None:
                return
            self.define_udp()

        # self.session.log("> {0}".format(len(data)))
        self.socket.sendto(data, (str(target_host), port))

    def send(self, data: bytes):
        data = bytes(data)
        if self.socket_type != ClientSocket.SOCKET_TYPE_TCP:
            return

        if self.socket is None:
            return

        # self.session.log("> {0}".format(len(data)))
        self.socket.send(data)

    def connect(self, address: bytes, port: int):
        if self.socket_type != ClientSocket.SOCKET_TYPE_TCP:
            return

        if self.socket:
            return

        if self.connecting:
            return

        if port == 53:
            # make sure DNS always goes to google
            target_host = '8.8.8.8'
        else:
            try:
                target_host = ipaddress.ip_address(bytes(address))
            except ValueError:
                return

        if self.socket is None:
            if self.bound_port is None:
                return
            self.define_tcp()

        # self.session.log("> {0}".format(len(data)))
        conn = self.socket.connect_ex((str(target_host), port))
        if conn == 0:
            self.connected(self.socket_id, 1)
            self.session.log("Socket {0} connected")
        elif conn == socket.EAGAIN or conn == socket.EWOULDBLOCK or conn == 115 or conn == 36:
            self.connecting = True
        else:
            self.connected(self.socket_id, 0)
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

    def __init__(self, writer: Callable[[bytes], None], session_id: int):
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
        print("{0} | {1}".format(self.session_id, m))

    def call_client_method(self, method, args):
        self.writer(bson.dumps({"m": method, "a": args}))

    def client_recv(self, sockfd: int, data: bytes):
        self.call_client_method("recv", [sockfd, data])

    def client_closed(self, sockfd: int):
        self.call_client_method("closed", [sockfd])

    def client_connected(self, sockfd: int, success: int):
        self.call_client_method("connected", [sockfd, success])

    def close(self):
        socks = self.allocated_sockets
        self.allocated_sockets = {}
        for k, v in socks.items():
            v.close()

    def recv(self, msg: bytes):
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
            self.methods[m](*a)
        except RequestError as e:
            self.log("Error while processing a request: {0}".format(e.msg))
            return
        except TypeError:
            self.log("Cannot process a request: {0}, type error".format(m))
            return

    def socket(self, socket_id: int, socket_type: int):
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

    def bind(self, socket_id: int, port: int):
        if socket_id not in self.allocated_sockets:
            return
        self.allocated_sockets[socket_id].bind(port)

    def sendto(self, socket_id: int, address: bytes, port: int, data: bytes):
        if socket_id not in self.allocated_sockets:
            return
        self.allocated_sockets[socket_id].sendto(address, port, data)

    def send(self, socket_id: int, data: bytes):
        if socket_id not in self.allocated_sockets:
            return
        self.allocated_sockets[socket_id].send(data)

    def connect(self, socket_id: int, address: bytes, port: int):
        if socket_id not in self.allocated_sockets:
            return
        self.allocated_sockets[socket_id].connect(address, port)

    def socket_close(self, socket_id: int):
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

    def __init__(self, local: bool):
        super().__init__([(r"/", ProxyHandler)])
        ProxyApp.INSTANCE = self
        self.local = local
        self.active = True
        self.sockets: Dict[int, Callable[[int, threading.Semaphore], None]] = {}
        self.polling = select.poll()

    def register_socket(self, sock: socket.socket, handler: Callable[[int, threading.Semaphore], None]):
        self.sockets[sock.fileno()] = handler
        self.polling.register(sock.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLOUT)

    def unregister_write(self, sock: socket.socket):
        self.polling.modify(sock.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR)

    def unregister_socket(self, sock: socket.socket):
        self.polling.unregister(sock.fileno())
        del self.sockets[sock.fileno()]

    def poll_loop(self):
        while self.active:
            for fd, event in self.polling.poll(500):
                handler = self.sockets.get(fd)
                if handler:
                    s = threading.Semaphore(value=0)
                    ProxyApp.IOLOOP.add_callback(handler, event, s)
                    s.acquire()


# noinspection PyAbstractClass
class ProxyHandler(websocket.WebSocketHandler):

    def __init__(self, application: ProxyApp, request, **kwargs):
        super().__init__(application, request, **kwargs)
        self.client_session = ClientSession(self.write_serialized_message, application.NEXT_SESSION_ID)
        application.NEXT_SESSION_ID += 1
        self.connection_closed = False

    def write_serialized_message(self, payload: bytes):
        self.write_message(payload, True)

    def set_default_headers(self) -> None:
        if self.application.local:
            self.set_header("Access-Control-Allow-Origin", "*")
        else:
            self.set_header("Access-Control-Allow-Origin", "https://speccytools.org/emu")

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
        # The client has given up and gone home.
        self.connection_closed = True

    def on_message(self, message):
        if self.connection_closed:
            return
        self.client_session.recv(message)

    def on_close(self):
        self.client_session.close()
        self.client_session.log("Session closed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    # Adding optional argument
    parser.add_argument("--local", action="store_true", help="Run locally")

    # Read arguments from command line
    args = parser.parse_args()

    app = ProxyApp(args.local)

    x = threading.Thread(target=app.poll_loop, args=())
    ProxyApp.IOLOOP = ioloop.IOLoop.current()

    if app.local:
        http_server = httpserver.HTTPServer(app)
        http_server.listen(5000)
    else:
        http_server = httpserver.HTTPServer(app, ssl_options={
            "certfile": os.environ["PROXY_CERTFILE"],
            "keyfile": os.environ["PROXY_PRIVFILE"],
        })
        http_server.listen(443)

    x.start()
    ProxyApp.IOLOOP.start()
