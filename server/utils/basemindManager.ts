export function resolveBasemindBinary(): string {
  return '';
}

export function basemindScan(_opts: { root: string; paths?: string[]; json?: boolean }) {
  return { success: false, exitCode: null, stdout: '', stderr: '', error: 'stub' };
}

export function basemindRescan(_opts: { root: string; paths?: string[]; json?: boolean }) {
  return { success: false, exitCode: null, stdout: '', stderr: '', error: 'stub' };
}

export async function registerBasemindServer(): Promise<string> {
  return '';
}

export async function unregisterBasemindServer(): Promise<void> {}

export async function getBasemindServerStatus(): Promise<{ status: string }> {
  return { status: 'disconnected' };
}
