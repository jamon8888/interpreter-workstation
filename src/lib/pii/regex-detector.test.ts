import { describe, expect, test } from 'bun:test';

import { detectRegex } from './regex-detector';

describe('detectRegex', () => {
  test('detects IBANs, compact and space-grouped', () => {
    // `iban` has a colour, a token label and normalization tests, but no
    // pattern produced one, so the category could never fire. With NER
    // detection unavailable the regex pass is the only thing running.
    expect(detectRegex('Virement vers FR7630006000011234567890189 demain'))
      .toEqual([
        { category: 'iban', start: 14, end: 41, text: 'FR7630006000011234567890189', confidence: 1.0 },
      ]);

    const grouped = detectRegex('IBAN: DE89 3704 0044 0532 0130 00');
    expect(grouped).toHaveLength(1);
    expect(grouped[0].category).toBe('iban');
    expect(grouped[0].text).toBe('DE89 3704 0044 0532 0130 00');
  });

  test('does not report the digits inside an IBAN as a phone number', () => {
    // The IBAN pattern runs before the digit-based ones so their
    // alreadyCovered guards skip digits that belong to it.
    const found = detectRegex('FR7630006000011234567890189');
    expect(found.map((d) => d.category)).toEqual(['iban']);
  });

  test('keeps adjacent detections of different categories apart', () => {
    // The merge condition used to join anything within one character, so an
    // email followed by a space and a phone number collapsed into a single
    // email detection covering both — and rehydrated under one [EMAIL_n].
    const found = detectRegex('a@b.com 555-010-0200');
    expect(found.map((d) => [d.category, d.text])).toEqual([
      ['email', 'a@b.com'],
      ['phone', '555-010-0200'],
    ]);
  });

  test('still detects cards and IPv4 addresses', () => {
    expect(detectRegex('4111 1111 1111 1111')[0].category).toBe('credit_card');
    expect(detectRegex('host 192.168.1.10')[0].category).toBe('ipv4');
  });
});
