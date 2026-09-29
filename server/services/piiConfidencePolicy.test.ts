import { describe, expect, test } from 'bun:test';

import { DEFAULT_MIN_CONFIDENCE, resolveMinConfidence } from './piiConfidencePolicy';

describe('resolveMinConfidence', () => {
  test('applies the global default to a category with no override', () => {
    expect(resolveMinConfidence('email')).toBe(DEFAULT_MIN_CONFIDENCE);
    expect(resolveMinConfidence('organization')).toBe(DEFAULT_MIN_CONFIDENCE);
  });

  test('holds IBAN and credit-card numbers to a strict bar', () => {
    expect(resolveMinConfidence('iban')).toBe(0.85);
    expect(resolveMinConfidence('credit_card')).toBe(0.85);
    // Aliases normalize onto the same canonical category as the raw form.
    expect(resolveMinConfidence('creditcard')).toBe(0.85);
  });

  test('holds person names to a medium bar regardless of which name alias is used', () => {
    expect(resolveMinConfidence('person_full_name')).toBe(0.6);
    expect(resolveMinConfidence('person')).toBe(0.6);
    expect(resolveMinConfidence('name')).toBe(0.6);
    expect(resolveMinConfidence('firstname')).toBe(0.6);
  });

  test('an explicit override replaces the whole policy, not just the default', () => {
    // A caller asking for 0.9 is asking to be strict everywhere; a
    // category-specific floor surviving underneath it would defeat the ask.
    expect(resolveMinConfidence('iban', 0.9)).toBe(0.9);
    expect(resolveMinConfidence('person_full_name', 0.9)).toBe(0.9);
    // Equally, an explicit 0 (accept everything) must not be reinterpreted as
    // "no override given" by an `??` that only guards against `undefined`.
    expect(resolveMinConfidence('iban', 0)).toBe(0);
  });

  test('does not resolve a prototype property as a category threshold', () => {
    // The same class of bug that PII_COLORS and CATEGORY_ALIASES guard
    // against in labels.ts: an unrecognized category must not read back a
    // function off Object.prototype and silently pass every detection.
    expect(resolveMinConfidence('constructor')).toBe(DEFAULT_MIN_CONFIDENCE);
    expect(resolveMinConfidence('__proto__')).toBe(DEFAULT_MIN_CONFIDENCE);
  });
});
