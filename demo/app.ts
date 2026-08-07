/**
 * `<demo-app>` — the shell around every demo page.
 *
 * It owns exactly four things:
 *
 * 1. the router and the route currently on screen,
 * 2. the `<lia-app-shell>` chrome (navigation, search, user menu, banners,
 *    footer, colour-scheme switcher),
 * 3. the page heading, derived from the route's own metadata, and
 * 4. scroll restoration, handed back to the router once Lit has rendered.
 *
 * Routes flagged `fullscreen` bypass the shell entirely — that is how the auth
 * screens and the "full pages" demos get the whole viewport while still living
 * in the same registry. They get a thin strip above the screen so there is
 * always a way back; see {@link DemoApp.renderFullscreen} for why it is a strip
 * and not a floating bar.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  AlertMessage,
  NavItem,
  SearchResult,
  UserInfo,
  UserMenuItem,
} from '@liasoft/lit-ui';
import { LiaElement, toast } from '@liasoft/lit-ui';
import { createRouter, isExternalHref, normalizePath, routeHref, type RouteMatch } from './router.js';
import { buildNav, searchRoutes } from './nav.js';
import { demoRoutes } from './pages/index.js';

/** Shown in the footer and in the navbar pill. */
export const DEMO_VERSION = '0.1.0';

/**
 * The application-wide router.
 *
 * Exported so a page can navigate imperatively; most pages just render an
 * `href` built with {@link routeHref}.
 */
export const router = createRouter(demoRoutes, {
  home: '/',
  scrollTarget: () => document.querySelector('lia-app-shell main'),
});

const DEMO_USER: UserInfo = {
  loginname: 'you',
  name: 'Kit explorer',
  email: 'you@example.org',
  isAdmin: true,
};

const USER_MENU: UserMenuItem[] = [
  { id: 'profile', label: 'Account panel', icon: 'fa-solid fa-id-card', href: routeHref('/auth/profile') },
  { id: 'credentials', label: 'Access credentials', icon: 'fa-solid fa-key', href: routeHref('/editors/credentials') },
  { id: 'settings', label: 'Settings page', icon: 'fa-solid fa-sliders', href: routeHref('/settings/page') },
  {
    id: 'source',
    label: 'Lit documentation',
    icon: 'fa-solid fa-book',
    href: 'https://lit.dev/',
    external: true,
    divider: true,
  },
];

const INTRO_BANNER: AlertMessage = {
  id: 'intro',
  variant: 'info',
  icon: 'fa-solid fa-flask',
  title: 'Demo build.',
  message: 'Every screen here is the kit rendering mock data — nothing is persisted.',
  dismissible: true,
  actions: [
    { id: 'tour', label: 'Start at the beginning', variant: 'light', size: 'sm', icon: 'fa-solid fa-rocket' },
  ],
};

/**
 * The demo application.
 *
 * @example
 * ```ts
 * document.getElementById('app')!.appendChild(document.createElement('demo-app'));
 * ```
 */
@customElement('demo-app')
export class DemoApp extends LiaElement {
  @state() private match: RouteMatch = router.current;
  @state() private searchResults: SearchResult[] = [];
  @state() private banners: AlertMessage[] = [INTRO_BANNER];

  private unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = router.subscribe((match) => this.onRouteChange(match));
    router.start();
  }

  override disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    super.disconnectedCallback();
  }

  protected override updated(): void {
    // The DOM now shows the new route; the router may put the reader back
    // where they were.
    router.restoreScroll();
  }

  /* -- routing --------------------------------------------------------- */

  private onRouteChange(match: RouteMatch): void {
    this.match = match;
    this.searchResults = [];
    document.title = match.found
      ? `${match.route.title} · Liasoft Lit UI`
      : 'Not found · Liasoft Lit UI';
    void this.closeMobileSidebar();
  }

  private async closeMobileSidebar(): Promise<void> {
    const shell = this.querySelector('lia-app-shell');
    if (shell) await shell.toggleSidebar(false);
  }

  /**
   * Sidebar entries, search hits and user-menu items all raise the same
   * cancelable `lia-navigate`. Anything that is not an absolute URL is handled
   * here, so the demo never reloads itself — and the fictional links inside the
   * navigation *demos* are swallowed rather than sending the reader to a 404.
   */
  private onNavigate(event: CustomEvent<{ url: string; item?: NavItem }>): void {
    const url = event.detail?.url ?? '';
    if (url === '' || isExternalHref(url)) return;
    event.preventDefault();
    const path = normalizePath(url);
    if (router.has(path)) router.navigate(path);
  }

  /* -- chrome ---------------------------------------------------------- */

  private onSearch(event: CustomEvent<{ field?: string; text: string }>): void {
    // Tables raise `lia-search` too; only the navbar's own field is ours.
    if (event.detail?.field !== 'global') return;
    this.searchResults = searchRoutes(router.routes, event.detail.text);
  }

  private onDismiss(event: CustomEvent<{ id?: string }>): void {
    const id = event.detail?.id;
    if (!id) return;
    const remaining = this.banners.filter((banner) => banner.id !== id);
    if (remaining.length !== this.banners.length) {
      event.stopPropagation();
      this.banners = remaining;
    }
  }

  private onBannerAction(event: CustomEvent<{ action: ActionDescriptor; id?: string }>): void {
    if (event.detail?.id !== 'tour') return;
    event.stopPropagation();
    router.navigate('/');
  }

  private onLogout(event: CustomEvent): void {
    event.preventDefault();
    toast({
      variant: 'secondary',
      icon: 'fa-solid fa-right-from-bracket',
      message: 'There is nothing to sign out of — this is a demo.',
      timeout: 4000,
    });
  }

  /* -- rendering -------------------------------------------------------- */

  private renderHeading(): TemplateResult {
    const route = this.match.route;
    const actions: ActionDescriptor[] = this.match.found
      ? [
          {
            id: 'top',
            label: 'Back to top',
            icon: 'fa-solid fa-arrow-up',
            variant: 'outline-secondary',
            size: 'sm',
            labelResponsive: true,
          },
        ]
      : [];

    return html`<lia-page-heading
      level="1"
      .title=${route.title}
      icon=${route.icon ?? ''}
      description=${route.description ?? ''}
      .actions=${actions}
      @lia-action=${(event: CustomEvent<{ id?: string }>) => {
        if (event.detail?.id !== 'top') return;
        event.stopPropagation();
        const main = this.querySelector('lia-app-shell main');
        main?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    ></lia-page-heading>`;
  }

  /**
   * A fullscreen route: the screen itself, under a strip that carries the way
   * back.
   *
   * Two rules the strip follows, both learned the hard way:
   *
   * - it is laid out **above** the screen rather than floating over its
   *   top-right corner, because that corner belongs to the screen — a user
   *   menu, a heading's actions, a banner's button all live there;
   * - it carries **nothing the screen already has**. Every fullscreen screen
   *   ships its own colour-scheme switch (the shell's navbar, the auth
   *   layout's, the installer's header), so the strip does not add a second
   *   one a few pixels away from it.
   */
  private renderFullscreen(route: RouteMatch['route']): TemplateResult {
    return html`
      <div class="demo-fullscreen">
        <div class="demo-fullscreen-bar">
          <a class="btn btn-sm btn-outline-secondary flex-shrink-0" href=${routeHref('/')}>
            <i class="fa-solid fa-arrow-left me-0 me-sm-2" aria-hidden="true"></i
            ><span class="d-none d-sm-inline">Back to the kit</span
            ><span class="visually-hidden d-sm-none">Back to the kit</span>
          </a>
          <span class="demo-fullscreen-title small text-body-secondary">${route.title}</span>
        </div>
        ${route.render()}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const { route, path } = this.match;

    if (route.fullscreen === true) return this.renderFullscreen(route);

    return html`
      <lia-app-shell
        brand-label="Liasoft Lit UI"
        brand-href=${routeHref('/')}
        home-href=${routeHref('/')}
        home-label="Overview"
        nav-label="Component gallery"
        search-placeholder="Search the gallery…"
        logout-label="Sign out"
        content-class=""
        footer-text="A Bootstrap 5 web-components kit. Every screen is mock data."
        footer-version=${DEMO_VERSION}
        .navItems=${buildNav(router.routes, path)}
        .user=${DEMO_USER}
        .userMenu=${USER_MENU}
        .searchResults=${this.searchResults}
        .banners=${this.banners}
        .navExtra=${html`<li class="nav-item d-none d-xl-flex align-items-center me-2">
          <span class="badge rounded-pill text-bg-secondary">v${DEMO_VERSION}</span>
        </li>`}
        .footerLinks=${[
          { label: 'Getting started', href: routeHref('/') },
          { label: 'Lit', href: 'https://lit.dev/', external: true },
          { label: 'Bootstrap', href: 'https://getbootstrap.com/', external: true },
        ]}
        @lia-navigate=${this.onNavigate}
        @lia-search=${this.onSearch}
        @lia-dismiss=${this.onDismiss}
        @lia-action=${this.onBannerAction}
        @lia-logout=${this.onLogout}
      >
        ${this.renderHeading()}
        <div class="demo-page p-3 p-lg-4 flex-grow-1">${route.render()}</div>
      </lia-app-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-app': DemoApp;
  }
}
