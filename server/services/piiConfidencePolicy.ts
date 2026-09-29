/**
 * Confidence policy for NER-detected PII spans.
 *
 * `detectPii` used a single flat cutoff (default 0, meaning "keep
 * everything") applied to every category alike. That treats a borderline
 * IBAN guess the same as a borderline name guess, when the two carry very
 * different risk: IBAN and credit-card numbers are pattern-shaped and are
 * already caught by the regex net (`src/lib/pii/regex-detector.ts`), so NER
 * only needs to confirm them — a strict bar that drops a weak NER match still
 * leaves the regex match standing. Person names have no such net: a dropped
 * span there is a real gap, so the bar sits lower, trading some false
 * positives for fewer silent misses.
 *
 * A dropped span is never a blocking failure. `shouldBlockAttachmentSend`
 * (src/lib/pii/redaction.ts) fails closed only when NER did not run at all;
 * this policy only narrows what a NER run reports back, the same way a human
 * reviewer would discount a low-confidence guess without refusing to send.
 */

import { normalizePiiCategory } from '../../src/lib/pii/labels';

/** Applies to every category without an explicit override below. */
export const DEFAULT_MIN_CONFIDENCE = 0.5;

/**
 * Per-category bars, keyed by the canonical category name
 * (`normalizePiiCategory` output) rather than whatever alias the detector
 * emitted, so `person`, `name` and `full_name` all resolve to the same bar.
 */
const CATEGORY_MIN_CONFIDENCE: Record<string, number> = {
  iban: 0.85,
  credit_card: 0.85,
  person_full_name: 0.6,
  person_first_name: 0.6,
  person_last_name: 0.6,
};

/**
 * Resolve the confidence bar a detection must clear to be kept.
 *
 * `override` is the caller-supplied `minConfidence` from the `detectPii` IPC
 * contract. It replaces the whole policy for the call rather than adjusting
 * one category: a caller asking for 0.9 is asking to be strict everywhere,
 * and a per-category floor surviving underneath that ask would silently
 * defeat it.
 */
export function resolveMinConfidence(category: string, override?: number): number {
  if (override !== undefined) return override;
  const normalized = normalizePiiCategory(category);
  return Object.prototype.hasOwnProperty.call(CATEGORY_MIN_CONFIDENCE, normalized)
    ? CATEGORY_MIN_CONFIDENCE[normalized]
    : DEFAULT_MIN_CONFIDENCE;
}
