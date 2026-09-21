/**
 * PROTOTYPE — Scan Progress Panel
 * Three variants, switchable via ?variant=A|B|C
 * Throwaway code for design reaction. Do not ship.
 */

import { useState, useEffect, useRef } from 'react';

// ─── Mock data matching basemind T1 shapes ───

interface PiiFinding {
  category: string;
  file: string;
  line: number;
  maskedValue: string;
}

interface ScanProgress {
  stage: 'extract' | 'embed' | 'index' | 'ner' | 'done';
  filesProcessed: number;
  totalFiles: number;
  currentFile: string;
  findings: PiiFinding[];
  elapsed: number; // ms
}

const MOCK_FILES = [
  'src/components/Button.tsx',
  'src/utils/email.ts',
  'src/hooks/useAuth.ts',
  'docs/README.md',
  'server/handlers/search.ts',
  'src/lib/pii/labels.ts',
  'electron/main.ts',
  'src/api.ts',
  'package.json',
  'src/App.tsx',
];

const MOCK_CATEGORIES: Record<string, string> = {
  email: '📧',
  phone: '📱',
  name: '👤',
  iban: '🏦',
  credit_card: '💳',
  ip_address: '🌐',
  address: '📍',
  organization: '🏢',
};

function useMockScan(): ScanProgress {
  const [progress, setProgress] = useState<ScanProgress>({
    stage: 'extract',
    filesProcessed: 0,
    totalFiles: MOCK_FILES.length,
    currentFile: '',
    findings: [],
    elapsed: 0,
  });

  useEffect(() => {
    const start = Date.now();
    let fileIdx = 0;
    const interval = setInterval(() => {
      if (fileIdx >= MOCK_FILES.length) {
        setProgress(prev => {
          const nextStage = prev.stage === 'ner' ? 'done' : prev.stage === 'extract' ? 'embed' : prev.stage === 'embed' ? 'index' : 'ner';
          if (prev.stage === 'ner') {
            clearInterval(interval);
          }
          return {
            ...prev,
            stage: nextStage,
            filesProcessed: prev.stage === 'ner' ? MOCK_FILES.length : prev.filesProcessed,
          };
        });
        return;
      }

      const newFinding: PiiFinding | null = Math.random() > 0.6
        ? {
            category: Object.keys(MOCK_CATEGORIES)[Math.floor(Math.random() * Object.keys(MOCK_CATEGORIES).length)],
            file: MOCK_FILES[fileIdx],
            line: Math.floor(Math.random() * 200) + 1,
            maskedValue: '***',
          }
        : null;

      setProgress(prev => ({
        ...prev,
        filesProcessed: fileIdx + 1,
        currentFile: MOCK_FILES[fileIdx],
        findings: newFinding ? [...prev.findings, newFinding] : prev.findings,
        elapsed: Date.now() - start,
      }));
      fileIdx++;
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return progress;
}

// ─── Variant A — Compact sidebar panel ───

function VariantA({ progress }: { progress: ScanProgress }) {
  const pct = Math.round((progress.filesProcessed / progress.totalFiles) * 100);
  const stageLabel = { extract: 'Extracting', embed: 'Embedding', index: 'Indexing', ner: 'Scanning PII', done: 'Complete' }[progress.stage];

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-blue-500">🔍</span>
        <span>Scanning workspace</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{stageLabel}</span>
        <span>{progress.filesProcessed}/{progress.totalFiles} files</span>
      </div>

      {/* Current file */}
      {progress.currentFile && (
        <div className="text-xs text-gray-400 truncate" title={progress.currentFile}>
          {progress.currentFile}
        </div>
      )}

      {/* PII findings */}
      {progress.findings.length > 0 && (
        <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {progress.findings.length} PII detection{progress.findings.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {progress.findings.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span>{MOCK_CATEGORIES[f.category] || '❓'}</span>
                <span className="text-gray-400 truncate">{f.file}:{f.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress.stage === 'done' && (
        <div className="text-xs text-green-600 dark:text-green-400 mt-2">
          ✓ Scan complete — {progress.findings.length} detections
        </div>
      )}
    </div>
  );
}

// ─── Variant B — Full-width top banner with stage pipeline ───

function VariantB({ progress }: { progress: ScanProgress }) {
  const stages = ['extract', 'embed', 'index', 'ner', 'done'] as const;
  const stageIdx = stages.indexOf(progress.stage);
  const elapsed = (progress.elapsed / 1000).toFixed(1);

  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-sm">
      {/* Stage pipeline */}
      <div className="flex items-center gap-2 mb-3">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              i < stageIdx ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : i === stageIdx ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
            }`}>
              {i < stageIdx ? '✓' : i === stageIdx ? '●' : '○'}
              {{ extract: 'Extract', embed: 'Embed', index: 'Index', ner: 'PII', done: 'Done' }[s]}
            </div>
            {i < stages.length - 1 && <span className="text-gray-300">→</span>}
          </div>
        ))}
        <span className="ml-auto text-xs text-gray-400">{elapsed}s</span>
      </div>

      {/* File progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(progress.filesProcessed / progress.totalFiles) * 100}%` }} />
        </div>
        <span className="text-xs text-gray-500">{progress.filesProcessed}/{progress.totalFiles}</span>
      </div>

      {/* Current file */}
      {progress.currentFile && (
        <div className="text-xs text-gray-400 mt-1 truncate">{progress.currentFile}</div>
      )}

      {/* PII findings — inline chips */}
      {progress.findings.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(
            progress.findings.reduce((acc, f) => ({ ...acc, [f.category]: (acc[f.category] || 0) + 1 }), {} as Record<string, number>)
          ).map(([cat, count]) => (
            <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
              {MOCK_CATEGORIES[cat]} {count}
            </span>
          ))}
        </div>
      )}

      {progress.stage === 'done' && (
        <div className="text-xs text-green-600 dark:text-green-400 mt-2">
          ✓ Complete — {progress.findings.length} PII detections across {progress.totalFiles} files
        </div>
      )}
    </div>
  );
}

// ─── Variant C — Floating card with live PII feed ───

function VariantC({ progress }: { progress: ScanProgress }) {
  const [collapsed, setCollapsed] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const pct = Math.round((progress.filesProcessed / progress.totalFiles) * 100);

  useEffect(() => {
    if (feedRef.current) {
      requestAnimationFrame(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      });
    }
  }, [progress.findings.length]);

  return (
    <div className={`fixed bottom-20 right-4 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl text-sm overflow-hidden transition-all ${collapsed ? 'h-12' : 'h-96'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-500">🛡️</span>
          <span className="font-medium text-xs">
            {progress.stage === 'done' ? 'Scan complete' : 'Scanning...'}
          </span>
        </div>
        <span className="text-xs text-gray-400">{pct}%</span>
      </div>

      {!collapsed && (
        <div className="flex flex-col h-full">
          {/* Progress bar */}
          <div className="px-3 pt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{progress.filesProcessed}/{progress.totalFiles} files</span>
              <span>{progress.currentFile?.split('/').pop()}</span>
            </div>
          </div>

          {/* Live PII feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-2">
            {progress.findings.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No PII detected yet...</div>
            ) : (
              <div className="flex flex-col gap-1">
                {progress.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span className="mt-0.5">{MOCK_CATEGORIES[f.category] || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{f.category}</div>
                      <div className="text-gray-400 truncate">{f.file}:{f.line}</div>
                    </div>
                    <span className="text-gray-300">{f.maskedValue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary footer */}
          {progress.findings.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(
                  progress.findings.reduce((acc, f) => ({ ...acc, [f.category]: (acc[f.category] || 0) + 1 }), {} as Record<string, number>)
                ).map(([cat, count]) => (
                  <span key={cat} className="text-xs text-gray-500">
                    {MOCK_CATEGORIES[cat]} {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Switcher ───

export default function ScanProgressPanelPrototype() {
  const params = new URLSearchParams(window.location.search);
  const [variant, setVariant] = useState<string>(params.get('variant') || 'A');
  const progress = useMockScan();

  const variants = ['A', 'B', 'C'] as const;
  type Variant = typeof variants[number];
  const names: Record<Variant, string> = { A: 'Compact sidebar', B: 'Stage pipeline banner', C: 'Floating card' };
  const currentIdx = variants.indexOf(variant as Variant);

  const navigate = (v: Variant) => {
    window.history.replaceState(null, '', `?variant=${v}`);
    setVariant(v);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Simulated app area */}
      <div className="flex h-screen">
        {/* Simulated file tree */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">EXPLORER</div>
          {MOCK_FILES.map(f => (
            <div key={f} className={`text-xs py-0.5 px-2 rounded ${f === progress.currentFile ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}>
              {f}
            </div>
          ))}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Variant B renders here (top banner) */}
          {variant === 'B' && <VariantB progress={progress} />}

          {/* Simulated chat area */}
          <div className="flex-1 p-8 text-center text-gray-400">
            <div className="text-lg mb-2">Workspace: ~/project</div>
            <div className="text-sm">Open a folder to start scanning for PII</div>
          </div>
        </div>

        {/* Variant A renders here (sidebar) */}
        {variant === 'A' && <VariantA progress={progress} />}
      </div>

      {/* Variant C renders here (floating card) */}
      {variant === 'C' && <VariantC progress={progress} />}

      {/* Floating switcher bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-lg text-xs font-medium z-50">
        <button
          onClick={() => navigate(variants[(currentIdx - 1 + 3) % 3])}
          className="hover:opacity-70"
        >
          ←
        </button>
        <span>{variant} — {names[variant as typeof variants[number]]}</span>
        <button
          onClick={() => navigate(variants[(currentIdx + 1) % 3])}
          className="hover:opacity-70"
        >
          →
        </button>
      </div>
    </div>
  );
}
