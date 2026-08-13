import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type { NavItem } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';

/**
 * The secondary navigation column on the right of the content area — the rail
 * a settings or documentation page uses to jump between its sections.
 *
 * It is a light rail rather than a dark one, hidden below `lg` (the same
 * entries usually appear inline on small screens), and optionally sticky so it
 * stays put while the content scrolls. Nested `items` render as an indented
 * sub-list; there is no collapsing here on purpose — a secondary rail should
 * stay scannable.
 *
 * @example
 * ```ts
 * html`<lia-sub-sidebar
 *   title="Sections"
 *   sticky
 *   .items=${[
 *     { label: 'General', url: '#general', active: true },
 *     { label: 'Security', url: '#security' },
 *     { label: 'Advanced', url: '#advanced', items: [{ label: 'Logging', url: '#logging' }] },
 *   ]}
 * ></lia-sub-sidebar>`
 * ```
 */
@customElement('lia-sub-sidebar')
export class LiaSubSidebar extends LiaElement {
  /** Entries of the secondary rail. */
  @property({ attribute: false }) items: NavItem[] = [];

  /**
   * Heading above the list; also the accessible name of the landmark.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute. Authoring it *as* an
   * HTML attribute still works, but the browser will then also show it as a
   * tooltip — bind the property (`.title=${…}`) if that bothers you.
   */
  @property({ type: String }) override title = '';

  /** Accessible name when no visible `title` is given. */
  @property({ type: String }) label = 'Secondary navigation';

  /** Stick to the top of the viewport while the content scrolls. */
  @property({ type: Boolean }) sticky = false;

  private navigate(item: NavItem, source: MouseEvent): void {
    if (source.defaultPrevented) return;
    if (source.button !== 0 || source.metaKey || source.ctrlKey || source.shiftKey || source.altKey)
      return;
    const event = this.emit('lia-navigate', { url: item.url ?? '', item }, { cancelable: true });
    if (event.defaultPrevented) source.preventDefault();
  }

  private renderItem(item: NavItem): unknown {
    const children = (item.items ?? []).filter((child) => child.visible !== false);
    return html`<li class="nav-item" aria-current="${ifDefined(item.active ? 'page' : undefined)}">
      <a
        class="${cx(
          'nav-link',
          'd-flex',
          'align-items-center',
          'gap-2',
          'py-1',
          item.active ? 'active fw-semibold' : 'link-body-emphasis'
        )}"
        href="${item.url ?? '#'}"
        target="${ifDefined(item.external ? '_blank' : undefined)}"
        rel="${ifDefined(item.external ? 'noopener noreferrer' : undefined)}"
        @click="${(event: MouseEvent) => this.navigate(item, event)}"
      >
        ${item.icon ? html`<i class="${item.icon}" aria-hidden="true"></i>` : nothing}
        <span class="me-auto">${renderRich(item.label)}</span>
        ${item.badge
          ? html`<span class="badge rounded-pill bg-${item.badge.variant ?? 'secondary'}"
              >${item.badge.text}</span
            >`
          : nothing}
      </a>
      ${children.length
        ? html`<ul class="nav flex-column ps-3">
            ${children.map((child) => this.renderItem(child))}
          </ul>`
        : nothing}
    </li>`;
  }

  protected override render(): unknown {
    const entries = this.items.filter((item) => item.visible !== false);
    if (entries.length === 0) return nothing;

    return html`<nav
      class="${cx(
        'lia-sub-sidebar',
        'd-none',
        'd-lg-flex',
        'flex-shrink-0',
        'flex-column',
        'overflow-auto',
        'max-h-before-header',
        'p-3',
        this.sticky && 'position-sticky top-0'
      )}"
      aria-label="${this.title || this.label}"
    >
      ${this.title
        ? html`<h6 class="text-body-secondary text-uppercase small px-2 mb-2">${this.title}</h6>`
        : nothing}
      <ul class="nav flex-column">
        ${entries.map((item) => this.renderItem(item))}
      </ul>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-sub-sidebar': LiaSubSidebar;
  }
}
