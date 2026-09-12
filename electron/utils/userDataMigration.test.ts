import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { migrateUserDataDirectory, planUserDataMigration, type MigrationProbe } from './userDataMigration';

function probeFrom(dirs: Record<string, string[]>): MigrationProbe {
  return {
    exists: (dirPath) => Object.prototype.hasOwnProperty.call(dirs, dirPath),
    hasEntries: (dirPath) => (dirs[dirPath] ?? []).length > 0,
  };
}

describe('planUserDataMigration', () => {
  const base = { currentName: 'Hacienda', legacyName: 'Interpreter' };

  test('moves the previous directory when the current one is absent', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/data/Hacienda',
      probe: probeFrom({ '/data/Interpreter': ['config.json'] }),
    });
    expect(plan).toEqual({ action: 'move', from: '/data/Interpreter', to: '/data/Hacienda' });
  });

  test('pairs a suffixed build with its own predecessor', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/data/Hacienda Internal',
      probe: probeFrom({
        '/data/Interpreter Internal': ['config.json'],
        '/data/Interpreter': ['config.json'],
      }),
    });
    expect(plan).toEqual({
      action: 'move',
      from: '/data/Interpreter Internal',
      to: '/data/Hacienda Internal',
    });
  });

  test('refuses to overwrite a current directory that already holds data', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/data/Hacienda',
      probe: probeFrom({
        '/data/Interpreter': ['config.json'],
        '/data/Hacienda': ['config.json'],
      }),
    });
    expect(plan.action).toBe('none');
  });

  test('does nothing when there is no previous directory', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/data/Hacienda',
      probe: probeFrom({}),
    });
    expect(plan.action).toBe('none');
  });

  test('does nothing when the previous directory is empty', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/data/Hacienda',
      probe: probeFrom({ '/data/Interpreter': [] }),
    });
    expect(plan.action).toBe('none');
  });

  test('does nothing when the data directory is not named after the product', () => {
    const plan = planUserDataMigration({
      ...base,
      currentDir: '/tmp/explicit-override',
      probe: probeFrom({ '/data/Interpreter': ['config.json'] }),
    });
    expect(plan.action).toBe('none');
  });
});

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'userdata-migration-'));
  roots.push(root);
  return root;
}

describe('migrateUserDataDirectory', () => {
  const names = { currentName: 'Hacienda', legacyName: 'Interpreter' };

  test('declines when the current path is a symlink to a populated directory', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'Interpreter'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Interpreter', 'config.json'), '{}');
    const elsewhere = path.join(root, 'elsewhere');
    fs.mkdirSync(elsewhere, { recursive: true });
    fs.writeFileSync(path.join(elsewhere, 'keep.json'), 'keep');
    fs.symlinkSync(elsewhere, path.join(root, 'Hacienda'));

    const result = migrateUserDataDirectory({ ...names, currentDir: path.join(root, 'Hacienda') });

    expect(result.action).toBe('none');
    expect(fs.readFileSync(path.join(elsewhere, 'keep.json'), 'utf8')).toBe('keep');
  });

  test('replaces a symlink standing in for an empty current directory', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'Interpreter'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Interpreter', 'config.json'), '{}');
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    fs.symlinkSync(empty, path.join(root, 'Hacienda'));

    const result = migrateUserDataDirectory({ ...names, currentDir: path.join(root, 'Hacienda') });

    expect(result.action).toBe('move');
    expect(fs.readFileSync(path.join(root, 'Hacienda', 'config.json'), 'utf8')).toBe('{}');
  });

  test('carries the vault key across the rename', () => {
    const root = makeRoot();
    const legacy = path.join(root, 'Interpreter');
    fs.mkdirSync(path.join(legacy, 'vaults'), { recursive: true });
    fs.writeFileSync(path.join(legacy, 'vaults', '.vault-key.enc'), 'the-key');

    const result = migrateUserDataDirectory({ ...names, currentDir: path.join(root, 'Hacienda') });

    expect(result.action).toBe('move');
    expect(fs.readFileSync(path.join(root, 'Hacienda', 'vaults', '.vault-key.enc'), 'utf8')).toBe('the-key');
    expect(fs.existsSync(legacy)).toBe(false);
  });

  test('replaces an empty current directory left by a previous launch', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'Interpreter'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Interpreter', 'config.json'), '{}');
    fs.mkdirSync(path.join(root, 'Hacienda'), { recursive: true });

    const result = migrateUserDataDirectory({ ...names, currentDir: path.join(root, 'Hacienda') });

    expect(result.action).toBe('move');
    expect(fs.readFileSync(path.join(root, 'Hacienda', 'config.json'), 'utf8')).toBe('{}');
  });

  test('is idempotent: a second run finds nothing to do', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'Interpreter'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Interpreter', 'config.json'), '{}');
    const current = path.join(root, 'Hacienda');

    expect(migrateUserDataDirectory({ ...names, currentDir: current }).action).toBe('move');
    const second = migrateUserDataDirectory({ ...names, currentDir: current });

    expect(second.action).toBe('none');
    expect(fs.readFileSync(path.join(current, 'config.json'), 'utf8')).toBe('{}');
  });
});
