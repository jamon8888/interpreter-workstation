/**
 * remarkPiiTokens (#164)
 *
 * Decorates redaction tokens (`[EMAIL_0]`, `[NAME_1]`, …) in chat markdown so
 * the reader sees a labelled placeholder instead of raw bracket text, and can
 * click it to ask for the original.
 *
 * Render-only: the stored transcript is never rewritten. What the model was
 * sent stays what the transcript holds; resolution happens at paint time and
 * leaves nothing behind — the same doctrine the document viewer follows.
 *
 * Matching is by pattern, not by a known map, which is the one substantive
 * difference from `remarkPastedContentTokens` next door. A token whose
 * original cannot be recovered still has to render as a token carrying the
 * unrestorable marker; matching only known tokens would render exactly those
 * as plain text and leave the gap invisible.
 */

import { findRedactedTokens, normalizePiiCategory } from '../../../src/lib/pii/labels';

/**
 * Parents whose text is markup or already decorated. Mirrors the exclusion
 * set `remarkPastedContentTokens` uses, plus our own node type so a second
 * pass cannot nest tokens inside tokens.
 */
const EXCLUDED_PARENT_TYPES = new Set([
  'link',
  'linkReference',
  'fileLink',
  'skillLink',
  'wikilink',
  'inlineCode',
  'code',
  'pastedContent',
  'piiToken',
]);

function createPiiTokenNode(token: string, category: string): Record<string, unknown> {
  return {
    type: 'piiToken',
    data: {
      hName: 'pii-token',
      hProperties: {
        'data-pii-token': token,
        'data-pii-category': normalizePiiCategory(category),
      },
    },
    children: [],
  };
}

function splitTextIntoNodes(value: string): Record<string, unknown>[] {
  const matches = findRedactedTokens(value);
  if (matches.length === 0) {
    return [{ type: 'text', value }];
  }

  const nodes: Record<string, unknown>[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, match.start) });
    }
    nodes.push(createPiiTokenNode(match.token, match.category));
    cursor = match.end;
  }
  if (cursor < value.length) {
    nodes.push({ type: 'text', value: value.slice(cursor) });
  }
  return nodes;
}

function transformTextChildren(parent: any): void {
  if (!Array.isArray(parent?.children)) return;
  if (EXCLUDED_PARENT_TYPES.has(parent.type)) return;

  const nextChildren: any[] = [];
  for (const child of parent.children) {
    if (child?.type === 'text' && typeof child.value === 'string') {
      nextChildren.push(...splitTextIntoNodes(child.value));
      continue;
    }
    transformTextChildren(child);
    nextChildren.push(child);
  }
  parent.children = nextChildren;
}

export const remarkPiiTokens = () => {
  return (tree: any) => {
    transformTextChildren(tree);
  };
};
