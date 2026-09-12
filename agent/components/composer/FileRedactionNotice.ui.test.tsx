import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) =>
      options?.provider
        ? `Files will be redacted before sending to ${options.provider} via basemind`
        : key,
  }),
}));

import { FileRedactionNotice } from './FileRedactionNotice';

describe('FileRedactionNotice', () => {
  test('warns with provider name when attachments are staged on an API provider', () => {
    render(<FileRedactionNotice modelProvider="api" hasAttachments />);
    expect(
      screen.getByText('Files will be redacted before sending to api via basemind'),
    ).toBeVisible();
  });

  test('warns that reversibility ends with the session when the vault refused the write', () => {
    render(
      <FileRedactionNotice modelProvider="api" hasAttachments={false} rehydrationStorage="session-only" />,
    );
    expect(screen.getByText('basemind.pii.sessionOnlyRehydration')).toBeVisible();
  });

  test('shows the session-only warning even with no attachments staged', () => {
    // It is about tokens already sent, so it must outlive the staged files
    // that gate the redaction notice.
    const { container } = render(
      <FileRedactionNotice modelProvider="local" hasAttachments={false} rehydrationStorage="session-only" />,
    );
    expect(container).not.toBeEmptyDOMElement();
  });

  test('stays quiet once the map reached the vault', () => {
    const { container } = render(
      <FileRedactionNotice modelProvider="api" hasAttachments={false} rehydrationStorage="persisted" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('stays hidden without attachments', () => {
    const { container } = render(
      <FileRedactionNotice modelProvider="api" hasAttachments={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('stays hidden on trusted providers', () => {
    for (const provider of ['mistral', 'local']) {
      const { container } = render(
        <FileRedactionNotice modelProvider={provider} hasAttachments />,
      );
      expect(container).toBeEmptyDOMElement();
    }
  });

  test('fails closed when the provider is unknown', () => {
    render(<FileRedactionNotice modelProvider={null} hasAttachments />);
    expect(
      screen.getByText('Files will be redacted before sending to the model via basemind'),
    ).toBeVisible();
  });
});
