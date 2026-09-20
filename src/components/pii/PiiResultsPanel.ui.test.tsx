import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { PiiResultsPanel, type PiiResult } from './PiiResultsPanel';

const SAMPLE_RESULTS: PiiResult[] = [
  { category: 'email', file: 'a.txt', line: 1, maskedValue: '[EMAIL_0]', originalValue: 'alice@example.com', confidence: 0.95 },
  { category: 'phone', file: 'a.txt', line: 5, maskedValue: '[PHONE_0]', originalValue: '555-1234', confidence: 0.88 },
  { category: 'email', file: 'b.txt', line: 10, maskedValue: '[EMAIL_1]', originalValue: 'bob@test.com', confidence: 0.92 },
];

describe('PiiResultsPanel', () => {
  test('shows empty state when no results', () => {
    render(<PiiResultsPanel results={[]} />);
    expect(screen.getByText(/No PII detected/)).toBeTruthy();
  });

  test('shows result count in header', () => {
    render(<PiiResultsPanel results={SAMPLE_RESULTS} />);
    expect(screen.getByText('3 PII findings')).toBeTruthy();
  });

  test('groups results by file', () => {
    render(<PiiResultsPanel results={SAMPLE_RESULTS} />);
    expect(screen.getByText('a.txt')).toBeTruthy();
    expect(screen.getByText('b.txt')).toBeTruthy();
  });

  test('filters by category when filter button clicked', () => {
    render(<PiiResultsPanel results={SAMPLE_RESULTS} />);
    // The filter button has text like "📱 Phone (1)"
    const phoneBtn = screen.getByRole('button', { name: /Phone/ });
    fireEvent.click(phoneBtn);
    // Only phone result should show
    expect(screen.getByText('[PHONE_0]')).toBeTruthy();
    expect(screen.queryByText('[EMAIL_0]')).toBeNull();
  });

  test('toggles originals visibility', () => {
    render(<PiiResultsPanel results={SAMPLE_RESULTS} />);
    // By default shows masked values
    expect(screen.getByText('[EMAIL_0]')).toBeTruthy();
    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    // Now shows originals
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  test('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PiiResultsPanel results={SAMPLE_RESULTS} onClose={onClose} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
