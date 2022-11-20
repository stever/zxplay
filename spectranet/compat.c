#include "compat.h"
#include "compat_internals.h"
#include "debug.h"

static struct socket_ref_t compat_sockets[COMPAT_MAX_SOCKETS] = {};
static enum internal_error_t internal_error = INTERNAL_ERROR_OK;

void FD_CLR(int fd, fd_set *set)
{
}

int  FD_ISSET(int fd, fd_set *set)
{
    return 0;
}

void FD_SET(int fd, fd_set *set)
{
}

void FD_ZERO(fd_set *set)
{
    set->fd_count = 0;
}

int compat_socket_close(compat_socket_t socket)
{
    return -1;
}

int compat_socket_get_error()
{
    return internal_error;
}

int select(int nfds, fd_set *readfds, fd_set *writefds, void* ignored1, void* ignored2)
{
    return 0;
}

const char* compat_socket_get_strerror()
{
    switch (internal_error)
    {
        case INTERNAL_ERROR_PROTOCOL_NOT_RECOGNIZED:
        {
            return "Protocol is not recognized";
        }
        default:
        {
            return "Error!";
        }
    }
}

void compat_socket_selfpipe_wake()
{
    //
}

int socket(int domain, int type, int protocol)
{
    for (uint8_t i = 0; i < COMPAT_MAX_SOCKETS; i++)
    {
        if (compat_sockets[i].used)
        {
            continue;
        }

        enum socket_type_t sock_type;

        switch (protocol)
        {
            case IPPROTO_TCP:
            {
                sock_type = SOCKET_TYPE_TCP;
                break;
            }
            case IPPROTO_UDP:
            {
                sock_type = SOCKET_TYPE_UDP;
                break;
            }
            default:
            {
                internal_error = INTERNAL_ERROR_PROTOCOL_NOT_RECOGNIZED;
                return compat_socket_invalid;
            }
        }

        compat_sockets[i].used = 1;
        compat_sockets[i].socket_type = sock_type;

        nic_w5100_debug("socket: opened %d type %d\n", i, sock_type);
        return i;
    }

    nic_w5100_debug("socket: used all sockets\n");
    return compat_socket_invalid;
}

int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen)
{
    return 0;
}

static uint8_t check_fd(int sockfd)
{
    if (sockfd < 0 || sockfd >= COMPAT_MAX_SOCKETS)
    {
        return 1;
    }

    if (!compat_sockets[sockfd].used)
    {
        return 1;
    }

    return 0;
}

int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen)
{
    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    if (check_fd(sockfd))
    {
        return -1;
    }

    compat_sockets[sockfd].bound_address = *addr_in;
    return 0;
}

int listen(int sockfd, int backlog)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    return -1;
}

int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    return -1;
}

int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    return -1;
}

int16_t recv(int sockfd, void *buf, uint16_t len, int flags)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    return 0;
}

int16_t recvfrom(int sockfd, void *buf, uint16_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    return 0;
}

int16_t send(int sockfd, const void *buf, uint16_t len, int flags)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    return -1;
}

int16_t sendto(int sockfd, const void *buf, uint16_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* dest_addr_in = (struct sockaddr_in*)dest_addr;

    nic_w5100_debug("sendto: port %d\n", dest_addr_in->sin_port);

    if (dest_addr_in->sin_port == 67)
    {
        return len;
    }

    return -1;
}