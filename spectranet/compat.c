#include "compat.h"
#include "compat_internals.h"
#include "debug.h"
#include "compat_api.h"

#include <string.h>

uint8_t recv_buffer[4096];
static struct socket_ref_t compat_sockets[COMPAT_MAX_SOCKETS] = {};
static enum internal_error_t internal_error = INTERNAL_ERROR_OK;

int FD_ISSET(int fd, fd_set *set)
{
    for (uint8_t i = 0; i < set->fd_count; i++)
    {
        if (set->fd_array[i] == fd)
        {
            return 1;
        }
    }

    return 0;
}

void FD_SET(int fd, fd_set *set)
{
    set->fd_array[set->fd_count++] = fd;
}

void FD_ZERO(fd_set *set)
{
    set->fd_count = 0;
}

int compat_socket_get_error()
{
    return internal_error;
}

int select(int nfds, fd_set *readfds, fd_set *writefds, void* ignored1, void* ignored2)
{
    for (uint8_t i = 0; i < readfds->fd_count; i++)
    {
        int fd = readfds->fd_array[i];
        if (compat_sockets[fd].rx_size)
        {
            nic_w5100_verbose("compat: select has data on socket %d (%d bytes)\n", fd,
                compat_sockets[fd].rx_size);
        }
        else
        {
            // we've got nothing
            readfds->fd_array[i] = 0xFF;
        }
    }

    // writefds are all sent unbufferred, so no need to touch them

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

        compat_sockets[i].rx_size = 0;
        compat_sockets[i].used = 1;
        compat_sockets[i].socket_type = sock_type;

        nic_socket(i, protocol);
        nic_w5100_debug("compat: opened %d type %d\n", i, sock_type);
        return i;
    }

    nic_w5100_debug("compat: used all sockets\n");
    return compat_socket_invalid;
}

int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen)
{
    nic_w5100_debug("compat: setsockopt\n");
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

int compat_socket_close(compat_socket_t sockfd)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    nic_socket_close(sockfd);

    compat_sockets[sockfd].used = 0;
    return 0;
}

int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen)
{
    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    if (check_fd(sockfd))
    {
        return -1;
    }

    uint16_t port = ntohs(addr_in->sin_port);
    nic_w5100_debug("compat: bind %d to port %d\n", sockfd, port);

    nic_bind(sockfd, port);

    compat_sockets[sockfd].bound = 1;
    compat_sockets[sockfd].bound_address = *addr_in;
    return 0;
}

int listen(int sockfd, int backlog)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    nic_w5100_debug("compat: listen %d\n", sockfd);

    return -1;
}

int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    nic_w5100_debug("compat: connect %d\n", sockfd);

    return -1;
}

int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;

    nic_w5100_debug("compat: accept %d\n", sockfd);

    return -1;
}

int16_t recv(int sockfd, void *buf, uint16_t len, int flags)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    nic_w5100_debug("compat: recv %d\n", sockfd);

    return 0;
}

int16_t recvfrom(int sockfd, void *buf, uint16_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    if (len > compat_sockets[sockfd].rx_size)
    {
        len = compat_sockets[sockfd].rx_size;
    }

    memcpy(buf, compat_sockets[sockfd].rx_buffer, len);
    if (compat_sockets[sockfd].rx_size > len)
    {
        memmove(compat_sockets[sockfd].rx_buffer, compat_sockets[sockfd].rx_buffer + len,
            compat_sockets[sockfd].rx_size - len);
    }

    compat_sockets[sockfd].rx_size -= len;

    return len;
}

int16_t send(int sockfd, const void *buf, uint16_t len, int flags)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    uint16_t port = ntohs(compat_sockets[sockfd].bound_address.sin_port);
    nic_w5100_debug("compat: send %d port %d\n", sockfd, ntohs(port));

    return len;
}

int16_t sendto(int sockfd, const void *buf, uint16_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen)
{
    if (check_fd(sockfd))
    {
        return -1;
    }

    struct sockaddr_in* dest_addr_in = (struct sockaddr_in*)dest_addr;
    uint16_t port = ntohs(dest_addr_in->sin_port);

    uint8_t* addr = (uint8_t*)&dest_addr_in->sin_addr;
    nic_w5100_debug("compat: sendto %d port %d\n", sockfd, port);
    nic_sendto(sockfd, addr, sizeof(dest_addr_in->sin_addr), port, buf, len);

    /*

    if (port == 67)
    {
        // Special case for DHCP
        compat_sockets[sockfd].socket_type = SOCKET_TYPE_DHCP;

        if (compat_sockets[sockfd].bound)
        {
            uint16_t bound_port = ntohs(compat_sockets[sockfd].bound_address.sin_port);
            nic_w5100_debug("compat: dhcp auto-response to port %d\n", bound_port);

            // Place a response on immediately

            const uint8_t* options = buf + 240;
            if (options[0] != 0x35)
            {
                nic_w5100_debug("compat: unrecognized options %d\n", options[0]);
                return -1;
            }

            switch (options[2])
            {
                case 1:
                {
                    // discover
                    nic_w5100_debug("compat: dhcp discover\n");

                    uint8_t response[] = {
                        0x02, 0x01, 0x06, 0x00, 0x00, 0x00, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0xc0, 0xa8, 0x00, 0x0a, 0xc0, 0xa8, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b, 0x82, 0x01,
                        0xfc, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x63, 0x82, 0x53, 0x63,
                        0x35, 0x01, 0x02, 0x01, 0x04, 0xff, 0xff, 0xff, 0x00, 0x3a, 0x04, 0x00, 0x00, 0x07, 0x08, 0x3b,
                        0x04, 0x00, 0x00, 0x0c, 0x4e, 0x33, 0x04, 0x00, 0x00, 0x0e, 0x10, 0x36, 0x04, 0xc0, 0xa8, 0x00,
                        0x01, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                    };

                    const uint8_t* transaction_id = buf + 4;
                    memcpy(response + 4, transaction_id, 4); // replace tranaction_id

                    const uint8_t* mac = buf + 28;
                    memcpy(response + 28, mac, 6); // replace mac

                    // place a response
                    compat_rx_data(sockfd, response, sizeof(response));

                    return len;
                }
                case 3:
                {
                    // request
                    nic_w5100_debug("compat: dhcp request\n");

                    uint8_t response[] = {
                        0x02, 0x01, 0x06, 0x00, 0x00, 0x00, 0x3d, 0x1e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0xc0, 0xa8, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b, 0x82, 0x01,
                        0xfc, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x63, 0x82, 0x53, 0x63,
                        0x35, 0x01, 0x05, 0x3a, 0x04, 0x00, 0x00, 0x07, 0x08, 0x3b, 0x04, 0x00, 0x00, 0x0c, 0x4e, 0x33,
                        0x04, 0x00, 0x00, 0x0e, 0x10, 0x36, 0x04, 0xc0, 0xa8, 0x00, 0x01, 0x01, 0x04, 0xff, 0xff, 0xff,
                        0x00, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                    };

                    const uint8_t* transaction_id = buf + 4;
                    memcpy(response + 4, transaction_id, 4); // replace tranaction_id

                    const uint8_t* mac = buf + 28;
                    memcpy(response + 28, mac, 6); // replace mac

                    // place a response
                    compat_rx_data(sockfd, response, sizeof(response));

                    break;
                }
                default:
                {
                    nic_w5100_debug("compat: unrecognized dhcp request type %d\n", options[2]);
                    return -1;
                }
            }
        }

        return len;
    }

    */

    return len;
}

unsigned int compat_rx_data(int sockfd, unsigned int sz)
{
    if (check_fd(sockfd))
    {
        return 0;
    }

    unsigned int fits = MAX_RX_BUFFER - compat_sockets[sockfd].rx_size;

    if (sz > fits)
    {
        sz = fits;
    }

    memcpy(compat_sockets[sockfd].rx_buffer + compat_sockets[sockfd].rx_size, recv_buffer, sz);
    compat_sockets[sockfd].rx_size += sz;

    nic_w5100_verbose("compat: placed %d bytes on socket %d, rx %d\n", sz, sockfd,
        compat_sockets[sockfd].rx_size);
    return sz;
}