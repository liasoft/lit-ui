import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LiaElement } from '../../core/base-element.js';
import type { NavItem } from '../../core/types.js';
import { renderRich } from '../../core/utils.js';

/**
 * A Bootstrap breadcrumb built from a `NavItem[]` trail.
 *
 * The last entry — or any entry flagged `active` — renders as plain text with
 * `aria-current="page"`; the rest are links that emit a cancelable
 * `lia-navigate`. An optional home crumb can be prepended by icon alone.
 *
 * @example
 * ```ts
 * html`<lia-breadcrumb
 *   home-href="/"
 *   .items=${[
 *     { label: 'Storage', url: '/storage' },
 *     { label: 'Volumes', url: '/storage/volumes' },
 *     { label: 'vol-01' },
 *   ]}
 *   @lia-navigate=${(e: CustomEvent) => { e.preventDefault(); router.go(e.detail.url); }}
 * ></lia-breadcrumb>`
 * ```
 */
@customElement('lia-breadcrumb')
export class LiaBreadcrumb extends LiaElement {
  /** The trail, root first. */
  @property({ attribute: false }) items: NavItem[] = [];

  /** Accessible name of the navigation landmark. */
  @property({ type: String }) label = 'Breadcrumb';

  /** Prepend a home crumb linking here. Empty renders no home crumb. */
  @property({ type: String, attribute: 'home-href' }) homeHref = '';

  /** Icon of the home crumb. */
  @property({ type: String, attribute: 'home-icon' }) homeIcon = 'fa-solid fa-house';

  /** Accessible name of the home crumb. */
  @property({ type: String, attribute: 'home-label' }) homeLabel = 'Home';

  /** Separator between crumbs — any CSS content string, e.g. `'/'` or `'›'`. */
  @property({ type: String }) divider = '';

  /** Extra classes for the `<ol>`, e.g. `bg-body-tertiary rounded-3 p-3`. */
  @property({ type: String, attribute: 'list-class' }) listClass = 'mb-0';

  private navigate(item: NavItem, source: MouseEvent): void {
    if (source.button !== 0 || source.metaKey || source.ctrlKey || source.shiftKey || source.altKey)
      return;
    const event = this.emit('lia-navigate', { url: item.url ?? '', item }, { cancelable: true });
    if (event.defaultPrevented) source.preventDefault();
  }

  private renderCrumb(item: NavItem, isLast: boolean): unknown {
    const current = item.active === true || (isLast && item.active !== false);
    const body = html`${item.icon
      ? html`<i class="${item.icon} me-1" aria-hidden="true"></i>`
      : nothing}${renderRich(item.label)}`;

    return html`<li
      class="breadcrumb-item ${current ? 'active' : ''}"
      aria-current="${ifDefined(current ? 'page' : undefined)}"
    >
      ${current || !item.url
        ? body
        : html`<a href="${item.url}" @click="${(event: MouseEvent) => this.navigate(item, event)}"
            >${body}</a
          >`}
    </li>`;
  }

  protected override render(): unknown {
    const items = this.items.filter((item) => item.visible !== false);
    if (items.length === 0 && !this.homeHref) return nothing;

    const styles = this.divider ? { '--bs-breadcrumb-divider': `'${this.divider}'` } : {};

    return html`<nav aria-label="${this.label}">
      <ol class="breadcrumb ${this.listClass}" style="${styleMap(styles)}">
        ${this.homeHref
          ? html`<li class="breadcrumb-item">
              <a
                href="${this.homeHref}"
                title="${this.homeLabel}"
                aria-label="${this.homeLabel}"
                @click="${(event: MouseEvent) =>
                  this.navigate({ label: this.homeLabel, url: this.homeHref }, event)}"
                ><i class="${this.homeIcon}" aria-hidden="true"></i
              ></a>
            </li>`
          : nothing}
        ${items.map((item, index) => this.renderCrumb(item, index === items.length - 1))}
      </ol>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-breadcrumb': LiaBreadcrumb;
  }
}
