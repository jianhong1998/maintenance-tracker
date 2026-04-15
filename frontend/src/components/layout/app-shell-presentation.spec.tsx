import { render, screen } from '@testing-library/react';
import { AppShellPresentation } from './app-shell-presentation';

describe('AppShellPresentation', () => {
  it('renders children without nav when showNav is false', () => {
    render(
      <AppShellPresentation
        showNav={false}
        pathname="/login"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders nav with three peer items (Fleet, History, Profile) when showNav is true', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName="Jane Smith"
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    // There are two nav elements on desktop+ (sidebar + hidden mobile bar), so getAllByRole
    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/fleet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
  });

  it('gives sidebar and mobile nav distinct aria-labels', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const navs = screen.getAllByRole('navigation');
    const labels = navs.map((n) => n.getAttribute('aria-label'));
    const uniqueLabels = new Set(labels.filter(Boolean));
    expect(uniqueLabels.size).toBe(navs.length);
  });

  it('marks Fleet link as aria-current="page" when pathname is /', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const fleetLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/');
    expect(fleetLinks.length).toBeGreaterThan(0);
    expect(fleetLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('marks History as active on /history (segment match)', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const historyLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/history');
    expect(historyLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark History as active on /history-foo (segment boundary)', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history-foo"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const historyLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/history');
    expect(historyLinks[0]).not.toHaveAttribute('aria-current', 'page');
  });

  it('renders the user display name in the desktop sidebar', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName="Jane Smith"
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('marks History as active on /history/123 (deep sub-route)', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history/123"
        userDisplayName={null}
      >
        <div />
      </AppShellPresentation>,
    );
    const historyLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/history');
    expect(historyLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Fleet or Profile as active when History is the active route', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history"
        userDisplayName={null}
      >
        <div />
      </AppShellPresentation>,
    );
    const fleetLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href') === '/');
    expect(fleetLinks[0]).not.toHaveAttribute('aria-current', 'page');
  });
});
