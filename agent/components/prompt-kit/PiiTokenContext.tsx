/**
 * Resolution context for chat redaction tokens (#164).
 *
 * The chat renders inside a different component tree from the composer, so the
 * composer's in-memory session map is not reachable from here. It does not
 * need to be: since #162 the send seam persists the thread's whole map to the
 * vault, so the vault is authoritative for anything the model was actually
 * sent. One decrypt per thread, cached, rather than one per token.
 *
 * Resolution is render-only. Nothing here writes to the transcript.
 */

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import { pii } from '@/ipc';
import { threadVaultDocId } from '@/lib/pii/vaultScope';

/**
 * Why three outcomes rather than "resolved or not":
 *
 * A token missing from a map that exists is permanently unrecoverable — the
 * original was never stored. A thread with no map at all is a different thing:
 * the first turn of a conversation is persisted only once the thread has an id
 * (see #162), so its tokens are briefly absent from the vault while being
 * perfectly recoverable. Calling that permanent would tell the reader
 * something false about their own data.
 */
export type PiiResolution =
  | { state: 'resolved'; original: string }
  | { state: 'unrestorable' }
  | { state: 'unavailable' };

export interface PiiRehydrationContextValue {
  resolve(token: string): Promise<PiiResolution>;
  /** Absent outside a thread — the token still renders, it just cannot resolve. */
  threadId: string | null;
}

const PiiRehydrationContext = createContext<PiiRehydrationContextValue | null>(null);

export function usePiiRehydration(): PiiRehydrationContextValue | null {
  return useContext(PiiRehydrationContext);
}

export function PiiRehydrationProvider({
  threadId,
  children,
}: {
  threadId: string | null;
  children: ReactNode;
}) {
  // Cache the thread's decrypted map for the lifetime of this provider: a
  // message full of tokens must not mean a vault round trip per token.
  const mapRef = useRef<{ threadId: string | null; map: Promise<Record<string, string>> | null }>({
    threadId: null,
    map: null,
  });

  const loadMap = useCallback((): Promise<Record<string, string>> | null => {
    if (!threadId) return null;
    if (mapRef.current.threadId !== threadId || !mapRef.current.map) {
      mapRef.current = {
        threadId,
        map: pii.decryptRehydration(threadVaultDocId(threadId)),
      };
    }
    return mapRef.current.map;
  }, [threadId]);

  const resolve = useCallback(async (token: string): Promise<PiiResolution> => {
    const pending = loadMap();
    if (!pending) return { state: 'unavailable' };
    let map: Record<string, string>;
    try {
      map = await pending;
    } catch {
      // No blob for this thread yet, or it could not be opened. Either way the
      // honest answer is "not available", not "gone forever".
      mapRef.current = { threadId: null, map: null };
      return { state: 'unavailable' };
    }
    const original = map[token];
    // The map exists and does not hold this token: nothing was ever stored for
    // it, and nothing ever will be.
    return original ? { state: 'resolved', original } : { state: 'unrestorable' };
  }, [loadMap]);

  const value = useMemo<PiiRehydrationContextValue>(
    () => ({ resolve, threadId }),
    [resolve, threadId],
  );

  return (
    <PiiRehydrationContext.Provider value={value}>
      {children}
    </PiiRehydrationContext.Provider>
  );
}
