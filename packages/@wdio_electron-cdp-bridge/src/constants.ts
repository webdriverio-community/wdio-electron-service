export const REQUEST_TIMEOUT = 10000;
export const DEFAULT_HOSTNAME = 'localhost';
export const DEFAULT_PORT = 9229;
export const DEFAULT_MAX_RETRY_COUNT = 3;
export const DEFAULT_RETRY_INTERVAL = 100;

export const ERROR_MESSAGE = {
  TIMEOUT_CONNECTION: 'Timeout exceeded when wait for the response:',
  TIMEOUT_WAIT_PORT: 'Timeout exceeded to wait port opening',
  DEBUGGER_NOT_FOUND: 'No debugger was detected.',
  DEBUGGER_FOUND_MULTIPLE: 'Multiple debugger was detected. Use first debugger.',
  NOT_CONNECTED: "WebSocket is not connected. Call 'DebuggerClient.connect()' before call this method.'",
  CONNECTION_CLOSED: 'Connection has been closed.',
  ERROR_PARSE_JSON: 'Failed to parse JSON:',
  ERROR_INTERNAL: 'Close the connection due to error:',
} as const;
