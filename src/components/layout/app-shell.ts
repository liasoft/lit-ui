import { html, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Collapse } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import type {
  AlertMessage,
  NavItem,
  SearchResult,
  UserInfo,
  UserMenuItem,
} from '../../core/types.js';
import { renderRich, uid } from '../../core/utils.js';
import { LightContent } from './light-content.js';
import { renderLayoutActions } from './internal.js';
import { flag } from './flag.js';
import type { FooterLink } from './footer.js';
import './navbar.js';
import './sidebar.js';
import './sub-sidebar.js';
import './footer.js';

/**
 * The whole application chrome in one element:
 *
 * ```text
 * ┌ banners (full-bleed, stacked) ─────────────────────────┐
 * ├ lia-navbar ────────────────────────────────────────────┤
 * │ lia-sidebar │ main                       │ sub-sidebar │
 * │             │  ├ your page content       │             │
 * │             │  └ lia-footer              │             │
 * └─────────────┴───────────────────────────┴──────────────┘
 * ```
 *
 * **Content projection.** Because the kit renders into the light DOM there is
 * no `<slot>`. Everything you write inside `<lia-app-shell>` is moved once, on
 * connect, into the content `<section>` of `<main>`; anything appended later is
 * caught by a `MutationObserver` and moved as well. {@link appendContent} does
 * the same imperatively. The holder is `display: contents`, so your markup
 * lays out exactly as if it were written in the section directly.
 *
 * If the projected content is a `<lia-page>`, the shell drops its own section
 * padding automatically — `lia-page` brings a full-bleed heading bar and its
 * own padded content area. Override with `contentClass`.
 *
 * **Responsive behaviour** is the reference panel's: at `md` and up the sidebar
 * is a permanent column and the search sits inline in the navbar; below `md`
 * the sidebar collapses behind the navbar toggler and the search collapses
 * into its own row.
 *
 * **Events** — all of them bubble out of the shell:
 * `lia-navigate` (sidebar, sub-sidebar, user menu, search hit; cancelable),
 * `lia-search` (debounced query from the navbar search),
 * `lia-action` (banner buttons and page toolbars),
 * `lia-logout`, `lia-dismiss`.
 *
 * @example
 * ```html
 * <lia-app-shell brand-label="Acme Console" home-href="/" id="shell">
 *   <lia-page title="Overview" icon="fa-solid fa-gauge">…</lia-page>
 * </lia-app-shell>
 * <script type="module">
 *   const shell = document.getElementById('shell');
 *   shell.navItems = [{ label: 'Overview', url: '/', icon: 'fa-solid fa-gauge', active: true }];
 *   shell.user = { loginname: 'ada' };
 *   shell.addEventListener('lia-search', (e) => console.log(e.detail.text));
 * </script>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-app-shell
 *   .navItems=${nav}
 *   .user=${user}
 *   .userMenu=${menu}
 *   .banners=${[{ variant: 'info', message: 'Setup is incomplete.',
 *                 actions: [{ id: 'setup', label: 'Start setup', variant: 'light', size: 'sm' }] }]}
 *   .footerLinks=${[{ label: 'Privacy', href: '/privacy' }]}
 *   footer-text="&copy; 2026 Acme Ltd."
 * >${page}</lia-app-shell>`
 * ```
 */
@customElement('lia-app-shell')
export class LiaAppShell extends LiaElement {
  /* -- navigation ------------------------------------------------------- */

  /** The primary navigation tree. */
  @property({ attribute: false }) navItems: NavItem[] = [];

  /** Entries of the secondary rail on the right; empty hides it. */
  @property({ attribute: false }) subNavItems: NavItem[] = [];

  /** Heading of the secondary rail. */
  @property({ type: String, attribute: 'sub-nav-title' }) subNavTitle = '';

  /** Keep the secondary rail in view while the content scrolls. */
  @property({ type: Boolean, attribute: 'sub-nav-sticky' }) subNavSticky = false;

  /** Start with the sidebar hidden on large screens too. */
  @property({ type: Boolean, attribute: 'collapsed-sidebar' }) collapsedSidebar = false;

  /** Accessible name of the primary rail. */
  @property({ type: String, attribute: 'nav-label' }) navLabel = 'Main navigation';

  /** Accessible name of the navbar's sidebar toggler. */
  @property({ type: String, attribute: 'toggler-label' }) togglerLabel = 'Toggle navigation';

  /* -- brand ------------------------------------------------------------ */

  @property({ type: String, attribute: 'brand-label' }) brandLabel = 'App';
  @property({ type: String, attribute: 'brand-logo' }) brandLogo = '';
  @property({ type: String, attribute: 'brand-href' }) brandHref = '#';

  /* -- user ------------------------------------------------------------- */

  @property({ attribute: false }) user?: UserInfo;
  @property({ attribute: false }) userMenu: UserMenuItem[] = [];
  @property({ type: String, attribute: 'logout-href' }) logoutHref = '';
  @property({ type: String, attribute: 'logout-label' }) logoutLabel = 'Sign out';

  /* -- navbar ----------------------------------------------------------- */

  /** Target of the navbar's home link; empty hides it. */
  @property({ type: String, attribute: 'home-href' }) homeHref = '';
  @property({ type: String, attribute: 'home-label' }) homeLabel = 'Home';

  @property({ converter: flag, attribute: 'search-enabled' }) searchEnabled = true;
  @property({ type: String, attribute: 'search-placeholder' }) searchPlaceholder = 'Search';

  /** Hits for the navbar search; assign after handling `lia-search`. */
  @property({ attribute: false }) searchResults: SearchResult[] = [];
  @property({ type: Boolean, attribute: 'search-loading' }) searchLoading = false;
  /** Failure of the last lookup, forwarded to the navbar's search box. */
  @property({ type: String, attribute: 'search-error' }) searchError = '';

  /** Extra utility-nav content (an update badge, an environment pill, …). */
  @property({ attribute: false }) navExtra?: unknown;

  @property({ converter: flag, attribute: 'show-theme-toggle' }) showThemeToggle = true;

  /* -- banners ---------------------------------------------------------- */

  /** Full-bleed messages stacked above the navbar. */
  @property({ attribute: false }) banners: AlertMessage[] = [];

  /** Accessible name of an banner's close button. */
  @property({ type: String, attribute: 'dismiss-label' }) dismissLabel = 'Dismiss';

  /* -- footer ----------------------------------------------------------- */

  @property({ converter: flag, attribute: 'show-footer' }) showFooter = true;
  @property({ type: String, attribute: 'footer-text' }) footerText = '';
  @property({ attribute: false }) footerLinks: FooterLink[] = [];
  @property({ type: String, attribute: 'footer-version' }) footerVersion = '';
  @property({ converter: flag, attribute: 'footer-show-version' }) footerShowVersion = true;
  @property({ type: String, attribute: 'footer-logo' }) footerLogo = '';
  @property({ type: String, attribute: 'footer-note' }) footerNote = '';

  /* -- content ---------------------------------------------------------- */

  /**
   * Padding utilities for the content `<section>`. Leave unset to let the shell
   * choose: no padding when the projected content is a `<lia-page>`, the
   * reference panel's `p-3 p-lg-5` otherwise.
   */
  @property({ type: String, attribute: 'content-class' }) contentClass?: string;

  private readonly sidebarId = uid('lia-sidebar');
  private readonly content = new LightContent(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.content.adopt();
  }

  override disconnectedCallback(): void {
    this.content.disconnect();
    super.disconnectedCallback();
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.content.pause();
  }

  protected override updated(_changed: PropertyValues): void {
    this.content.resume();
  }

  /** Append a node to the projected page content. */
  appendContent(node: Node): void {
    this.content.append(node);
  }

  /** Remove every projected node. */
  clearContent(): void {
    this.content.clear();
  }

  /**
   * Show or hide the collapsed sidebar programmatically — handy right after a
   * client-side navigation on a phone, where the rail stays open otherwise.
   */
  async toggleSidebar(show?: boolean): Promise<void> {
    await this.updateComplete;
    const rail = this.querySelector('lia-sidebar')?.querySelector<HTMLElement>('.lia-sidebar');
    if (!rail) return;
    const instance = Collapse.getOrCreateInstance(rail, { toggle: false });
    if (show === undefined) instance.toggle();
    else if (show) instance.show();
    else instance.hide();
  }

  /** True when the projected content consists solely of `<lia-page>` elements. */
  private get contentIsPage(): boolean {
    const projected = this.content.elements;
    return projected.length > 0 && projected.every((element) => element.tagName === 'LIA-PAGE');
  }

  private get resolvedContentClass(): string {
    if (this.contentClass !== undefined) return this.contentClass;
    return this.contentIsPage ? '' : 'p-3 p-lg-5';
  }

  private renderBanner(banner: AlertMessage, index: number): unknown {
    const id = banner.id ?? String(index);
    return html`<div
      class="alert alert-${banner.variant} rounded-0 mb-0 d-flex justify-content-between align-items-baseline gap-3"
      role="alert"
    >
      <span>
        ${banner.icon ? html`<i class="alert-icon ${banner.icon}" aria-hidden="true"></i>` : nothing}
        ${banner.title ? html`<strong class="me-1">${banner.title}</strong>` : nothing}
        ${banner.html ? renderRich(banner.message) : banner.message}
      </span>
      <span class="d-flex align-items-center gap-2 flex-shrink-0">
        ${renderLayoutActions(banner.actions, this)}
        ${banner.dismissible
          ? html`<button
              type="button"
              class="btn-close"
              aria-label="${this.dismissLabel}"
              @click="${() => this.emit('lia-dismiss', { id })}"
            ></button>`
          : nothing}
      </span>
    </div>`;
  }

  protected override render(): unknown {
    const banners = this.banners ?? [];

    return html`${banners.map((banner, index) => this.renderBanner(banner, index))}
      <lia-navbar
        brand-label="${this.brandLabel}"
        brand-logo="${this.brandLogo}"
        brand-href="${this.brandHref}"
        sidebar-id="${this.sidebarId}"
        toggler-label="${this.togglerLabel}"
        home-href="${this.homeHref}"
        home-label="${this.homeLabel}"
        logout-href="${this.logoutHref}"
        logout-label="${this.logoutLabel}"
        search-placeholder="${this.searchPlaceholder}"
        .searchEnabled="${this.searchEnabled}"
        .searchResults="${this.searchResults}"
        .searchLoading="${this.searchLoading}"
        .searchError="${this.searchError}"
        .showThemeToggle="${this.showThemeToggle}"
        .user="${this.user}"
        .userMenu="${this.userMenu}"
        .extra="${this.navExtra}"
        ?no-shadow="${this.contentIsPage}"
      ></lia-navbar>

      <div class="d-flex flex-grow-1">
        <lia-sidebar
          collapse-id="${this.sidebarId}"
          label="${this.navLabel}"
          .items="${this.navItems}"
          .collapsed="${this.collapsedSidebar}"
        ></lia-sidebar>

        <div class="d-flex flex-grow-1 overflow-hidden">
          <main class="d-flex flex-column flex-grow-1 overflow-auto">
            <section class="lia-app-shell-content flex-grow-1 ${this.resolvedContentClass}">
              ${this.content.holder}
            </section>
            ${this.showFooter
              ? html`<lia-footer
                  text="${this.footerText}"
                  version="${this.footerVersion}"
                  logo-src="${this.footerLogo}"
                  logo-alt="${this.brandLabel}"
                  note="${this.footerNote}"
                  .showVersion="${this.footerShowVersion}"
                  .links="${this.footerLinks}"
                ></lia-footer>`
              : nothing}
          </main>

          <lia-sub-sidebar
            .items="${this.subNavItems}"
            .title="${this.subNavTitle}"
            .sticky="${this.subNavSticky}"
          ></lia-sub-sidebar>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-app-shell': LiaAppShell;
  }
}
