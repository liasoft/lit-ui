import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { renderRich, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import {
  fill,
  focusFirstControl,
  renderAuthBackLink,
  renderAuthFeedback,
  renderAuthPasswordField,
  renderAuthSubmit,
} from './internal.js';
import './password-strength.js';
import '../feedback/alert.js';

/** Detail of the `lia-reset-password` event. */
export interface ResetPasswordDetail {
  /** The accepted new password. */
  password: string;
  /** Present only when the form was configured to ask for the old one. */
  current?: string;
}

/**
 * Choose a new password: the value, its confirmation, and a live strength
 * meter that gates the submit button.
 *
 * A typo in the confirmation is caught on blur rather than after a round
 * trip, the strength meter scores locally (nothing leaves the page), and
 * `min-score` decides how strong is strong enough. Set it to `0` to make the
 * meter purely advisory.
 *
 * @example
 * ```html
 * <lia-reset-password-form min-length="10" min-score="3" back-href="/"></lia-reset-password-form>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-reset-password-form
 *   require-current
 *   .loading=${this.busy}
 *   .error=${this.error}
 *   @lia-reset-password=${(e: CustomEvent) => this.save(e.detail.password)}
 * ></lia-reset-password-form>`
 * ```
 */
@customElement('lia-reset-password-form')
export class LiaResetPasswordForm extends LiaElement {
  /** Current value of the "new password" field. */
  @property({ type: String }) password = '';

  /** Current value of the confirmation field. */
  @property({ type: String }) confirmation = '';

  /** Current value of the "current password" field, when it is shown. */
  @property({ type: String }) current = '';

  /** Explanatory paragraph above the fields. */
  @property({ type: String }) description = '';

  @property({ type: String, attribute: 'password-label' }) passwordLabel = 'New password';
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = 'Confirm new password';
  @property({ type: String, attribute: 'current-label' }) currentLabel = 'Current password';
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Set new password';
  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to sign in';
  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Success';
  @property({ type: String, attribute: 'reveal-label' }) revealLabel = 'Show password';
  @property({ type: String, attribute: 'hide-label' }) hideLabel = 'Hide password';

  /** Shown under an empty required field. */
  @property({ type: String, attribute: 'required-message' }) requiredMessage =
    'This field is required.';

  /** Shown when the confirmation differs. */
  @property({ type: String, attribute: 'mismatch-message' }) mismatchMessage =
    'The two passwords do not match.';

  /** Shown when the value is shorter than `minLength`; `{min}` is substituted. */
  @property({ type: String, attribute: 'too-short-message' }) tooShortMessage =
    'Use at least {min} characters.';

  /** Shown when the strength score is below `minScore`. */
  @property({ type: String, attribute: 'too-weak-message' }) tooWeakMessage =
    'Choose a stronger password.';

  /** Minimum accepted length. */
  @property({ type: Number, attribute: 'min-length' }) minLength = 8;

  /** Lowest accepted strength score, `0`…`4`. `0` disables the gate. */
  @property({ type: Number, attribute: 'min-score' }) minScore = 2;

  /** Also ask for the password being replaced. */
  @property({ type: Boolean, attribute: 'require-current' }) requireCurrent = false;

  /** Show the strength meter. */
  @property({ converter: flag, attribute: 'show-strength' }) showStrength = true;

  /** Show the per-requirement chips under the meter. */
  @property({ type: Boolean, attribute: 'show-checks' }) showChecks = false;

  /** Offer the reveal toggles. */
  @property({ converter: flag, attribute: 'show-reveal' }) showReveal = true;

  /** Where the "back to sign in" link points. Empty emits `lia-auth-back`. */
  @property({ type: String, attribute: 'back-href' }) backHref = '';

  /** Hide the back link entirely (in-app password change). */
  @property({ converter: flag, attribute: 'show-back' }) showBack = true;

  @property({ type: String }) error = '';
  @property({ type: String }) success = '';
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;

  /** Put the caret in the first field on render. */
  @property({ converter: flag, attribute: 'auto-focus' }) autoFocusFirst = true;

  @state() private revealed = false;
  @state() private submitted = false;
  @state() private confirmationTouched = false;
  @state() private strong = false;

  private readonly instanceId = uid('lia-rpwd');

  /** Every message that currently applies, keyed by field. */
  get errors(): Record<string, string> {
    const result: Record<string, string> = {};
    if (this.requireCurrent && this.current === '') result['current'] = this.requiredMessage;
    if (this.password === '') result['password'] = this.requiredMessage;
    else if (this.password.length < this.minLength) {
      result['password'] = fill(this.tooShortMessage, { min: this.minLength });
    } else if (this.minScore > 0 && this.showStrength && !this.strong) {
      result['password'] = this.tooWeakMessage;
    }
    if (this.confirmation === '') result['confirmation'] = this.requiredMessage;
    else if (this.confirmation !== this.password) result['confirmation'] = this.mismatchMessage;
    return result;
  }

  /** `true` when the form would emit on submit. */
  get isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /** Clear both fields and the validation state. */
  reset(): void {
    this.password = '';
    this.confirmation = '';
    this.current = '';
    this.submitted = false;
    this.confirmationTouched = false;
  }

  protected override firstUpdated(): void {
    if (this.autoFocusFirst && !this.disabled) focusFirstControl(this);
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading || this.disabled) return;
    this.submitted = true;
    if (!this.isValid) {
      void this.updateComplete.then(() => focusFirstControl(this, '.is-invalid'));
      return;
    }
    this.emit<ResetPasswordDetail>('lia-reset-password', {
      password: this.password,
      ...(this.requireCurrent ? { current: this.current } : {}),
    });
  }

  private handleBack(event: Event): void {
    if (this.backHref) return;
    event.preventDefault();
    this.emit('lia-auth-back');
  }

  private renderStrength(): TemplateResult | typeof nothing {
    if (!this.showStrength) return nothing;
    return html`<lia-password-strength
      .password=${this.password}
      .minLength=${this.minLength}
      .required=${this.minScore}
      ?show-checks=${this.showChecks}
      @lia-password-strength=${(event: CustomEvent<{ acceptable: boolean }>) => {
        this.strong = event.detail.acceptable;
      }}
    ></lia-password-strength>`;
  }

  protected override render(): TemplateResult {
    const busy = this.loading || this.disabled;
    const errors = this.errors;
    const showFor = (field: string): boolean =>
      this.submitted || (field === 'confirmation' && this.confirmationTouched);

    return html`<form class="lia-reset-password-form" novalidate @submit=${this.handleSubmit}>
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
      ${this.requireCurrent
        ? renderAuthPasswordField({
            id: `${this.instanceId}-current`,
            name: 'current-password',
            label: this.currentLabel,
            value: this.current,
            autocomplete: 'current-password',
            disabled: busy,
            invalid: this.submitted && errors['current'] !== undefined,
            error: errors['current'] ?? '',
            reveal: false,
            onInput: (value) => {
              this.current = value;
            },
          })
        : nothing}
      ${renderAuthPasswordField({
        id: `${this.instanceId}-password`,
        name: 'new-password',
        label: this.passwordLabel,
        value: this.password,
        autocomplete: 'new-password',
        disabled: busy,
        invalid: showFor('password') && errors['password'] !== undefined,
        error: errors['password'] ?? '',
        reveal: this.showReveal,
        revealed: this.revealed,
        revealLabel: this.revealLabel,
        hideLabel: this.hideLabel,
        below: this.renderStrength(),
        onToggleReveal: () => {
          this.revealed = !this.revealed;
        },
        onInput: (value) => {
          this.password = value;
        },
      })}
      ${renderAuthPasswordField({
        id: `${this.instanceId}-confirmation`,
        name: 'confirm-password',
        label: this.confirmLabel,
        value: this.confirmation,
        autocomplete: 'new-password',
        disabled: busy,
        invalid: showFor('confirmation') && errors['confirmation'] !== undefined,
        error: errors['confirmation'] ?? '',
        reveal: false,
        onInput: (value) => {
          this.confirmation = value;
        },
        onBlur: () => {
          if (this.confirmation !== '') this.confirmationTouched = true;
        },
      })}
      ${renderAuthSubmit({
        label: this.submitLabel,
        loading: this.loading,
        disabled: this.disabled,
        icon: 'fa-solid fa-key',
      })}
      ${this.showBack
        ? html`<p class="text-center mt-3 mb-0">
            ${renderAuthBackLink(this.backHref, this.backLabel, (event) => this.handleBack(event))}
          </p>`
        : nothing}
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-reset-password-form': LiaResetPasswordForm;
  }
  interface HTMLElementEventMap {
    'lia-reset-password': CustomEvent<ResetPasswordDetail>;
  }
}
