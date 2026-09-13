import { describe, expect, test } from 'bun:test';

import { remarkPiiTokens } from './remarkPiiTokens';

function textNode(value: string) {
  return { type: 'text', value };
}

function paragraph(...children: unknown[]) {
  return { type: 'paragraph', children };
}

function run(tree: any): any {
  remarkPiiTokens()(tree);
  return tree;
}

describe('remarkPiiTokens', () => {
  test('replaces a token with a decorated node and keeps the text around it', () => {
    const tree = run({ type: 'root', children: [paragraph(textNode('Write to [EMAIL_0] today'))] });

    const children = tree.children[0].children;
    expect(children.map((c: any) => c.type)).toEqual(['text', 'piiToken', 'text']);
    expect(children[0].value).toBe('Write to ');
    expect(children[2].value).toBe(' today');
    expect(children[1].data.hName).toBe('pii-token');
    expect(children[1].data.hProperties['data-pii-token']).toBe('[EMAIL_0]');
  });

  test('carries the category, normalized to the canonical name', () => {
    const tree = run({ type: 'root', children: [paragraph(textNode('[CREDIT_CARD_0]'))] });
    expect(tree.children[0].children[0].data.hProperties['data-pii-category']).toBe('credit_card');
  });

  test('decorates a token it cannot resolve just the same', () => {
    // The plugin has no map: matching by pattern is what lets an unrecoverable
    // token still render as a token, carrying the unrestorable marker, instead
    // of silently reading as literal text.
    const tree = run({ type: 'root', children: [paragraph(textNode('[EMAIL_99]'))] });
    expect(tree.children[0].children[0].type).toBe('piiToken');
  });

  test('handles several tokens in one run of text', () => {
    const tree = run({ type: 'root', children: [paragraph(textNode('[EMAIL_0] and [PHONE_1]'))] });
    const types = tree.children[0].children.map((c: any) => c.type);
    expect(types).toEqual(['piiToken', 'text', 'piiToken']);
  });

  test('leaves code and links alone', () => {
    for (const type of ['inlineCode', 'code', 'link', 'wikilink', 'pastedContent']) {
      const tree = run({ type: 'root', children: [{ type, children: [textNode('[EMAIL_0]')] }] });
      expect(tree.children[0].children[0].type).toBe('text');
    }
  });

  test('does not re-enter a token it already produced', () => {
    const tree = run({ type: 'root', children: [paragraph(textNode('[EMAIL_0]'))] });
    run(tree);
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].type).toBe('piiToken');
  });

  test('leaves text with no token untouched, as a single node', () => {
    const tree = run({ type: 'root', children: [paragraph(textNode('nothing to see here'))] });
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0]).toEqual({ type: 'text', value: 'nothing to see here' });
  });

  test('reaches tokens nested under emphasis', () => {
    const tree = run({
      type: 'root',
      children: [paragraph({ type: 'emphasis', children: [textNode('[NAME_0]')] })],
    });
    expect(tree.children[0].children[0].children[0].type).toBe('piiToken');
  });
});
