export const REQUEST_TIMEOUT = 10000;
export const DEFAULT_HOSTNAME = 'localhost';
export const DEFAULT_PORT = 9229;
export const DEFAULT_MAX_RETRY_COUNT = 3;
export const DEFAULT_RETRY_INTERVAL = 100;

export const ERROR_MESSAGE = {
  TIMEOUT_CONNECTION: 'Request timeout exceeded waiting for response:',
  TIMEOUT_WAIT_PORT: 'Timeout exceeded while waiting for debugger port to open',
  DEBUGGER_NOT_FOUND: 'No debugger instance was detected',
  DEBUGGER_FOUND_MULTIPLE: 'Multiple debugger instances detected. Using the first available instance',
  NOT_CONNECTED: "WebSocket is not connected. Call 'CdpBridge.connect()' before using this method",
  CONNECTION_CLOSED: 'WebSocket connection has been closed',
  ERROR_PARSE_JSON: 'Failed to parse JSON response:',
  ERROR_INTERNAL: 'Connection closed due to error:',
} as const;
