import { describe, expect, test } from 'bun:test';

import { piiSpansForText } from './PiiLabel';

describe('piiSpansForText', () => {
  test('view mode finds stored tokens with node-relative offsets', () => {
    const spans = piiSpansForText('Contact [EMAIL_0] today', 'view');
    expect(spans).toEqual([{ category: 'email', token: '[EMAIL_0]', from: 8, to: 17 }]);
  });

  test('view mode ignores non-token brackets', () => {
    expect(piiSpansForText('see [image: logo]', 'view')).toEqual([]);
  });

  test('compose mode finds live structured PII', () => {
    const spans = piiSpansForText('mail me at jane@example.com', 'compose');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('email');
    expect(spans[0].token).toBe('jane@example.com');
  });

  test('compose mode returns nothing for plain prose', () => {
    expect(piiSpansForText('The quick brown fox jumps.', 'compose')).toEqual([]);
  });

  test('view mode returns only stored tokens', () => {
    const spans = piiSpansForText('Mail [EMAIL_0] at john@example.com', 'view');
    expect(spans).toHaveLength(1);
    expect(spans[0].token).toBe('[EMAIL_0]');
    expect(spans[0].category).toBe('email');
  });

  test('compose mode merges existing tokens with new regex PII', () => {
    const spans = piiSpansForText('[EMAIL_0] and jane@example.com', 'compose');
    expect(spans.map((span) => span.token)).toEqual(['[EMAIL_0]', 'jane@example.com']);
    expect(spans.map((span) => span.from)).toEqual([0, '[EMAIL_0] and '.length]);
  });

  test('compose mode drops regex spans that overlap a token', () => {
    // Token text should never be re-labelled as cleartext PII.
    const spans = piiSpansForText('[EMAIL_0]', 'compose');
    expect(spans).toHaveLength(1);
    expect(spans[0].token).toBe('[EMAIL_0]');
  });
});
