#include "debug.h"

#if W5100_DEBUG

#include <stdarg.h>

extern void debug_print(const char* data, uint16_t len);

void
nic_w5100_debug( const char *format, ... )
{
    char line[128];
    va_list ap;
    va_start( ap, format );
    int written = vsnprintf( line, sizeof(line), format, ap );
    va_end( ap );
    debug_print(line, written);
}

#endif