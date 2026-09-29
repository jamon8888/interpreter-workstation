/**
 * A redaction token as the chat renders it (#164).
 *
 * Clicking asks the vault for the original. Nothing is resolved until asked:
 * a transcript full of tokens costs nothing to display, and a reveal stays a
 * deliberate act — which is also what makes it worth auditing (#165).
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { pii } from '@/ipc';
import { PII_COLORS, getPiiColor } from '@/lib/pii/colors';
import { PII_UNRESTORABLE_MARKER_KEY } from '@/lib/pii/labels';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { usePiiRehydration, type PiiResolution } from './PiiTokenContext';

interface PiiTokenProps {
  'data-pii-token'?: string;
  'data-pii-category'?: string;
}

export function PiiToken(props: PiiTokenProps) {
  const { t } = useTranslation();
  const rehydration = usePiiRehydration();
  const token = props['data-pii-token'] ?? '';
  const category = props['data-pii-category'] ?? 'unknown';
  const [resolution, setResolution] = useState<PiiResolution | null>(null);
  const [revealing, setRevealing] = useState(false);

  const color = getPiiColor(category);
  // `label` lives on PII_COLORS, which getPiiColor does not return. Same
  // prototype guard the rest of the module uses: an unknown category must not
  // read a function off Object.prototype.
  const label = Object.prototype.hasOwnProperty.call(PII_COLORS, category)
    ? PII_COLORS[category].label
    : category;

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open || resolution || revealing || !rehydration) return;
    setRevealing(true);
    void (async () => {
      const next = await rehydration.resolve(token);
      setResolution(next);
      setRevealing(false);
      if (next.state !== 'resolved' || !rehydration.threadId) return;
      // Audit the reveal, never what was revealed (#165). Fire-and-forget:
      // a logging failure must not turn a successful reveal into an error.
      void pii.recordReveal({
        scope: rehydration.threadId,
        scopeType: 'thread',
        token,
        category,
        surface: 'chat',
      }).catch(() => {});
    })();
  }, [category, rehydration, resolution, revealing, token]);

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          className="oa-pii-label"
          style={{
            '--pii-category-color': color.light,
            '--pii-category-color-dark': color.dark,
          } as React.CSSProperties}
          data-pii-label="true"
          data-pii-category={category}
          data-pii-token={token}
          role="button"
          tabIndex={0}
          aria-label={t('basemind.pii.tokenAriaLabel', { category: label })}
        >
          {token}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] rounded-[14px] px-3 py-2" side="bottom">
        <p className="text-ui-sm">
          {t('basemind.pii.redactedCategory', { category: label })}
        </p>
        <p className="pt-1 font-mono text-ui-xs text-[var(--oa-text-muted)]">{token}</p>
        <div className="pt-2 text-ui-sm">
          {revealing ? (
            <span className="text-[var(--oa-text-muted)]">{t('basemind.pii.revealing')}</span>
          ) : resolution?.state === 'resolved' ? (
            <span className="break-all font-medium">{resolution.original}</span>
          ) : resolution?.state === 'unrestorable' ? (
            <span className="text-[var(--oa-text-muted)]">{t(PII_UNRESTORABLE_MARKER_KEY)}</span>
          ) : resolution?.state === 'unavailable' ? (
            // Deliberately not the unrestorable wording: the map may simply not
            // be written yet, and claiming permanence would be false.
            <span className="text-[var(--oa-text-muted)]">{t('basemind.pii.revealUnavailable')}</span>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
