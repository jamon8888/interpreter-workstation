import { listVaultBlobDocIds, deleteVaultBlob } from './vault';
import { threadVaultDocId } from '../../src/lib/pii/vaultScope';

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
  const activeBlobIds = new Set(activeThreadIds.map(threadVaultDocId));
  const allDocIds = listVaultBlobDocIds(userDataDir);

  let cleaned = 0;
  for (const docId of allDocIds) {
    if (!activeBlobIds.has(docId)) {
      deleteVaultBlob(docId, userDataDir);
      cleaned++;
    }
  }

  return { cleaned };
}
