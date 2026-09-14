/**
 * Reveal audit trail (#165).
 *
 * A dedicated, local, append-only log — deliberately separate from
 * `server/telemetry.ts`. Nothing here reaches the network, checks a telemetry
 * opt-in, or is gated by one: a DPO auditing reveals must see every one, on
 * every install, whatever the analytics setting says.
 *
 * One line per successful reveal: timestamp, the scope it was revealed in
 * (a vault doc id today; a thread id once the composer/chat surfaces land),
 * the token, its category, and which surface asked. Never the decrypted
 * original — an audit trail that stored what it audits would defeat the
 * pseudonymization it is meant to hold accountable.
 *
 * Plain JSONL at a fixed path: local-readable and DPO-exportable by copying
 * the file, no export tooling required.
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolveUserDataDir } from './vault';

export type PiiRevealScopeType = 'document' | 'thread';
export type PiiRevealSurface = 'viewer' | 'composer' | 'chat';

export interface PiiRevealAuditEntry {
  scope: string;
  scopeType: PiiRevealScopeType;
  token: string;
  category: string;
  surface: PiiRevealSurface;
}

interface PiiRevealAuditRecord extends PiiRevealAuditEntry {
  timestamp: string;
}

export const PII_AUDIT_LOG_FILENAME = 'pii-audit.jsonl';

// A rotation bound fixed at build time, per the spec: this is an audit trail
// of a deliberate, occasional user action, not a high-volume log, so a single
// backup file is enough headroom without unbounded growth.
export const PII_AUDIT_LOG_MAX_BYTES = 5 * 1024 * 1024;

// Each logged field is attacker-adjacent (a category label, a scope id) but
// not designed for logging; capping length keeps one malformed reveal from
// writing an unbounded line rather than trusting every caller to do it.
const MAX_FIELD_LENGTH = 512;

function clip(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) : value;
}

export function resolvePiiAuditLogPath(userDataDir = resolveUserDataDir()): string {
  return path.join(userDataDir, PII_AUDIT_LOG_FILENAME);
}

function rotateIfNeeded(logPath: string): void {
  // eslint-disable-next-line no-useless-assignment -- initial value needed for try/catch scope
  let size = 0;
  try {
    size = fs.statSync(logPath).size;
  } catch {
    return; // No file yet: nothing to rotate.
  }
  if (size < PII_AUDIT_LOG_MAX_BYTES) return;
  // Single backup, overwritten each time: an audit trail of occasional reveals
  // does not need generational history, only a bound on disk growth.
  try {
    fs.renameSync(logPath, `${logPath}.1`);
  } catch {
    // If the rename fails the file keeps growing past the bound this once;
    // that is preferable to losing the reveal this call is about to record.
  }
}

/**
 * Append one reveal to the audit trail. Never throws: a reveal already
 * succeeded by the time this runs, and a logging failure must not be
 * mistaken for — or allowed to cause — a failed reveal.
 */
export function recordPiiReveal(entry: PiiRevealAuditEntry, userDataDir = resolveUserDataDir()): void {
  try {
    const record: PiiRevealAuditRecord = {
      timestamp: new Date().toISOString(),
      scope: clip(entry.scope),
      scopeType: entry.scopeType,
      token: clip(entry.token),
      category: clip(entry.category),
      surface: entry.surface,
    };
    const logPath = resolvePiiAuditLogPath(userDataDir);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    rotateIfNeeded(logPath);
    fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);
  } catch (error) {
    console.warn('[pii-audit] Failed to record a reveal:', error instanceof Error ? error.message : error);
  }
}
