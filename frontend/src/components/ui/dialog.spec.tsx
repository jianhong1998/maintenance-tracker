import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('calls onOpenChange(false) when the backdrop is clicked', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test Dialog"
      >
        <p>content</p>
      </Dialog>,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call onOpenChange when clicking inside the dialog panel', () => {
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
    fireEvent.click(screen.getByRole('dialog'));
    expect(onOpenChange).not.toHaveBeenCalled();
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

  it('does not register Escape listener when closed', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={false}
        onOpenChange={onOpenChange}
        title="Test Dialog"
      >
        <p>content</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('uses aria-labelledby pointing to the heading instead of aria-label', () => {
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
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    expect(dialog).not.toHaveAttribute('aria-label');
    expect(document.getElementById('dialog-title')).toHaveTextContent(
      'My Dialog',
    );
  });
});
