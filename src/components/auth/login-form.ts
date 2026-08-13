import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { SelectOption } from '../../core/types.js';
import { uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import {
  focusFirstControl,
  renderAuthFeedback,
  renderAuthField,
  renderAuthPasswordField,
  renderAuthSubmit,
  renderAuthSwitch,
} from './internal.js';
import '../feedback/alert.js';

/** Detail of the `lia-login` event. */
export interface LoginSubmitDetail {
  username: string;
  password: string;
  /** State of the "remember me" switch; always `false` when it is hidden. */
  remember: boolean;
  /** Selected interface language, when the picker is shown. */
  language?: string;
}

/** Detail of the `lia-language-change` event. */
export interface LanguageChangeDetail {
  language: string;
}

/**
 * The sign-in form: identifier, password, and the affordances a modern login
 * page is expected to have.
 *
 * Beyond the two credential fields it offers a password reveal
 * toggle, an optional "remember me" switch, an optional interface-language
 * picker for users who cannot read the default locale well enough to sign in,
 * and inline required-field validation that runs before anything is emitted.
 * Nothing is posted: the element emits `lia-login` and leaves the request to
 * the application.
 *
 * Drop it inside `<lia-auth-layout>`, which supplies the card and heading.
 *
 * @example
 * ```html
 * <lia-login-form show-remember forgot-href="/forgot-password"></lia-login-form>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-login-form
 *   .loading=${this.busy}
 *   .error=${this.error}
 *   username-label="Email or username"
 *   .languages=${[
 *     { value: 'en', label: 'English' },
 *     { value: 'de', label: 'Deutsch' },
 *   ]}
 *   language="en"
 *   @lia-login=${(e: CustomEvent) => this.signIn(e.detail)}
 *   @lia-language-change=${(e: CustomEvent) => this.setLocale(e.detail.language)}
 * ></lia-login-form>`
 * ```
 */
@customElement('lia-login-form')
export class LiaLoginForm extends LiaElement {
  /** Current identifier value; two-way in practice via `lia-login`. */
  @property({ type: String }) username = '';

  /** Current password value. */
  @property({ type: String }) password = '';

  /** State of the "remember me" switch. */
  @property({ type: Boolean }) remember = false;

  /** Selected language code, when {@link languages} is populated. */
  @property({ type: String }) language = '';

  /** Options for the interface-language picker. Empty hides it. */
  @property({ attribute: false }) languages: SelectOption[] = [];

  @property({ type: String, attribute: 'username-label' }) usernameLabel = 'Username';
  @property({ type: String, attribute: 'password-label' }) passwordLabel = 'Password';
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Sign in';
  @property({ type: String, attribute: 'remember-label' }) rememberLabel = 'Keep me signed in';
  @property({ type: String, attribute: 'forgot-label' }) forgotLabel = 'Forgot your password?';
  @property({ type: String, attribute: 'language-label' }) languageLabel = 'Language';
  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Success';
  @property({ type: String, attribute: 'reveal-label' }) revealLabel = 'Show password';
  @property({ type: String, attribute: 'hide-label' }) hideLabel = 'Hide password';

  /** Message shown under an empty required field. */
  @property({ type: String, attribute: 'required-message' }) requiredMessage =
    'This field is required.';

  @property({ type: String, attribute: 'username-placeholder' }) usernamePlaceholder = '';
  @property({ type: String, attribute: 'password-placeholder' }) passwordPlaceholder = '';

  /** `autocomplete` token for the identifier — `username` or `email`. */
  @property({ type: String, attribute: 'username-autocomplete' }) usernameAutocomplete = 'username';

  /** Error message rendered above the fields. */
  @property({ type: String }) error = '';

  /** Success message rendered above the fields; wins over {@link error}. */
  @property({ type: String }) success = '';

  /** Render `error` / `success` as trusted HTML. */
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;

  /** Show a spinner in the submit button and block interaction. */
  @property({ type: Boolean }) loading = false;

  /** Disable every control, e.g. while the panel is locked. */
  @property({ type: Boolean }) disabled = false;

  /** Show the "remember me" switch. */
  @property({ type: Boolean, attribute: 'show-remember' }) showRemember = false;

  /** Show the "forgot your password" link. */
  @property({ converter: flag, attribute: 'show-forgot' }) showForgot = true;

  /** Target of the forgot-password link. Empty renders it as a plain button. */
  @property({ type: String, attribute: 'forgot-href' }) forgotHref = '';

  /** Offer the password reveal toggle. */
  @property({ converter: flag, attribute: 'show-reveal' }) showReveal = true;

  /** Put the caret in the identifier field on first render. */
  @property({ converter: flag, attribute: 'auto-focus' }) autoFocusFirst = true;

  @state() private revealed = false;
  @state() private submitted = false;

  private readonly instanceId = uid('lia-login');

  /** The values that would be emitted right now. */
  get values(): LoginSubmitDetail {
    return {
      username: this.username,
      password: this.password,
      remember: this.showRemember ? this.remember : false,
      ...(this.languages.length > 0 ? { language: this.language } : {}),
    };
  }

  /** Clear the password (and optionally the identifier) after a failed attempt. */
  reset(clearUsername = false): void {
    this.password = '';
    if (clearUsername) this.username = '';
    this.submitted = false;
  }

  protected override firstUpdated(): void {
    if (this.autoFocusFirst && !this.disabled) focusFirstControl(this);
  }

  private get usernameInvalid(): boolean {
    return this.submitted && this.username.trim() === '';
  }

  private get passwordInvalid(): boolean {
    return this.submitted && this.password === '';
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading || this.disabled) return;
    this.submitted = true;
    if (this.username.trim() === '' || this.password === '') {
      void this.updateComplete.then(() => focusFirstControl(this, '.is-invalid'));
      return;
    }
    this.emit<LoginSubmitDetail>('lia-login', this.values);
  }

  private handleForgot(event: Event): void {
    if (this.forgotHref) return;
    event.preventDefault();
    this.emit('lia-forgot-request', { username: this.username });
  }

  private renderLanguage(): TemplateResult | typeof nothing {
    if (this.languages.length === 0) return nothing;
    const id = `${this.instanceId}-language`;
    return html`<div class="mb-3">
      <label class="form-label" for=${id}>${this.languageLabel}</label>
      <select
        class="form-select"
        id=${id}
        name="language"
        .value=${this.language}
        ?disabled=${this.disabled || this.loading}
        @change=${(event: Event) => {
          this.language = (event.target as HTMLSelectElement).value;
          this.emit<LanguageChangeDetail>('lia-language-change', { language: this.language });
        }}
      >
        ${this.languages.map(
          (option) => html`<option value=${option.value} ?disabled=${option.disabled === true}>
            ${option.label}
          </option>`
        )}
      </select>
    </div>`;
  }

  private renderOptionsRow(): TemplateResult | typeof nothing {
    const forgot =
      this.showForgot && this.forgotLabel
        ? html`<a
            class="small text-body-secondary ms-auto"
            href=${this.forgotHref || '#'}
            @click=${(event: Event) => this.handleForgot(event)}
            >${this.forgotLabel}</a
          >`
        : nothing;
    const remember = this.showRemember
      ? renderAuthSwitch({
          id: `${this.instanceId}-remember`,
          name: 'remember',
          label: this.rememberLabel,
          checked: this.remember,
          disabled: this.disabled || this.loading,
          class: 'mb-0',
          onChange: (checked) => {
            this.remember = checked;
          },
        })
      : nothing;
    if (remember === nothing && forgot === nothing) return nothing;
    return html`<div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      ${remember}${forgot}
    </div>`;
  }

  protected override render(): TemplateResult {
    const busy = this.loading || this.disabled;
    return html`<form class="lia-login-form" novalidate @submit=${this.handleSubmit}>
      ${renderAuthFeedback(this.error, this.success, {
        errorTitle: this.errorTitle,
        successTitle: this.successTitle,
        trustedHtml: this.trustedHtml,
      })}
      ${renderAuthField({
        id: `${this.instanceId}-username`,
        name: 'username',
        label: this.usernameLabel,
        value: this.username,
        placeholder: this.usernamePlaceholder,
        autocomplete: this.usernameAutocomplete,
        disabled: busy,
        invalid: this.usernameInvalid,
        error: this.requiredMessage,
        onInput: (value) => {
          this.username = value;
        },
      })}
      ${renderAuthPasswordField({
        id: `${this.instanceId}-password`,
        name: 'password',
        label: this.passwordLabel,
        value: this.password,
        placeholder: this.passwordPlaceholder,
        autocomplete: 'current-password',
        disabled: busy,
        invalid: this.passwordInvalid,
        error: this.requiredMessage,
        reveal: this.showReveal,
        revealed: this.revealed,
        revealLabel: this.revealLabel,
        hideLabel: this.hideLabel,
        onToggleReveal: () => {
          this.revealed = !this.revealed;
        },
        onInput: (value) => {
          this.password = value;
        },
      })}
      ${this.renderLanguage()}${this.renderOptionsRow()}
      ${renderAuthSubmit({
        label: this.submitLabel,
        loading: this.loading,
        disabled: this.disabled,
        icon: 'fa-solid fa-right-to-bracket',
      })}
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-login-form': LiaLoginForm;
  }
  interface HTMLElementEventMap {
    'lia-login': CustomEvent<LoginSubmitDetail>;
    'lia-language-change': CustomEvent<LanguageChangeDetail>;
    'lia-forgot-request': CustomEvent<{ username: string }>;
  }
}
