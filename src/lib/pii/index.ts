export { PII_COLORS, getPiiColor, getAllPiiCategories } from './colors';
export { detectRegex } from './regex-detector';
export type { PiiDetection } from './regex-detector';
export { needsRedactionForProvider, shouldBlockAttachmentSend } from './redaction';
export {
  buildPiiLabelAttributes,
  buildRedactedText,
  findRedactedTokens,
  mergeDetections,
  normalizePiiCategory,
  tokenLabelForCategory,
} from './labels';
export type { RedactedToken } from './labels';
/** Document ID prefix for per-thread vault rehydration maps. */
export { threadVaultDocId } from './vaultScope';
