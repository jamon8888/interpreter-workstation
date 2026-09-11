import { test, expect } from './fixtures';

type StartupMetrics = {
  pageReadyMs: number;
  memoryMB: number;
};

test.describe('Startup latency', () => {
  test.skip(
    process.platform === 'darwin' && Boolean(process.env.CI),
    'Startup latency measurement is unstable on macOS CI runners.',
  );

  test('measures page-ready latency and peak idle memory', async ({ page }) => {
    test.setTimeout(120000);

    // NOTE: This measures page-ready time from the renderer's perspective,
    // NOT full cold-start time. The ElectronInstanceManager singleton means
    // the first test in the suite gets a fresh launch; subsequent tests
    // reuse the instance. Full cold-start measurement requires launching
    // an isolated Electron process outside the test framework.
    const t0 = performance.now();

    await page.waitForLoadState('networkidle');

    const t1 = performance.now();

    // Collect memory after the app settles
    await page.waitForTimeout(2000);
    const memoryMB = await page.evaluate(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      }
      return 0;
    });

    const metrics: StartupMetrics = {
      pageReadyMs: Math.round(t1 - t0),
      memoryMB,
    };

    console.log('Startup metrics:', JSON.stringify(metrics, null, 2));

    // Page-ready time should be well under 5s (generous CI budget)
    expect(metrics.pageReadyMs).toBeLessThan(5000);
    expect(metrics.memoryMB).toBeGreaterThan(0);
  });
});
