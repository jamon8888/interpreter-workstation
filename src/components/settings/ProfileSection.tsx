import { useState, useEffect } from 'react';
import { basemind } from '@/ipc';

interface ProfileInfo {
  profileId: string;
  profile: {
    id: string;
    label: string;
    description: string;
    nerEnabled: boolean;
    rerankerEnabled: boolean;
    embedMode: string;
    redactionCategories: string[];
  };
  hardware: {
    arch: string;
    avx2: boolean;
    totalMemoryBytes: number;
  };
}

const RAM_GB = (bytes: number) => `${(bytes / (1024 ** 3)).toFixed(1)} GB`;

export function ProfileSection() {
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    basemind.detectMachineProfile()
      .then((info) => { if (!cancelled) setInfo(info); })
      .catch((err) => { console.error('[ProfileSection] Failed to detect machine profile:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500 py-2">Detecting hardware…</div>;
  }

  if (!info) {
    return <div className="text-sm text-gray-500 py-2">Unable to detect hardware.</div>;
  }

  const { profile, hardware } = info;

  return (
    <div className="space-y-4">
      {/* Hardware snapshot */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div>Architecture: {hardware.arch}</div>
        <div>AVX2: {hardware.avx2 ? 'Yes' : 'No'}</div>
        <div>RAM: {RAM_GB(hardware.totalMemoryBytes)}</div>
      </div>

      {/* Active profile */}
      <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {profile.label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            Active
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{profile.description}</p>
      </div>

      {/* Feature matrix */}
      <div className="text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">PII NER</span>
          <span className={profile.nerEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
            {profile.nerEnabled ? 'Enabled' : 'Disabled (regex only)'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Reranker</span>
          <span className={profile.rerankerEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
            {profile.rerankerEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Embeddings</span>
          <span className="text-gray-600 dark:text-gray-400">{profile.embedMode}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">PII categories</span>
          <span className="text-gray-600 dark:text-gray-400">{profile.redactionCategories.length}</span>
        </div>
      </div>
    </div>
  );
}
