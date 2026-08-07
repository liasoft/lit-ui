import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { PropertyValues } from 'lit';
// Collapse powers the sidebar/search togglers via Bootstrap's data-api;
// Dropdown is instantiated explicitly for the user menu.
import { Collapse, Dropdown } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import type { SearchResult, UserInfo, UserMenuItem } from '../../core/types.js';
import { uid } from '../../core/utils.js';
import { LightContent } from './light-content.js';
import { flag } from './flag.js';
import './global-search.js';
import './theme-toggle.js';

/**
 * The top bar: sidebar toggler, brand block sized to the sidebar, the global
 * search, and the right-hand utility nav (home, colour-scheme switcher, user
 * dropdown, sign-out).
 *
 * Responsive behaviour matches the reference panel exactly: at `md` and up the
 * brand block is as wide as the sidebar underneath it and the search sits
 * inline; below `md` the sidebar hides behind the toggler and the search
 * collapses into its own row behind a magnifier icon.
 *
 * **Extra items** (an update badge, an environment pill, an impersonation
 * marker) can be added two ways: pass a renderable to `extra`, or write
 * `<li class="nav-item">…</li>` children inside the tag — those are moved into
 * the utility nav, just before the home link.
 *
 * @example
 * ```html
 * <lia-navbar brand-label="Acme Console" home-href="/" sidebar-id="main-nav">
 *   <li class="nav-item"><span class="nav-link text-success">staging</span></li>
 * </lia-navbar>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-navbar
 *   .user=${{ loginname: 'ada', isAdmin: true }}
 *   .userMenu=${[{ label: 'Profile', icon: 'fa-solid fa-user-gear', href: '/profile' }]}
 *   .searchResults=${hits}
 *   @lia-search=${onSearch}
 *   @lia-logout=${onLogout}
 * ></lia-navbar>`
 * ```
 */
@customElement('lia-navbar')
export class LiaNavbar extends LiaElement {
  /** Text shown in the brand block, and the logo's alt text. */
  @property({ type: String, attribute: 'brand-label' }) brandLabel = 'App';

  /** Logo image. When absent, {@link brandLabel} is rendered as text. */
  @property({ type: String, attribute: 'brand-logo' }) brandLogo = '';

  /** Where the brand block links to. */
  @property({ type: String, attribute: 'brand-href' }) brandHref = '#';

  /** DOM id of the collapsible sidebar the toggler controls. */
  @property({ type: String, attribute: 'sidebar-id' }) sidebarId = '';

  /** Accessible name of the sidebar toggler. */
  @property({ type: String, attribute: 'toggler-label' }) togglerLabel = 'Toggle navigation';

  /** Render the global search. */
  @property({ converter: flag, attribute: 'search-enabled' }) searchEnabled = true;

  @property({ type: String, attribute: 'search-placeholder' }) searchPlaceholder = 'Search';

  /** Hits handed straight to `<lia-global-search>`. */
  @property({ attribute: false }) searchResults: SearchResult[] = [];

  /** Spinner state of the global search. */
  @property({ type: Boolean, attribute: 'search-loading' }) searchLoading = false;

  /** Failure of the last lookup, handed straight to `<lia-global-search>`. */
  @property({ type: String, attribute: 'search-error' }) searchError = '';

  /** Target of the "home" link. Empty hides the link. */
  @property({ type: String, attribute: 'home-href' }) homeHref = '';

  @property({ type: String, attribute: 'home-label' }) homeLabel = 'Home';

  /** Signed-in user. Without one the user dropdown and sign-out are hidden. */
  @property({ attribute: false }) user?: UserInfo;

  /** Entries of the user dropdown. */
  @property({ attribute: false }) userMenu: UserMenuItem[] = [];

  /** Target of the sign-out link; empty makes it a pure `lia-logout` button. */
  @property({ type: String, attribute: 'logout-href' }) logoutHref = '';

  @property({ type: String, attribute: 'logout-label' }) logoutLabel = 'Sign out';

  /** Hide the sign-out control entirely. */
  @property({ converter: flag, attribute: 'show-logout' }) showLogout = true;

  /** Render the colour-scheme switcher. */
  @property({ converter: flag, attribute: 'show-theme-toggle' }) showThemeToggle = true;

  /** Drop the bar's shadow — use it when a page heading sits directly below. */
  @property({ type: Boolean, attribute: 'no-shadow' }) noShadow = false;

  /** Extra utility-nav content, rendered before the home link. */
  @property({ attribute: false }) extra?: unknown;

  private readonly ids = {
    search: uid('lia-navbar-search'),
    userMenu: uid('lia-navbar-user'),
  };

  private readonly slotted = new LightContent(this, 'lia-navbar-extra');
  private dropdown?: Dropdown;
  private collapse?: Collapse;

  override connectedCallback(): void {
    super.connectedCallback();
    this.slotted.adopt();
    if (this.hasUpdated) this.initPlugins();
  }

  override disconnectedCallback(): void {
    this.slotted.disconnect();
    this.dropdown?.dispose();
    this.dropdown = undefined;
    this.collapse?.dispose();
    this.collapse = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.slotted.pause();
  }

  protected override updated(_changed: PropertyValues): void {
    this.slotted.resume();
  }

  protected override firstUpdated(): void {
    this.initPlugins();
  }

  private initPlugins(): void {
    const toggle = this.querySelector<HTMLElement>('.dropdown-toggle[data-bs-toggle="dropdown"]');
    if (toggle && !this.dropdown) this.dropdown = Dropdown.getOrCreateInstance(toggle);

    const searchRow = this.querySelector<HTMLElement>(`#${CSS.escape(this.ids.search)}`);
    if (searchRow && !this.collapse) {
      this.collapse = Collapse.getOrCreateInstance(searchRow, { toggle: false });
    }
  }

  private onLogout(source: Event): void {
    const event = this.emit('lia-logout', { user: this.user }, { cancelable: true });
    if (event.defaultPrevented) source.preventDefault();
  }

  private onMenuItem(item: UserMenuItem, source: MouseEvent): void {
    if (!item.href) return;
    if (source.button !== 0 || source.metaKey || source.ctrlKey || source.shiftKey || source.altKey)
      return;
    const event = this.emit(
      'lia-navigate',
      { url: item.href, item: { label: item.label, url: item.href, icon: item.icon } },
      { cancelable: true }
    );
    if (event.defaultPrevented) source.preventDefault();
  }

  private renderBrand(): unknown {
    const inner = this.brandLogo
      ? html`<img
          src="${this.brandLogo}"
          alt="${this.brandLabel}"
          class="lia-header-logo d-inline-block align-text-top ms-md-3"
        />`
      : html`<span class="lia-brand-label ms-md-3">${this.brandLabel}</span>`;

    return html`<a class="navbar-brand me-0 shadow-sm" href="${this.brandHref}">${inner}</a>`;
  }

  private renderUserMenu(): unknown {
    const user = this.user;
    if (!user) return nothing;
    const entries = this.userMenu.filter((item) => item.visible !== false);
    const name = user.name || user.loginname;

    return html`<li class="nav-item dropdown">
      <a
        class="nav-link dropdown-toggle"
        href="#"
        id="${this.ids.userMenu}"
        role="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="${name}"
        @click="${(event: MouseEvent) => event.preventDefault()}"
      >
        ${user.avatarUrl
          ? html`<img
              class="lia-navbar-avatar rounded-circle me-1"
              src="${user.avatarUrl}"
              alt=""
            />`
          : html`<i class="fa-solid fa-user me-1" aria-hidden="true"></i>`}
        <span class="d-none d-xl-inline">${name}</span>
      </a>
      ${entries.length
        ? html`<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="${this.ids.userMenu}">
            ${entries.map(
              (item) => html`${item.divider ? html`<li><hr class="dropdown-divider" /></li>` : nothing}
                <li>
                  <a
                    class="dropdown-item"
                    href="${item.href ?? '#'}"
                    target="${ifDefined(item.external ? '_blank' : undefined)}"
                    rel="${ifDefined(item.external ? 'noopener noreferrer' : undefined)}"
                    @click="${(event: MouseEvent) => this.onMenuItem(item, event)}"
                  >
                    ${item.icon
                      ? html`<i class="${item.icon} me-1" aria-hidden="true"></i>`
                      : nothing}
                    ${item.label}
                  </a>
                </li>`
            )}
          </ul>`
        : nothing}
    </li>`;
  }

  private renderLogout(): unknown {
    if (!this.showLogout || !this.user) return nothing;
    return html`<li class="nav-item">
      <a
        class="nav-link text-primary"
        title="${this.logoutLabel}"
        aria-label="${this.logoutLabel}"
        href="${this.logoutHref || '#'}"
        @click="${(event: MouseEvent) => this.onLogout(event)}"
      >
        <i class="fa-solid fa-power-off" aria-hidden="true"></i>
      </a>
    </li>`;
  }

  protected override render(): unknown {
    return html`<nav
      class="navbar navbar-expand-md navbar-light p-0 ${this.noShadow ? '' : 'shadow-sm'}"
      aria-label="${this.brandLabel}"
    >
      <div class="container-fluid gx-0">
        <div>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#${this.sidebarId}"
            aria-controls="${this.sidebarId}"
            aria-expanded="false"
            aria-label="${this.togglerLabel}"
            ?hidden="${this.sidebarId === ''}"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>

        ${this.renderBrand()}

        <div class="order-0 order-md-1 d-flex flex-grow-0 flex-md-grow-auto">
          <ul class="navbar-nav ms-md-auto me-3 me-lg-5 align-items-center">
            ${this.searchEnabled
              ? html`<li class="nav-item d-md-none">
                  <a
                    class="nav-link"
                    data-bs-toggle="collapse"
                    href="#${this.ids.search}"
                    role="button"
                    aria-expanded="false"
                    aria-controls="${this.ids.search}"
                    aria-label="${this.searchPlaceholder}"
                  >
                    <i class="fa-solid fa-magnifying-glass text-body-secondary" aria-hidden="true"></i>
                  </a>
                </li>`
              : nothing}
            ${this.extra ?? nothing} ${this.slotted.holder}
            ${this.homeHref
              ? html`<li class="nav-item">
                  <a class="nav-link" href="${this.homeHref}">
                    <i class="fa-solid fa-house me-1" aria-hidden="true"></i>
                    <span class="d-none d-xl-inline">${this.homeLabel}</span>
                  </a>
                </li>`
              : nothing}
            ${this.showThemeToggle
              ? html`<li class="nav-item">
                  <lia-theme-toggle nav-link></lia-theme-toggle>
                </li>`
              : nothing}
            ${this.renderUserMenu()} ${this.renderLogout()}
          </ul>
        </div>

        <div
          class="order-1 order-md-0 collapse navbar-collapse lia-collapse-search"
          id="${this.ids.search}"
          ?hidden="${!this.searchEnabled}"
        >
          ${this.searchEnabled
            ? html`<lia-global-search
                class="ms-3 mt-3 ms-lg-5 my-md-0 w-100"
                placeholder="${this.searchPlaceholder}"
                label="${this.searchPlaceholder}"
                .results="${this.searchResults}"
                ?loading="${this.searchLoading}"
                error="${this.searchError}"
              ></lia-global-search>`
            : nothing}
        </div>
      </div>
    </nav>`;
  }
}

declare global {
  interface HTMLElementEventMap {
    /** Fired when the sign-out control is used. Cancelable. */
    'lia-logout': CustomEvent<{ user?: UserInfo }>;
  }

  interface HTMLElementTagNameMap {
    'lia-navbar': LiaNavbar;
  }
}
