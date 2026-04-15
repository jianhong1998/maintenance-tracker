import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('uses hover-pointer: (not plain hover:) on default variant', () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover-pointer:bg-primary/90');
    expect(btn.className).not.toContain('hover:bg-primary/90');
  });

  it('uses hover-pointer: (not plain hover:) on secondary variant', () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain(
      'hover-pointer:bg-[color:var(--bg-card-hover)]',
    );
    expect(btn.className).not.toContain(
      'hover:bg-[color:var(--bg-card-hover)]',
    );
  });

  it('uses hover-pointer: (not plain hover:) on secondary-destructive variant', () => {
    render(<Button variant="secondary-destructive">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover-pointer:bg-[#ff44440d]');
    expect(btn.className).not.toContain('hover:bg-[#ff44440d]');
  });

  it('uses hover-pointer: (not plain hover:) on dashed-ghost variant', () => {
    render(<Button variant="dashed-ghost">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover-pointer:bg-[#00e5ff08]');
    expect(btn.className).not.toContain('hover:bg-[#00e5ff08]');
  });

  it('uses hover-pointer: (not plain hover:) on destructive variant', () => {
    render(<Button variant="destructive">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover-pointer:bg-destructive/90');
    expect(btn.className).not.toContain('hover:bg-destructive/90');
  });

  it('uses hover-pointer: (not plain hover:) on outline variant', () => {
    render(<Button variant="outline">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain(
      'hover-pointer:bg-[color:var(--bg-card-hover)]',
    );
    expect(btn.className).not.toContain(
      'hover:bg-[color:var(--bg-card-hover)]',
    );
  });

  it('uses hover-pointer: (not plain hover:) on ghost variant', () => {
    render(<Button variant="ghost">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain(
      'hover-pointer:bg-[color:var(--bg-card-hover)]',
    );
    expect(btn.className).not.toContain(
      'hover:bg-[color:var(--bg-card-hover)]',
    );
  });

  it('uses hover-pointer: (not plain hover:) on link variant', () => {
    render(<Button variant="link">Click</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover-pointer:underline');
    expect(btn.className).not.toContain('hover:underline');
  });
});
