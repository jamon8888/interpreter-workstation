import type { IpcRenderer } from 'electron';
import type {
  OfficeExtensionConvertRequest,
  OfficeExtensionDownloadRequest,
  PdfUpdateFormDataRequest,
  PdfFillFieldEvent,
  MovieCompileComponentsRequest,
  MovieExportRequest,
  MovieCancelExportRequest,
  MovieExportProgressEvent,
} from '../ipc/registry';

export function buildDocumentNamespaces(ipcRenderer: IpcRenderer, IPC_CHANNELS: typeof import('../ipc/registry').IPC_CHANNELS) {
  return {
    officeExtension: {
      convert: (request: OfficeExtensionConvertRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_CONVERT, request),
      download: (request: OfficeExtensionDownloadRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_DOWNLOAD, request),
      status: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_STATUS),
      ensureRunning: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_ENSURE_RUNNING),
      checkInstalled: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_CHECK_INSTALLED),
      install: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_INSTALL),
      uninstall: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_UNINSTALL),
      healthcheck: () =>
        ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_HEALTHCHECK),
      onInstallProgress: (callback: (event: import('../ipc/registry').OfficeExtensionInstallProgressEvent) => void) => {
        const handler = (_event: any, data: import('../ipc/registry').OfficeExtensionInstallProgressEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.OFFICE_EXTENSION_INSTALL_PROGRESS, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.OFFICE_EXTENSION_INSTALL_PROGRESS, handler);
      },
    },

    pdf: {
      updateFormData: (filePath: string, formData: { fields: Array<{ name: string; type: string; value: any }> }) => {
        const request: PdfUpdateFormDataRequest = { filePath, formData };
        return ipcRenderer.invoke(IPC_CHANNELS.PDF_UPDATE_FORM_DATA, request);
      },
      onFillField: (callback: (event: PdfFillFieldEvent) => void) => {
        const listener = (_: any, event: PdfFillFieldEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.PDF_FILL_FIELD, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.PDF_FILL_FIELD, listener);
      },
      readStructure: (filePath: string, page?: number) => {
        return ipcRenderer.invoke(IPC_CHANNELS.PDF_READ_STRUCTURE, { filePath, page });
      },
    },

    movie: {
      compileComponents: (request: MovieCompileComponentsRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.MOVIE_COMPILE_COMPONENTS, request),
      exportProject: (request: MovieExportRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.MOVIE_EXPORT, request),
      cancelExport: (request: MovieCancelExportRequest) =>
        ipcRenderer.invoke(IPC_CHANNELS.MOVIE_EXPORT_CANCEL, request),
      onExportProgress: (callback: (event: MovieExportProgressEvent) => void) => {
        const listener = (_: any, event: MovieExportProgressEvent) => callback(event);
        ipcRenderer.on(IPC_CHANNELS.MOVIE_EXPORT_PROGRESS, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.MOVIE_EXPORT_PROGRESS, listener);
      },
    },
  };
}
