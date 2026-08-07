import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LiaElement } from '../../core/base-element.js';
import type { AlertMessage } from '../../core/types.js';
import { cx } from '../../core/utils.js';
import './alert.js';

/**
 * A list of {@link AlertMessage}s rendered as stacked `<lia-alert>`s, with
 * per-item dismissal handled for you.
 *
 * This is what a page's flash-message area is made of: hand it whatever the
 * server returned and it takes care of keys, spacing and removal.
 *
 * @example
 * ```ts
 * html`<lia-alert-stack
 *   .messages=${[
 *     { id: 'saved', variant: 'success', message: 'Settings stored.', dismissible: true },
 *     { id: 'quota', variant: 'warning', title: 'Almost full', message: '92% of the quota is in use.' },
 *   ]}
 *   @lia-dismiss=${(e) => this.drop(e.detail.id)}
 * ></lia-alert-stack>`
 * ```
 */
@customElement('lia-alert-stack')
export class LiaAlertStack extends LiaElement {
  /** The messages to show, in order. */
  @property({ attribute: false }) messages: AlertMessage[] = [];

  /** Force every message to be dismissible, whatever the message says. */
  @property({ type: Boolean }) dismissible?: boolean;

  /** Accessible name of each close button. */
  @property({ type: String }) closeLabel = 'Close';

  /** Suppress the icon chip on every alert. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** Bootstrap gap utility step between the alerts. */
  @property({ type: String }) gap = '3';

  /** Rendered instead of the stack when there is nothing to show. */
  @property({ type: String }) emptyMessage?: string;

  /** Extra classes on the wrapping column. */
  @property({ type: String, attribute: 'stack-class' }) stackClass?: string;

  @state() private dismissed: ReadonlySet<string> = new Set<string>();

  /** The messages that are still on screen. */
  get visibleMessages(): AlertMessage[] {
    return this.messages.filter((message, index) => !this.dismissed.has(this.keyFor(message, index)));
  }

  /** Hide every message without touching the `messages` property. */
  dismissAll(): void {
    this.dismissed = new Set(this.messages.map((message, index) => this.keyFor(message, index)));
  }

  /** Bring every dismissed message back. */
  reset(): void {
    this.dismissed = new Set<string>();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // A fresh batch of messages starts with a clean slate.
    if (changed.has('messages')) this.dismissed = new Set<string>();
  }

  private keyFor(message: AlertMessage, index: number): string {
    return message.id ?? `index-${index}`;
  }

  private handleDismiss(event: Event, message: AlertMessage, index: number): void {
    // Swallow the child's event and re-emit one carrying the caller's own id.
    event.stopPropagation();
    const next = new Set(this.dismissed);
    next.add(this.keyFor(message, index));
    this.dismissed = next;
    this.emit<{ id?: string }>('lia-dismiss', { id: message.id });
  }

  protected override render(): TemplateResult | typeof nothing {
    const entries = this.messages
      .map((message, index) => ({ message, index, key: this.keyFor(message, index) }))
      .filter((entry) => !this.dismissed.has(entry.key));

    if (entries.length === 0) {
      return this.emptyMessage
        ? html`<p class="text-body-secondary mb-0">${this.emptyMessage}</p>`
        : nothing;
    }

    return html`<div class=${cx('d-flex flex-column', `gap-${this.gap}`, this.stackClass)}>
      ${repeat(
        entries,
        (entry) => entry.key,
        (entry) => html`<lia-alert
          .alert=${entry.message}
          .dismissible=${this.dismissible ?? entry.message.dismissible}
          .noIcon=${this.noIcon}
          .closeLabel=${this.closeLabel}
          @lia-dismiss=${(event: Event) => this.handleDismiss(event, entry.message, entry.index)}
        ></lia-alert>`
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-alert-stack': LiaAlertStack;
  }
}
