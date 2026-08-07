import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { NavItem } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { renderIcon } from '../primitives/lia-icon.js';
import {
  SETTINGS_ANCHOR_PREFIX,
  settingsGroupAnchor,
  settingsNavItems,
  type SettingsNavEntry,
} from './settings-model.js';
import '../layout/sub-sidebar.js';

/** Detail of `lia-settings-navigate`, fired when a section anchor is used. */
export interface SettingsNavigateDetail {
  /** Id of the group the reader asked for. */
  id: string;
  /** The anchor's DOM target, when it is on the page. */
  target?: HTMLElement;
}

declare global {
  interface HTMLElementEventMap {
    'lia-settings-navigate': CustomEvent<SettingsNavigateDetail>;
  }
}

/** How the anchor list presents itself. */
export type SettingsNavLayout = 'rail' | 'inline';

/**
 * The list of section anchors of a settings page.
 *
 * Two shapes from one element. `rail` (the default) delegates to
 * `<lia-sub-sidebar>` — the light column on the right of the content that
 * disappears below `lg`; `inline` renders a wrapping row of pills, which is
 * what small screens get instead.
 *
 * Clicking an entry scrolls its section into view smoothly instead of letting
 * the browser jump, and emits `lia-settings-navigate`. Nothing here is
 * settings-specific beyond the naming: it is an anchor rail for any page built
 * out of titled blocks.
 *
 * @example
 * ```ts
 * html`<lia-settings-nav
 *   .items=${[
 *     { id: 'general', label: 'General', icon: 'fa-solid fa-sliders' },
 *     { id: 'mail', label: 'Mail', icon: 'fa-solid fa-envelope' },
 *   ]}
 *   active="mail"
 *   heading="Sections"
 *   sticky
 *   @lia-settings-navigate=${(e: CustomEvent) => console.log(e.detail.id)}
 * ></lia-settings-nav>`
 * ```
 *
 * @example
 * ```html
 * <lia-settings-nav layout="inline" class="d-lg-none"></lia-settings-nav>
 * ```
 */
@customElement('lia-settings-nav')
export class LiaSettingsNav extends LiaElement {
  /** The sections to link to. */
  @property({ attribute: false }) items: SettingsNavEntry[] = [];

  /** Id of the entry rendered as current. */
  @property({ type: String }) active = '';

  /**
   * `rail` for the right-hand column, `inline` for a row of pills.
   *
   * Reflected, because the stylesheet needs it: a rail must be
   * `display: contents` so the inner `<nav>` becomes the flex item, while an
   * inline list is a block of its own.
   */
  @property({ type: String, reflect: true }) layout: SettingsNavLayout = 'rail';

  /** Visible heading above the rail. Empty renders none. */
  @property({ type: String }) heading = '';

  /** Accessible name of the navigation landmark. */
  @property({ type: String }) label = 'Sections';

  /** Keep the rail in view while the settings scroll. */
  @property({ type: Boolean }) sticky = false;

  /** Prefix of the generated anchor ids; must match `<lia-settings-group>`. */
  @property({ type: String, attribute: 'anchor-prefix' }) anchorPrefix = SETTINGS_ANCHOR_PREFIX;

  /** Scroll the target into view smoothly instead of jumping to it. */
  @property({ type: Boolean, attribute: 'no-smooth' }) noSmooth = false;

  /** The entries as `<lia-sub-sidebar>` navigation items. */
  get navItems(): NavItem[] {
    return settingsNavItems(this.items, this.active, '#', this.anchorPrefix);
  }

  /** Bring a group's section into view and report it. */
  goTo(id: string): void {
    const target = this.ownerDocument.getElementById(settingsGroupAnchor(id, this.anchorPrefix));
    if (target) {
      // Guarded: `scrollIntoView` is missing in the DOM implementations used
      // by unit tests, where focusing alone is still the right behaviour.
      target.scrollIntoView?.({
        behavior: this.noSmooth ? 'auto' : 'smooth',
        block: 'start',
      });
      // Section headings carry tabindex="-1" so the reading position follows
      // the scroll for keyboard and screen-reader users too.
      target.focus({ preventScroll: true });
    }
    this.emit<SettingsNavigateDetail>('lia-settings-navigate', { id, target: target ?? undefined });
  }

  private handleClick(id: string, event: MouseEvent): void {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    this.goTo(id);
  }

  private handleRailNavigate(event: CustomEvent<{ url: string; item?: NavItem }>): void {
    const id = event.detail.item?.id;
    if (!id) return;
    // Claim the click: the rail cancels its own anchor when we preventDefault.
    event.preventDefault();
    this.goTo(id);
  }

  private renderInline(): unknown {
    const entries = this.items.filter((entry) => entry.visible !== false);
    if (entries.length === 0) return nothing;
    return html`<nav class="lia-settings-nav-inline" aria-label=${this.label}>
      <ul class="nav nav-pills flex-nowrap overflow-auto gap-1 pb-1">
        ${entries.map(
          (entry) => html`<li class="nav-item">
            <a
              class=${cx('nav-link', 'py-1', 'text-nowrap', entry.id === this.active && 'active')}
              href=${`#${settingsGroupAnchor(entry.id, this.anchorPrefix)}`}
              aria-current=${entry.id === this.active ? 'true' : nothing}
              @click=${(event: MouseEvent) => this.handleClick(entry.id, event)}
            >
              ${renderIcon(entry.icon, { class: 'me-1' })}${renderRich(entry.label)}
              ${entry.badge
                ? html`<span class="badge rounded-pill bg-${entry.badge.variant ?? 'secondary'} ms-1"
                    >${entry.badge.text}</span
                  >`
                : nothing}
            </a>
          </li>`
        )}
      </ul>
    </nav>`;
  }

  protected override render(): unknown {
    if (this.layout === 'inline') return this.renderInline();
    return html`<lia-sub-sidebar
      .items=${this.navItems}
      .title=${this.heading}
      .label=${this.label}
      ?sticky=${this.sticky}
      @lia-navigate=${this.handleRailNavigate}
    ></lia-sub-sidebar>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-settings-nav': LiaSettingsNav;
  }
}
