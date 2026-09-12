import { describe, expect, test } from 'bun:test';

import {
  archiveThreadForHistory,
  listAllThreadIds,
  listAllThreadIdsForDeletion,
  renameThread,
  trashThread,
  unarchiveThreadForHistory,
} from '../handlers/agentThreads';
import {
  applyFileReadRedaction,
  clearRuntimeRehydrationMaps,
  getRuntimeRehydrationMap,
} from '../services/runtimeRedaction';

describe('agent thread handlers', () => {
  test('pages through every cursor when listing threads', async () => {
    const service = {
      listThreads: async (params?: { archived?: boolean; cursor?: string | null }) => {
        if (params?.archived) {
          throw new Error('expected visible thread listing only');
        }

        if (!params?.cursor) {
          return {
            data: [{ id: 'thread-1' }, { id: 'thread-2' }],
            nextCursor: 'cursor-2',
          };
        }

        if (params.cursor === 'cursor-2') {
          return {
            data: [{ id: 'thread-3' }],
            nextCursor: null,
          };
        }

        throw new Error(`unexpected cursor ${params.cursor}`);
      },
    };

    await expect(
      listAllThreadIds(service, {
        archived: false,
        modelProviders: [],
        sortKey: 'updated_at',
        sourceKinds: ['vscode', 'appServer'],
      }),
    ).resolves.toEqual(['thread-1', 'thread-2', 'thread-3']);
  });

  test('collects visible and hidden thread pages without duplicates', async () => {
    const service = {
      listThreads: async (params?: { archived?: boolean; cursor?: string | null }) => {
        if (params?.archived) {
          if (!params.cursor) {
            return {
              data: [{ id: 'thread-hidden-1' }, { id: 'thread-shared' }],
              nextCursor: 'hidden-cursor-2',
            };
          }

          if (params.cursor === 'hidden-cursor-2') {
            return {
              data: [{ id: 'thread-hidden-2' }],
              nextCursor: null,
            };
          }
        } else if (!params?.cursor) {
          return {
            data: [{ id: 'thread-visible-1' }, { id: 'thread-shared' }],
            nextCursor: 'visible-cursor-2',
          };
        } else if (params.cursor === 'visible-cursor-2') {
          return {
            data: [{ id: 'thread-visible-2' }],
            nextCursor: null,
          };
        }

        throw new Error(
          `unexpected listThreads request archived=${String(params?.archived)} cursor=${params?.cursor ?? 'null'}`,
        );
      },
    };

    await expect(listAllThreadIdsForDeletion(service)).resolves.toEqual([
      'thread-visible-1',
      'thread-shared',
      'thread-visible-2',
      'thread-hidden-1',
      'thread-hidden-2',
    ]);
  });

  test('trashes the archived transcript path after archiving a thread', async () => {
    const readCalls: string[] = [];
    const archivedPaths: string[] = [];
    const service = {
      readThread: async (threadId: string) => {
        readCalls.push(threadId);
        const path = readCalls.length === 1
          ? '/sessions/thread-1.jsonl'
          : '/archived/thread-1.jsonl';
        return {
          id: threadId,
          preview: '',
          modelProvider: 'openai',
          createdAt: 0,
          updatedAt: 0,
          status: { type: 'idle' as const },
          path,
          cwd: '/workspace',
          cliVersion: '0.0.0',
          source: 'appServer' as const,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          turns: [],
        };
      },
      archiveThread: async () => {},
      unarchiveThread: async () => {
        throw new Error('should not unarchive on success');
      },
    };

    await trashThread('thread-1', {
      service,
      trashFileImpl: async (filePath: string) => {
        archivedPaths.push(filePath);
        return { success: true };
      },
    });

    expect(archivedPaths).toEqual(['/archived/thread-1.jsonl']);
  });

  test('unarchives the thread again if moving the archived transcript to trash fails', async () => {    const unarchivedThreadIds: string[] = [];
    const service = {
      readThread: async (threadId: string) => ({
        id: threadId,
        preview: '',
        modelProvider: 'openai',
        createdAt: 0,
        updatedAt: 0,
        status: { type: 'idle' as const },
        path: '/archived/thread-1.jsonl',
        cwd: '/workspace',
        cliVersion: '0.0.0',
        source: 'appServer' as const,
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: null,
        turns: [],
      }),
      archiveThread: async () => {},
      unarchiveThread: async (threadId: string) => {
        unarchivedThreadIds.push(threadId);
      },
    };

    await expect(trashThread('thread-1', {
      service,
      trashFileImpl: async () => ({ success: false, error: 'Permission denied' }),
    })).rejects.toThrow('Permission denied');

    expect(unarchivedThreadIds).toEqual(['thread-1']);
  });

  test('renames threads without changing blank names', async () => {
    const setNameCalls: Array<{ threadId: string; name: string }> = [];
    const service = {
      setThreadName: async (threadId: string, name: string) => {
        setNameCalls.push({ threadId, name });
      },
    };

    await expect(renameThread('thread-1', '  Project Alpha  ', { service })).resolves.toEqual({
      success: true,
      name: 'Project Alpha',
    });
    await expect(renameThread('thread-1', '   ', { service })).rejects.toThrow('Conversation name is required.');
    expect(setNameCalls).toEqual([{ threadId: 'thread-1', name: 'Project Alpha' }]);
  });

  test('archives and unarchives history threads without trashing files', async () => {
    const archiveCalls: string[] = [];
    const unarchiveCalls: string[] = [];

    await expect(archiveThreadForHistory('thread-1', {
      service: {
        archiveThread: async (threadId: string) => {
          archiveCalls.push(threadId);
        },
      },
    })).resolves.toEqual({ success: true });

    await expect(unarchiveThreadForHistory('thread-1', {
      service: {
        unarchiveThread: async (threadId: string) => {
          unarchiveCalls.push(threadId);
        },
      },
    })).resolves.toEqual({ success: true });

    expect(archiveCalls).toEqual(['thread-1']);
    expect(unarchiveCalls).toEqual(['thread-1']);
  });

  test('clears the thread rehydration map when trashing succeeds', async () => {
    clearRuntimeRehydrationMaps();
    await applyFileReadRedaction('mail john@example.com', { threadKey: 'thread-map-clear' }, {
      isNerReady: () => false,
      detectNer: async () => [],
    });
    expect(Object.keys(getRuntimeRehydrationMap('thread-map-clear')).length).toBeGreaterThan(0);

    const service = {
      readThread: async (threadId: string) => ({
        id: threadId,
        preview: '',
        modelProvider: 'openai',
        createdAt: 0,
        updatedAt: 0,
        status: { type: 'idle' as const },
        path: '/archived/thread-1.jsonl',
        cwd: '/workspace',
        cliVersion: '0.0.0',
        source: 'appServer' as const,
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: null,
        turns: [],
      }),
      archiveThread: async () => {},
      unarchiveThread: async () => {
        throw new Error('should not unarchive on success');
      },
    };

    await trashThread('thread-map-clear', {
      service,
      trashFileImpl: async () => ({ success: true }),
    });

    expect(getRuntimeRehydrationMap('thread-map-clear')).toEqual({});
  });

  test('keeps the thread rehydration map when trashing fails', async () => {
    clearRuntimeRehydrationMaps();
    await applyFileReadRedaction('mail john@example.com', { threadKey: 'thread-map-keep' }, {
      isNerReady: () => false,
      detectNer: async () => [],
    });
    expect(Object.keys(getRuntimeRehydrationMap('thread-map-keep')).length).toBeGreaterThan(0);

    const service = {
      readThread: async (threadId: string) => ({
        id: threadId,
        preview: '',
        modelProvider: 'openai',
        createdAt: 0,
        updatedAt: 0,
        status: { type: 'idle' as const },
        path: '/archived/thread-2.jsonl',
        cwd: '/workspace',
        cliVersion: '0.0.0',
        source: 'appServer' as const,
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: null,
        turns: [],
      }),
      archiveThread: async () => {},
      unarchiveThread: async () => {},
    };

    await expect(trashThread('thread-map-keep', {
      service,
      trashFileImpl: async () => ({ success: false, error: 'Permission denied' }),
    })).rejects.toThrow('Permission denied');

    expect(Object.keys(getRuntimeRehydrationMap('thread-map-keep')).length).toBeGreaterThan(0);
  });
});
