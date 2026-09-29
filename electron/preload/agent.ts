import type { IpcRenderer } from 'electron';
import type {
  SubagentToolCallEvent,
  AgentNotificationEvent,
  AppToastEvent,
  ProgrammaticTaskStartHeadedRequest,
  ProgrammaticTaskStartHeadedResponse,
  ProgrammaticTaskStartedEvent,
  FeedbackSubmitRequest,
  SkillsListRequest,
  DesktopNotificationShowRequest,
  DesktopNotificationClickedEvent,
} from '../ipc/registry';

export function buildAgentNamespaces(
  ipcRenderer: IpcRenderer,
  IPC_CHANNELS: typeof import('../ipc/registry').IPC_CHANNELS,
  replayPendingAgentTabCreateRequest: (requestId: string) => Promise<void>,
) {
  return {
    codex: {
      request: (method: string, params: unknown) =>
        ipcRenderer.invoke(IPC_CHANNELS.CODEX_REQUEST, method, params),
      save_thread: (thread_id: string, items: unknown[]) =>
        ipcRenderer.invoke(IPC_CHANNELS.CODEX_SAVE_THREAD, thread_id, items),
      load_thread: (thread_id: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.CODEX_LOAD_THREAD, thread_id),
      list_threads: () =>
        ipcRenderer.invoke(IPC_CHANNELS.CODEX_LIST_THREADS),
      on_event: (callback: (event: import('../ipc/registry').CodexEvent) => void) => {
        const handler = (_: Electron.IpcRendererEvent, event: import('../ipc/registry').CodexEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.CODEX_EVENT, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.CODEX_EVENT, handler);
      },
    },

    subagentTools: {
      onToolCall: (callback: (event: SubagentToolCallEvent) => void) => {
        const handler = (_: any, event: SubagentToolCallEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.SUBAGENT_TOOL_CALL, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.SUBAGENT_TOOL_CALL, handler);
      },
    },

    agentNotifications: {
      onNotification: (callback: (event: AgentNotificationEvent) => void) => {
        const handler = (_: any, event: AgentNotificationEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.AGENT_NOTIFICATION, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_NOTIFICATION, handler);
      },
    },

    appToasts: {
      onShow: (callback: (event: AppToastEvent) => void) => {
        const handler = (_: any, event: AppToastEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.APP_TOAST_SHOW, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_TOAST_SHOW, handler);
      },
    },

    programmaticTasks: {
      startHeaded: async (request: ProgrammaticTaskStartHeadedRequest) => {
        const response = await ipcRenderer.invoke(IPC_CHANNELS.PROGRAMMATIC_TASK_START_HEADED, request) as ProgrammaticTaskStartHeadedResponse;
        if (response.success && response.result?.requestId) {
          await replayPendingAgentTabCreateRequest(response.result.requestId);
        }
        return response;
      },
      onStarted: (callback: (event: ProgrammaticTaskStartedEvent) => void) => {
        const handler = (_: any, event: ProgrammaticTaskStartedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.PROGRAMMATIC_TASK_STARTED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.PROGRAMMATIC_TASK_STARTED, handler);
      },
    },

    feedback: {
      submit: (request: FeedbackSubmitRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.FEEDBACK_SUBMIT, request),
    },

    skills: {
      list: (request?: SkillsListRequest) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST, request),
      delete: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE, dirPath),
      reveal: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_REVEAL, dirPath),
      onChanged: (callback: () => void) => {
        const listener = () => callback();
        ipcRenderer.on(IPC_CHANNELS.SKILLS_CHANGED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.SKILLS_CHANGED, listener);
      },
    },

    desktopNotification: {
      show: (request: DesktopNotificationShowRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_NOTIFICATION_SHOW, request),
      onClicked: (callback: (event: DesktopNotificationClickedEvent) => void) => {
        const listener = (_: any, event: DesktopNotificationClickedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.DESKTOP_NOTIFICATION_CLICKED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.DESKTOP_NOTIFICATION_CLICKED, listener);
      },
    },
  };
}
