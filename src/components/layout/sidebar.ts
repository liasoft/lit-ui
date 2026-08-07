import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
// Importing Collapse registers Bootstrap's collapse data-api, which drives the
// group toggles below without a click handler of our own.
import { Collapse } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import type { NavItem } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';

/** Does this entry, or any of its children, represent the current page? */
function isBranchActive(item: NavItem): boolean {
  if (item.active) return true;
  return (item.items ?? []).some((child) => child.active === true);
}

/**
 * The primary, collapsible, grouped navigation rail.
 *
 * Entries with `items` become Bootstrap collapse groups; leaf entries link
 * straight out. Per entry the rail understands `addUrl` (a "+" shortcut on the
 * right), `external` (opens in a new tab and shows the external marker),
 * `badge` (a counter) and `active` (highlighting). The group containing the
 * active entry is expanded on first render, and the component then follows the
 * user's own expand/collapse decisions.
 *
 * Below `md` the rail is hidden behind the navbar toggler: give the toggler
 * `data-bs-target="#<collapseId>"` — `<lia-app-shell>` wires that up for you.
 *
 * Clicking an entry emits a cancelable `lia-navigate`; cancel it to take over
 * routing client-side.
 *
 * @example
 * ```ts
 * html`<lia-sidebar
 *   collapse-id="main-nav"
 *   .items=${[
 *     { label: 'Overview', url: '/', icon: 'fa-solid fa-gauge', active: true },
 *     {
 *       label: 'Storage', icon: 'fa-solid fa-database',
 *       items: [
 *         { label: 'Volumes', url: '/volumes', addUrl: '/volumes/new', badge: { text: 4 } },
 *         { label: 'Console', url: 'https://example.test', external: true },
 *       ],
 *     },
 *   ]}
 *   @lia-navigate=${(e: CustomEvent) => console.log(e.detail.url)}
 * ></lia-sidebar>`
 * ```
 */
@customElement('lia-sidebar')
export class LiaSidebar extends LiaElement {
  /** The navigation tree. Entries with `visible === false` are skipped. */
  @property({ attribute: false }) items: NavItem[] = [];

  /** DOM id of the collapsible rail — the navbar toggler's `data-bs-target`. */
  @property({ type: String, attribute: 'collapse-id' }) collapseId = '';

  /** Accessible name of the `<nav>` landmark. */
  @property({ type: String }) label = 'Main navigation';

  /** Keep the rail collapsed on large screens too, until it is toggled. */
  @property({ type: Boolean }) collapsed = false;

  /** Title of the per-entry "+" shortcut. */
  @property({ type: String, attribute: 'add-label' }) addLabel = 'Add';

  /** Title of the external-link marker. */
  @property({ type: String, attribute: 'external-label' }) externalLabel = 'Opens in a new tab';

  /** Ids of the groups currently expanded. */
  @state() private expanded = new Set<string>();

  private readonly instanceId = uid('lia-nav');
  private syncedFor?: NavItem[];

  /** Delegated listener keeping our state in sync with Bootstrap's own toggling. */
  private readonly onCollapseToggled = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const key = target?.dataset['liaGroup'];
    if (!key) return;
    const next = new Set(this.expanded);
    if (event.type === 'shown.bs.collapse') next.add(key);
    else next.delete(key);
    this.expanded = next;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('shown.bs.collapse', this.onCollapseToggled);
    this.addEventListener('hidden.bs.collapse', this.onCollapseToggled);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('shown.bs.collapse', this.onCollapseToggled);
    this.removeEventListener('hidden.bs.collapse', this.onCollapseToggled);
    for (const element of Array.from(this.querySelectorAll('.collapse'))) {
      Collapse.getInstance(element)?.dispose();
    }
    super.disconnectedCallback();
  }

  protected override willUpdate(): void {
    // Re-derive the open groups whenever a *new* tree arrives, so navigating to
    // another page opens the right group without fighting manual toggles.
    if (this.syncedFor !== this.items) {
      this.syncedFor = this.items;
      const open = new Set(this.expanded);
      this.items.forEach((item, index) => {
        if (item.items?.length && isBranchActive(item)) open.add(this.groupKey(item, index));
      });
      this.expanded = open;
    }
  }

  private groupKey(item: NavItem, index: number): string {
    return item.id ?? `${this.instanceId}-g${index}`;
  }

  private visible(items: NavItem[] | undefined): NavItem[] {
    return (items ?? []).filter((item) => item.visible !== false);
  }

  private navigate(item: NavItem, source: MouseEvent): void {
    if (source.defaultPrevented) return;
    if (source.button !== 0 || source.metaKey || source.ctrlKey || source.shiftKey || source.altKey)
      return;
    const event = this.emit('lia-navigate', { url: item.url ?? '', item }, { cancelable: true });
    if (event.defaultPrevented) source.preventDefault();
  }

  private renderBadge(item: NavItem): unknown {
    if (!item.badge) return nothing;
    return html`<span
      class="badge rounded-pill bg-${item.badge.variant ?? 'secondary'} me-2 flex-shrink-0"
      >${item.badge.text}</span
    >`;
  }

  private renderChild(child: NavItem): unknown {
    return html`<li
      class="nav-item d-flex justify-content-between align-items-center"
      aria-current="${ifDefined(child.active ? 'page' : undefined)}"
    >
      <div class="me-auto">
        <a
          class="${cx('nav-link', 'text-light', child.active && 'active fw-bold')}"
          href="${child.url ?? '#'}"
          target="${ifDefined(child.external ? '_blank' : undefined)}"
          rel="${ifDefined(child.external ? 'noopener noreferrer' : undefined)}"
          @click="${(event: MouseEvent) => this.navigate(child, event)}"
          >${renderRich(child.label)}</a
        >
      </div>
      ${child.addUrl
        ? html`<a
            href="${child.addUrl}"
            class="text-secondary me-2"
            title="${this.addLabel}"
            aria-label="${this.addLabel}: ${child.label}"
            @click="${(event: MouseEvent) =>
              this.navigate({ ...child, url: child.addUrl ?? '' }, event)}"
            ><i class="fa-solid fa-plus-circle" aria-hidden="true"></i
          ></a>`
        : nothing}
      ${child.external
        ? html`<span class="me-2" title="${this.externalLabel}"
            ><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i
            ><span class="visually-hidden">${this.externalLabel}</span></span
          >`
        : nothing}
      ${this.renderBadge(child)}
    </li>`;
  }

  private renderGroup(item: NavItem, index: number): unknown {
    const key = this.groupKey(item, index);
    const panelId = `${this.instanceId}-sub-${index}`;
    const open = this.expanded.has(key);

    return html`<li class="nav-item" aria-current="${ifDefined(isBranchActive(item) ? 'true' : undefined)}">
      <a
        class="${cx('nav-link', 'text-light', 'd-flex', 'align-items-center', !open && 'collapsed')}"
        href="#${panelId}"
        role="button"
        data-bs-toggle="collapse"
        data-bs-target="#${panelId}"
        aria-expanded="${open ? 'true' : 'false'}"
        aria-controls="${panelId}"
      >
        ${item.icon ? html`<i class="${item.icon}" aria-hidden="true"></i>` : nothing}
        <span class="me-auto">${renderRich(item.label)}</span>
        ${this.renderBadge(item)}
      </a>
      <div class="${cx('collapse', open && 'show')}" id="${panelId}" data-lia-group="${key}">
        <ul class="nav flex-column ps-3">
          ${this.visible(item.items).map((child) => this.renderChild(child))}
        </ul>
      </div>
    </li>`;
  }

  private renderLeaf(item: NavItem): unknown {
    return html`<li class="nav-item" aria-current="${ifDefined(item.active ? 'page' : undefined)}">
      <a
        class="${cx(
          'nav-link',
          'text-light',
          'text-uppercase',
          'd-flex',
          'align-items-center',
          item.active && 'active'
        )}"
        href="${item.url ?? '#'}"
        target="${ifDefined(item.external ? '_blank' : undefined)}"
        rel="${ifDefined(item.external ? 'noopener noreferrer' : undefined)}"
        @click="${(event: MouseEvent) => this.navigate(item, event)}"
      >
        ${item.icon ? html`<i class="${item.icon}" aria-hidden="true"></i>` : nothing}
        <span class="me-auto">${renderRich(item.label)}</span>
        ${this.renderBadge(item)}
      </a>
    </li>`;
  }

  protected override render(): unknown {
    const entries = this.visible(this.items);
    return html`<nav
      id="${this.collapseId || `${this.instanceId}-rail`}"
      class="${cx(
        'lia-sidebar',
        'collapse',
        !this.collapsed && 'd-md-flex',
        'flex-shrink-0',
        'flex-column',
        'bg-dark',
        'overflow-auto',
        'max-h-before-header'
      )}"
      data-bs-theme="dark"
      aria-label="${this.label}"
    >
      <ul class="nav d-flex flex-fill flex-column py-3">
        ${entries.map((item, index) =>
          item.items?.length ? this.renderGroup(item, index) : this.renderLeaf(item)
        )}
      </ul>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-sidebar': LiaSidebar;
  }
}
