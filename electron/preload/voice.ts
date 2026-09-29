import type { IpcRenderer } from 'electron';
import type {
  VoiceExtensionCheckInstalledRequest,
  VoiceExtensionInstallRequest,
  TtsSetSettingsRequest,
  TtsInstallModelRequest,
  TtsGetVoicesRequest,
  TtsSpeakRequest,
  TtsSettingsChangedEvent,
  TtsInstallProgressEvent,
  TtsPlaybackRequestedEvent,
  SttSetSettingsRequest,
  SttSettingsChangedEvent,
} from '../ipc/registry';

export function buildVoiceNamespaces(ipcRenderer: IpcRenderer, IPC_CHANNELS: typeof import('../ipc/registry').IPC_CHANNELS) {
  return {
    voiceExtension: {
      checkInstalled: (request?: VoiceExtensionCheckInstalledRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.VOICE_EXTENSION_CHECK_INSTALLED, request ?? {}),
      install: (request?: VoiceExtensionInstallRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.VOICE_EXTENSION_INSTALL, request ?? {}),
      onInstallProgress: (callback: (event: import('../ipc/registry').VoiceExtensionInstallProgressEvent) => void) => {
        const handler = (_event: any, data: import('../ipc/registry').VoiceExtensionInstallProgressEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.VOICE_EXTENSION_INSTALL_PROGRESS, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.VOICE_EXTENSION_INSTALL_PROGRESS, handler);
      },
    },

    tts: {
      getSettings: () =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_GET_SETTINGS),
      setSettings: (request: TtsSetSettingsRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_SET_SETTINGS, request),
      listModels: () =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_LIST_MODELS),
      installModel: (request: TtsInstallModelRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_INSTALL_MODEL, request),
      getVoices: (request?: TtsGetVoicesRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_GET_VOICES, request ?? {}),
      speak: (request: TtsSpeakRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.TTS_SPEAK, request),
      onSettingsChanged: (callback: (event: TtsSettingsChangedEvent) => void) => {
        const handler = (_event: any, data: TtsSettingsChangedEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.TTS_SETTINGS_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TTS_SETTINGS_CHANGED, handler);
      },
      onInstallProgress: (callback: (event: TtsInstallProgressEvent) => void) => {
        const handler = (_event: any, data: TtsInstallProgressEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.TTS_INSTALL_PROGRESS, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TTS_INSTALL_PROGRESS, handler);
      },
      onPlaybackRequested: (callback: (event: TtsPlaybackRequestedEvent) => void) => {
        const handler = (_event: any, data: TtsPlaybackRequestedEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.TTS_PLAYBACK_REQUESTED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TTS_PLAYBACK_REQUESTED, handler);
      },
    },

    stt: {
      getSettings: () =>
        ipcRenderer.invoke(IPC_CHANNELS.STT_GET_SETTINGS),
      setSettings: (request: SttSetSettingsRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.STT_SET_SETTINGS, request),
      onSettingsChanged: (callback: (event: SttSettingsChangedEvent) => void) => {
        const handler = (_event: any, data: SttSettingsChangedEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.STT_SETTINGS_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.STT_SETTINGS_CHANGED, handler);
      },
    },
  };
}
