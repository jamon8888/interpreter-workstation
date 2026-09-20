import { useState, useMemo } from 'react';

export interface PiiResult {
  category: string;
  file: string;
  line: number;
  maskedValue: string;
  originalValue?: string;
  confidence: number;
}

interface PiiResultsPanelProps {
  results: PiiResult[];
  onClose?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  email: '📧',
  phone: '📱',
  person_full_name: '👤',
  person_first_name: '👤',
  person_last_name: '👤',
  iban: '🏦',
  credit_card: '💳',
  ip_address: '🌐',
  ipv4: '🌐',
  ipv6: '🌐',
  address: '📍',
  organization: '🏢',
};

const CATEGORY_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  person_full_name: 'Name',
  person_first_name: 'First Name',
  person_last_name: 'Last Name',
  iban: 'IBAN',
  credit_card: 'Credit Card',
  ip_address: 'IP Address',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  address: 'Address',
  organization: 'Organization',
};

export function PiiResultsPanel({ results, onClose }: PiiResultsPanelProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const [showOriginals, setShowOriginals] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(results.map((r) => r.category));
    return Array.from(cats).sort();
  }, [results]);

  const filtered = useMemo(() => {
    if (!filter) return results;
    return results.filter((r) => r.category === filter);
  }, [results, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PiiResult[]>();
    for (const r of filtered) {
      const existing = groups.get(r.file) ?? [];
      existing.push(r);
      groups.set(r.file, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (results.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No PII detected in this workspace.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
          {results.length} PII finding{results.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showOriginals}
              onChange={(e) => setShowOriginals(e.target.checked)}
              className="rounded"
            />
            Show originals
          </label>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        <button
          onClick={() => setFilter(null)}
          className={`px-2 py-0.5 text-xs rounded-full ${!filter ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          All ({results.length})
        </button>
        {categories.map((cat) => {
          const count = results.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? null : cat)}
              className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${filter === cat ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              {CATEGORY_ICONS[cat] ?? '•'} {CATEGORY_LABELS[cat] ?? cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Results grouped by file */}
      <div className="flex-1 overflow-y-auto">
        {grouped.map(([file, items]) => (
          <div key={file} className="border-b border-gray-100 dark:border-gray-800">
            <div className="px-4 py-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
              {file}
            </div>
            {items.map((item, i) => (
              <div key={i} className="px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <span className="text-gray-400 w-12 text-right">{item.line}</span>
                <span className="w-20 text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                <span className="flex-1 font-mono text-gray-700 dark:text-gray-300">
                  {showOriginals && item.originalValue ? item.originalValue : item.maskedValue}
                </span>
                <span className="text-gray-400">{Math.round(item.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
