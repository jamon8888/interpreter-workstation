import { listVaultBlobDocIds, deleteVaultBlob } from './vault';

let gcRanThisSession = false;

export function resetGcFlagForTests(): void {
  gcRanThisSession = false;
}

export function runOrphanBlobGcOnce(options: {
  activeThreadIds: string[];
  userDataDir?: string;
}): { cleaned: number } {
  if (gcRanThisSession) return { cleaned: 0 };
  gcRanThisSession = true;

  const { activeThreadIds, userDataDir } = options;
  const activeSet = new Set(activeThreadIds);
  const allDocIds = listVaultBlobDocIds(userDataDir);

  let cleaned = 0;
  for (const docId of allDocIds) {
    // Only clean thread blobs
    if (!docId.startsWith('thread-')) continue;
    const threadId = docId.slice('thread-'.length);
    if (!activeSet.has(threadId)) {
      deleteVaultBlob(docId, userDataDir);
      cleaned++;
    }
  }

  return { cleaned };
}
