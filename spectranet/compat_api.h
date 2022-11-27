#ifndef COMPAT_API_H
#define COMPAT_API_H

#include <stdint.h>

extern void nic_socket(uint8_t socket_id, uint8_t socket_type);
extern void nic_socket_close(uint8_t socket_id);
extern void nic_bind(uint8_t socket_id, uint16_t port);
extern void nic_sendto(uint8_t socket_id, const uint8_t* address, uint8_t address_len, uint16_t port, const uint8_t* data, uint16_t len);
extern void nic_send(uint8_t socket_id, const uint8_t* data, uint16_t len);
extern void nic_connect(uint8_t socket_id, const uint8_t* address, uint8_t address_len, uint16_t port);

#endif