import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  FormDefinition,
  FormSubmitDetail,
  FormValues,
  IconName,
  SelectOption,
  UserInfo,
} from '../../core/types.js';
import { applyScheme, getPreferredScheme, type ColorScheme } from '../../core/theme.js';
import { cx, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import {
  fill,
  renderAuthFeedback,
  renderAuthPasswordField,
  renderAuthSubmit,
  renderAuthSwitch,
} from './internal.js';
import type { QuestionExtra } from './question-dialog.js';
import './password-strength.js';
import '../form/form.js';
import '../feedback/alert.js';

/** Detail of the `lia-change-password` event. */
export interface ChangePasswordDetail {
  /** The password being replaced; empty when `requireCurrent` is off. */
  current: string;
  /** The new password. */
  password: string;
  /** State of every {@link QuestionExtra} offered beside the fields. */
  extras: Record<string, boolean>;
}

/** Detail of the `lia-preferences` event. */
export interface PreferencesDetail {
  /** Selected interface theme, when a theme list was supplied. */
  theme?: string;
  /** Selected interface language, when a language list was supplied. */
  language?: string;
  /** Selected colour scheme, when the scheme picker is shown. */
  scheme?: ColorScheme;
}

/** Which panel is currently saving. */
export type ProfileBusySection = '' | 'details' | 'password' | 'preferences';

/**
 * The account panel: who you are, how you sign in, and how the interface
 * should look.
 *
 * Three sibling cards, because a password change and a language change
 * genuinely are separate transactions; each card
 * reports through its own event. The details card is
 * driven by an ordinary {@link FormDefinition} and rendered by `<lia-form>`,
 * so it inherits the whole form system; the password card adds a strength
 * meter and a match check; the preferences card carries
 * theme, language and the Bootstrap colour-scheme switch.
 *
 * Every card can be switched off, and every visible string is a property.
 *
 * @example
 * ```html
 * <lia-profile-form show-preferences="false"></lia-profile-form>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-profile-form
 *   .user=${{ loginname: 'ada', name: 'Ada Lovelace', email: 'ada@example.org' }}
 *   .details=${detailsDefinition}
 *   .passwordExtras=${[
 *     { name: 'rotateKeys', label: 'Also rotate my API keys', checked: true },
 *   ]}
 *   .themes=${[{ value: 'default', label: 'Default' }]}
 *   .languages=${[{ value: 'en', label: 'English' }]}
 *   .busySection=${this.saving}
 *   @lia-profile-save=${(e: CustomEvent) => this.saveDetails(e.detail.values)}
 *   @lia-change-password=${(e: CustomEvent) => this.changePassword(e.detail)}
 *   @lia-preferences=${(e: CustomEvent) => this.savePreferences(e.detail)}
 * ></lia-profile-form>`
 * ```
 */
@customElement('lia-profile-form')
export class LiaProfileForm extends LiaElement {
  /* ---------------- details ---------------- */

  /** Identity shown at the top of the details card. */
  @property({ attribute: false }) user?: UserInfo;

  /** Definition of the editable account details. Omit to hide the card. */
  @property({ attribute: false }) details?: FormDefinition;

  /** Values for the details form. */
  @property({ attribute: false }) detailsValues?: FormValues;

  /** Server-side errors for the details form, keyed by field name. */
  @property({ attribute: false }) detailsErrors: Record<string, string> = {};

  @property({ type: String, attribute: 'details-title' }) detailsTitle = 'Account details';
  @property({ type: String, attribute: 'details-icon' }) detailsIcon: IconName =
    'fa-solid fa-id-card';
  @property({ type: String, attribute: 'details-submit-label' }) detailsSubmitLabel = 'Save';
  @property({ type: String, attribute: 'details-error' }) detailsError = '';
  @property({ type: String, attribute: 'details-success' }) detailsSuccess = '';

  /* ---------------- password ---------------- */

  @property({ type: String, attribute: 'password-title' }) passwordTitle = 'Change password';
  @property({ type: String, attribute: 'password-icon' }) passwordIcon: IconName =
    'fa-solid fa-lock';
  @property({ type: String, attribute: 'current-label' }) currentLabel = 'Current password';
  @property({ type: String, attribute: 'new-password-label' }) newPasswordLabel = 'New password';
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = 'Confirm new password';
  @property({ type: String, attribute: 'password-submit-label' }) passwordSubmitLabel =
    'Change password';
  @property({ type: String, attribute: 'password-error' }) passwordError = '';
  @property({ type: String, attribute: 'password-success' }) passwordSuccess = '';

  /** Extra opt-ins beside the password fields, e.g. "also update service logins". */
  @property({ attribute: false }) passwordExtras: readonly QuestionExtra[] = [];

  /** Ask for the password being replaced. */
  @property({ converter: flag, attribute: 'require-current' }) requireCurrent = true;

  /** Minimum accepted length for the new password. */
  @property({ type: Number, attribute: 'min-length' }) minLength = 8;

  /** Lowest accepted strength score, `0`…`4`. `0` disables the gate. */
  @property({ type: Number, attribute: 'min-score' }) minScore = 2;

  /** Show the strength meter under the new-password field. */
  @property({ converter: flag, attribute: 'show-strength' }) showStrength = true;

  @property({ type: String, attribute: 'required-message' }) requiredMessage =
    'This field is required.';
  @property({ type: String, attribute: 'mismatch-message' }) mismatchMessage =
    'The two passwords do not match.';
  @property({ type: String, attribute: 'too-short-message' }) tooShortMessage =
    'Use at least {min} characters.';
  @property({ type: String, attribute: 'too-weak-message' }) tooWeakMessage =
    'Choose a stronger password.';

  /* ---------------- preferences ---------------- */

  @property({ type: String, attribute: 'preferences-title' }) preferencesTitle = 'Preferences';
  @property({ type: String, attribute: 'preferences-icon' }) preferencesIcon: IconName =
    'fa-solid fa-sliders';
  @property({ type: String, attribute: 'preferences-submit-label' }) preferencesSubmitLabel =
    'Save preferences';
  @property({ type: String, attribute: 'preferences-error' }) preferencesError = '';
  @property({ type: String, attribute: 'preferences-success' }) preferencesSuccess = '';

  /** Interface themes on offer. Empty hides the theme select. */
  @property({ attribute: false }) themes: SelectOption[] = [];

  /** Selected theme. */
  @property({ type: String }) theme = '';

  @property({ type: String, attribute: 'theme-label' }) themeLabel = 'Theme';

  /** Interface languages on offer. Empty hides the language select. */
  @property({ attribute: false }) languages: SelectOption[] = [];

  /** Selected language. */
  @property({ type: String }) language = '';

  @property({ type: String, attribute: 'language-label' }) languageLabel = 'Language';

  /** Show the light / dark / auto colour-scheme picker. */
  @property({ converter: flag, attribute: 'show-scheme' }) showScheme = true;

  @property({ type: String, attribute: 'scheme-label' }) schemeLabel = 'Colour scheme';
  @property({ type: String, attribute: 'scheme-light-label' }) schemeLightLabel = 'Light';
  @property({ type: String, attribute: 'scheme-dark-label' }) schemeDarkLabel = 'Dark';
  @property({ type: String, attribute: 'scheme-auto-label' }) schemeAutoLabel = 'System';

  /* ---------------- shared ---------------- */

  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';
  @property({ type: String, attribute: 'success-title' }) successTitle = 'Saved';

  /** Which card is currently saving. */
  @property({ type: String, attribute: 'busy-section' }) busySection: ProfileBusySection = '';

  /** Disable every control. */
  @property({ type: Boolean }) disabled = false;

  /** Render the details card. Defaults to on when `details` or `user` is set. */
  @property({ converter: flag, attribute: 'show-details' }) showDetails = true;

  /** Render the change-password card. */
  @property({ converter: flag, attribute: 'show-password' }) showPassword = true;

  /** Render the preferences card. */
  @property({ converter: flag, attribute: 'show-preferences' }) showPreferences = true;

  /** Bootstrap column classes applied to each card. */
  @property({ type: String, attribute: 'column-class' }) columnClass = 'col-12 col-md-6 col-xl-4';

  @state() private current = '';
  @state() private password = '';
  @state() private confirmation = '';
  @state() private revealed = false;
  @state() private submitted = false;
  @state() private strong = false;
  @state() private extraValues: Record<string, boolean> = {};
  @state() private scheme: ColorScheme = 'auto';

  private readonly instanceId = uid('lia-profile');

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheme = getPreferredScheme();
    this.extraValues = Object.fromEntries(
      this.passwordExtras.map((extra) => [extra.name, extra.checked === true])
    );
  }

  /** Clear the password card. */
  resetPassword(): void {
    this.current = '';
    this.password = '';
    this.confirmation = '';
    this.submitted = false;
  }

  /* ------------------------------------------------------------------ *
   * Password card
   * ------------------------------------------------------------------ */

  /** Validation messages for the password card, keyed by field. */
  get passwordErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    if (this.requireCurrent && this.current === '') result['current'] = this.requiredMessage;
    if (this.password === '') result['password'] = this.requiredMessage;
    else if (this.password.length < this.minLength) {
      result['password'] = fill(this.tooShortMessage, { min: this.minLength });
    } else if (this.minScore > 0 && this.showStrength && !this.strong) {
      result['password'] = this.tooWeakMessage;
    }
    if (this.confirmation !== this.password) result['confirmation'] = this.mismatchMessage;
    return result;
  }

  private handlePasswordSubmit(event: Event): void {
    event.preventDefault();
    if (this.disabled || this.busySection === 'password') return;
    this.submitted = true;
    if (Object.keys(this.passwordErrors).length > 0) return;
    this.emit<ChangePasswordDetail>('lia-change-password', {
      current: this.requireCurrent ? this.current : '',
      password: this.password,
      extras: { ...this.extraValues },
    });
  }

  private renderPasswordCard(): TemplateResult | typeof nothing {
    if (!this.showPassword) return nothing;
    const busy = this.busySection === 'password';
    const blocked = this.disabled || busy;
    const errors = this.passwordErrors;
    const show = (key: string): boolean => this.submitted && errors[key] !== undefined;

    return this.renderCard(
      this.passwordTitle,
      this.passwordIcon,
      html`<form novalidate @submit=${this.handlePasswordSubmit}>
        ${renderAuthFeedback(this.passwordError, this.passwordSuccess, {
          errorTitle: this.errorTitle,
          successTitle: this.successTitle,
        })}
        ${this.requireCurrent
          ? renderAuthPasswordField({
              id: `${this.instanceId}-current`,
              name: 'current-password',
              label: this.currentLabel,
              value: this.current,
              autocomplete: 'current-password',
              disabled: blocked,
              invalid: show('current'),
              error: errors['current'] ?? '',
              reveal: false,
              onInput: (value) => {
                this.current = value;
              },
            })
          : nothing}
        ${renderAuthPasswordField({
          id: `${this.instanceId}-new`,
          name: 'new-password',
          label: this.newPasswordLabel,
          value: this.password,
          autocomplete: 'new-password',
          disabled: blocked,
          invalid: show('password'),
          error: errors['password'] ?? '',
          revealed: this.revealed,
          below: this.showStrength
            ? html`<lia-password-strength
                .password=${this.password}
                .minLength=${this.minLength}
                .required=${this.minScore}
                @lia-password-strength=${(event: CustomEvent<{ acceptable: boolean }>) => {
                  this.strong = event.detail.acceptable;
                }}
              ></lia-password-strength>`
            : nothing,
          onToggleReveal: () => {
            this.revealed = !this.revealed;
          },
          onInput: (value) => {
            this.password = value;
          },
        })}
        ${renderAuthPasswordField({
          id: `${this.instanceId}-confirm`,
          name: 'confirm-password',
          label: this.confirmLabel,
          value: this.confirmation,
          autocomplete: 'new-password',
          disabled: blocked,
          invalid: show('confirmation'),
          error: errors['confirmation'] ?? '',
          reveal: false,
          onInput: (value) => {
            this.confirmation = value;
          },
        })}
        ${this.passwordExtras.length > 0
          ? html`<div class="d-flex flex-column gap-2 mb-3">
              ${this.passwordExtras.map((extra) =>
                renderAuthSwitch({
                  id: `${this.instanceId}-${extra.name}`,
                  name: extra.name,
                  label: extra.label,
                  checked: this.extraValues[extra.name] === true,
                  disabled: blocked || extra.disabled === true,
                  ...(extra.control ? { control: extra.control } : {}),
                  html: extra.html === true,
                  class: 'mb-0',
                  onChange: (checked) => {
                    this.extraValues = { ...this.extraValues, [extra.name]: checked };
                  },
                })
              )}
            </div>`
          : nothing}
        ${renderAuthSubmit({
          label: this.passwordSubmitLabel,
          loading: busy,
          disabled: this.disabled,
          icon: 'fa-solid fa-key',
        })}
      </form>`
    );
  }

  /* ------------------------------------------------------------------ *
   * Details card
   * ------------------------------------------------------------------ */

  private renderIdentity(): TemplateResult | typeof nothing {
    const user = this.user;
    if (!user) return nothing;
    return html`<div class="d-flex align-items-center gap-3 mb-3">
      ${user.avatarUrl
        ? html`<img
            class="lia-profile-avatar rounded-circle"
            src=${user.avatarUrl}
            alt=""
            aria-hidden="true"
          />`
        : html`<span
            class=${cx(
              'lia-profile-avatar rounded-circle bg-body-secondary',
              'd-inline-flex align-items-center justify-content-center'
            )}
            aria-hidden="true"
          >
            <i class="fa-solid fa-user"></i>
          </span>`}
      <div class="min-w-0">
        <div class="fw-semibold text-truncate">${user.name || user.loginname}</div>
        ${user.email
          ? html`<div class="small text-body-secondary text-truncate">${user.email}</div>`
          : nothing}
      </div>
    </div>`;
  }

  private renderDetailsCard(): TemplateResult | typeof nothing {
    if (!this.showDetails || (!this.details && !this.user)) return nothing;
    const busy = this.busySection === 'details';
    return this.renderCard(
      this.detailsTitle,
      this.detailsIcon,
      html`${renderAuthFeedback(this.detailsError, this.detailsSuccess, {
        errorTitle: this.errorTitle,
        successTitle: this.successTitle,
      })}
      ${this.renderIdentity()}
      ${this.details
        ? html`<lia-form
            .definition=${this.details}
            .values=${this.detailsValues ?? {}}
            .errors=${this.detailsErrors}
            .busy=${busy}
            .disabled=${this.disabled}
            submit-label=${this.detailsSubmitLabel}
            @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
              // Re-badge the generic form event so a page can tell the three
              // cards apart without inspecting the target.
              event.stopPropagation();
              this.emit<FormSubmitDetail>('lia-profile-save', event.detail);
            }}
          ></lia-form>`
        : nothing}`
    );
  }

  /* ------------------------------------------------------------------ *
   * Preferences card
   * ------------------------------------------------------------------ */

  private selectScheme(scheme: ColorScheme): void {
    this.scheme = scheme;
    // Apply straight away: a colour-scheme picker that needs a save button
    // before it does anything is a broken preview.
    applyScheme(scheme);
  }

  private handlePreferencesSubmit(event: Event): void {
    event.preventDefault();
    if (this.disabled || this.busySection === 'preferences') return;
    this.emit<PreferencesDetail>('lia-preferences', {
      ...(this.themes.length > 0 ? { theme: this.theme } : {}),
      ...(this.languages.length > 0 ? { language: this.language } : {}),
      ...(this.showScheme ? { scheme: this.scheme } : {}),
    });
  }

  private renderSelect(
    id: string,
    label: string,
    options: SelectOption[],
    value: string,
    blocked: boolean,
    onChange: (next: string) => void
  ): TemplateResult {
    return html`<div class="mb-3">
      <label class="form-label" for=${id}>${label}</label>
      <select
        class="form-select"
        id=${id}
        name=${id}
        .value=${value}
        ?disabled=${blocked}
        @change=${(event: Event) => onChange((event.target as HTMLSelectElement).value)}
      >
        ${options.map(
          (option) => html`<option value=${option.value} ?disabled=${option.disabled === true}>
            ${option.label}
          </option>`
        )}
      </select>
    </div>`;
  }

  private renderSchemePicker(blocked: boolean): TemplateResult {
    const name = `${this.instanceId}-scheme`;
    const options: Array<[ColorScheme, string, string]> = [
      ['light', this.schemeLightLabel, 'fa-solid fa-sun'],
      ['dark', this.schemeDarkLabel, 'fa-solid fa-moon'],
      ['auto', this.schemeAutoLabel, 'fa-solid fa-circle-half-stroke'],
    ];
    return html`<fieldset class="mb-3">
      <legend class="form-label fs-6">${this.schemeLabel}</legend>
      <div class="btn-group w-100" role="group" aria-label=${this.schemeLabel}>
        ${options.map(([value, label, icon]) => {
          const id = `${name}-${value}`;
          return html`<input
              type="radio"
              class="btn-check"
              name=${name}
              id=${id}
              value=${value}
              autocomplete="off"
              .checked=${this.scheme === value}
              ?disabled=${blocked}
              @change=${() => this.selectScheme(value)}
            />
            <label class="btn btn-outline-secondary" for=${id}>
              <i class="${icon} me-1" aria-hidden="true"></i>${label}
            </label>`;
        })}
      </div>
    </fieldset>`;
  }

  private renderPreferencesCard(): TemplateResult | typeof nothing {
    if (!this.showPreferences) return nothing;
    const hasTheme = this.themes.length > 0;
    const hasLanguage = this.languages.length > 0;
    if (!hasTheme && !hasLanguage && !this.showScheme) return nothing;
    const busy = this.busySection === 'preferences';
    const blocked = this.disabled || busy;

    return this.renderCard(
      this.preferencesTitle,
      this.preferencesIcon,
      html`<form novalidate @submit=${this.handlePreferencesSubmit}>
        ${renderAuthFeedback(this.preferencesError, this.preferencesSuccess, {
          errorTitle: this.errorTitle,
          successTitle: this.successTitle,
        })}
        ${hasTheme
          ? this.renderSelect(
              `${this.instanceId}-theme`,
              this.themeLabel,
              this.themes,
              this.theme,
              blocked,
              (next) => {
                this.theme = next;
              }
            )
          : nothing}
        ${hasLanguage
          ? this.renderSelect(
              `${this.instanceId}-language`,
              this.languageLabel,
              this.languages,
              this.language,
              blocked,
              (next) => {
                this.language = next;
              }
            )
          : nothing}
        ${this.showScheme ? this.renderSchemePicker(blocked) : nothing}
        ${renderAuthSubmit({
          label: this.preferencesSubmitLabel,
          loading: busy,
          disabled: this.disabled,
          icon: 'fa-regular fa-floppy-disk',
        })}
      </form>`
    );
  }

  /* ------------------------------------------------------------------ *
   * Shell
   * ------------------------------------------------------------------ */

  private renderCard(title: string, icon: IconName, body: unknown): TemplateResult {
    return html`<div class=${this.columnClass}>
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <h2 class="card-title h5 d-flex align-items-center gap-2">
            ${icon ? html`<i class=${icon} aria-hidden="true"></i>` : nothing}${title}
          </h2>
          ${body}
        </div>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult {
    return html`<div class=${cx('lia-profile-form row g-4')}>
      ${this.renderDetailsCard()}${this.renderPasswordCard()}${this.renderPreferencesCard()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-profile-form': LiaProfileForm;
  }
  interface HTMLElementEventMap {
    'lia-change-password': CustomEvent<ChangePasswordDetail>;
    'lia-preferences': CustomEvent<PreferencesDetail>;
    'lia-profile-save': CustomEvent<FormSubmitDetail>;
  }
}
