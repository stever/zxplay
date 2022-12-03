#ifndef DEBUG_H
#define DEBUG_H

#define nic_w5100_verbose(...)

/* Define this to spew debugging info to stdout */
#define W5100_DEBUG 0

#if W5100_DEBUG
#include <stdio.h>
void nic_w5100_debug( const char *format, ... );
#else
#define nic_w5100_debug(...)
#endif

#endif