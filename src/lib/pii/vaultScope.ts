/**
 * How a vault blob is addressed, in one place.
 *
 * The writer is server-side (`rehydrationPersistence`, at the send seam) and a
 * reader is renderer-side (chat detokenization, #164). Both have to agree on
 * the key exactly, and a convention duplicated on either side of the IPC
 * boundary is a convention that drifts. `src/lib/pii` is the module the server
 * already imports from, so it is where the two can share one definition.
 */

/** Vault blob id for a thread's rehydration map; `sanitizeVaultDocId` accepts this shape. */
export function threadVaultDocId(threadKey: string): string {
  return `thread-${threadKey}`;
}
