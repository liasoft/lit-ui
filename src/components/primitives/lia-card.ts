import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { renderIcon } from './lia-icon.js';
import { renderActions } from './render-action.js';
import { LightSlot } from './light-slot.js';

/**
 * A Bootstrap card: optional header with a title, icon and actions, a body,
 * and an optional footer.
 *
 * **Content can be supplied two ways, and both work at once:**
 *
 * 1. `.content` — any renderable value (a `TemplateResult`, string, number).
 *    Preferred when you are already writing a Lit template.
 * 2. Light-DOM children — write markup inside `<lia-card>…</lia-card>` and the
 *    card lifts it into the body once, on connect, then renders it back on
 *    every update. Use this for hand-written HTML pages, or when the children
 *    are other custom elements that must keep their identity.
 *
 * When the content is a `list-group` set `no-body`, exactly as Bootstrap wants:
 * flush list groups sit next to the body, not inside it.
 *
 * @example
 * ```html
 * <lia-card title="System details" icon="fa-solid fa-gears" no-body>
 *   <ul class="list-group list-group-flush">
 *     <lia-key-value label="Hostname" value="node-01"></lia-key-value>
 *   </ul>
 * </lia-card>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-card
 *   title="Traffic"
 *   icon="fa-solid fa-chart-line"
 *   .headerActions=${[{ id: 'reload', icon: 'fa-solid fa-rotate', title: 'Reload' }]}
 *   .content=${html`<canvas id="traffic"></canvas>`}
 * ></lia-card>`;
 * ```
 */
@customElement('lia-card')
export class LiaCard extends LiaElement {
  /**
   * Header title. Prefer the property binding (`.title=${…}`) — setting it as
   * a static `title="…"` attribute also gives the host a native browser
   * tooltip, which is rarely what you want on a card.
   */
  @property({ type: String }) override title = '';

  /** Small muted line under the title. */
  @property({ type: String }) subtitle = '';

  /**
   * Muted text at the trailing end of the header — the conditions the card's content was produced
   * under: the aggregate applied, the bucket width, the limit that truncated it.
   *
   * Distinct from {@link subtitle}, which sits under the title and describes what the card *is*. This
   * sits opposite it and describes what it is *showing right now*, which is the thing a reader needs
   * when a control above the card decides it.
   */
  @property({ type: String }) note = '';

  /** Icon-font class string rendered before the title. */
  @property({ type: String }) icon: IconName = '';

  /** Contextual colouring: tints the header and the card border. */
  @property({ type: String }) variant?: Variant;

  /** Skip the `.card-body` wrapper — for flush list groups, tables or images. */
  @property({ type: Boolean, attribute: 'no-body' }) noBody = false;

  /** Buttons rendered at the right end of the header. */
  @property({ attribute: false }) headerActions: ActionDescriptor[] = [];

  /** Buttons rendered in the footer. */
  @property({ attribute: false }) footerActions: ActionDescriptor[] = [];

  /** Body content as a renderable value; combined with any projected children. */
  @property({ attribute: false }) content?: unknown;

  /** Footer content as a renderable value. */
  @property({ attribute: false }) footer?: unknown;

  /** Extra classes for the `.card` element. */
  @property({ type: String, attribute: 'card-class' }) cardClass = '';

  /** Extra classes for the `.card-body` element. */
  @property({ type: String, attribute: 'body-class' }) bodyClass = '';

  /** Render the card in the muted "switched off" treatment. */
  @property({ type: Boolean }) deactivated = false;

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  private get hasHeader(): boolean {
    return Boolean(this.title || this.icon || this.subtitle || this.note || this.headerActions.length);
  }

  private get hasFooter(): boolean {
    return this.footer !== undefined || this.footerActions.length > 0;
  }

  private renderHeader(): TemplateResult | typeof nothing {
    if (!this.hasHeader) return nothing;
    return html`<div
      class=${cx(
        'card-header',
        'd-flex',
        'justify-content-between',
        'align-items-center',
        'gap-2',
        this.variant && `text-bg-${this.variant}`
      )}
    >
      <div class="text-truncate">
        <span class="d-inline-flex align-items-center gap-1">
          ${renderIcon(this.icon)}${this.title}
        </span>
        ${this.subtitle
          ? html`<div class="small fw-normal text-body-secondary">${this.subtitle}</div>`
          : nothing}
      </div>
      ${this.note ? html`<span class="small text-body-secondary text-nowrap">${this.note}</span>` : nothing}
      ${this.headerActions.length
        ? html`<div class="d-flex flex-wrap align-items-center gap-1" role="group">
            ${renderActions(this.headerActions, { host: this, size: 'sm' })}
          </div>`
        : nothing}
    </div>`;
  }

  private renderBody(): TemplateResult {
    const body = html`${this.content ?? nothing}${this.lightSlot.node}`;
    if (this.noBody) return html`${body}`;
    return html`<div class=${cx('card-body', this.bodyClass)}>${body}</div>`;
  }

  private renderFooter(): TemplateResult | typeof nothing {
    if (!this.hasFooter) return nothing;
    return html`<div class="card-footer d-flex flex-wrap align-items-center gap-1">
      ${this.footer ?? nothing}${renderActions(this.footerActions, { host: this, size: 'sm' })}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<div
      class=${cx(
        'card',
        this.variant && `border-${this.variant}`,
        this.deactivated && 'deactivated',
        this.cardClass
      )}
    >
      ${this.renderHeader()}${this.renderBody()}${this.renderFooter()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-card': LiaCard;
  }
}
