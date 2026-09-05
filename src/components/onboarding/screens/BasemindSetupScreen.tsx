import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { basemind } from '../../../ipc';
import { OnboardingHeading, OnboardingScreenShell } from '../components/OnboardingScreenShell';
import { Button } from '../../ui/button';
import { useOnboarding } from '../OnboardingContext';

const STAGES = ['ner', 'embeddings', 'reranker'] as const;
type Stage = typeof STAGES[number];

interface StageState {
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  error?: string;
}

const MAX_RETRIES = 2;

export interface BasemindSetupScreenProps {
  onNext: () => void;
}

export function BasemindSetupScreen({ onNext }: BasemindSetupScreenProps) {
  const { t } = useTranslation();
  const { updateUserChoices } = useOnboarding();
  const [stageStates, setStageStates] = useState<Record<Stage, StageState>>({
    ner: { status: 'pending', progress: 0 },
    embeddings: { status: 'pending', progress: 0 },
    reranker: { status: 'pending', progress: 0 },
  });
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);

  const runDownload = useCallback(async (skipCurrent: Stage | null = null) => {
    setIsDownloading(true);
    for (const stage of STAGES) {
      if (stage === skipCurrent) continue;
      setCurrentStage(stage);
      setStageStates(prev => ({
        ...prev,
        [stage]: { ...prev[stage], status: 'downloading' },
      }));

      let retries = 0;
      let success = false;
      while (retries <= MAX_RETRIES && !success) {
        try {
          const result = await basemind.download();
          const stageResult = result.stages.find((s: { stage: string; success: boolean; error?: string }) => s.stage === stage);
          if (stageResult?.success) {
            setStageStates(prev => ({
              ...prev,
              [stage]: { status: 'done', progress: 100 },
            }));
            success = true;
          } else {
            throw new Error(stageResult?.error ?? 'Download failed');
          }
        } catch (err) {
          retries++;
          if (retries > MAX_RETRIES) {
            setStageStates(prev => ({
              ...prev,
              [stage]: {
                status: 'error',
                progress: prev[stage].progress,
                error: err instanceof Error ? err.message : String(err),
              },
            }));
          }
        }
      }
    }
    setIsDownloading(false);
    setCurrentStage(null);
  }, []);

  const handleSkip = useCallback(() => {
    setIsSkipped(true);
    updateUserChoices({ basemindSetupComplete: true });
    onNext();
  }, [onNext, updateUserChoices]);

  const handleContinue = useCallback(() => {
    updateUserChoices({ basemindSetupComplete: true });
    onNext();
  }, [onNext, updateUserChoices]);

  const allDone = Object.values(stageStates).every(s => s.status === 'done');
  const hasError = Object.values(stageStates).some(s => s.status === 'error');

  useEffect(() => {
    if (allDone && !isSkipped) {
      updateUserChoices({ basemindSetupComplete: true });
    }
  }, [allDone, isSkipped, updateUserChoices]);

  const stageLabel: Record<Stage, string> = {
    ner: t('basemind.download.ner'),
    embeddings: t('basemind.download.embeddings'),
    reranker: t('basemind.download.reranker'),
  };

  return (
    <OnboardingScreenShell size="form">
      <OnboardingHeading
        title={t('onboarding.basemind.title', 'Document Intelligence')}
        description={t('onboarding.basemind.description', 'Download language understanding models for privacy-preserving document indexing.')}
        align="left"
      />

      <div className="mt-6 space-y-3">
        {STAGES.map((stage) => {
          const state = stageStates[stage];
          const isActive = currentStage === stage;
          return (
            <div
              key={stage}
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3"
              style={{
                borderColor: state.status === 'done'
                  ? 'var(--oa-border)'
                  : state.status === 'error'
                    ? 'var(--destructive, #ef4444)'
                    : 'var(--oa-border)',
                background: state.status === 'done'
                  ? 'color-mix(in srgb, var(--oa-bg-app) 60%, transparent)'
                  : 'var(--oa-bg-app)',
              }}
            >
              <div className="flex size-6 shrink-0 items-center justify-center">
                {state.status === 'done' ? (
                  <Check className="size-4 text-emerald-500" />
                ) : state.status === 'error' ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : state.status === 'downloading' || isActive ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Download className="size-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-ui-sm font-medium text-foreground">{stageLabel[stage]}</p>
                {state.status === 'downloading' && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-1 rounded-full bg-foreground/60 transition-all duration-300"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                )}
                {state.status === 'error' && state.error && (
                  <p className="mt-1 text-ui-xs text-destructive">{state.error}</p>
                )}
              </div>

              {state.status === 'error' && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => runDownload(stage)}
                  className="shrink-0"
                >
                  {t('basemind.download.retry')}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {allDone ? (
          <Button variant="default" onClick={handleContinue}>
            {t('onboarding.basemind.continue', 'Continue')}
          </Button>
        ) : hasError ? (
          <>
            <Button variant="ghost" onClick={handleSkip}>
              {t('basemind.download.skip')}
            </Button>
            <Button variant="default" onClick={() => runDownload()}>
              {t('basemind.download.retry')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleSkip}>
              {t('basemind.download.skip')}
            </Button>
            {!isDownloading && (
              <Button variant="default" onClick={() => runDownload()}>
                <Download className="size-4 mr-1.5" />
                {t('onboarding.basemind.startDownload', 'Download & Continue')}
              </Button>
            )}
          </>
        )}
      </div>
    </OnboardingScreenShell>
  );
}
