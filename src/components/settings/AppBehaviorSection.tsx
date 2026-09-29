import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/switch';
import { SettingsRow } from './SettingsSection';
import { search, uiSettings, workspaceScan } from '@/ipc';
import type { BooleanSettingChangedEvent } from '../../../shared/booleanSettings';
import { trackSettingChanged } from '../../utils/telemetry';

export function AppBehaviorSectionContent() {
  "use no memo";

  const { t } = useTranslation();
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [rerankerEnabled, setRerankerEnabled] = useState(false);
  const [rerankerOverride, setRerankerOverride] = useState<boolean | null>(null);
  const [rerankerReady, setRerankerReady] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const launchAtLoginResponse = await uiSettings.getLaunchAtLogin();
        setLaunchAtLogin(launchAtLoginResponse.enabled);
      } catch (error) {
        console.error('Failed to load app behavior settings:', error);
      }
      try {
        const [rerankerState, scanStatus] = await Promise.all([
          search.getRerankerEnabled(),
          workspaceScan.status(),
        ]);
        setRerankerEnabled(rerankerState.enabled);
        setRerankerOverride(rerankerState.override);
        setRerankerReady(scanStatus.resourcesReady.reranker);
      } catch (error) {
        console.error('Failed to load reranker setting:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();

    const unsubscribeLaunchAtLogin = uiSettings.onLaunchAtLoginChanged?.((event: BooleanSettingChangedEvent) => {
      setLaunchAtLogin(event.enabled);
    });

    return () => {
      unsubscribeLaunchAtLogin?.();
    };
  }, []);

  async function handleLaunchAtLoginChange(enabled: boolean) {
    const previous = launchAtLogin;
    setLaunchAtLogin(enabled);
    try {
      const result = await uiSettings.setLaunchAtLogin(enabled);
      if (!result.success) setLaunchAtLogin(previous);
      else {
        trackSettingChanged({
          settingKey: 'launchAtLogin', tabId: 'general', sectionId: 'preferences',
          valueType: 'boolean', oldValue: previous, newValue: enabled,
        });
      }
    } catch (error) {
      console.error('Failed to save launch at login setting:', error);
      setLaunchAtLogin(previous);
    }
  }

  if (loading) {
    return <div className="text-ui-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  async function handleRerankerChange(enabled: boolean) {
    const previous = rerankerEnabled;
    const previousOverride = rerankerOverride;
    setRerankerEnabled(enabled);
    setRerankerOverride(enabled);
    try {
      const result = await search.setRerankerEnabled(enabled);
      setRerankerEnabled(result.enabled);
      trackSettingChanged({
        settingKey: 'rerankerEnabled', tabId: 'general', sectionId: 'preferences',
        valueType: 'boolean', oldValue: previous, newValue: result.enabled,
      });
    } catch (error) {
      console.error('Failed to save reranker setting:', error);
      setRerankerEnabled(previous);
      setRerankerOverride(previousOverride);
    }
  }

  async function handleRerankerResetAuto() {
    const previous = rerankerEnabled;
    const previousOverride = rerankerOverride;
    try {
      const [result, state] = await Promise.all([
        search.setRerankerEnabled(null),
        search.getRerankerEnabled(),
      ]);
      setRerankerEnabled(result.enabled);
      setRerankerOverride(state.override);
      trackSettingChanged({
        settingKey: 'rerankerEnabled', tabId: 'general', sectionId: 'preferences',
        valueType: 'boolean', oldValue: previous, newValue: result.enabled,
      });
    } catch (error) {
      console.error('Failed to reset reranker setting:', error);
      setRerankerEnabled(previous);
      setRerankerOverride(previousOverride);
    }
  }

  return (
    <>
      <SettingsRow
        label={t('settings.general.launchAtLoginLabel')}
        description={t('settings.general.launchAtLoginDescription')}
      >
        <Switch checked={launchAtLogin} onCheckedChange={handleLaunchAtLoginChange} />
      </SettingsRow>
      <SettingsRow
        label={t('settings.search.rerankLabel')}
        description={
          rerankerReady
            ? t('settings.search.rerankDescription')
            : t('settings.search.rerankNoModel')
        }
      >
        <span className="flex items-center gap-2">
          {rerankerOverride === null && (
            <span className="text-ui-xs text-muted-foreground">{t('settings.search.rerankAuto')}</span>
          )}
          {rerankerOverride !== null && (
            <button
              type="button"
              onClick={handleRerankerResetAuto}
              className="text-ui-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('settings.search.rerankAutoReset')}
            </button>
          )}
          <Switch checked={rerankerEnabled} onCheckedChange={handleRerankerChange} />
        </span>
      </SettingsRow>
    </>
  );
}
