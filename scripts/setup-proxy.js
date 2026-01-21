/**
 * Configures the global Node.js fetch to use HTTP_PROXY / NO_PROXY environment variables.
 * Usage: Import this file at the very top of your Node.js entry point.
 *
 * import './setup-proxy.js';
 *
 * This file is now a wrapper around the shared utility in @inseme/cop-host.
 */

import "@inseme/cop-host/utils/node-proxy.js";
