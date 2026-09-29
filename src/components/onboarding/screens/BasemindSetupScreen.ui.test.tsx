import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { OnboardingProvider } from '../OnboardingContext';
import { BasemindSetupScreen } from './BasemindSetupScreen';

const ipcMocks = vi.hoisted(() => ({
  download: vi.fn(),
  cpuFeatures: vi.fn(),
  getRerankerDefault: vi.fn(),
  getStaleRerankerCache: vi.fn(),
  clearStaleRerankerCache: vi.fn(),
}));

vi.mock('../../../ipc', () => ({
  basemind: {
    download: ipcMocks.download,
    cpuFeatures: ipcMocks.cpuFeatures,
    getStaleRerankerCache: ipcMocks.getStaleRerankerCache,
    clearStaleRerankerCache: ipcMocks.clearStaleRerankerCache,
  },
  search: {
    getRerankerDefault: ipcMocks.getRerankerDefault,
    setRerankerEnabled: vi.fn(),
  },
}));

function renderScreen() {
  render(
    <OnboardingProvider totalSteps={19}>
      <BasemindSetupScreen onNext={vi.fn()} />
    </OnboardingProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  ipcMocks.cpuFeatures.mockResolvedValue({ arch: 'x86_64', avx2: true, avx: true, sse4_1: true, sse4_2: true, neon: false, noavx2Build: false });
  ipcMocks.getRerankerDefault.mockResolvedValue({ enabled: true });
  ipcMocks.download.mockResolvedValue({ stages: [], success: true });
});

const STALE_TEXT = '1.1 GB of previous reranker';

describe('BasemindSetupScreen stale reranker notice', () => {
  test('offers to free the previous reranker when stale weights exist', async () => {
    ipcMocks.getStaleRerankerCache.mockResolvedValue({ bytes: 1_100_000_000 });
    ipcMocks.clearStaleRerankerCache.mockImplementationOnce(async () => {
      ipcMocks.getStaleRerankerCache.mockResolvedValue({ bytes: 0 });
      return { freedBytes: 1_100_000_000 };
    });
    renderScreen();

    expect(await screen.findByText(STALE_TEXT, { exact: false })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /free space/i }));
    expect(ipcMocks.clearStaleRerankerCache).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText(STALE_TEXT, { exact: false })).toBeNull();
    });
  });

  test('stays quiet without stale weights', async () => {
    ipcMocks.getStaleRerankerCache.mockResolvedValue({ bytes: 0 });
    renderScreen();
    await waitFor(() => {
      expect(ipcMocks.getStaleRerankerCache).toHaveBeenCalled();
    });
    expect(screen.queryByText(STALE_TEXT, { exact: false })).toBeNull();
  });
});
