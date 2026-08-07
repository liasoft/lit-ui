import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { renderRich, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import {
  focusFirstControl,
  renderAuthBackLink,
  renderAuthFeedback,
  renderAuthField,
  renderAuthSubmit,
} from './internal.js';
import '../feedback/alert.js';

/** Detail of the `lia-forgot-password` event. */
export interface ForgotPasswordDetail {
  /** Account identifier — empty when only the address is asked for. */
  identifier: string;
  /** Email address on file — empty when only the identifier is asked for. */
  email: string;
}

/**
 * "I forgot my password": collect enough to identify the account, then hand
 * over to the application to send the reset mail.
 *
 * The reference panel asked for username *and* address; both fields are
 * individually switchable here, because asking for only the address is the
 * more common modern flow. Once `sent` flips to `true` the fields are replaced
 * by a confirmation panel, so a second submission cannot be fired by accident
 * and the response cannot be used to probe which accounts exist.
 *
 * @example
 * ```html
 * <lia-forgot-password-form back-href="/" require-identifier="false"></lia-forgot-password-form>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-forgot-password-form
 *   .loading=${this.busy}
 *   .sent=${this.sent}
 *   .error=${this.error}
 *   sent-message="If the account exists we have sent a reset link."
 *   @lia-forgot-password=${(e: CustomEvent) => this.requestReset(e.detail)}
 * ></lia-forgot-password-form>`
 * ```
 */
@customElement('lia-forgot-password-form')
export class LiaForgotPasswordForm extends LiaElement {
  /** Current identifier value. */
  @property({ type: String }) identifier = '';

  /** Current email value. */
  @property({ type: String }) email = '';

  /** Explanatory paragraph above the fields. */
  @property({ type: String }) description = '';

  @property({ type: String, attribute: 'identifier-label' }) identifierLabel = 'Username';
  @property({ type: String, attribute: 'email-label' }) emailLabel = 'Email address';
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Send reset instructions';
  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to sign in';
  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Check your inbox';
  @property({ type: String, attribute: 'required-message' }) requiredMessage =
    'This field is required.';
  @property({ type: String, attribute: 'invalid-email-message' }) invalidEmailMessage =
    'Enter a valid email address.';

  /** Body of the confirmation panel shown once `sent` is `true`. */
  @property({ type: String, attribute: 'sent-message' }) sentMessage =
    'If an account matches what you entered, a message with reset instructions is on its way.';

  /** Where the "back to sign in" link points. Empty emits `lia-auth-back`. */
  @property({ type: String, attribute: 'back-href' }) backHref = '';

  /** Ask for the account identifier. */
  @property({ converter: flag, attribute: 'require-identifier' }) requireIdentifier = true;

  /** Ask for the email address. */
  @property({ converter: flag, attribute: 'require-email' }) requireEmail = true;

  /** Switch to the confirmation panel. */
  @property({ type: Boolean }) sent = false;

  @property({ type: String }) error = '';
  @property({ type: String }) success = '';
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;

  /** Put the caret in the first field on render. */
  @property({ converter: flag, attribute: 'auto-focus' }) autoFocusFirst = true;

  @state() private submitted = false;

  private readonly instanceId = uid('lia-fpwd');

  /** Return to the input state after a failed or repeated attempt. */
  reset(): void {
    this.sent = false;
    this.submitted = false;
  }

  protected override firstUpdated(): void {
    if (this.autoFocusFirst && !this.disabled && !this.sent) focusFirstControl(this);
  }

  private get identifierInvalid(): boolean {
    return this.submitted && this.requireIdentifier && this.identifier.trim() === '';
  }

  private get emailError(): string {
    if (!this.requireEmail) return '';
    if (this.email.trim() === '') return this.requiredMessage;
    // Deliberately permissive: the server is the authority on deliverability.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) ? '' : this.invalidEmailMessage;
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading || this.disabled) return;
    this.submitted = true;
    if (this.identifierInvalid || this.emailError !== '') {
      void this.updateComplete.then(() => focusFirstControl(this, '.is-invalid'));
      return;
    }
    this.emit<ForgotPasswordDetail>('lia-forgot-password', {
      identifier: this.requireIdentifier ? this.identifier.trim() : '',
      email: this.requireEmail ? this.email.trim() : '',
    });
  }

  private handleBack(event: Event): void {
    if (this.backHref) return;
    event.preventDefault();
    this.emit('lia-auth-back');
  }

  private renderBack(): TemplateResult | typeof nothing {
    const link = renderAuthBackLink(this.backHref, this.backLabel, (event) =>
      this.handleBack(event)
    );
    if (link === nothing) return nothing;
    return html`<p class="text-center mt-3 mb-0">${link}</p>`;
  }

  protected override render(): TemplateResult {
    if (this.sent) {
      return html`<div class="lia-forgot-password-form">
        <lia-alert
          variant="success"
          heading=${this.successTitle}
          alert-class="mb-0"
          .message=${this.success || this.sentMessage}
          ?trusted-html=${this.trustedHtml}
        ></lia-alert>
        ${this.renderBack()}
      </div>`;
    }

    const busy = this.loading || this.disabled;
    const emailError = this.emailError;
    return html`<form class="lia-forgot-password-form" novalidate @submit=${this.handleSubmit}>
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
      ${this.requireIdentifier
        ? renderAuthField({
            id: `${this.instanceId}-identifier`,
            name: 'identifier',
            label: this.identifierLabel,
            value: this.identifier,
            autocomplete: 'username',
            disabled: busy,
            invalid: this.identifierInvalid,
            error: this.requiredMessage,
            onInput: (value) => {
              this.identifier = value;
            },
          })
        : nothing}
      ${this.requireEmail
        ? renderAuthField({
            id: `${this.instanceId}-email`,
            name: 'email',
            label: this.emailLabel,
            value: this.email,
            type: 'email',
            inputmode: 'email',
            autocomplete: 'email',
            disabled: busy,
            invalid: this.submitted && emailError !== '',
            error: emailError,
            onInput: (value) => {
              this.email = value;
            },
          })
        : nothing}
      ${renderAuthSubmit({
        label: this.submitLabel,
        loading: this.loading,
        disabled: this.disabled,
        icon: 'fa-solid fa-paper-plane',
      })}
      ${this.renderBack()}
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-forgot-password-form': LiaForgotPasswordForm;
  }
  interface HTMLElementEventMap {
    'lia-forgot-password': CustomEvent<ForgotPasswordDetail>;
    'lia-auth-back': CustomEvent<void>;
  }
}
