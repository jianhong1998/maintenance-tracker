import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Dialog } from './dialog';

describe('Dialog', () => {
  it('renders children and title when open is true', () => {
    render(
      <Dialog
        open={true}
        onOpenChange={vi.fn()}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('renders nothing when open is false', () => {
    render(
      <Dialog
        open={false}
        onOpenChange={vi.fn()}
        title="Test Dialog"
      >
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.queryByText('Dialog content')).not.toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Escape key is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test Dialog"
      >
        <p>content</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the overlay is clicked', () => {
    // Radix DismissableLayer registers its pointerdown listener after a setTimeout(0).
    // Use fake timers so we can advance the clock and activate the listener before dispatching.
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test"
      >
        <p>content</p>
      </Dialog>,
    );
    // Advance fake timers to trigger Radix's deferred listener registration.
    act(() => {
      vi.runAllTimers();
    });
    const overlay = document.querySelector('[data-radix-dialog-overlay]');
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!);
    vi.useRealTimers();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses aria-labelledby pointing to the h2 title element', () => {
    render(
      <Dialog
        open={true}
        onOpenChange={vi.fn()}
        title="My Dialog"
      >
        <p>content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const titleEl = document.getElementById(labelledById!);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe('My Dialog');
  });
});
