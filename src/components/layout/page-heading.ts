import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { renderRich } from '../../core/utils.js';
import { renderLayoutActions } from './internal.js';

/**
 * The title bar that sits between the navbar and the page content: icon,
 * title, optional counter badge and description on the left, an action toolbar
 * on the right.
 *
 * When `backUrl` is set, a "back to overview" action is prepended to the
 * toolbar — the same affordance the reference panel adds to every detail form
 * and every filtered listing.
 *
 * Buttons without an `href` emit `lia-action` carrying the descriptor; anchors
 * navigate normally but still emit the event, so a router can intercept.
 *
 * @example
 * ```ts
 * html`<lia-page-heading
 *   title="Volumes"
 *   icon="fa-solid fa-database"
 *   description="Block storage attached to this project"
 *   .badge=${{ text: 12 }}
 *   back-url="/storage"
 *   .actions=${[{ id: 'create', label: 'New volume', icon: 'fa-solid fa-plus-circle' }]}
 *   @lia-action=${(e: CustomEvent) => console.log(e.detail.id)}
 * ></lia-page-heading>`
 * ```
 */
@customElement('lia-page-heading')
export class LiaPageHeading extends LiaElement {
  /**
   * Heading text.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute. Authoring it *as* an
   * HTML attribute still works, but the browser will then also show it as a
   * tooltip — bind the property (`.title=${…}`) if that bothers you.
   */
  @property({ type: String }) override title = '';

  /** Icon class rendered before the title. */
  @property({ type: String }) icon: IconName = '';

  /** Secondary line under the title. Trusted HTML is allowed. */
  @property({ type: String }) description = '';

  /** Counter pill after the title, e.g. the number of rows in a listing. */
  @property({ attribute: false }) badge?: { text: string | number; variant?: Variant };

  /** Toolbar on the right-hand side. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** When set, a "back" action is prepended to {@link actions}. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  /** Label of the generated back action. */
  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Icon of the generated back action. */
  @property({ type: String, attribute: 'back-icon' }) backIcon: IconName = 'fa-solid fa-reply';

  /** Heading level of the title, for pages that need a different outline. */
  @property({ type: Number }) level: 1 | 2 | 3 | 4 | 5 | 6 = 5;

  /** The toolbar as it is actually rendered, back action included. */
  get resolvedActions(): ActionDescriptor[] {
    const list = [...this.actions];
    if (this.backUrl) {
      list.unshift({
        id: 'back',
        label: this.backLabel,
        icon: this.backIcon,
        href: this.backUrl,
        variant: 'outline-secondary',
      });
    }
    return list;
  }

  /** True when there is nothing at all to show — the host can then skip the bar. */
  get isEmpty(): boolean {
    return (
      this.title === '' &&
      this.description === '' &&
      this.resolvedActions.filter((action) => action.visible !== false).length === 0
    );
  }

  private renderTitle(): unknown {
    const inner = html`${this.icon
      ? html`<i class="${this.icon} me-1" aria-hidden="true"></i>`
      : nothing}${this.title}${this.badge
      ? html` <small
          ><span class="badge rounded-pill bg-${this.badge.variant ?? 'secondary'}"
            >${this.badge.text}</span
          ></small
        >`
      : nothing}`;

    switch (this.level) {
      case 1:
        return html`<h1 class="h5 mb-1">${inner}</h1>`;
      case 2:
        return html`<h2 class="h5 mb-1">${inner}</h2>`;
      case 3:
        return html`<h3 class="h5 mb-1">${inner}</h3>`;
      case 4:
        return html`<h4 class="h5 mb-1">${inner}</h4>`;
      case 6:
        return html`<h6 class="h5 mb-1">${inner}</h6>`;
      default:
        return html`<h5 class="mb-1">${inner}</h5>`;
    }
  }

  protected override render(): unknown {
    if (this.isEmpty) return nothing;

    return html`<section
      class="lia-heading py-3 px-3 px-lg-5 shadow-sm d-flex justify-content-between align-items-center gap-3"
    >
      <div class="min-w-0">
        ${this.title ? this.renderTitle() : nothing}
        ${this.description
          ? html`<span class="text-body-secondary">${renderRich(this.description)}</span>`
          : nothing}
      </div>
      ${renderLayoutActions(this.resolvedActions, this)}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-page-heading': LiaPageHeading;
  }
}
