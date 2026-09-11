import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../../tests/helpers/render';
import { resetAllStores } from '../../../tests/helpers/store';
import AboutTab from './AboutTab';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('AboutTab', () => {
  it('renders a concise About paragraph and the version', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.getByText(/Plan trips, organize reservations/i)).toBeInTheDocument();
    expect(screen.getByText('Version 2.9.10')).toBeInTheDocument();
  });

  it('provides one Contact us link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Contact us').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/liketrek/TREK/issues/new/choose');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not show the removed community and donation links', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.queryByText('Ko-fi')).toBeNull();
    expect(screen.queryByText('Buy Me a Coffee')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
    expect(screen.queryByText('Report a Bug')).toBeNull();
    expect(screen.queryByText('Feature Request')).toBeNull();
    expect(screen.queryByText('Wiki')).toBeNull();
  });

  it('highlights the Contact us link on hover', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Contact us').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(37, 99, 235)');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
  });
});
