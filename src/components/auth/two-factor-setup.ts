import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName } from '../../core/types.js';
import { copyToClipboard, cx, renderRich, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { renderAuthFeedback, renderAuthSubmit } from './internal.js';
import type { CodeInputDetail } from './code-input.js';
import './code-input.js';
import '../feedback/alert.js';
import '../primitives/lia-copy-button.js';

/** One offer in the method chooser. */
export interface TwoFactorMethodOption {
  /** Value reported back in the events, e.g. `off`, `email`, `app`. */
  value: string;
  label: string;
  /** One line explaining what the method means for the user. */
  description?: string;
  icon?: IconName;
  disabled?: boolean;
}

/** Which panel of the enrolment flow is on screen. */
export type TwoFactorSetupStage = 'choose' | 'verify' | 'active';

/** Detail of `lia-two-factor-method`, `-verify`, `-disable` and `-cancel`. */
export interface TwoFactorSetupDetail {
  /** The method the user picked or that is currently active. */
  method: string;
  /** The verification code, on `lia-two-factor-verify` only. */
  code?: string;
  /** The shared secret being confirmed, on `lia-two-factor-verify` only. */
  secret?: string;
}

/** Detail of the `lia-recovery-codes` event. */
export interface RecoveryCodesDetail {
  action: 'copy' | 'download' | 'regenerate';
  codes: string[];
}

/** The generic three-way choice: off, a mailed code, or an authenticator app. */
export const DEFAULT_TWO_FACTOR_METHODS: readonly TwoFactorMethodOption[] = Object.freeze([
  {
    value: 'off',
    label: 'Disabled',
    description: 'Sign in with your password only.',
    icon: 'fa-solid fa-shield-slash',
  },
  {
    value: 'email',
    label: 'Emailed code',
    description: 'A single-use code is sent to your address at every sign-in.',
    icon: 'fa-solid fa-envelope',
  },
  {
    value: 'app',
    label: 'Authenticator app',
    description: 'Your app generates a new code every 30 seconds, offline.',
    icon: 'fa-solid fa-mobile-screen-button',
  },
]);

/**
 * The two-factor enrolment panel: pick a method, confirm it with a code, then
 * keep the recovery codes somewhere safe.
 *
 * The flow is modelled as explicit stages: the method choice renders as
 * described radio cards, the shared secret sits in a copyable
 * field for people who cannot scan, and the recovery codes come as a
 * saveable list. It stays presentation-only — bring your own QR data
 * URI in `qr-src`; no QR library is bundled.
 *
 * @example
 * ```html
 * <lia-two-factor-setup stage="choose"></lia-two-factor-setup>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-two-factor-setup
 *   stage="verify"
 *   method="app"
 *   .qrSrc=${this.qrDataUri}
 *   .secret=${this.secret}
 *   .recoveryCodes=${this.codes}
 *   @lia-two-factor-method=${(e: CustomEvent) => this.begin(e.detail.method)}
 *   @lia-two-factor-verify=${(e: CustomEvent) => this.activate(e.detail)}
 *   @lia-two-factor-disable=${() => this.turnOff()}
 * ></lia-two-factor-setup>`
 * ```
 */
@customElement('lia-two-factor-setup')
export class LiaTwoFactorSetup extends LiaElement {
  /** Which panel to show. */
  @property({ type: String }) stage: TwoFactorSetupStage = 'choose';

  /** The selected (or active) method. */
  @property({ type: String }) method = 'off';

  /** The offers in the chooser. */
  @property({ attribute: false }) methods: readonly TwoFactorMethodOption[] =
    DEFAULT_TWO_FACTOR_METHODS;

  /** Render the chooser as a `<select>` rather than radio cards. */
  @property({ type: Boolean }) compact = false;

  /** Data URI (or URL) of the enrolment QR code. */
  @property({ type: String, attribute: 'qr-src' }) qrSrc = '';

  /** Accessible description of the QR image. */
  @property({ type: String, attribute: 'qr-alt' }) qrAlt =
    'Enrolment QR code for your authenticator app';

  /** The shared secret, shown as a copyable fallback for the QR code. */
  @property({ type: String }) secret = '';

  /** The verification code the user is typing. */
  @property({ type: String }) code = '';

  /** How many characters the verification code has. */
  @property({ type: Number, attribute: 'code-length' }) codeLength = 6;

  /** Single-use fallback codes to show once enrolment succeeded. */
  @property({ attribute: false }) recoveryCodes: string[] = [];

  /** Wrap the panel in a `.card`. */
  @property({ converter: flag }) card = true;

  @property({ type: String }) heading = 'Two-factor authentication';
  @property({ type: String }) icon: IconName = 'fa-solid fa-shield-halved';
  @property({ type: String }) description = '';

  @property({ type: String, attribute: 'method-label' }) methodLabel = 'Method';
  @property({ type: String, attribute: 'scan-label' }) scanLabel =
    'Scan this code with your authenticator app.';
  @property({ type: String, attribute: 'secret-label' }) secretLabel = 'Setup key';
  @property({ type: String, attribute: 'secret-hint' }) secretHint =
    'Cannot scan? Enter this key in your app by hand.';
  @property({ type: String, attribute: 'email-hint' }) emailHint =
    'We have sent a confirmation code to your address. Enter it below to finish.';
  @property({ type: String, attribute: 'code-label' }) codeLabel = 'Confirmation code';
  @property({ type: String, attribute: 'continue-label' }) continueLabel = 'Continue';
  @property({ type: String, attribute: 'verify-label' }) verifyLabel = 'Turn on';
  @property({ type: String, attribute: 'disable-label' }) disableLabel = 'Turn off';
  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = 'Cancel';
  @property({ type: String, attribute: 'active-message' }) activeMessage =
    'Two-factor authentication is active on this account.';
  @property({ type: String, attribute: 'recovery-title' }) recoveryTitle = 'Recovery codes';
  @property({ type: String, attribute: 'recovery-description' }) recoveryDescription =
    'Each code works once. Store them somewhere you can reach without this account.';
  @property({ type: String, attribute: 'copy-label' }) copyLabel = 'Copy all';
  @property({ type: String, attribute: 'download-label' }) downloadLabel = 'Download';
  @property({ type: String, attribute: 'regenerate-label' }) regenerateLabel = 'Generate new codes';
  @property({ type: String, attribute: 'download-filename' }) downloadFilename =
    'recovery-codes.txt';
  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Success';
  @property({ type: String, attribute: 'incomplete-message' }) incompleteMessage =
    'Enter the complete code.';

  /** Offer the "generate new codes" action next to the recovery list. */
  @property({ type: Boolean, attribute: 'show-regenerate' }) showRegenerate = false;

  @property({ type: String }) error = '';
  @property({ type: String }) success = '';
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;

  @state() private submitted = false;

  private readonly instanceId = uid('lia-2fa-setup');

  /** The recovery codes as the plain text the copy and download actions use. */
  get recoveryText(): string {
    return this.recoveryCodes.join('\n');
  }

  private get busy(): boolean {
    return this.loading || this.disabled;
  }

  private emitSetup(type: string, extra: Partial<TwoFactorSetupDetail> = {}): void {
    this.emit<TwoFactorSetupDetail>(type, { method: this.method, ...extra });
  }

  private handleChoose(event: Event): void {
    event.preventDefault();
    if (this.busy) return;
    this.emitSetup('lia-two-factor-method');
  }

  private handleVerify(event: Event): void {
    event.preventDefault();
    if (this.busy) return;
    this.submitted = true;
    if (this.code.length < this.codeLength) return;
    this.emitSetup('lia-two-factor-verify', { code: this.code, secret: this.secret });
  }

  private async handleCopyCodes(): Promise<void> {
    await copyToClipboard(this.recoveryText);
    this.emit<RecoveryCodesDetail>('lia-recovery-codes', {
      action: 'copy',
      codes: [...this.recoveryCodes],
    });
  }

  private handleDownloadCodes(): void {
    const blob = new Blob([`${this.recoveryText}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadFilename;
    anchor.rel = 'noopener';
    anchor.click();
    // Give the browser a tick to start the download before dropping the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.emit<RecoveryCodesDetail>('lia-recovery-codes', {
      action: 'download',
      codes: [...this.recoveryCodes],
    });
  }

  /* ------------------------------------------------------------------ *
   * Stages
   * ------------------------------------------------------------------ */

  private renderChooser(): TemplateResult {
    const options = this.methods;
    if (this.compact) {
      const id = `${this.instanceId}-method`;
      return html`<div class="mb-3">
        <label class="form-label" for=${id}>${this.methodLabel}</label>
        <select
          class="form-select"
          id=${id}
          name="method"
          .value=${this.method}
          ?disabled=${this.busy}
          @change=${(event: Event) => {
            this.method = (event.target as HTMLSelectElement).value;
          }}
        >
          ${options.map(
            (option) => html`<option value=${option.value} ?disabled=${option.disabled === true}>
              ${option.label}
            </option>`
          )}
        </select>
      </div>`;
    }

    return html`<div
      class="lia-2fa-methods list-group mb-3"
      role="radiogroup"
      aria-label=${this.methodLabel}
    >
      ${options.map((option) => {
        const id = `${this.instanceId}-method-${option.value}`;
        const selected = this.method === option.value;
        return html`<label
          class=${cx(
            'list-group-item list-group-item-action d-flex gap-3 align-items-start',
            selected && 'active'
          )}
          for=${id}
        >
          <input
            class="form-check-input flex-shrink-0 mt-1"
            type="radio"
            name="${this.instanceId}-method"
            id=${id}
            value=${option.value}
            .checked=${selected}
            ?disabled=${this.busy || option.disabled === true}
            @change=${() => {
              this.method = option.value;
            }}
          />
          <span class="flex-grow-1">
            <span class="d-flex align-items-center gap-2 fw-semibold">
              ${option.icon ? html`<i class=${option.icon} aria-hidden="true"></i>` : nothing}
              ${option.label}
            </span>
            ${option.description
              ? html`<span class=${cx('d-block small', selected ? '' : 'text-body-secondary')}>
                  ${option.description}
                </span>`
              : nothing}
          </span>
        </label>`;
      })}
    </div>`;
  }

  private renderSecret(): TemplateResult | typeof nothing {
    if (!this.secret) return nothing;
    const id = `${this.instanceId}-secret`;
    return html`<div class="mb-3">
      <label class="form-label" for=${id}>${this.secretLabel}</label>
      <div class="input-group">
        <input
          class="form-control lia-2fa-secret font-monospace"
          id=${id}
          type="text"
          readonly
          .value=${this.secret}
          aria-describedby="${id}-hint"
          @focus=${(event: Event) => (event.target as HTMLInputElement).select()}
        />
        <lia-copy-button .text=${this.secret} title=${this.copyLabel}></lia-copy-button>
      </div>
      <div class="form-text" id="${id}-hint">${this.secretHint}</div>
    </div>`;
  }

  private renderVerify(): TemplateResult {
    const invalid = this.submitted && this.code.length < this.codeLength;
    return html`<div class="lia-2fa-verify">
      ${this.qrSrc
        ? html`<p class="text-body-secondary">${this.scanLabel}</p>
            <div class="text-center mb-3">
              <img class="lia-2fa-qr img-fluid" src=${this.qrSrc} alt=${this.qrAlt} />
            </div>`
        : nothing}
      ${!this.qrSrc && this.emailHint
        ? html`<p class="text-body-secondary">${this.emailHint}</p>`
        : nothing}
      ${this.renderSecret()}
      <div class="mb-3">
        <span class="form-label d-block">${this.codeLabel}</span>
        <lia-code-input
          .value=${this.code}
          .length=${this.codeLength}
          ?disabled=${this.busy}
          ?invalid=${invalid}
          label=${this.codeLabel}
          @lia-code-input-change=${(event: CustomEvent<CodeInputDetail>) => {
            this.code = event.detail.value;
          }}
        ></lia-code-input>
        ${invalid
          ? html`<div class="invalid-feedback d-block">${this.incompleteMessage}</div>`
          : nothing}
      </div>
    </div>`;
  }

  private renderActive(): TemplateResult {
    const active = this.methods.find((option) => option.value === this.method);
    return html`<div class="lia-2fa-active">
      <div class="d-flex align-items-start gap-2 mb-3">
        <i class="fa-solid fa-circle-check text-success mt-1" aria-hidden="true"></i>
        <div>
          <p class="mb-0">${this.activeMessage}</p>
          ${active
            ? html`<p class="small text-body-secondary mb-0">
                ${this.methodLabel}: ${active.label}
              </p>`
            : nothing}
        </div>
      </div>
    </div>`;
  }

  private renderRecoveryCodes(): TemplateResult | typeof nothing {
    if (this.recoveryCodes.length === 0) return nothing;
    return html`<section class="lia-2fa-recovery mt-4" aria-labelledby="${this.instanceId}-rc">
      <h3 class="h6" id="${this.instanceId}-rc">${this.recoveryTitle}</h3>
      <p class="small text-body-secondary">${this.recoveryDescription}</p>
      <ul class="lia-recovery-codes list-unstyled font-monospace mb-3">
        ${this.recoveryCodes.map((entry) => html`<li>${entry}</li>`)}
      </ul>
      <div class="d-flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click=${() => void this.handleCopyCodes()}
        >
          <i class="fa-solid fa-copy me-1" aria-hidden="true"></i>${this.copyLabel}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click=${() => this.handleDownloadCodes()}
        >
          <i class="fa-solid fa-download me-1" aria-hidden="true"></i>${this.downloadLabel}
        </button>
        ${this.showRegenerate
          ? html`<button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              ?disabled=${this.busy}
              @click=${() =>
                this.emit<RecoveryCodesDetail>('lia-recovery-codes', {
                  action: 'regenerate',
                  codes: [...this.recoveryCodes],
                })}
            >
              <i class="fa-solid fa-rotate me-1" aria-hidden="true"></i>${this.regenerateLabel}
            </button>`
          : nothing}
      </div>
    </section>`;
  }

  private renderStage(): TemplateResult {
    if (this.stage === 'verify') return this.renderVerify();
    if (this.stage === 'active') return this.renderActive();
    return this.renderChooser();
  }

  private renderFooter(): TemplateResult {
    if (this.stage === 'verify') {
      return html`<div class="d-flex flex-wrap gap-2">
        <button
          type="submit"
          class="btn btn-primary flex-grow-1"
          ?disabled=${this.busy}
          aria-busy=${this.loading ? 'true' : nothing}
        >
          ${this.loading
            ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
            : html`<i class="fa-solid fa-check me-2" aria-hidden="true"></i>`}${this.verifyLabel}
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          ?disabled=${this.busy}
          @click=${() => this.emitSetup('lia-two-factor-cancel')}
        >
          ${this.cancelLabel}
        </button>
      </div>`;
    }
    if (this.stage === 'active') {
      return html`<div class="d-grid gap-2">
        <button
          type="button"
          class="btn btn-outline-danger"
          ?disabled=${this.busy}
          @click=${() => this.emitSetup('lia-two-factor-disable')}
        >
          <i class="fa-solid fa-shield-slash me-2" aria-hidden="true"></i>${this.disableLabel}
        </button>
      </div>`;
    }
    return renderAuthSubmit({
      label: this.continueLabel,
      loading: this.loading,
      disabled: this.disabled,
      icon: 'fa-solid fa-arrow-right',
    });
  }

  private renderContent(): TemplateResult {
    return html`<form
      class="lia-two-factor-setup"
      novalidate
      @submit=${(event: Event) =>
        this.stage === 'verify' ? this.handleVerify(event) : this.handleChoose(event)}
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
      ${this.renderStage()}${this.renderFooter()}${this.renderRecoveryCodes()}
    </form>`;
  }

  protected override render(): TemplateResult {
    if (!this.card) return this.renderContent();
    return html`<div class="card shadow-sm">
      <div class="card-body">
        <h2 class="card-title h5 d-flex align-items-center gap-2">
          ${this.icon ? html`<i class=${this.icon} aria-hidden="true"></i>` : nothing}
          ${this.heading}
        </h2>
        ${this.renderContent()}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-two-factor-setup': LiaTwoFactorSetup;
  }
  interface HTMLElementEventMap {
    'lia-two-factor-method': CustomEvent<TwoFactorSetupDetail>;
    'lia-two-factor-verify': CustomEvent<TwoFactorSetupDetail>;
    'lia-two-factor-disable': CustomEvent<TwoFactorSetupDetail>;
    'lia-two-factor-cancel': CustomEvent<TwoFactorSetupDetail>;
    'lia-recovery-codes': CustomEvent<RecoveryCodesDetail>;
  }
}
