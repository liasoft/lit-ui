import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { renderRich, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import {
  fill,
  focusFirstControl,
  renderAuthFeedback,
  renderAuthField,
  renderAuthSubmit,
  renderAuthSwitch,
} from './internal.js';
import type { CodeInputDetail } from './code-input.js';
import './code-input.js';
import '../feedback/alert.js';

/** Detail of the `lia-two-factor` event. */
export interface TwoFactorSubmitDetail {
  /** The code the user entered, trimmed and upper-cased for recovery codes. */
  code: string;
  /** State of the "trust this device" switch; `false` when it is hidden. */
  remember: boolean;
  /** `true` when the user switched to the recovery-code field. */
  recovery: boolean;
}

/** Detail of the `lia-two-factor-resend` event. */
export interface TwoFactorResendDetail {
  /** How many times a new code has been requested during this challenge. */
  attempt: number;
}

/**
 * The second step of signing in: enter the one-time code.
 *
 * The code is entered in a segmented field (`<lia-code-input>`) that supports
 * paste and auto-advance and submits itself once the last box is filled; a
 * plain free-text input is available behind the `simple` flag. Two escape
 * hatches are built in: a
 * cooldown-guarded "send a new code" action for email/SMS delivery, and a
 * toggle to a recovery-code field for users who lost their authenticator.
 *
 * @example
 * ```html
 * <lia-two-factor-form show-remember show-recovery></lia-two-factor-form>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-two-factor-form
 *   simple
 *   .loading=${this.busy}
 *   .error=${this.error}
 *   show-resend
 *   .resendCooldown=${30}
 *   @lia-two-factor=${(e: CustomEvent) => this.verify(e.detail)}
 *   @lia-two-factor-resend=${() => this.sendCode()}
 * ></lia-two-factor-form>`
 * ```
 */
@customElement('lia-two-factor-form')
export class LiaTwoFactorForm extends LiaElement {
  /** The code entered so far. */
  @property({ type: String }) code = '';

  /** The recovery code entered so far, when the user switched modes. */
  @property({ type: String, attribute: 'recovery-code' }) recoveryCode = '';

  /** State of the "trust this device" switch. */
  @property({ type: Boolean }) remember = false;

  /** Explanatory paragraph above the field. */
  @property({ type: String }) description = '';

  /** How many characters the code has. */
  @property({ type: Number }) length = 6;

  /** Render one plain input instead of the segmented boxes. */
  @property({ type: Boolean }) simple = false;

  /** Accept letters as well as digits. */
  @property({ type: Boolean }) alphanumeric = false;

  @property({ type: String, attribute: 'code-label' }) codeLabel = 'Verification code';
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Verify';
  @property({ type: String, attribute: 'remember-label' }) rememberLabel = 'Trust this device';
  @property({ type: String, attribute: 'resend-label' }) resendLabel = 'Send a new code';
  @property({ type: String, attribute: 'recovery-label' }) recoveryLabel = 'Use a recovery code';
  @property({ type: String, attribute: 'recovery-field-label' }) recoveryFieldLabel =
    'Recovery code';
  @property({ type: String, attribute: 'recovery-back-label' }) recoveryBackLabel =
    'Use your verification code';
  @property({ type: String, attribute: 'recovery-hint' }) recoveryHint =
    'Enter one of the single-use codes you saved when you turned on two-factor authentication.';
  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Success';

  /** Countdown label while resending is blocked; `{seconds}` is substituted. */
  @property({ type: String, attribute: 'resend-wait-label' }) resendWaitLabel =
    'You can request a new code in {seconds}s';

  /** Shown when the field is empty or incomplete on submit. */
  @property({ type: String, attribute: 'incomplete-message' }) incompleteMessage =
    'Enter the complete code.';

  /** Offer the "trust this device" switch. */
  @property({ type: Boolean, attribute: 'show-remember' }) showRemember = false;

  /** Offer the "send a new code" action. */
  @property({ type: Boolean, attribute: 'show-resend' }) showResend = false;

  /** Offer the recovery-code toggle. */
  @property({ type: Boolean, attribute: 'show-recovery' }) showRecovery = false;

  /** Seconds the resend action stays blocked after each request. */
  @property({ type: Number, attribute: 'resend-cooldown' }) resendCooldown = 30;

  /** Submit as soon as the last character is entered. */
  @property({ converter: flag, attribute: 'auto-submit' }) autoSubmit = true;

  @property({ type: String }) error = '';
  @property({ type: String }) success = '';
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;

  /** Put the caret in the code field on render. */
  @property({ converter: flag, attribute: 'auto-focus' }) autoFocusFirst = true;

  @state() private recoveryMode = false;
  @state() private submitted = false;
  @state() private cooldown = 0;

  private resendCount = 0;
  private timer?: ReturnType<typeof setInterval>;
  private readonly instanceId = uid('lia-2fa');

  /** `true` while the recovery-code field is showing. */
  get isRecoveryMode(): boolean {
    return this.recoveryMode;
  }

  /** Clear the entered code and the validation state. */
  reset(): void {
    this.code = '';
    this.recoveryCode = '';
    this.submitted = false;
  }

  /** Switch between the code field and the recovery-code field. */
  setRecoveryMode(active: boolean): void {
    this.recoveryMode = active;
    this.submitted = false;
    void this.updateComplete.then(() => focusFirstControl(this));
  }

  override disconnectedCallback(): void {
    this.stopCooldown();
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    if (this.autoFocusFirst && !this.disabled && this.simple) focusFirstControl(this);
  }

  private stopCooldown(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private startCooldown(): void {
    this.stopCooldown();
    if (this.resendCooldown <= 0) return;
    this.cooldown = this.resendCooldown;
    this.timer = setInterval(() => {
      this.cooldown -= 1;
      if (this.cooldown <= 0) this.stopCooldown();
    }, 1000);
  }

  private get currentValue(): string {
    return this.recoveryMode ? this.recoveryCode.trim() : this.code.trim();
  }

  private get incomplete(): boolean {
    if (this.recoveryMode) return this.currentValue === '';
    return this.simple ? this.currentValue === '' : this.code.length < this.length;
  }

  private submitCode(): void {
    if (this.loading || this.disabled) return;
    this.submitted = true;
    if (this.incomplete) {
      void this.updateComplete.then(() => focusFirstControl(this));
      return;
    }
    this.emit<TwoFactorSubmitDetail>('lia-two-factor', {
      code: this.recoveryMode ? this.currentValue.toUpperCase() : this.currentValue,
      remember: this.showRemember ? this.remember : false,
      recovery: this.recoveryMode,
    });
  }

  private handleResend(): void {
    if (this.cooldown > 0 || this.loading || this.disabled) return;
    this.resendCount += 1;
    this.emit<TwoFactorResendDetail>('lia-two-factor-resend', { attempt: this.resendCount });
    this.startCooldown();
  }

  private renderCodeField(): TemplateResult {
    const busy = this.loading || this.disabled;
    const invalid = this.submitted && this.incomplete;
    if (this.recoveryMode) {
      return renderAuthField({
        id: `${this.instanceId}-recovery`,
        name: 'recovery-code',
        label: this.recoveryFieldLabel,
        value: this.recoveryCode,
        autocomplete: 'one-time-code',
        disabled: busy,
        invalid,
        error: this.incompleteMessage,
        hint: this.recoveryHint,
        onInput: (value) => {
          this.recoveryCode = value;
        },
      });
    }
    if (this.simple) {
      return renderAuthField({
        id: `${this.instanceId}-code`,
        name: 'code',
        label: this.codeLabel,
        value: this.code,
        autocomplete: 'one-time-code',
        inputmode: this.alphanumeric ? 'text' : 'numeric',
        disabled: busy,
        invalid,
        error: this.incompleteMessage,
        onInput: (value) => {
          this.code = value;
        },
      });
    }
    return html`<div class="mb-3">
      <span class="form-label d-block" id="${this.instanceId}-code-label">${this.codeLabel}</span>
      <lia-code-input
        .value=${this.code}
        .length=${this.length}
        ?alphanumeric=${this.alphanumeric}
        ?disabled=${busy}
        ?invalid=${invalid}
        .autoFocusFirst=${this.autoFocusFirst}
        label=${this.codeLabel}
        @lia-code-input-change=${(event: CustomEvent<CodeInputDetail>) => {
          this.code = event.detail.value;
        }}
        @lia-code-input-complete=${() => {
          if (this.autoSubmit) this.submitCode();
        }}
      ></lia-code-input>
      ${invalid
        ? html`<div class="invalid-feedback d-block">${this.incompleteMessage}</div>`
        : nothing}
    </div>`;
  }

  private renderExtras(): TemplateResult | typeof nothing {
    const rows: unknown[] = [];
    if (this.showRemember) {
      rows.push(
        renderAuthSwitch({
          id: `${this.instanceId}-remember`,
          name: 'remember-device',
          label: this.rememberLabel,
          checked: this.remember,
          disabled: this.loading || this.disabled,
          onChange: (checked) => {
            this.remember = checked;
          },
        })
      );
    }
    if (rows.length === 0) return nothing;
    return html`<div class="mb-3">${rows}</div>`;
  }

  private renderActions(): TemplateResult | typeof nothing {
    const links: TemplateResult[] = [];
    if (this.showResend) {
      links.push(html`<button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        ?disabled=${this.cooldown > 0 || this.loading || this.disabled}
        @click=${() => this.handleResend()}
      >
        <i class="fa-solid fa-rotate-right me-1" aria-hidden="true"></i>${this.resendLabel}
      </button>`);
    }
    if (this.showRecovery) {
      links.push(html`<button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        ?disabled=${this.loading || this.disabled}
        @click=${() => this.setRecoveryMode(!this.recoveryMode)}
      >
        <i class="fa-solid fa-life-ring me-1" aria-hidden="true"></i>${this.recoveryMode
          ? this.recoveryBackLabel
          : this.recoveryLabel}
      </button>`);
    }
    if (links.length === 0 && this.cooldown === 0) return nothing;
    return html`<div class="d-flex flex-wrap justify-content-between gap-2 mt-3">
      ${links}
      ${this.cooldown > 0
        ? html`<small class="text-body-secondary w-100" role="status">
            ${fill(this.resendWaitLabel, { seconds: this.cooldown })}
          </small>`
        : nothing}
    </div>`;
  }

  protected override render(): TemplateResult {
    return html`<form
      class="lia-two-factor-form"
      novalidate
      @submit=${(event: Event) => {
        event.preventDefault();
        this.submitCode();
      }}
    >
      ${this.description
        ? html`<p class="text-body-secondary">
            ${this.trustedHtml ? renderRich(this.description) : this.description}
          </p>`
        : nothing}
      ${renderAuthFeedback(this.error, this.success, {
        errorTitle: this.errorTitle,
        successTitle: this.successTitle,
        trustedHtml: this.trustedHtml,
      })}
      ${this.renderCodeField()}${this.renderExtras()}
      ${renderAuthSubmit({
        label: this.submitLabel,
        loading: this.loading,
        disabled: this.disabled,
        icon: 'fa-solid fa-shield-halved',
      })}
      ${this.renderActions()}
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-two-factor-form': LiaTwoFactorForm;
  }
  interface HTMLElementEventMap {
    'lia-two-factor': CustomEvent<TwoFactorSubmitDetail>;
    'lia-two-factor-resend': CustomEvent<TwoFactorResendDetail>;
  }
}
