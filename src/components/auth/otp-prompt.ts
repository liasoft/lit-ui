import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { uid } from '../../core/utils.js';
import { renderAuthField } from './internal.js';
import { LiaAuthPrompt } from './prompt-base.js';
import type { CodeInputDetail } from './code-input.js';
import './code-input.js';

/** Detail of the `lia-otp` event. */
export interface OtpPromptDetail {
  /** The code the user entered. */
  code: string;
}

/**
 * The one-time-password challenge shown before a sensitive action.
 *
 * This is the reference panel's `otpquestion` interstitial turned into a
 * modal you can await:
 *
 * ```ts
 * const answer = await prompt.request();
 * if (answer) await api.deleteEverything(answer.code);
 * ```
 *
 * Pass `inline` to keep the original full-page `alert alert-warning`
 * treatment. The code field is segmented by default; `simple` restores the
 * single input.
 *
 * @example
 * ```html
 * <lia-otp-prompt
 *   heading="Confirm with your authenticator"
 *   question="This action cannot be undone."
 * ></lia-otp-prompt>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-otp-prompt
 *   .open=${this.challenging}
 *   .loading=${this.busy}
 *   .error=${this.error}
 *   confirm-label="Verify and continue"
 *   @lia-otp=${(e: CustomEvent) => this.verify(e.detail.code)}
 *   @lia-otp-cancel=${() => (this.challenging = false)}
 * ></lia-otp-prompt>`
 * ```
 */
@customElement('lia-otp-prompt')
export class LiaOtpPrompt extends LiaAuthPrompt<OtpPromptDetail> {
  /** The code entered so far. */
  @property({ type: String }) code = '';

  /** How many characters the code has. */
  @property({ type: Number }) length = 6;

  /** Render one plain input instead of the segmented boxes. */
  @property({ type: Boolean }) simple = false;

  /** Accept letters as well as digits. */
  @property({ type: Boolean }) alphanumeric = false;

  /** Extra sentence between the question and the field. */
  @property({ type: String }) description = '';

  @property({ type: String, attribute: 'code-label' }) codeLabel = 'One-time code';
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = 'Verify';
  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = 'Cancel';
  @property({ type: String, attribute: 'incomplete-message' }) incompleteMessage =
    'Enter the complete code.';

  /** Submit as soon as the last character is entered. */
  @property({ type: Boolean, attribute: 'auto-submit' }) autoSubmit = false;

  @state() private submitted = false;

  private readonly instanceId = uid('lia-otp');

  /** Clear the field and the validation state. */
  reset(): void {
    this.code = '';
    this.submitted = false;
  }

  private get incomplete(): boolean {
    return this.simple ? this.code.trim() === '' : this.code.length < this.length;
  }

  protected override submitPrompt(): void {
    this.submitted = true;
    if (this.incomplete) return;
    const detail: OtpPromptDetail = { code: this.code.trim() };
    this.emit<OtpPromptDetail>('lia-otp', detail);
    this.close(detail);
  }

  protected override onCancelled(): void {
    this.submitted = false;
    this.emit('lia-otp-cancel');
  }

  protected override renderBody(): TemplateResult {
    const invalid = this.submitted && this.incomplete;
    if (this.simple) {
      return html`<div class="mt-3">
        ${this.description ? html`<p class="text-body-secondary">${this.description}</p>` : nothing}
        ${renderAuthField({
          id: `${this.instanceId}-code`,
          name: 'otp',
          label: this.codeLabel,
          value: this.code,
          autocomplete: 'one-time-code',
          inputmode: this.alphanumeric ? 'text' : 'numeric',
          disabled: this.loading,
          invalid,
          error: this.incompleteMessage,
          class: 'mb-0',
          onInput: (value) => {
            this.code = value;
          },
        })}
      </div>`;
    }
    return html`<div class="mt-3">
      ${this.description ? html`<p class="text-body-secondary">${this.description}</p>` : nothing}
      <span class="form-label d-block">${this.codeLabel}</span>
      <lia-code-input
        .value=${this.code}
        .length=${this.length}
        ?alphanumeric=${this.alphanumeric}
        ?disabled=${this.loading}
        ?invalid=${invalid}
        label=${this.codeLabel}
        @lia-code-input-change=${(event: CustomEvent<CodeInputDetail>) => {
          this.code = event.detail.value;
        }}
        @lia-code-input-complete=${() => {
          if (this.autoSubmit) this.submitPrompt();
        }}
      ></lia-code-input>
      ${invalid
        ? html`<div class="invalid-feedback d-block">${this.incompleteMessage}</div>`
        : nothing}
    </div>`;
  }

  protected override renderFooter(): TemplateResult {
    return html`<button
        type="button"
        class="btn btn-secondary"
        ?disabled=${this.loading}
        @click=${() => this.close(null)}
      >
        ${this.cancelLabel}
      </button>
      <button type="submit" class="btn btn-${this.variant === 'warning' ? 'danger' : this.variant}"
        ?disabled=${this.loading} aria-busy=${this.loading ? 'true' : nothing}>
        ${this.loading
          ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
          : nothing}${this.confirmLabel}
      </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-otp-prompt': LiaOtpPrompt;
  }
  interface HTMLElementEventMap {
    'lia-otp': CustomEvent<OtpPromptDetail>;
    'lia-otp-cancel': CustomEvent<void>;
  }
}
