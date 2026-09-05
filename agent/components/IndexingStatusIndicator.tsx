import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { workspaceScan } from '../../src/ipc';
import type { WorkspaceScanStatus } from '../../src/ipc';
import { useToast } from '../../src/contexts/ToastContext';

const LARGE_OP_THRESHOLD = 10;
const READY_DISPLAY_MS = 5_000;

export function useIndexingStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<WorkspaceScanStatus | null>(null);
  const [showReady, setShowReady] = useState(false);
  const prevIndexingRef = useRef(false);
  const prevFileCountRef = useRef(0);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const s = await workspaceScan.status();
      const wasIndexing = prevIndexingRef.current;
      const prevFileCount = prevFileCountRef.current;
      prevIndexingRef.current = s.indexing;
      prevFileCountRef.current = s.fileCount;
      setStatus(s);

      if (wasIndexing && !s.indexing && prevFileCount > 0) {
        setShowReady(true);
        readyTimerRef.current = setTimeout(() => setShowReady(false), READY_DISPLAY_MS);
        toast.dismiss('basemind-indexing');
      }

      if (!wasIndexing && s.indexing && s.fileCount >= LARGE_OP_THRESHOLD) {
        toast({
          variant: 'default',
          title: t('basemind.indexing.progress', { count: s.fileCount }),
          duration: 0,
          id: 'basemind-indexing',
        });
      }

      if (!wasIndexing && s.indexing && s.fileCount > 0 && s.fileCount < LARGE_OP_THRESHOLD) {
        toast({
          variant: 'default',
          title: t('basemind.indexing.progress', { count: s.fileCount }),
          duration: 2000,
          id: 'basemind-indexing-small',
        });
      }
    } catch {
      // silently ignore
    }
  }, [toast, t]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2_000);
    return () => {
      clearInterval(interval);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    };
  }, [refresh]);

  return { status, showReady };
}

interface IndexingStatusIndicatorProps {
  className?: string;
}

export function IndexingStatusIndicator({ className }: IndexingStatusIndicatorProps) {
  const { t } = useTranslation();
  const { status, showReady } = useIndexingStatus();

  if (!status) return null;

  if (showReady) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-ui-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" />
          <span>{t('basemind.indexing.ready')}</span>
        </div>
      </div>
    );
  }

  if (!status.indexing) return null;
  if (status.fileCount < LARGE_OP_THRESHOLD) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-ui-xs font-medium text-muted-foreground dark:bg-white/5">
        <Loader2 className="size-3 animate-spin" />
        <span>{t('basemind.indexing.progress', { count: status.fileCount })}</span>
      </div>
    </div>
  );
}
