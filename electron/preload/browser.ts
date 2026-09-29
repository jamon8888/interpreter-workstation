import type { IpcRenderer } from 'electron';
import type {
  BrowserCreateRequest,
  BrowserNavigateRequest,
  BrowserIdRequest,
  BrowserGetStateRequest,
  BrowserAttachRequest,
  BrowserSetBoundsRequest,
  BrowserEvent,
  BrowserTabCreatedEvent,
  BrowserTabClosedEvent,
  BrowserControlSetPolicyRequest,
  BrowserControlArrangeSplitRequest,
  BrowserControlActivateTabRequest,
  BrowserControlChangedEvent,
  TerminalDataEvent,
  TerminalExitEvent,
} from '../ipc/registry';

export function buildBrowserNamespaces(ipcRenderer: IpcRenderer, IPC_CHANNELS: typeof import('../ipc/registry').IPC_CHANNELS) {
  return {
    browser: {
      create: (id: string, url: string, browserId?: string, faviconUrl?: string) => {
        const request: BrowserCreateRequest = { id, url, browserId, faviconUrl };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CREATE, request);
      },
      navigate: (id: string, url: string) => {
        const request: BrowserNavigateRequest = { id, url };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_NAVIGATE, request);
      },
      goBack: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_BACK, request);
      },
      goForward: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GO_FORWARD, request);
      },
      reload: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_RELOAD, request);
      },
      stop: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STOP, request);
      },
      close: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CLOSE, request);
      },
      getState: (id: string) => {
        const request: BrowserGetStateRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_STATE, request);
      },
      attach: (id: string, windowId: number) => {
        const request: BrowserAttachRequest = { id, windowId };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_ATTACH, request);
      },
      detach: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_DETACH, request);
      },
      setBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => {
        const request: BrowserSetBoundsRequest = { id, bounds };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_SET_BOUNDS, request);
      },
      focus: (id: string) => {
        const request: BrowserIdRequest = { id };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_FOCUS, request);
      },
      onEvent: (callback: (event: BrowserEvent) => void) => {
        const listener = (_: any, event: BrowserEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.BROWSER_EVENT, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_EVENT, listener);
      },
      onTabCreated: (callback: (event: BrowserTabCreatedEvent) => void) => {
        const listener = (_: any, event: BrowserTabCreatedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.BROWSER_TAB_CREATED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_TAB_CREATED, listener);
      },
      onTabClosed: (callback: (event: BrowserTabClosedEvent) => void) => {
        const listener = (_: any, event: BrowserTabClosedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.BROWSER_TAB_CLOSED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_TAB_CLOSED, listener);
      },
      getPersistedTabs: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_PERSISTED_TABS),
    },

    browserControl: {
      getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CONTROL_GET_STATUS),
      getPolicy: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CONTROL_GET_POLICY),
      setPolicy: (policy: BrowserControlSetPolicyRequest['policy']) => {
        const request: BrowserControlSetPolicyRequest = { policy };
        return ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CONTROL_SET_POLICY, request);
      },
      arrangeSplit: (request: BrowserControlArrangeSplitRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CONTROL_ARRANGE_SPLIT, request),
      activateTab: (request: BrowserControlActivateTabRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CONTROL_ACTIVATE_TAB, request),
      onChanged: (callback: (event: BrowserControlChangedEvent) => void) => {
        const listener = (_: any, event: BrowserControlChangedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.BROWSER_CONTROL_CHANGED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_CONTROL_CHANGED, listener);
      },
    },

    terminal: {
      create: (cwd?: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, { cwd }),
      write: (sessionId: string, data: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, { sessionId, data }),
      resize: (sessionId: string, cols: number, rows: number) =>
        ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, { sessionId, cols, rows }),
      close: (sessionId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CLOSE, { sessionId }),
      onData: (callback: (event: TerminalDataEvent) => void) => {
        const listener = (_: any, event: TerminalDataEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, listener);
      },
      onExit: (callback: (event: TerminalExitEvent) => void) => {
        const listener = (_: any, event: TerminalExitEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, listener);
      },
    },
  };
}
