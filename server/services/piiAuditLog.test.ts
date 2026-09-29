import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PII_AUDIT_LOG_MAX_BYTES,
  recordPiiReveal,
  resolvePiiAuditLogPath,
} from './piiAuditLog';

const dirs: string[] = [];

function makeUserDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pii-audit-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function readLines(logPath: string): unknown[] {
  return fs.readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('recordPiiReveal', () => {
  test('appends one JSON line per reveal, never the decrypted value', () => {
    const dir = makeUserDataDir();
    recordPiiReveal(
      { scope: 'doc-1', scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' },
      dir,
    );

    const logPath = resolvePiiAuditLogPath(dir);
    const [record] = readLines(logPath) as Array<Record<string, unknown>>;

    expect(record).toMatchObject({
      scope: 'doc-1',
      scopeType: 'document',
      token: '[EMAIL_0]',
      category: 'email',
      surface: 'viewer',
    });
    expect(typeof record.timestamp).toBe('string');
    expect(new Date(record.timestamp as string).toString()).not.toBe('Invalid Date');
    // The whole point of the trail: nothing here can reconstruct what was
    // revealed, only that it was.
    expect(JSON.stringify(record)).not.toContain('@example.com');
    expect(Object.keys(record).sort()).toEqual(
      ['category', 'scope', 'scopeType', 'surface', 'timestamp', 'token'],
    );
  });

  test('accumulates entries across multiple reveals', () => {
    const dir = makeUserDataDir();
    recordPiiReveal({ scope: 'doc-1', scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' }, dir);
    recordPiiReveal({ scope: 'doc-1', scopeType: 'document', token: '[PHONE_0]', category: 'phone', surface: 'viewer' }, dir);

    const lines = readLines(resolvePiiAuditLogPath(dir)) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.token)).toEqual(['[EMAIL_0]', '[PHONE_0]']);
  });

  test('rotates to a single backup once the log crosses the size bound', () => {
    const dir = makeUserDataDir();
    const logPath = resolvePiiAuditLogPath(dir);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    // Seed a file already past the bound rather than writing millions of real
    // entries: rotation only cares about size, not content.
    fs.writeFileSync(logPath, 'x'.repeat(PII_AUDIT_LOG_MAX_BYTES + 1));

    recordPiiReveal({ scope: 'doc-1', scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' }, dir);

    expect(fs.existsSync(`${logPath}.1`)).toBe(true);
    expect(fs.statSync(`${logPath}.1`).size).toBeGreaterThan(PII_AUDIT_LOG_MAX_BYTES);
    // The new file holds only the reveal that triggered rotation.
    const lines = readLines(logPath);
    expect(lines).toHaveLength(1);
  });

  test('overwrites the previous backup rather than keeping generations', () => {
    const dir = makeUserDataDir();
    const logPath = resolvePiiAuditLogPath(dir);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(`${logPath}.1`, 'stale backup content');
    fs.writeFileSync(logPath, 'x'.repeat(PII_AUDIT_LOG_MAX_BYTES + 1));

    recordPiiReveal({ scope: 'doc-1', scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' }, dir);

    expect(fs.readFileSync(`${logPath}.1`, 'utf8')).not.toBe('stale backup content');
  });

  test('never throws, even when the directory cannot be created', () => {
    // A file where a directory is expected makes mkdirSync fail.
    const dir = makeUserDataDir();
    const blockedPath = path.join(dir, 'blocked');
    fs.writeFileSync(blockedPath, '');

    expect(() => recordPiiReveal(
      { scope: 'doc-1', scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' },
      blockedPath,
    )).not.toThrow();
  });

  test('clips an oversized field instead of writing it unbounded', () => {
    const dir = makeUserDataDir();
    const huge = 'a'.repeat(10_000);
    recordPiiReveal({ scope: huge, scopeType: 'document', token: '[EMAIL_0]', category: 'email', surface: 'viewer' }, dir);

    const [record] = readLines(resolvePiiAuditLogPath(dir)) as Array<Record<string, string>>;
    expect(record.scope.length).toBeLessThan(huge.length);
  });
});
