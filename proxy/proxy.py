import tornado.ioloop
from tornado import ioloop, web, websocket
from typing import Dict, Callable, Optional
from dnslib import DNSRecord, DNSError, RR, QTYPE, A
import ipaddress

import bson
import socket
import select
import threading


class RequestError(Exception):
    def __init__(self, msg):
        self.msg = msg


class ClientSocket(object):
    ALLOWED_SOCKET_TYPES = [0, 1]

    SOCKET_TYPE_TCP = 0
    SOCKET_TYPE_UDP = 1

    def __init__(self, session: 'ClientSession', socket_id: int, socket_type: int, recv: Callable[[int, bytes], None],
                 closed: Callable[[int], None]):
        self.session = session
        self.socket_id = socket_id
        self.recv = recv
        self.closed = closed
        self.socket_type = socket_type
        self.local_port: int = 0
        self.bound_port: Optional[int] = None
        self.socket: Optional[socket.socket] = None

        self.session.log("New socket: {0}".format(socket_id))

    def bind(self, port: int):
        self.bound_port = port

    def handle_dns(self, data: bytes):
        try:
            q = DNSRecord.parse(data)
        except DNSError as e:
            raise RequestError("DNSError: {0}" + str(e))
        if len(q.questions) == 0:
            raise RequestError("Empty DNS request")
        dn = q.questions[0].qname
        dn_name = b'.'.join(dn.label).decode()

        try:
            host = socket.gethostbyname(dn_name)
        except Exception as e:
            self.session.log("Failed to resolve host {0}: {1}".format(dn_name, str(e)))
            a = q.reply()
            a.header.set_rcode(0x3)
            self.recv(self.socket_id, bytes(a.pack()))
            return

        a = q.reply()

        self.session.log("DNS {0} resolved to {1}".format(dn_name, host))
        self.session.dns_mapping[self.session.dns_mapping_address_pool] = dn_name
        self.session.dns_mapping_address_pool += 1
        a.add_answer(RR(dn, QTYPE.A, rdata=A(host), ttl=600))
        self.recv(self.socket_id, bytes(a.pack()))

    def define_udp(self):
        self.socket = socket.socket(family=socket.AF_INET, type=socket.SOCK_DGRAM)
        self.socket.bind(('', 0))
        self.local_port = self.socket.getsockname()[1]
        if self.bound_port == 0:
            self.bound_port = self.local_port

        ProxyApp.INSTANCE.register_socket(self.socket, self.poll_event)

    def poll_event(self, event: int, s: threading.Semaphore):
        if not self.socket:
            return
        if event & select.POLLIN:
            data = self.socket.recv(2048)
            self.recv(self.socket_id, data)
        if event & select.POLLHUP:
            self.closed(self.socket_id)
            self.close()
        s.release()

    def sendto(self, address: bytes, port: int, data: bytes):
        data = bytes(data)
        if self.socket_type != ClientSocket.SOCKET_TYPE_UDP:
            return

        if port == 53:
            self.handle_dns(data)
            return

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

    def close(self):
        if self.socket_id in self.session.allocated_sockets:
            del self.session.allocated_sockets[self.socket_id]
        if self.socket:
            ProxyApp.INSTANCE.unregister_socket(self.socket)
            self.socket.close()
            self.socket = None
        self.session.log("Socket {0} closed".format(self.socket_id))
        self.session = None


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
            "sendto": self.sendto
        }

    def log(self, m: str):
        print("{0} | {1}".format(self.session_id, m))

    def call_client_method(self, method, args):
        self.writer(bson.dumps({"m": method, "a": args}))

    def client_recv(self, sockfd: int, data: bytes):
        self.call_client_method("recv", [sockfd, data])

    def client_closed(self, sockfd: int):
        self.call_client_method("closed", [sockfd])

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
        new_socket = ClientSocket(self, socket_id, socket_type, self.client_recv, self.client_closed)
        if socket_id in self.allocated_sockets:
            raise RequestError("Socket ID already exists: {0}".format(socket_id))
        self.allocated_sockets[socket_id] = new_socket

    def bind(self, socket_id: int, port: int):
        if socket_id not in self.allocated_sockets:
            raise RequestError("Socket is not opened")
        self.allocated_sockets[socket_id].bind(port)

    def sendto(self, socket_id: int, address: bytes, port: int, data: bytes):
        if socket_id not in self.allocated_sockets:
            raise RequestError("Socket is not opened")
        self.allocated_sockets[socket_id].sendto(address, port, data)

    def socket_close(self, socket_id: int):
        if socket_id not in self.allocated_sockets:
            raise RequestError("Socket is not opened")
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
        self.active = True
        self.sockets: Dict[int, Callable[[int, threading.Semaphore], None]] = {}
        self.polling = select.poll()

    def register_socket(self, sock: socket.socket, handler: Callable[[int, threading.Semaphore], None]):
        self.sockets[sock.fileno()] = handler
        self.polling.register(sock.fileno())

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

    def write_serialized_message(self, payload: bytes):
        self.write_message(payload, True)

    def check_origin(self, origin):
        return True

    def open(self):
        self.client_session.log("A new session opened")

    def on_message(self, message):
        self.client_session.recv(message)

    def on_close(self):
        self.client_session.close()
        self.client_session.log("Session closed")


app = ProxyApp()

if __name__ == "__main__":
    x = threading.Thread(target=app.poll_loop, args=())
    ProxyApp.IOLOOP = ioloop.IOLoop.current()
    app.listen(5000)
    x.start()
    ProxyApp.IOLOOP.start()
