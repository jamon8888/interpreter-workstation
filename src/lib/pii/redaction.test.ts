import { describe, expect, test } from 'bun:test';

import { needsRedactionForProvider, shouldBlockAttachmentSend } from './redaction';

describe('needsRedactionForProvider', () => {
  test('only on-device local providers are trusted', () => {
    expect(needsRedactionForProvider('local')).toBe(false);
    expect(needsRedactionForProvider('LOCAL')).toBe(false);
  });

  test('mistral label requires redaction (covers local weights and remote API)', () => {
    expect(needsRedactionForProvider('mistral')).toBe(true);
    expect(needsRedactionForProvider('Mistral')).toBe(true);
  });

  test('api and hosted providers require redaction', () => {
    expect(needsRedactionForProvider('api')).toBe(true);
    expect(needsRedactionForProvider('hosted')).toBe(true);
    expect(needsRedactionForProvider('openai-oauth')).toBe(true);
  });

  test('missing provider fails closed', () => {
    expect(needsRedactionForProvider(null)).toBe(true);
    expect(needsRedactionForProvider(undefined)).toBe(true);
    expect(needsRedactionForProvider('')).toBe(true);
  });
});

describe('shouldBlockAttachmentSend', () => {
  test('blocks attachment payloads when NER failed', () => {
    expect(shouldBlockAttachmentSend({ hasAttachmentPayload: true, nerFailed: true })).toBe(true);
  });

  test('allows text-only sends on regex fallback', () => {
    expect(shouldBlockAttachmentSend({ hasAttachmentPayload: false, nerFailed: true })).toBe(false);
  });

  test('allows attachments when NER succeeded', () => {
    expect(shouldBlockAttachmentSend({ hasAttachmentPayload: true, nerFailed: false })).toBe(false);
  });
});
