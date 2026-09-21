/**
 * Machine profile detection and selection.
 *
 * Profiles determine which basemind models and features are enabled:
 *   - constrained: <8GB RAM or no AVX2 → regex-only PII, no reranker
 *   - balanced: 8-16GB + AVX2 → lightweight NER + regex, reranker off
 *   - full: 16GB+ + AVX2 → full NER + regex, reranker on
 *   - aarch64: ARM64 → lightweight NER + regex, reranker off
 */

export type MachineProfileId = 'constrained' | 'balanced' | 'full' | 'aarch64';

export interface MachineProfile {
  id: MachineProfileId;
  label: string;
  description: string;
  nerEnabled: boolean;
  rerankerEnabled: boolean;
  embedMode: 'lightweight' | 'full';
  redactionCategories: string[];
}

export interface HardwareInfo {
  arch: string;
  avx2: boolean;
  totalMemoryBytes: number;
}

const PROFILES: Record<MachineProfileId, MachineProfile> = {
  constrained: {
    id: 'constrained',
    label: 'Constrained',
    description: 'Regex-only PII detection, no reranker. For low-RAM or older machines.',
    nerEnabled: false,
    rerankerEnabled: false,
    embedMode: 'lightweight',
    redactionCategories: ['email', 'phone', 'ipv4', 'credit_card'],
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Lightweight NER + regex. Reranker off.',
    nerEnabled: true,
    rerankerEnabled: false,
    embedMode: 'lightweight',
    redactionCategories: ['email', 'phone', 'ipv4', 'credit_card', 'person_full_name', 'iban'],
  },
  full: {
    id: 'full',
    label: 'Full',
    description: 'Full NER + regex, reranker enabled. For powerful machines.',
    nerEnabled: true,
    rerankerEnabled: true,
    embedMode: 'full',
    redactionCategories: [
      'email', 'phone', 'ipv4', 'ipv6', 'credit_card',
      'person_full_name', 'person_first_name', 'person_last_name',
      'iban', 'address', 'organization',
    ],
  },
  aarch64: {
    id: 'aarch64',
    label: 'ARM64',
    description: 'Optimized for ARM64. Lightweight NER + regex. Reranker off.',
    nerEnabled: true,
    rerankerEnabled: false,
    embedMode: 'lightweight',
    redactionCategories: ['email', 'phone', 'ipv4', 'credit_card', 'person_full_name', 'iban'],
  },
};

const RAM_GB = 1024 * 1024 * 1024;

const RAM_THRESHOLDS = {
  balanced: 8 * RAM_GB,
  full: 16 * RAM_GB,
};

export function detectProfile(hardware: HardwareInfo): MachineProfileId {
  if (hardware.arch === 'aarch64' || hardware.arch === 'arm64') {
    return 'aarch64';
  }
  if (!hardware.avx2 || hardware.totalMemoryBytes < RAM_THRESHOLDS.balanced) {
    return 'constrained';
  }
  if (hardware.totalMemoryBytes >= RAM_THRESHOLDS.full) {
    return 'full';
  }
  return 'balanced';
}

export function getProfile(id: MachineProfileId): MachineProfile {
  return PROFILES[id];
}

export function getAllProfiles(): MachineProfile[] {
  return Object.values(PROFILES);
}
