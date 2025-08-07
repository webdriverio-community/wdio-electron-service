export type Debugger = {
  description: string;
  devtoolsFrontendUrl: string;
  devtoolsFrontendUrlCompat: string;
  faviconUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};

export type Version = {
  browser: string;
  protocolVersion: string;
};

export type DebuggerList = Array<Debugger>;
