import type { IpcRenderer } from 'electron';
import type {
  ComputerUseSetupRequestedEvent,
  CheckpointSettings,
  CheckpointSettingsChangedEvent,
  CheckpointStatusEvent,
  ProjectRunnerPathRequest,
  ProjectRunnerChangedEvent,
} from '../ipc/registry';

export function buildMiscNamespaces(ipcRenderer: IpcRenderer, IPC_CHANNELS: typeof import('../ipc/registry').IPC_CHANNELS) {
  return {
    computerUseSetup: {
      onRequested: (callback: (event: ComputerUseSetupRequestedEvent) => void) => {
        const listener = (_: any, event: ComputerUseSetupRequestedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.COMPUTER_USE_SETUP_REQUESTED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.COMPUTER_USE_SETUP_REQUESTED, listener);
      },
      onStatusRequested: (callback: (event: import('../ipc/registry').ComputerUseSetupStatusRequestedEvent) => void) => {
        const listener = (_: any, event: import('../ipc/registry').ComputerUseSetupStatusRequestedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.COMPUTER_USE_SETUP_STATUS_REQUESTED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.COMPUTER_USE_SETUP_STATUS_REQUESTED, listener);
      },
    },

    overlaySettings: {
      get: () => ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_GET),
      set: (settings: import('../../apps/interpreter-overlay/shared/settings').InterpreterOverlaySettings) =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_SET, settings),
      getAccessState: (options?: { forceRefresh?: boolean }) =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_GET_ACCESS_STATE, options),
      getPermissionStatus: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_GET_PERMISSION_STATUS),
      requestAccessibilityPermission: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_REQUEST_ACCESSIBILITY_PERMISSION),
      requestScreenRecordingPermission: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_REQUEST_SCREEN_RECORDING_PERMISSION),
      openAccessibilitySettings: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_OPEN_ACCESSIBILITY_SETTINGS),
      openScreenRecordingSettings: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OVERLAY_SETTINGS_OPEN_SCREEN_RECORDING_SETTINGS),
    },

    interpreterOverlay: {
      startWindowVoiceMode: (request?: import('../ipc/registry').InterpreterOverlayStartWindowVoiceRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.INTERPRETER_OVERLAY_START_WINDOW_VOICE, request),
      onOnboardingVoiceInterviewCompleted: (
        callback: (event: import('../ipc/registry').InterpreterOverlayOnboardingVoiceInterviewCompletedEvent) => void,
      ) => {
        const listener = (
          _event: any,
          data: import('../ipc/registry').InterpreterOverlayOnboardingVoiceInterviewCompletedEvent,
        ) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.INTERPRETER_OVERLAY_ONBOARDING_VOICE_INTERVIEW_COMPLETED, listener);
        return () => ipcRenderer.removeListener(
          IPC_CHANNELS.INTERPRETER_OVERLAY_ONBOARDING_VOICE_INTERVIEW_COMPLETED,
          listener,
        );
      },
    },

    projectRunner: {
      start: (projectPath: string) => {
        const request: ProjectRunnerPathRequest = { projectPath };
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RUNNER_START, request);
      },
      stop: (projectPath: string) => {
        const request: ProjectRunnerPathRequest = { projectPath };
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RUNNER_STOP, request);
      },
      getStatus: (projectPath: string) => {
        const request: ProjectRunnerPathRequest = { projectPath };
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RUNNER_GET_STATUS, request);
      },
      onChanged: (callback: (event: ProjectRunnerChangedEvent) => void) => {
        const listener = (_: any, event: ProjectRunnerChangedEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.PROJECT_RUNNER_CHANGED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECT_RUNNER_CHANGED, listener);
      },
    },

    checkpoint: {
      get: (messageId: string) => {
        return ipcRenderer.invoke(IPC_CHANNELS.CHECKPOINT_GET, { messageId });
      },
      restore: (messageId: string, type: 'before' | 'after', paths?: string[]) => {
        return ipcRenderer.invoke(IPC_CHANNELS.CHECKPOINT_RESTORE, { messageId, type, paths });
      },
      getSettings: () => {
        return ipcRenderer.invoke(IPC_CHANNELS.CHECKPOINT_SETTINGS_GET);
      },
      setSettings: (settings: Partial<CheckpointSettings>) => {
        return ipcRenderer.invoke(IPC_CHANNELS.CHECKPOINT_SETTINGS_SET, { settings });
      },
      onSettingsChanged: (callback: (event: CheckpointSettingsChangedEvent) => void) => {
        const handler = (_event: unknown, data: CheckpointSettingsChangedEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.CHECKPOINT_SETTINGS_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.CHECKPOINT_SETTINGS_CHANGED, handler);
      },
      onStatusChanged: (callback: (event: CheckpointStatusEvent) => void) => {
        const handler = (_event: unknown, data: CheckpointStatusEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.CHECKPOINT_STATUS_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.CHECKPOINT_STATUS_CHANGED, handler);
      },
    },
  };
}
