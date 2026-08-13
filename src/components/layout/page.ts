import { html, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, AlertMessage, IconName, Variant } from '../../core/types.js';
import { renderRich } from '../../core/utils.js';
import { LightContent } from './light-content.js';
import { renderLayoutActions } from './internal.js';
import { flag } from './flag.js';
import './page-heading.js';

/**
 * A page inside `<lia-app-shell>`: heading bar, an alert region, and the
 * content itself — the three blocks stacked inside `<main>`, without having
 * to touch the shell.
 *
 * **Content projection.** The kit renders into the light DOM, so there is no
 * `<slot>`. Whatever you write inside `<lia-page>` is moved once into the
 * content `<section>` and left alone from then on; markup appended later is
 * picked up by a `MutationObserver`. Use {@link appendContent} to add nodes
 * imperatively.
 *
 * @example
 * ```html
 * <lia-page title="Volumes" icon="fa-solid fa-database" back-url="/storage">
 *   <lia-table id="volumes"></lia-table>
 * </lia-page>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-page
 *   title=${title}
 *   .actions=${[{ id: 'create', label: 'New', icon: 'fa-solid fa-plus-circle' }]}
 *   .alerts=${errors}
 *   @lia-dismiss=${(e: CustomEvent) => dismiss(e.detail.id)}
 * >${content}</lia-page>`
 * ```
 */
@customElement('lia-page')
export class LiaPage extends LiaElement {
  /**
   * Heading title.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute. Authoring it *as* an
   * HTML attribute still works, but the browser will then also show it as a
   * tooltip — bind the property (`.title=${…}`) if that bothers you.
   */
  @property({ type: String }) override title = '';

  @property({ type: String }) icon: IconName = '';

  /** Secondary line under the title. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Counter pill after the title. */
  @property({ attribute: false }) badge?: { text: string | number; variant?: Variant };

  /** Heading toolbar. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Prepends a "back" action to the toolbar. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Page-level messages, rendered between the heading and the content. */
  @property({ attribute: false }) alerts: AlertMessage[] = [];

  /** Render the heading bar at all. */
  @property({ converter: flag, attribute: 'show-heading' }) showHeading = true;

  /** Padding utilities for the content section. */
  @property({ type: String, attribute: 'content-class' }) contentClass = 'p-3 p-lg-5';

  /** Accessible name of the alert region. */
  @property({ type: String, attribute: 'alerts-label' }) alertsLabel = 'Messages';

  /** Accessible name of an alert's close button. */
  @property({ type: String, attribute: 'dismiss-label' }) dismissLabel = 'Dismiss';

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

  /** Append a node to the projected content. */
  appendContent(node: Node): void {
    this.content.append(node);
  }

  /** Remove every projected node. */
  clearContent(): void {
    this.content.clear();
  }

  private renderAlert(alert: AlertMessage, index: number): unknown {
    const id = alert.id ?? String(index);
    return html`<div
      class="alert alert-${alert.variant} d-flex align-items-baseline justify-content-between gap-3"
      role="alert"
    >
      <div>
        ${alert.icon ? html`<i class="${alert.icon} alert-icon" aria-hidden="true"></i>` : nothing}
        ${alert.title ? html`<strong class="me-1">${alert.title}</strong>` : nothing}
        ${alert.html ? renderRich(alert.message) : alert.message}
      </div>
      ${renderLayoutActions(alert.actions, this)}
      ${alert.dismissible
        ? html`<button
            type="button"
            class="btn-close"
            aria-label="${this.dismissLabel}"
            @click="${() => this.emit('lia-dismiss', { id })}"
          ></button>`
        : nothing}
    </div>`;
  }

  protected override render(): unknown {
    return html`${this.showHeading
      ? html`<lia-page-heading
          .title="${this.title}"
          .icon="${this.icon}"
          .description="${this.description}"
          .badge="${this.badge}"
          .actions="${this.actions}"
          .backUrl="${this.backUrl}"
          .backLabel="${this.backLabel}"
        ></lia-page-heading>`
      : nothing}
    ${this.alerts.length
      ? html`<div class="px-3 px-lg-5 pt-3" role="region" aria-label="${this.alertsLabel}">
          ${this.alerts.map((alert, index) => this.renderAlert(alert, index))}
        </div>`
      : nothing}
    <section class="lia-page-content flex-grow-1 ${this.contentClass}">
      ${this.content.holder}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-page': LiaPage;
  }
}
