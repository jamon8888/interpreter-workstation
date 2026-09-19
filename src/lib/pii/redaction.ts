/**
 * Only on-device `local` models skip redaction: the provider string is a
 * coarse label, and `mistral` covers both local weights and the remote API.
 * Trusting the label would let raw bytes reach a distant model (#232).
 * Unknown fails closed: redact and notify.
 */
const TRUSTED_PROVIDERS = new Set(['local']);

export function needsRedactionForProvider(
  provider: string | null | undefined,
): boolean {
  if (!provider) return true;
  return !TRUSTED_PROVIDERS.has(provider.toLowerCase());
}

/**
 * Fail-closed send policy: attachment payloads must never ride on the
 * regex-only fallback. Text-only turns keep the existing fallback so a
 * redaction outage degrades instead of blocking chat.
 */
export function shouldBlockAttachmentSend(options: {
  hasAttachmentPayload: boolean;
  nerFailed: boolean;
}): boolean {
  return options.hasAttachmentPayload && options.nerFailed;
}
