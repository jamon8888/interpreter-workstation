import { workspace, workspaceScan } from '@/ipc';
import type { WorkspaceScanStatus } from '@/ipc';

type Listener = () => void;

/** Cadence while population/scan is running; idle when nothing is processing. */
const POLL_INTERVAL_MS = 1000;

let status: WorkspaceScanStatus | null = null;
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeWorkspace: (() => void) | null = null;
/** Bumped whenever a newer refresh starts or the cache dies, so a stale
 * in-flight response can never repopulate the snapshot. */
let fetchSeq = 0;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function isProcessing(s: WorkspaceScanStatus | null): boolean {
  return !!s && (s.indexing || !!s.progress);
}

function schedulePoll(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (listeners.size === 0 || !isProcessing(status)) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void refreshSafeStatus();
  }, POLL_INTERVAL_MS);
}

export async function refreshSafeStatus(): Promise<void> {
  const seq = ++fetchSeq;
  try {
    const next = await workspaceScan.status();
    if (seq !== fetchSeq) return;
    status = next;
    emit();
  } catch {
    // Status is advisory; keep the last known snapshot.
    if (seq !== fetchSeq) return;
  }
  schedulePoll();
}

export function getSafeStatusSnapshot(): WorkspaceScanStatus | null {
  return status;
}

export function subscribeSafeStatus(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    unsubscribeWorkspace = workspace.onChanged(() => {
      void refreshSafeStatus();
    });
    void refreshSafeStatus();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    unsubscribeWorkspace?.();
    unsubscribeWorkspace = null;
    // The cache lives only while someone is watching: every new mount refetches,
    // so one workspace's state can never leak into another's banner.
    status = null;
    fetchSeq += 1;
  };
}
