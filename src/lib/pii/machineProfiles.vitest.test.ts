import { describe, expect, test } from 'vitest';

import { detectProfile, getProfile, getAllProfiles } from './machineProfiles';

describe('detectProfile', () => {
  test('returns constrained for low RAM without AVX2', () => {
    const result = detectProfile({ arch: 'x86_64', avx2: false, totalMemoryBytes: 4 * 1024 ** 3 });
    expect(result).toBe('constrained');
  });

  test('returns constrained for low RAM even with AVX2', () => {
    const result = detectProfile({ arch: 'x86_64', avx2: true, totalMemoryBytes: 4 * 1024 ** 3 });
    expect(result).toBe('constrained');
  });

  test('returns balanced for 8-16GB with AVX2', () => {
    const result = detectProfile({ arch: 'x86_64', avx2: true, totalMemoryBytes: 12 * 1024 ** 3 });
    expect(result).toBe('balanced');
  });

  test('returns full for 16GB+ with AVX2', () => {
    const result = detectProfile({ arch: 'x86_64', avx2: true, totalMemoryBytes: 32 * 1024 ** 3 });
    expect(result).toBe('full');
  });

  test('returns aarch64 for ARM64 regardless of RAM', () => {
    const result = detectProfile({ arch: 'aarch64', avx2: false, totalMemoryBytes: 4 * 1024 ** 3 });
    expect(result).toBe('aarch64');
  });

  test('returns aarch64 for arm64', () => {
    const result = detectProfile({ arch: 'arm64', avx2: false, totalMemoryBytes: 32 * 1024 ** 3 });
    expect(result).toBe('aarch64');
  });
});

describe('getProfile', () => {
  test('returns profile with expected fields', () => {
    const profile = getProfile('balanced');
    expect(profile.id).toBe('balanced');
    expect(profile.label).toBe('Balanced');
    expect(profile.nerEnabled).toBe(true);
    expect(profile.rerankerEnabled).toBe(false);
    expect(profile.embedMode).toBe('lightweight');
    expect(profile.redactionCategories.length).toBeGreaterThan(0);
  });

  test('constrained has NER disabled', () => {
    expect(getProfile('constrained').nerEnabled).toBe(false);
  });

  test('full has reranker enabled', () => {
    expect(getProfile('full').rerankerEnabled).toBe(true);
  });
});

describe('getAllProfiles', () => {
  test('returns all 4 profiles', () => {
    expect(getAllProfiles()).toHaveLength(4);
  });
});
