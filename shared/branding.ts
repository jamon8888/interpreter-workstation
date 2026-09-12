export const ACTIVE_BRAND = {
  id: 'hacienda',
  appName: 'Hacienda',
  accent: '#111111',
  accentForeground: '#ffffff',
  logoColor: '#202123',
  // The name this product shipped under before the rename. `userData` is
  // derived from the app name, so an existing install's directory still
  // carries it and has to be found by it once. See
  // `electron/utils/userDataMigration.ts`.
  legacyAppName: 'Interpreter',
} as const;
