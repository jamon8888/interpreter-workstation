import { useState, useEffect, useCallback } from 'react';
import { workspaceScan, type WorkspaceScanStatus } from '@/ipc';

interface ScanBannerProps {
  workspacePath: string | null;
  onScanStarted?: () => void;
  onDismiss?: () => void;
}

const DISMISS_KEY_PREFIX = 'pii-scan-dismissed-';

function dismissKey(workspacePath: string): string {
  return `${DISMISS_KEY_PREFIX}${workspacePath}`;
}

export function ScanBanner({ workspacePath, onScanStarted, onDismiss }: ScanBannerProps) {
  const [status, setStatus] = useState<WorkspaceScanStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspacePath) return;
    setDismissed(localStorage.getItem(dismissKey(workspacePath)) === '1');
    workspaceScan.status().then(setStatus).catch(() => {});
  }, [workspacePath]);

  const handleScan = useCallback(async () => {
    if (!workspacePath) return;
    setScanning(true);
    setError(null);
    try {
      await workspaceScan.rescan(workspacePath, ['.']);
      onScanStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [workspacePath, onScanStarted]);

  const handleDismiss = useCallback(() => {
    if (workspacePath) {
      localStorage.setItem(dismissKey(workspacePath), '1');
    }
    setDismissed(true);
    onDismiss?.();
  }, [workspacePath, onDismiss]);

  if (
    !workspacePath
    || dismissed
    || scanning
    || status?.indexing
    || status?.lastScanAt
  ) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-950/30 text-sm">
      <span className="text-blue-600 dark:text-blue-400">🔒</span>
      <span className="flex-1 text-gray-700 dark:text-gray-300">
        Scan workspace for sensitive data? Redaction is regex-only until a full scan completes.
      </span>
      <button
        onClick={handleScan}
        disabled={scanning}
        className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : 'Scan'}
      </button>
      <button
        onClick={handleDismiss}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Skip
      </button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
