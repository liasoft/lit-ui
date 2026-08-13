import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, ConfirmDescriptor, IconName } from '../../core/types.js';
import { renderRich, uid } from '../../core/utils.js';
import { ACTION_CONFIRM_REQUEST_EVENT } from '../primitives/render-action.js';
import { ModalController } from './modal-controller.js';

/**
 * An extra opt-in switch shown inside the dialog — e.g. an "also delete the
 * user's files" checkbox on a delete prompt.
 */
export interface ConfirmOption {
  /** Key the value is reported under. */
  name: string;
  /** Trusted HTML label. */
  label: string;
  checked?: boolean;
  disabled?: boolean;
}

/** Everything `<lia-confirm-dialog>` can be asked to show. */
export interface ConfirmRequest extends ConfirmDescriptor {
  /** Overrides the icon derived from `variant`. */
  icon?: IconName;
  /** Hide the icon entirely. */
  noIcon?: boolean;
  /** Render `message` as trusted HTML. */
  html?: boolean;
  /** Extra switches shown under the message. */
  options?: ConfirmOption[];
  /** Arbitrary payload echoed back on the `lia-confirm` event. */
  data?: Record<string, unknown>;
}

/** The full outcome of a confirmation, including any {@link ConfirmOption}. */
export interface ConfirmResult {
  confirmed: boolean;
  /** Option name -> checked. Empty when the request had no options. */
  options: Record<string, boolean>;
  data?: Record<string, unknown>;
}

/**
 * Detail shape {@link installConfirmHandler} understands.
 *
 * The primitives family's `ActionConfirmRequestDetail` is the canonical
 * producer: it carries `confirm` plus `accept`/`cancel` continuations. This
 * interface is a structural superset that additionally supports a
 * promise-style `respond` / `result` convention, so any emitter can be
 * answered by the same handler.
 */
export interface ConfirmRequestEventDetail {
  /** The prompt to show. */
  confirm?: ConfirmDescriptor;
  /** Alternative source of the prompt (`action.confirm` is used). */
  action?: ActionDescriptor;
  /** Continuation invoked when the user confirms. */
  accept?: () => void;
  /** Continuation invoked when the user declines. */
  cancel?: () => void;
  /** Called with the pending answer, for promise-style emitters. */
  respond?: (confirmed: boolean | Promise<boolean>) => void;
  /** Filled in by the handler when no `respond` callback was supplied. */
  result?: Promise<boolean>;
}

const EMPTY_REQUEST: ConfirmRequest = { message: '' };

/**
 * The "are you sure?" dialog as a promise-returning component.
 *
 * Normally you do not place this element yourself: call the module-level
 * {@link confirmAction} helper, which lazily mounts a singleton on
 * `document.body`. Declare an instance only when you need to restyle it or
 * scope it to a subtree.
 *
 * @example
 * ```ts
 * const dialog = document.querySelector('lia-confirm-dialog')!;
 * if (await dialog.confirm({ message: 'Delete this entry?', variant: 'danger' })) {
 *   await api.delete(id);
 * }
 * ```
 */
@customElement('lia-confirm-dialog')
export class LiaConfirmDialog extends LiaElement {
  /** The prompt currently on screen. Set by {@link confirm}. */
  @property({ attribute: false }) request?: ConfirmRequest;

  /** Whether the dialog is open. Reflected so CSS can key off it. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Heading used when the request has no `title`. */
  @property({ type: String }) defaultTitle = 'Are you sure?';

  /** Accept-button label used when the request has no `confirmLabel`. */
  @property({ type: String }) defaultConfirmLabel = 'Yes';

  /** Cancel-button label used when the request has no `cancelLabel`. */
  @property({ type: String }) defaultCancelLabel = 'No';

  /** Accessible name of the header's close button. */
  @property({ type: String }) closeLabel = 'Close';

  @state() private optionValues: Record<string, boolean> = {};

  private readonly titleId = uid('lia-confirm-title');
  private readonly messageId = uid('lia-confirm-message');
  private resolver?: (result: ConfirmResult) => void;
  private accepted = false;

  private readonly modal = new ModalController(
    this,
    { backdrop: true, keyboard: true, focus: true },
    {
      onShown: () => this.focusInitialButton(),
      onHidden: () => this.handleHidden(),
    }
  );

  /**
   * Show the dialog and resolve once the user answered. Resolves `false` when
   * the dialog is dismissed with <kbd>Esc</kbd>, the backdrop or the ✕ button.
   */
  confirm(request: ConfirmRequest): Promise<boolean> {
    return this.confirmWithOptions(request).then((result) => result.confirmed);
  }

  /** Like {@link confirm}, but also reports the {@link ConfirmOption} values. */
  confirmWithOptions(request: ConfirmRequest): Promise<ConfirmResult> {
    // A prompt that is still pending is answered negatively before we replace it.
    this.settle({ confirmed: false, options: {} });
    this.request = request;
    this.accepted = false;
    this.optionValues = Object.fromEntries(
      (request.options ?? []).map((option) => [option.name, option.checked === true])
    );
    this.open = true;
    return new Promise<ConfirmResult>((resolve) => {
      this.resolver = resolve;
    });
  }

  /** Close the dialog programmatically, answering `confirmed`. */
  close(confirmed = false): void {
    this.accepted = confirmed;
    this.open = false;
  }

  protected override firstUpdated(): void {
    const element = this.querySelector<HTMLElement>(':scope > .modal');
    if (element) this.modal.attach(element);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    if (this.open) this.modal.show();
    else this.modal.hide();
  }

  override disconnectedCallback(): void {
    this.settle({ confirmed: false, options: {} });
    super.disconnectedCallback();
  }

  private get data(): ConfirmRequest {
    return this.request ?? EMPTY_REQUEST;
  }

  private settle(result: ConfirmResult): void {
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(result);
  }

  private handleHidden(): void {
    const result: ConfirmResult = {
      confirmed: this.accepted,
      options: { ...this.optionValues },
      data: this.data.data,
    };
    this.open = false;
    this.settle(result);
    this.emit<ConfirmResult>('lia-confirm', result);
  }

  private focusInitialButton(): void {
    // Destructive prompts open on "cancel" so a stray Enter cannot delete.
    const selector = this.variant === 'danger' ? '.lia-confirm-cancel' : '.lia-confirm-accept';
    this.querySelector<HTMLButtonElement>(selector)?.focus();
  }

  private get variant(): string {
    return this.data.variant ?? 'danger';
  }

  private handleOptionChange(name: string, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.optionValues = { ...this.optionValues, [name]: input.checked };
  }

  private renderOptionSwitches(): TemplateResult | typeof nothing {
    const options = this.data.options ?? [];
    if (options.length === 0) return nothing;
    return html`<div class="mt-3 d-flex flex-column gap-2">
      ${options.map((option) => {
        const id = `${this.messageId}-${option.name}`;
        return html`<div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id=${id}
            name=${option.name}
            ?disabled=${option.disabled === true}
            .checked=${this.optionValues[option.name] === true}
            @change=${(event: Event) => this.handleOptionChange(option.name, event)}
          />
          <label class="form-check-label" for=${id}>${renderRich(option.label)}</label>
        </div>`;
      })}
    </div>`;
  }

  protected override render(): TemplateResult {
    const data = this.data;
    const variant = this.variant;
    const icon = data.icon ?? 'fa-solid fa-circle-question';
    return html`<div
      class="modal fade"
      tabindex="-1"
      aria-labelledby=${this.titleId}
      aria-describedby=${this.messageId}
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title d-flex align-items-center gap-2" id=${this.titleId}>
              ${data.noIcon === true
                ? nothing
                : html`<i class="${icon} text-${variant}" aria-hidden="true"></i>`}
              <span>${data.title ?? this.defaultTitle}</span>
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label=${this.closeLabel}
              @click=${() => this.close(false)}
            ></button>
          </div>
          <div class="modal-body">
            <p class="mb-0" id=${this.messageId}>
              ${data.html === true ? renderRich(data.message) : data.message}
            </p>
            ${this.renderOptionSwitches()}
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary lia-confirm-cancel"
              @click=${() => this.close(false)}
            >
              ${data.cancelLabel ?? this.defaultCancelLabel}
            </button>
            <button
              type="button"
              class="btn btn-${variant} lia-confirm-accept"
              @click=${() => this.close(true)}
            >
              ${data.confirmLabel ?? this.defaultConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }
}

/* ------------------------------------------------------------------ *
 * Singleton helpers
 * ------------------------------------------------------------------ */

let singleton: LiaConfirmDialog | undefined;

/**
 * The lazily created, document-level confirmation dialog. Mounted on
 * `document.body` on first use.
 */
export function getConfirmDialog(): LiaConfirmDialog {
  if (!singleton || !singleton.isConnected) {
    singleton = document.createElement('lia-confirm-dialog');
    document.body.appendChild(singleton);
  }
  return singleton;
}

/**
 * Ask the user to confirm something, anywhere, without wiring up an element.
 *
 * @example
 * ```ts
 * import { confirmAction } from '@liasoft/lit-ui';
 *
 * if (await confirmAction({ message: 'Remove this entry?', variant: 'danger' })) {
 *   remove();
 * }
 * ```
 */
export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  return getConfirmDialog().confirm(request);
}

/** Like {@link confirmAction} but reports the extra switch values too. */
export function confirmActionWithOptions(request: ConfirmRequest): Promise<ConfirmResult> {
  return getConfirmDialog().confirmWithOptions(request);
}

/** Remove the singleton dialog from the document (mostly useful in tests). */
export function disposeConfirmDialog(): void {
  singleton?.remove();
  singleton = undefined;
}

/**
 * Answer `lia-action-confirm-request` events with the singleton dialog.
 *
 * Buttons, table rows and toolbars raise that cancelable event instead of
 * depending on the feedback family; without a handler they fall back to the
 * browser's `window.confirm()`. Calling this once at start-up upgrades the
 * whole document to the proper dialog.
 *
 * The handler claims the request with `preventDefault()`, shows the dialog and
 * then runs the emitter's `accept` / `cancel` continuation.
 *
 * @example
 * ```ts
 * import { installConfirmHandler } from '@liasoft/lit-ui';
 *
 * const uninstall = installConfirmHandler();
 * ```
 *
 * @returns a function that removes the listener again.
 */
export function installConfirmHandler(target: EventTarget = document): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<ConfirmRequestEventDetail | undefined>).detail;
    const descriptor = detail?.confirm ?? detail?.action?.confirm;
    if (!detail || !descriptor) return;
    // Claim the request so the emitter does not fall back to window.confirm().
    event.preventDefault();
    const answer = confirmAction(descriptor);
    if (typeof detail.respond === 'function') detail.respond(answer);
    else detail.result = answer;
    void answer.then((confirmed) => {
      if (confirmed) detail.accept?.();
      else detail.cancel?.();
    });
  };
  target.addEventListener(ACTION_CONFIRM_REQUEST_EVENT, listener);
  return () => target.removeEventListener(ACTION_CONFIRM_REQUEST_EVENT, listener);
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-confirm-dialog': LiaConfirmDialog;
  }
  interface HTMLElementEventMap {
    'lia-confirm': CustomEvent<ConfirmResult>;
  }
}
