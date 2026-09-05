import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '../../src/lib/utils';

interface ModelPrivacyHintProps {
  provider: string;
  className?: string;
}

export function ModelPrivacyHint({ provider, className }: ModelPrivacyHintProps) {
  const { t } = useTranslation();

  const needsRedaction = !['mistral', 'local'].includes(provider.toLowerCase());
  if (!needsRedaction) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1 py-0.5 text-ui-xs text-muted-foreground',
        className,
      )}
    >
      <Lock className="size-2.5 shrink-0" />
      <span>{t('basemind.privacyHint')}</span>
    </div>
  );
}
