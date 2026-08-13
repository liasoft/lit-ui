import { Toast } from 'bootstrap';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, AlertMessage, IconName, Variant } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { renderActionRow, variantIcon, variantIsDark } from './internal.js';

/** Where `<lia-toast-container>` docks itself. */
export type ToastPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'middle-start'
  | 'middle-center'
  | 'middle-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end';

/** Default auto-dismiss delay, in milliseconds. */
export const DEFAULT_TOAST_TIMEOUT = 5000;

/**
 * A single Bootstrap toast.
 *
 * Usually created for you by {@link LiaToastContainer}; place one by hand only
 * when you want a toast in a fixed spot of your own layout.
 *
 * @example
 * ```ts
 * html`<lia-toast
 *   .message=${{ variant: 'success', title: 'Saved', message: 'Settings stored.', timeout: 4000 }}
 *   @lia-dismiss=${() => this.drop(id)}
 * ></lia-toast>`
 * ```
 */
@customElement('lia-toast')
export class LiaToast extends LiaElement {
  /** The message as data. Individual properties override its fields. */
  @property({ attribute: false }) message?: AlertMessage;

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant?: Variant;

  /** Bold title; renders the toast with a header row. */
  @property({ type: String }) heading?: string;

  /** Body text. */
  @property({ type: String }) text?: string;

  /** Render the body as trusted HTML. */
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml?: boolean;

  /** Icon shown before the message. Defaults to the variant's icon. */
  @property({ type: String }) icon?: IconName;

  /** Suppress the icon. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** Auto-dismiss delay in ms. `0` or a negative value keeps the toast up. */
  @property({ type: Number }) timeout?: number;

  /** Delay used when neither the property nor the message specify one. */
  @property({ type: Number }) defaultTimeout = DEFAULT_TOAST_TIMEOUT;

  /** Accessible name of the close button. */
  @property({ type: String }) closeLabel = 'Close';

  /** Hide the close button (only sensible together with a timeout). */
  @property({ type: Boolean, attribute: 'no-close' }) noClose = false;

  /** Extra caption on the right of the header, e.g. a relative timestamp. */
  @property({ type: String }) caption?: string;

  /** Buttons rendered under the message. */
  @property({ attribute: false }) actions?: ActionDescriptor[];

  /** Whether the toast is visible. */
  @property({ type: Boolean, reflect: true }) open = true;

  private instance?: Toast;
  private element?: HTMLElement;
  private initialised = false;

  /** The effective message, merging the `message` object with the attributes. */
  get data(): AlertMessage {
    const base = this.message;
    return {
      id: base?.id,
      variant: this.variant ?? base?.variant ?? 'primary',
      title: this.heading ?? base?.title,
      message: this.text ?? base?.message ?? '',
      html: this.trustedHtml ?? base?.html,
      icon: this.icon ?? base?.icon,
      dismissible: base?.dismissible,
      timeout: this.timeout ?? base?.timeout,
      actions: this.actions ?? base?.actions,
    };
  }

  /** Show the toast. */
  show(): void {
    this.open = true;
    this.instance?.show();
  }

  /** Hide the toast; `lia-dismiss` follows once the fade completes. */
  hide(): void {
    this.open = false;
    this.instance?.hide();
  }

  protected override firstUpdated(): void {
    this.attach();
    if (this.open) this.instance?.show();
  }

  protected override updated(changed: PropertyValues<this>): void {
    // `firstUpdated` already did the work for the very first cycle.
    if (!this.initialised) {
      this.initialised = true;
      return;
    }
    if (changed.has('message') || changed.has('timeout') || changed.has('defaultTimeout')) {
      // Re-create so Bootstrap picks up the new autohide delay.
      const wasOpen = this.open;
      this.detach();
      this.attach();
      if (wasOpen) this.instance?.show();
      return;
    }
    if (!changed.has('open')) return;
    if (this.open) this.instance?.show();
    else this.instance?.hide();
  }

  override disconnectedCallback(): void {
    this.detach();
    super.disconnectedCallback();
  }

  private attach(): void {
    const element = this.querySelector<HTMLElement>(':scope > .toast');
    if (!element) return;
    const timeout = this.data.timeout ?? this.defaultTimeout;
    this.element = element;
    element.addEventListener('hidden.bs.toast', this.handleHidden);
    this.instance = new Toast(element, {
      animation: true,
      autohide: timeout > 0,
      delay: timeout > 0 ? timeout : DEFAULT_TOAST_TIMEOUT,
    });
  }

  private detach(): void {
    this.element?.removeEventListener('hidden.bs.toast', this.handleHidden);
    this.element = undefined;
    try {
      this.instance?.dispose();
    } catch {
      /* already detached */
    }
    this.instance = undefined;
  }

  private readonly handleHidden = (): void => {
    this.open = false;
    this.emit<{ id?: string }>('lia-dismiss', { id: this.data.id });
    this.emit<{ id?: string }>('lia-toast-hide', { id: this.data.id });
  };

  private renderClose(extraClass: string): TemplateResult | typeof nothing {
    if (this.noClose) return nothing;
    return html`<button
      type="button"
      class=${cx(
        'btn-close',
        variantIsDark(this.data.variant) ? 'btn-close-white' : '',
        extraClass
      )}
      aria-label=${this.closeLabel}
      @click=${() => this.hide()}
    ></button>`;
  }

  protected override render(): TemplateResult {
    const data = this.data;
    const body = data.html === true ? renderRich(data.message) : data.message;
    const iconClass = data.icon ?? variantIcon(data.variant);
    const actions = renderActionRow(data.actions, 'mt-2', {
      host: this,
      size: 'sm',
      variant: variantIsDark(data.variant) ? 'light' : 'dark',
    });

    // `classMap` rather than an interpolation: Bootstrap toggles `show`,
    // `showing` and `hide` on this element and must not be overwritten.
    const surface = classMap({ [`text-bg-${data.variant}`]: true });

    return html`<div
      class="toast fade border-0 lia-toast ${surface}"
      role="alert"
      aria-live=${data.variant === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      ${data.title
        ? html`<div class="toast-header bg-transparent border-0 text-reset">
              ${this.noIcon
                ? nothing
                : html`<i class="${iconClass} me-2" aria-hidden="true"></i>`}
              <strong class="me-auto">${data.title}</strong>
              ${this.caption ? html`<small class="opacity-75">${this.caption}</small>` : nothing}
              ${this.renderClose('ms-2')}
            </div>
            <div class="toast-body pt-0">${body}${actions}</div>`
        : html`<div class="d-flex">
            <div class="toast-body d-flex align-items-start gap-2">
              ${this.noIcon ? nothing : html`<i class=${iconClass} aria-hidden="true"></i>`}
              <div class="min-w-0">${body}${actions}</div>
            </div>
            ${this.renderClose('me-2 m-auto')}
          </div>`}
    </div>`;
  }
}

/**
 * The fixed stack toasts live in.
 *
 * Drop one into your app shell and drive it with the `messages` property, or
 * ignore it entirely and use the module-level {@link toast} helper, which
 * mounts a singleton container on `document.body` the first time it is called.
 *
 * @example
 * ```ts
 * html`<lia-toast-container
 *   placement="bottom-end"
 *   .messages=${this.notifications}
 *   @lia-dismiss=${(e) => this.drop(e.detail.id)}
 * ></lia-toast-container>`
 * ```
 */
@customElement('lia-toast-container')
export class LiaToastContainer extends LiaElement {
  /** Messages to show. Replacing the array replaces the whole stack. */
  @property({ attribute: false }) messages: AlertMessage[] = [];

  /** Corner (or edge) the stack docks to. */
  @property({ type: String }) placement: ToastPlacement = 'top-end';

  /** Delay applied to messages without their own `timeout`. */
  @property({ type: Number }) defaultTimeout = DEFAULT_TOAST_TIMEOUT;

  /** Accessible name of the live region. */
  @property({ type: String }) regionLabel = 'Notifications';

  /** Accessible name of each close button. */
  @property({ type: String }) closeLabel = 'Close';

  /** Oldest toasts beyond this count are dropped. `0` means no limit. */
  @property({ type: Number }) max = 6;

  @state() private items: AlertMessage[] = [];

  /** The toasts currently in the stack. */
  get toasts(): readonly AlertMessage[] {
    return this.items;
  }

  /**
   * Add a toast. Returns the id it was filed under, which is also what
   * `lia-dismiss` reports and what {@link dismiss} expects.
   */
  push(message: string | AlertMessage, overrides: Partial<AlertMessage> = {}): string {
    const base: AlertMessage =
      typeof message === 'string' ? { variant: 'primary', message } : { ...message };
    const item: AlertMessage = { ...base, ...overrides };
    item.id ??= uid('lia-toast');
    const next = [...this.items, item];
    this.items = this.max > 0 && next.length > this.max ? next.slice(next.length - this.max) : next;
    return item.id;
  }

  /** Remove a toast by id. */
  dismiss(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
  }

  /** Empty the stack. */
  clear(): void {
    this.items = [];
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('messages')) return;
    this.items = this.messages.map((message) => ({ ...message, id: message.id ?? uid('lia-toast') }));
  }

  private handleDismiss(event: Event, item: AlertMessage): void {
    event.stopPropagation();
    this.items = this.items.filter((candidate) => candidate.id !== item.id);
    this.emit<{ id?: string }>('lia-dismiss', { id: item.id });
  }

  protected override render(): TemplateResult {
    return html`<div
      class=${cx('toast-container lia-toast-container', `lia-toast-${this.placement}`)}
      role="region"
      aria-label=${this.regionLabel}
    >
      ${repeat(
        this.items,
        (item) => item.id,
        (item) => html`<lia-toast
          .message=${item}
          .defaultTimeout=${this.defaultTimeout}
          .closeLabel=${this.closeLabel}
          @lia-dismiss=${(event: Event) => this.handleDismiss(event, item)}
        ></lia-toast>`
      )}
    </div>`;
  }
}

/* ------------------------------------------------------------------ *
 * Singleton helpers
 * ------------------------------------------------------------------ */

let container: LiaToastContainer | undefined;

/** The lazily created, document-level toast container. */
export function getToastContainer(placement?: ToastPlacement): LiaToastContainer {
  if (!container || !container.isConnected) {
    container = document.createElement('lia-toast-container');
    document.body.appendChild(container);
  }
  if (placement) container.placement = placement;
  return container;
}

/**
 * Show a toast from anywhere, without placing a container yourself.
 *
 * @example
 * ```ts
 * import { toast } from '@liasoft/lit-ui';
 *
 * toast('Settings saved.');
 * toast({ variant: 'danger', title: 'Upload failed', message: err.message, timeout: 0 });
 * ```
 *
 * @returns the id of the new toast, for use with {@link dismissToast}.
 */
export function toast(
  message: string | AlertMessage,
  overrides: Partial<AlertMessage> = {}
): string {
  return getToastContainer().push(message, overrides);
}

/** Remove a toast previously created with {@link toast}. */
export function dismissToast(id: string): void {
  container?.dismiss(id);
}

/** Remove every toast from the singleton container. */
export function clearToasts(): void {
  container?.clear();
}

/** Detach the singleton container from the document (mostly useful in tests). */
export function disposeToastContainer(): void {
  container?.remove();
  container = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-toast': LiaToast;
    'lia-toast-container': LiaToastContainer;
  }
  interface HTMLElementEventMap {
    'lia-toast-hide': CustomEvent<{ id?: string }>;
  }
}
