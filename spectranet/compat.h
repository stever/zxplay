#ifndef COMPAT_H
#define COMPAT_H

#include <stdint.h>

typedef int compat_socket_t;
typedef uint16_t socklen_t;
#define compat_socket_invalid (-1)

#define SOCK_STREAM (0)
#define SOCK_DGRAM (1)

#define IPPROTO_TCP (0)
#define IPPROTO_UDP (1)

#define SOL_SOCKET (0)
#define SO_REUSEADDR (1)

#define AF_INET (0)

#define ntohs(x) (((x << 8) & 0xFF00) | (uint8_t)(x >> 8))
#define ntohl(x) (((x << 8) & 0xFF00) | (uint8_t)(x >> 8))

#define FD_SETSIZE (8)
#define MAX_RX_BUFFER (2048)

typedef struct fd_set {
  uint8_t  fd_count;
  compat_socket_t fd_array[FD_SETSIZE];
} fd_set;

struct in_addr {
    unsigned long s_addr;  // load with inet_aton()
};

struct sockaddr {
};

struct sockaddr_in {
    short            sin_family;   // e.g. AF_INET
    unsigned short   sin_port;     // e.g. htons(3490)
    struct in_addr   sin_addr;     // see struct in_addr, below
    char             sin_zero[8];  // zero this if you want to
};

int compat_socket_close(compat_socket_t socket);
int compat_socket_get_error();
const char* compat_socket_get_strerror();
void compat_socket_selfpipe_wake();

int  FD_ISSET(int fd, fd_set *set);
void FD_SET(int fd, fd_set *set);
void FD_ZERO(fd_set *set);

int select(int nfds, fd_set *readfds, fd_set *writefds, void*, void*);

int socket(int domain, int type, int protocol);
int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen);
int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
int listen(int sockfd, int backlog);
int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
int16_t recv(int sockfd, void *buf, uint16_t len, int flags);
int16_t recvfrom(int sockfd, void *buf, uint16_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen);
int16_t send(int sockfd, const void *buf, uint16_t len, int flags);
int16_t sendto(int sockfd, const void *buf, uint16_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen);

uint16_t compat_rx_data(int sockfd, uint8_t* data, uint16_t sz);

#endif
