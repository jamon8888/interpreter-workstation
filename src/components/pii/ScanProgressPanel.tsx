import { useState, useEffect, useRef } from 'react';
import { scanProgress } from '@/ipc';
import type { ScanProgressEvent } from '../../../electron/ipc/registry';

interface ScanProgressPanelProps {
  workspacePath: string | null;
  onClose?: () => void;
  onViewResults?: () => void;
}

const STAGES = ['extract', 'embed', 'index', 'ner', 'done'] as const;
const STAGE_SHORT: Record<string, string> = { extract: 'Extract', embed: 'Embed', index: 'Index', ner: 'PII', done: 'Done' };

export function ScanProgressPanel({ onClose, onViewResults }: ScanProgressPanelProps) {
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Reset timer when a new scan starts
  useEffect(() => {
    if (progress?.type === 'progress' && progress.stage === 'extract') {
      startTimeRef.current = Date.now();
      setElapsed(0);
    }
  }, [progress?.stage]);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = scanProgress.onProgress((event: ScanProgressEvent) => {
      if (!mountedRef.current) return;
      setProgress(event);
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (progress?.type === 'complete' || progress?.type === 'error') return;
    const id = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 500);
    return () => clearInterval(id);
  }, [progress?.type]);

  const stage = progress?.stage ?? 'extract';
  const stageIdx = STAGES.indexOf(stage as typeof STAGES[number]);
  const pct = progress?.total
    ? Math.round(((progress.progress ?? 0) / progress.total) * 100)
    : null;
  const elapsedSec = (elapsed / 1000).toFixed(1);

  if (progress?.type === 'error') {
    return (
      <div className="border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-red-700 dark:text-red-300">Scan failed: {progress.error}</span>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {progress?.type === 'complete' ? 'Scan complete' : 'Scanning…'}
        </span>
        <div className="flex items-center gap-2">
          {progress?.type === 'complete' && onViewResults && (
            <button onClick={onViewResults} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
              View results
            </button>
          )}
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {STAGES.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`text-xs ${i < stageIdx ? 'text-green-600 dark:text-green-400' : i === stageIdx ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
              {i < stageIdx ? '✓' : i === stageIdx ? '●' : '○'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{STAGE_SHORT[s]}</span>
            {i < STAGES.length - 1 && <span className="text-gray-300 dark:text-gray-600">→</span>}
          </span>
        ))}
      </div>

      {pct !== null && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{progress?.progress ?? 0}{progress?.total ? `/${progress.total}` : ''} files</span>
        <span>{elapsedSec}s</span>
      </div>

      {progress?.message && (
        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">{progress.message}</div>
      )}
    </div>
  );
}
