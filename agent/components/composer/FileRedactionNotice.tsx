import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { needsRedactionForProvider } from '../../../src/lib/pii/redaction';

export type RehydrationStorageState = 'unknown' | 'persisted' | 'session-only';

interface FileRedactionNoticeProps {
  modelProvider: string | null | undefined;
  hasAttachments: boolean;
  /**
   * Whether this thread's rehydration map reached the vault. `session-only`
   * means a send succeeded but the map could not be stored, so the tokens
   * stop resolving when the session ends.
   */
  rehydrationStorage?: RehydrationStorageState;
  className?: string;
}

/**
 * File-redaction notice: visible only while attachments are staged and the
 * active provider requires basemind redaction. Unknown provider fails closed
 * (notice shown).
 */
export function FileRedactionNotice({
  modelProvider,
  hasAttachments,
  rehydrationStorage = 'unknown',
  className,
}: FileRedactionNoticeProps) {
  const { t } = useTranslation();

  // The session-only warning is about tokens already sent, so it outlives the
  // staged attachments that gate the redaction notice and shows on its own.
  if (rehydrationStorage === 'session-only') {
    return (
      <span
        className={`flex items-center gap-1 px-1 py-0.5 text-ui-xs text-amber-600 dark:text-amber-400${className ? ` ${className}` : ''}`}
      >
        <Lock className="size-2.5 shrink-0" />
        <span>{t('basemind.pii.sessionOnlyRehydration')}</span>
      </span>
    );
  }

  if (!hasAttachments || !needsRedactionForProvider(modelProvider)) return null;

  return (
    <span
      className={`flex items-center gap-1 px-1 py-0.5 text-ui-xs text-muted-foreground${className ? ` ${className}` : ''}`}
    >
      <Lock className="size-2.5 shrink-0" />
      <span>{t('basemind.filesWillBeRedacted', { provider: modelProvider || 'the model' })}</span>
    </span>
  );
}
