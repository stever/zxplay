
#ifndef COMPAT_INTERNALS_H
#define COMPAT_INTERNALS_H

#include "compat.h"

#define COMPAT_MAX_SOCKETS (8)

enum internal_error_t
{
    INTERNAL_ERROR_OK = 0,
    INTERNAL_ERROR_PROTOCOL_NOT_RECOGNIZED
};

enum socket_type_t
{
    SOCKET_TYPE_DHCP = 0,
    SOCKET_TYPE_TCP,
    SOCKET_TYPE_UDP,
};

struct socket_ref_t
{
    uint8_t used;
    enum socket_type_t socket_type;
    struct sockaddr_in bound_address;
};

#endif