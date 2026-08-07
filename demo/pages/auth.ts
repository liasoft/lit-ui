/**
 * Demo pages — Auth.
 *
 * Sign-in, recovery, the second factor, the interruption prompts and the
 * account panel.
 *
 * Every form here is presentation-only by design: it validates what it can
 * locally, then emits an event with what the user typed. Nothing posts,
 * nothing navigates, nothing assumes a session shape — so the same elements
 * work against a cookie, a token endpoint or a mock like this one.
 *
 * The demo's "backend" accepts `you` / `demo` and asks for the code `123456`.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type {
  CredentialsPromptDetail,
  FormDefinition,
  ForgotPasswordDetail,
  LiaCredentialsPrompt,
  LiaOtpPrompt,
  LiaQuestionDialog,
  LoginSubmitDetail,
  OtpPromptDetail,
  QuestionAnswerDetail,
  QuestionExtra,
  ResetPasswordDetail,
  SelectOption,
  TwoFactorSubmitDetail,
  TwoFactorSetupStage,
} from '@liasoft/lit-ui';
import {
  DEFAULT_PASSWORD_STRENGTH_LABELS,
  LiaElement,
  scorePassword,
  toast,
} from '@liasoft/lit-ui';
import { demoUser } from '../data/index.js';
import { routeHref, type DemoRoute } from '../router.js';
import { cluster, dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const FRAME = 'border rounded-3 bg-body-tertiary p-3 p-lg-4';

const LANGUAGES: SelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pt', label: 'Português' },
];

const THEMES: SelectOption[] = [
  { value: 'orbit', label: 'Orbit (default)' },
  { value: 'contrast', label: 'High contrast' },
  { value: 'compact', label: 'Compact' },
];

/** A demo enrolment secret and its recovery codes — obviously not real. */
const SETUP_SECRET = 'JBSW Y3DP EHPK 3PXP MZ2F O4ZA';

const RECOVERY_CODES = [
  '4f2a-91cd-0e77',
  '8b31-77ae-1c40',
  'd90e-4412-ab63',
  '20fc-6d85-97e1',
  'c714-3b0a-58df',
  'e6a2-1f93-42bc',
];

/** The account-details half of the profile panel. */
const PROFILE_DETAILS: FormDefinition = {
  sections: {
    main: {
      fields: {
        name: { type: 'text', label: 'Display name', value: demoUser.name, mandatory: true },
        email: { type: 'email', label: 'Email address', value: demoUser.email, mandatory: true },
        loginname: { type: 'label', label: 'Sign-in name', value: demoUser.loginname },
        timezone: {
          type: 'select',
          label: 'Time zone',
          value: 'Europe/Amsterdam',
          options: [
            { value: 'UTC', label: 'UTC' },
            { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
            { value: 'Africa/Lagos', label: 'Africa/Lagos' },
            { value: 'Asia/Singapore', label: 'Asia/Singapore' },
          ],
        },
        digest: {
          type: 'switch',
          label: 'Send me the weekly digest',
          checked: true,
        },
      },
    },
  },
};

const PASSWORD_EXTRAS: QuestionExtra[] = [
  { name: 'signOutOthers', label: 'Sign out every other session', checked: true, control: 'switch' },
  { name: 'rotateKeys', label: 'Rotate my access keys as well', control: 'switch' },
];

const PASSWORD_SAMPLES = [
  '',
  'orbit',
  'password1',
  'Summer2026',
  'correct horse battery',
  'Tr0ub4dor&3xample!',
];

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * A sign-in card with a fake backend: `you` / `demo` succeeds, anything else
 * fails, and the third failure locks the account.
 *
 * @example
 * ```ts
 * html`<demo-login></demo-login>`;
 * ```
 */
@customElement('demo-login')
export class DemoLogin extends LiaElement {
  @state() private loading = false;
  @state() private error = '';
  @state() private success = '';
  @state() private attempts = 0;
  @state() private events: readonly LoggedEvent[] = [];

  private async onLogin(event: CustomEvent<LoginSubmitDetail>): Promise<void> {
    const detail = event.detail;
    this.events = logEvent(this.events, 'lia-login', {
      username: detail.username,
      remember: detail.remember,
      language: detail.language,
    });
    this.loading = true;
    this.error = '';
    this.success = '';
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.loading = false;

    if (detail.username === 'you' && detail.password === 'demo') {
      this.attempts = 0;
      this.success = 'Signed in. In a real application the router would take over here.';
      return;
    }
    this.attempts += 1;
    this.error =
      this.attempts >= 3
        ? 'Too many attempts. The account is locked for 15 minutes.'
        : `That combination is not recognised. Try <code>you</code> / <code>demo</code>. (${this.attempts}/3)`;
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Sign in with “you” / “demo”. Anything else fails, and three failures lock it.')}
      <div class=${FRAME}>
        <lia-auth-layout
          centered="false"
          brand="Orbit Console"
          brand-icon="fa-solid fa-satellite"
          heading="Sign in"
          description="Use the credentials your administrator gave you."
          error=${this.error}
          success=${this.success}
          trusted-html
          footer-text="Protected by two-factor authentication."
          .links=${[
            // No recovery link here — `show-forgot` on the form below already
            // renders one, next to the password field it belongs to.
            { label: 'Trouble signing in?', url: routeHref('/feedback/hints') },
          ]}
        >
          <lia-login-form
            show-remember
            show-forgot
            forgot-href=${routeHref('/auth/recovery')}
            username-placeholder="you"
            password-placeholder="demo"
            .languages=${LANGUAGES}
            language="en"
            .loading=${this.loading}
            .disabled=${this.attempts >= 3}
            @lia-login=${this.onLogin}
            @lia-language-change=${(event: CustomEvent<{ language: string }>) => {
              this.events = logEvent(this.events, 'lia-language-change', event.detail);
            }}
            @lia-forgot-password=${(event: Event) => {
              event.preventDefault();
              this.events = logEvent(this.events, 'lia-forgot-password');
            }}
          ></lia-login-form>
        </lia-auth-layout>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** Forgot-password and reset, both driven to their finished states. */
@customElement('demo-recovery')
export class DemoRecovery extends LiaElement {
  @state() private sent = false;
  @state() private requesting = false;
  @state() private resetting = false;
  @state() private resetError = '';
  @state() private events: readonly LoggedEvent[] = [];

  private async onForgot(event: CustomEvent<ForgotPasswordDetail>): Promise<void> {
    this.events = logEvent(this.events, 'lia-forgot-request', event.detail);
    this.requesting = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.requesting = false;
    this.sent = true;
  }

  private async onReset(event: CustomEvent<ResetPasswordDetail>): Promise<void> {
    this.events = logEvent(this.events, 'lia-reset-password', {
      length: event.detail.password.length,
    });
    this.resetting = true;
    this.resetError = '';
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.resetting = false;
    if (event.detail.password.toLowerCase().includes('orbit')) {
      this.resetError = 'The new password may not contain the product name.';
      return;
    }
    toast({ variant: 'success', message: 'Password changed. You can sign in again.' });
  }

  protected override render(): TemplateResult {
    return html`
      ${split(
        html`<div class=${FRAME}>
          <lia-auth-layout centered="false" heading="Reset your password" max-width="380">
            <lia-forgot-password-form
              description="Tell us who you are and where to write."
              back-href=${routeHref('/auth/sign-in')}
              .sent=${this.sent}
              .loading=${this.requesting}
              @lia-forgot-request=${this.onForgot}
              @lia-auth-back=${(event: Event) => {
                event.preventDefault();
                this.sent = false;
              }}
            ></lia-forgot-password-form>
          </lia-auth-layout>
        </div>`,
        html`<div class=${FRAME}>
          <lia-auth-layout centered="false" heading="Choose a new password" max-width="380">
            <lia-reset-password-form
              description="It must be at least twelve characters and not obviously guessable."
              min-length="12"
              min-score="2"
              show-checks
              show-back="false"
              error=${this.resetError}
              .loading=${this.resetting}
              @lia-reset-password=${this.onReset}
            ></lia-reset-password-form>
          </lia-auth-layout>
        </div>`
      )}
      ${eventLog(this.events)}
    `;
  }
}

/** The password meter, wired to a text field and to the scoring function. */
@customElement('demo-password-strength')
export class DemoPasswordStrength extends LiaElement {
  @state() private password = 'Summer2026';

  protected override render(): TemplateResult {
    const score = scorePassword(this.password, { minLength: 12 });
    return html`
      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <label class="form-label" for="demo-strength-input">Try a password</label>
          <input
            id="demo-strength-input"
            class="form-control mb-3"
            type="text"
            autocomplete="off"
            .value=${this.password}
            @input=${(event: Event) => {
              this.password = (event.target as HTMLInputElement).value;
            }}
          />
          <lia-password-strength
            .password=${this.password}
            min-length="12"
            required="2"
            show-checks
          ></lia-password-strength>
        </div>
        <div class="col-12 col-lg-6">
          <p class="small text-uppercase fw-semibold text-body-secondary mb-2">
            scorePassword(value, { minLength: 12 })
          </p>
          <lia-code-block
            .code=${JSON.stringify(score, null, 2)}
            language="json"
            no-header
            max-height="14rem"
          ></lia-code-block>
        </div>
      </div>
      <hr class="my-4" />
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <caption class="visually-hidden">Sample passwords and their scores</caption>
          <thead>
            <tr>
              <th scope="col">Password</th>
              <th scope="col" style="width: 40%;">Meter</th>
              <th scope="col">Label</th>
            </tr>
          </thead>
          <tbody>
            ${PASSWORD_SAMPLES.map((sample) => {
              const result = scorePassword(sample, { minLength: 12 });
              return html`<tr>
                <td class="font-monospace">${sample === '' ? '(empty)' : sample}</td>
                <td>
                  <lia-password-strength
                    .password=${sample}
                    min-length="12"
                    show-label="false"
                    show-empty
                  ></lia-password-strength>
                </td>
                <td class="small text-body-secondary">
                  ${DEFAULT_PASSWORD_STRENGTH_LABELS[result.score] ?? result.score}
                </td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

/** The second-factor challenge, accepting `123456`. */
@customElement('demo-two-factor')
export class DemoTwoFactor extends LiaElement {
  @state() private loading = false;
  @state() private error = '';
  @state() private events: readonly LoggedEvent[] = [];

  private async onSubmit(event: CustomEvent<TwoFactorSubmitDetail>): Promise<void> {
    this.events = logEvent(this.events, 'lia-two-factor', event.detail);
    this.loading = true;
    this.error = '';
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.loading = false;
    const value = event.detail.code;
    if (value === '123456' || RECOVERY_CODES.includes(value)) {
      toast({ variant: 'success', message: 'Second factor accepted.' });
      return;
    }
    this.error = 'That code is not valid. The demo accepts <code>123456</code>.';
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Type 123456 — it submits itself on the sixth character. Or use a recovery code.')}
      <div class=${FRAME}>
        <lia-auth-layout
          centered="false"
          heading="Confirm it is you"
          brand="Orbit Console"
          brand-icon="fa-solid fa-shield-halved"
          max-width="420"
        >
          <lia-two-factor-form
            description="Enter the six-digit code from your authenticator app."
            show-remember
            show-resend
            show-recovery
            resend-cooldown="10"
            error=${this.error}
            trusted-html
            .loading=${this.loading}
            @lia-two-factor=${this.onSubmit}
            @lia-two-factor-resend=${(event: CustomEvent) => {
              this.events = logEvent(this.events, 'lia-two-factor-resend', event.detail);
              toast({ variant: 'info', message: 'A new code would be sent now.', timeout: 2500 });
            }}
          ></lia-two-factor-form>
        </lia-auth-layout>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** Enrolment: pick a method, scan, verify, then keep the recovery codes. */
@customElement('demo-two-factor-setup')
export class DemoTwoFactorSetup extends LiaElement {
  @state() private stage: TwoFactorSetupStage = 'choose';
  @state() private method = 'app';
  @state() private loading = false;
  @state() private codes: string[] = [];
  @state() private events: readonly LoggedEvent[] = [];

  private async verify(): Promise<void> {
    this.loading = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.loading = false;
    this.stage = 'active';
    this.codes = RECOVERY_CODES;
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Pick a method, continue, then verify with any six digits — the demo accepts them.')}
      <lia-two-factor-setup
        stage=${this.stage}
        method=${this.method}
        secret=${SETUP_SECRET}
        show-regenerate
        .recoveryCodes=${this.codes}
        .loading=${this.loading}
        @lia-two-factor-method=${(event: CustomEvent<{ method: string }>) => {
          this.method = event.detail.method;
          this.events = logEvent(this.events, 'lia-two-factor-method', event.detail);
          this.stage = event.detail.method === 'off' ? 'choose' : 'verify';
        }}
        @lia-two-factor-verify=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-two-factor-verify', event.detail);
          void this.verify();
        }}
        @lia-two-factor-disable=${() => {
          this.events = logEvent(this.events, 'lia-two-factor-disable');
          this.stage = 'choose';
          this.method = 'off';
          this.codes = [];
        }}
        @lia-recovery-codes=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-recovery-codes', event.detail);
          this.codes = RECOVERY_CODES.map((code) => code.split('').reverse().join(''));
        }}
      ></lia-two-factor-setup>
      ${eventLog(this.events)}
    `;
  }
}

/** The segmented code field on its own. */
@customElement('demo-code-input')
export class DemoCodeInput extends LiaElement {
  @state() private value = '';
  @state() private events: readonly LoggedEvent[] = [];

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Type, paste a whole code, use the arrow keys and backspace — all of it is handled.')}
      <div class="vstack gap-4">
        <div>
          <p class="small text-body-secondary mb-2">Six digits, auto-focused.</p>
          <lia-code-input
            length="6"
            .value=${this.value}
            @lia-code-input-change=${(event: CustomEvent<{ value: string }>) => {
              this.value = event.detail.value;
              this.events = logEvent(this.events, 'lia-code-input-change', event.detail);
            }}
            @lia-code-input-complete=${(event: CustomEvent<{ value: string }>) => {
              this.events = logEvent(this.events, 'lia-code-input-complete', event.detail);
            }}
          ></lia-code-input>
        </div>
        <div>
          <p class="small text-body-secondary mb-2">
            Eight alphanumeric characters, upper-cased, medium size.
          </p>
          <lia-code-input
            length="8"
            alphanumeric
            uppercase
            size="md"
            auto-focus="false"
            label="Recovery code"
          ></lia-code-input>
        </div>
        <div>
          <p class="small text-body-secondary mb-2">Invalid, and disabled.</p>
          ${cluster(
            html`<lia-code-input length="4" value="12" invalid auto-focus="false"></lia-code-input>`,
            html`<lia-code-input length="4" value="1234" disabled auto-focus="false"></lia-code-input>`
          )}
        </div>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** The three interruption prompts, each awaited. */
@customElement('demo-prompts')
export class DemoPrompts extends LiaElement {
  @state() private result?: unknown;
  @state() private events: readonly LoggedEvent[] = [];

  @query('lia-otp-prompt') private otp?: LiaOtpPrompt;
  @query('lia-credentials-prompt') private credentials?: LiaCredentialsPrompt;
  @query('lia-question-dialog') private question?: LiaQuestionDialog;

  private async askOtp(): Promise<void> {
    const answer = await this.otp?.request();
    this.result = answer ?? { cancelled: true };
    this.events = logEvent(this.events, 'otp.request()', answer);
  }

  private async askCredentials(): Promise<void> {
    const answer = await this.credentials?.request();
    this.result = answer ?? { cancelled: true };
    this.events = logEvent(this.events, 'credentials.request()', answer ? { username: answer.username } : null);
  }

  private async askQuestion(): Promise<void> {
    const answer = await this.question?.request();
    this.result = answer ?? { cancelled: true };
    this.events = logEvent(this.events, 'question.request()', answer);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Each button awaits a promise; a dismissed prompt resolves with null.')}
      ${cluster(
        html`<button class="btn btn-outline-primary" type="button" @click=${this.askOtp}>
          <i class="fa-solid fa-mobile-screen me-2" aria-hidden="true"></i>Ask for a one-time code
        </button>`,
        html`<button class="btn btn-outline-danger" type="button" @click=${this.askCredentials}>
          <i class="fa-solid fa-key me-2" aria-hidden="true"></i>Re-authenticate
        </button>`,
        html`<button class="btn btn-outline-secondary" type="button" @click=${this.askQuestion}>
          <i class="fa-solid fa-circle-question me-2" aria-hidden="true"></i>Ask a question
        </button>`
      )}

      <lia-otp-prompt
        heading="Confirm this change"
        question="Removing a member is protected by your second factor."
        description="Enter the current code from your authenticator app."
        length="6"
        auto-submit
        @lia-otp=${(event: CustomEvent<OtpPromptDetail>) => {
          this.events = logEvent(this.events, 'lia-otp', event.detail);
        }}
        @lia-otp-cancel=${() => this.events = logEvent(this.events, 'lia-otp-cancel')}
      ></lia-otp-prompt>

      <lia-credentials-prompt
        heading="This action is protected"
        question="Deleting the organisation cannot be undone."
        description="Enter your password to continue."
        show-reveal
        confirm-variant="danger"
        @lia-credentials=${(event: CustomEvent<CredentialsPromptDetail>) => {
          this.events = logEvent(this.events, 'lia-credentials', { username: event.detail.username });
        }}
        @lia-credentials-cancel=${() => this.events = logEvent(this.events, 'lia-credentials-cancel')}
      ></lia-credentials-prompt>

      <lia-question-dialog
        heading="Move to another region?"
        question="Move ingest-04 to eu-west?"
        detail="The service is unavailable for roughly four minutes while its volumes are replicated."
        variant="warning"
        icon="fa-solid fa-earth-europe"
        default-answer="cancel"
        .answers=${[
          { id: 'cancel', label: 'Stay in eu-central', variant: 'outline-secondary' },
          { id: 'schedule', label: 'Schedule it for tonight', variant: 'outline-primary' },
          { id: 'now', label: 'Move it now', variant: 'warning', icon: 'fa-solid fa-bolt' },
        ]}
        .extras=${[
          { name: 'snapshot', label: 'Snapshot the volumes first', checked: true, control: 'switch' },
          { name: 'notify', label: 'Notify the on-call channel', control: 'switch' },
        ]}
        @lia-answer=${(event: CustomEvent<QuestionAnswerDetail>) => {
          this.events = logEvent(this.events, 'lia-answer', event.detail);
        }}
      ></lia-question-dialog>

      ${valueDump(this.result, { title: 'Resolved value', empty: 'Ask something above.' })}
      ${eventLog(this.events)}
    `;
  }
}

/** The account panel: details, password and preferences, each saved on its own. */
@customElement('demo-profile')
export class DemoProfile extends LiaElement {
  @state() private busySection: '' | 'details' | 'password' | 'preferences' = '';
  @state() private detailsSuccess = '';
  @state() private passwordError = '';
  @state() private passwordSuccess = '';
  @state() private preferencesSuccess = '';
  @state() private theme = 'orbit';
  @state() private language = 'en';
  @state() private events: readonly LoggedEvent[] = [];

  private async run(
    section: 'details' | 'password' | 'preferences',
    after: () => void
  ): Promise<void> {
    this.busySection = section;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.busySection = '';
    after();
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Each card saves on its own. The password card rejects anything containing “orbit”, so the error path is reachable.'
      )}
      <lia-profile-form
        .user=${demoUser}
        .details=${PROFILE_DETAILS}
        .passwordExtras=${PASSWORD_EXTRAS}
        min-length="12"
        min-score="2"
        .themes=${THEMES}
        theme=${this.theme}
        .languages=${LANGUAGES}
        language=${this.language}
        busy-section=${this.busySection}
        details-success=${this.detailsSuccess}
        password-error=${this.passwordError}
        password-success=${this.passwordSuccess}
        preferences-success=${this.preferencesSuccess}
        @lia-profile-save=${(event: CustomEvent<{ values: Record<string, unknown> }>) => {
          this.events = logEvent(this.events, 'lia-profile-save', event.detail.values);
          void this.run('details', () => {
            this.detailsSuccess = 'Your details were saved.';
          });
        }}
        @lia-change-password=${(event: CustomEvent<{ password: string }>) => {
          this.events = logEvent(this.events, 'lia-change-password', {
            length: event.detail.password.length,
          });
          void this.run('password', () => {
            if (event.detail.password.toLowerCase().includes('orbit')) {
              this.passwordError = 'The new password may not contain the product name.';
              this.passwordSuccess = '';
              return;
            }
            this.passwordError = '';
            this.passwordSuccess = 'Password changed.';
          });
        }}
        @lia-preferences=${(event: CustomEvent<{ theme?: string; language?: string }>) => {
          this.events = logEvent(this.events, 'lia-preferences', event.detail);
          this.theme = event.detail.theme ?? this.theme;
          this.language = event.detail.language ?? this.language;
          void this.run('preferences', () => {
            this.preferencesSuccess = 'Preferences saved.';
          });
        }}
      ></lia-profile-form>
      ${eventLog(this.events)}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const LOGIN_CODE = dedent`
  html\`<lia-auth-layout
    brand="Orbit Console"
    brand-icon="fa-solid fa-satellite"
    heading="Sign in"
    description="Use the credentials your administrator gave you."
    error=\${this.error}
    success=\${this.success}
    max-width="420"
    footer-text="Protected by two-factor authentication."
    .links=\${[{ label: 'Forgot your password?', url: '/forgot' }]}
  >
    <lia-login-form
      show-remember
      forgot-href="/forgot"
      .languages=\${languages}
      .loading=\${this.busy}
      @lia-login=\${(e: CustomEvent<LoginSubmitDetail>) => this.signIn(e.detail)}
      @lia-language-change=\${(e: CustomEvent) => setLocale(e.detail.language)}
    ></lia-login-form>
  </lia-auth-layout>\`;

  // LoginSubmitDetail → { username, password, remember, language }
`;

const PROMPT_CODE = dedent`
  // Every prompt is awaitable and resolves with \`null\` when it is dismissed.
  const otp = await this.renderRoot.querySelector('lia-otp-prompt')!.request();
  // → { code: '123456' } | null

  const credentials = await this.credentialsPrompt.request();
  // → { username, password } | null

  const answer = await this.questionDialog.request();
  // → { id: 'now', extras: { snapshot: true, notify: false } } | null

  // Build your own on the same machinery:
  class MyPrompt extends LiaAuthPrompt<MyResult> {
    protected renderBody() { … }
    protected renderFooter() { … }
    protected submitPrompt() { this.close({ … }); }
  }
`;

const PROFILE_CODE = dedent`
  html\`<lia-profile-form
    .user=\${user}
    .details=\${detailsForm}                 // a FormDefinition for the first card
    .passwordExtras=\${[
      { name: 'signOutOthers', label: 'Sign out every other session', checked: true, control: 'switch' },
    ]}
    min-length="12"
    min-score="2"
    .themes=\${themes}
    .languages=\${languages}
    busy-section=\${this.busy}               // '' | 'details' | 'password' | 'preferences'
    password-error=\${this.passwordError}
    @lia-profile-save=\${(e: CustomEvent) => saveDetails(e.detail.values)}
    @lia-change-password=\${(e: CustomEvent<ChangePasswordDetail>) => changePassword(e.detail)}
    @lia-preferences=\${(e: CustomEvent<PreferencesDetail>) => savePreferences(e.detail)}
  ></lia-profile-form>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderSignIn(): TemplateResult {
  return html`
    ${section('Sign in', 'The card, the form inside it, and a backend that answers.', [
      example('Live', html`<demo-login></demo-login>`, LOGIN_CODE),
      note(
        html`The form never navigates and never posts. It validates that both fields are filled,
          then emits <code>lia-login</code> with what was typed — which is the only thing a UI kit
          can honestly know about authentication.`,
        'info'
      ),
    ])}
    ${section('The layout', 'The centred card the auth screens share: brand, heading, messages, content, links, footer and a theme toggle.', [
      example(
        'Variations',
        html`<div class="row g-3">
          <div class="col-12 col-lg-6">
            <div class=${FRAME}>
              <lia-auth-layout
                centered="false"
                max-width="360"
                heading="Minimal"
                description="No brand, no links, no footer."
                show-theme-toggle="false"
              >
                <lia-login-form show-reveal="false" auto-focus="false"></lia-login-form>
              </lia-auth-layout>
            </div>
          </div>
          <div class="col-12 col-lg-6">
            <div class=${FRAME}>
              <lia-auth-layout
                centered="false"
                max-width="360"
                brand="Orbit Console"
                brand-icon="fa-solid fa-satellite"
                heading="Account locked"
                error="Too many failed attempts. Try again in 15 minutes."
                error-title="Locked"
                .links=${[{ label: 'Contact an administrator', url: routeHref('/editors/report') }]}
              >
                <lia-login-form disabled auto-focus="false"></lia-login-form>
              </lia-auth-layout>
            </div>
          </div>
        </div>`,
        dedent`
          html\`<lia-auth-layout
            centered                     // fills the viewport; turn it off inside a card
            max-width="420"
            logo-src="/logo.svg"
            brand="Orbit Console"
            heading="Sign in"
            error=\${error}
            success=\${success}
            .alerts=\${alerts}
            .links=\${links}
            footer-text="…"
          >…</lia-auth-layout>\`;
        `
      ),
      example(
        'Login form properties',
        propTable(
          [
            { name: 'showRemember', type: 'boolean', default: 'false', description: 'The "keep me signed in" switch.' },
            { name: 'showForgot / forgotHref', type: 'boolean / string', description: 'The recovery link under the password field.' },
            { name: 'showReveal', type: 'boolean', default: 'true', description: 'The eye button on the password field.' },
            { name: 'languages / language', type: 'SelectOption[] / string', description: 'A language picker; changing it raises `lia-language-change` immediately.' },
            { name: 'loading / disabled', type: 'boolean', description: 'In flight, and locked out.' },
            { name: 'error / success', type: 'string', description: 'Messages above the fields. `trusted-html` allows markup.' },
            { name: 'autoFocusFirst', type: 'boolean', default: 'true', description: 'Focus the identifier on connect. Turn it off when several forms share a page.' },
          ],
          'lia-login-form'
        )
      ),
    ])}
  `;
}

function renderRecovery(): TemplateResult {
  return html`
    ${section('Recovery', 'Ask for a link; then set a new password behind it.', [
      example('Both halves', html`<demo-recovery></demo-recovery>`, dedent`
        html\`<lia-forgot-password-form
          require-identifier
          require-email
          back-href="/sign-in"
          .sent=\${this.sent}                  // switches to the "check your inbox" state
          .loading=\${this.busy}
          @lia-forgot-request=\${(e: CustomEvent<ForgotPasswordDetail>) => request(e.detail)}
        ></lia-forgot-password-form>\`;

        html\`<lia-reset-password-form
          min-length="12"
          min-score="2"                        // refuses a weak password, not just a short one
          show-checks
          require-current                      // for the "change password" case
          error=\${this.error}
          @lia-reset-password=\${(e: CustomEvent<ResetPasswordDetail>) => reset(e.detail)}
        ></lia-reset-password-form>\`;
      `),
      note(
        html`The sent state deliberately does not say whether the account exists — the message is
          the same either way. That is a property of the copy
          (<code>sent-message</code>), so a product with different requirements can change it.`,
        'info'
      ),
    ])}
    ${section('Password strength', 'A dependency-free meter, and the scoring function behind it.', [
      example('Live', html`<demo-password-strength></demo-password-strength>`, dedent`
        import { scorePassword, DEFAULT_PASSWORD_BLOCKLIST } from '@liasoft/lit-ui';

        scorePassword('Tr0ub4dor&3xample!', { minLength: 12 });
        // → { score: 4, checks: { length, lower, upper, digit, symbol, varied, notCommon }, … }

        html\`<lia-password-strength
          .password=\${value}
          min-length="12"
          required="2"                  // how many checks count as "acceptable"
          show-checks
          .blocklist=\${[...DEFAULT_PASSWORD_BLOCKLIST, 'orbit', companyName]}
        ></lia-password-strength>\`;
      `),
    ])}
  `;
}

function renderTwoFactor(): TemplateResult {
  return html`
    ${section('The challenge', 'Enter the code — or fall back to a recovery code when the phone is gone.', [
      example('Live', html`<demo-two-factor></demo-two-factor>`, dedent`
        html\`<lia-two-factor-form
          length="6"
          auto-submit                      // fires as soon as the last character lands
          show-remember
          show-resend
          show-recovery
          resend-cooldown="30"
          error=\${this.error}
          .loading=\${this.busy}
          @lia-two-factor=\${(e: CustomEvent<TwoFactorSubmitDetail>) => verify(e.detail)}
          @lia-two-factor-resend=\${() => resend()}
        ></lia-two-factor-form>\`;

        // TwoFactorSubmitDetail → { code, remember, recovery }
      `),
      example(
        'Simple mode',
        html`<div class=${FRAME} style="max-width: 26rem;">
          <lia-two-factor-form
            simple
            auto-focus="false"
            description="A single field, for authenticators with variable-length codes."
          ></lia-two-factor-form>
        </div>`,
        dedent`
          // \`simple\` swaps the segmented boxes for one ordinary input.
          html\`<lia-two-factor-form simple></lia-two-factor-form>\`;
        `
      ),
    ])}
    ${section('Enrolment', 'Choose a method, scan or copy the secret, verify, and keep the recovery codes.', [
      example('Live', html`<demo-two-factor-setup></demo-two-factor-setup>`, dedent`
        html\`<lia-two-factor-setup
          stage=\${this.stage}                   // 'choose' | 'verify' | 'active'
          method=\${this.method}
          qr-src=\${this.qrDataUrl}
          secret="JBSW Y3DP EHPK 3PXP"
          .recoveryCodes=\${this.codes}
          show-regenerate
          @lia-two-factor-method=\${(e: CustomEvent) => this.pick(e.detail.method)}
          @lia-two-factor-verify=\${(e: CustomEvent) => this.verify(e.detail.code)}
          @lia-two-factor-disable=\${() => this.disable()}
          @lia-recovery-codes=\${() => this.regenerate()}
        ></lia-two-factor-setup>\`;
      `),
    ])}
    ${section('Code input', 'The segmented field the challenge is built on — usable anywhere a fixed-length code is typed.', [
      example('Live', html`<demo-code-input></demo-code-input>`, dedent`
        html\`<lia-code-input
          length="6"
          alphanumeric                        // letters as well as digits
          uppercase
          size="lg"                           // 'md' | 'lg'
          label="Verification code"
          box-label="Character {index} of {total}"
          .value=\${this.code}
          @lia-code-input-change=\${(e: CustomEvent) => (this.code = e.detail.value)}
          @lia-code-input-complete=\${(e: CustomEvent) => this.verify(e.detail.value)}
        ></lia-code-input>\`;
      `),
    ])}
  `;
}

function renderPrompts(): TemplateResult {
  return html`
    ${section(
      'Interruption prompts',
      'A protected action stops and asks. All three are awaitable, and all three resolve with `null` when the user backs out.',
      example('Live', html`<demo-prompts></demo-prompts>`, PROMPT_CODE)
    )}
    ${section('Inline, not modal', 'The same prompts rendered in place — for a page that is itself the interruption.', [
      example(
        'inline',
        split(
          html`<lia-otp-prompt
            inline
            open
            heading="Confirm this change"
            question="Enter the current code from your authenticator app."
            length="6"
          ></lia-otp-prompt>`,
          html`<lia-credentials-prompt
            inline
            open
            heading="This action is protected"
            question="Enter your password to continue."
            show-username
            show-reveal
          ></lia-credentials-prompt>`
        ),
        dedent`
          // \`inline\` renders the prompt as a panel instead of a dialog; \`open\`
          // shows it without a request().
          html\`<lia-otp-prompt inline open heading="…" question="…"></lia-otp-prompt>\`;
        `
      ),
      example(
        'The shared base',
        propTable(
          [
            { name: 'open', type: 'boolean', description: 'Reflected. `request()` sets it and returns a promise.' },
            { name: 'inline', type: 'boolean', default: 'false', description: 'Render as a panel rather than a modal.' },
            { name: 'heading / question', type: 'string', description: 'The dialog title and the sentence under it.' },
            { name: 'variant / icon', type: 'Variant / IconName', description: 'Contextual colour and glyph of the prompt.' },
            { name: 'error / errorTitle', type: 'string', description: 'A failed attempt, shown above the controls.' },
            { name: 'loading', type: 'boolean', description: 'Spins the confirm button and blocks the form.' },
            { name: 'staticBackdrop', type: 'boolean', default: 'false', description: 'Refuse to close on a backdrop click or Esc.' },
            { name: 'request()', type: 'Promise<T | null>', description: 'Show it and wait. A second call dismisses the first.' },
            { name: 'close(result?)', type: 'void', description: 'Resolve the pending request from the outside.' },
          ],
          'LiaAuthPrompt'
        )
      ),
    ])}
  `;
}

function renderProfile(): TemplateResult {
  return html`
    ${section(
      'Account panel',
      'Three independent cards — details, password, preferences — each with its own busy state, its own error and its own event.',
      example('Live', html`<demo-profile></demo-profile>`, PROFILE_CODE, { bodyClass: 'p-3' })
    )}
    ${section('Partial panels', 'Show only the cards the account may actually change.', [
      example(
        'Preferences only',
        html`<lia-profile-form
          show-details="false"
          show-password="false"
          column-class="col-12 col-md-6"
          .themes=${THEMES}
          .languages=${LANGUAGES}
          theme="orbit"
          language="en"
          @lia-preferences=${(event: CustomEvent) => {
            toast({ variant: 'info', message: `Preferences: ${JSON.stringify(event.detail)}` });
          }}
        ></lia-profile-form>`,
        dedent`
          html\`<lia-profile-form
            show-details="false"
            show-password="false"
            column-class="col-12 col-md-6"
            .themes=\${themes}
            .languages=\${languages}
          ></lia-profile-form>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      note(
        html`The colour-scheme switch inside the preferences card writes the same stored preference
          as <code>&lt;lia-theme-toggle&gt;</code> — there is only ever one source of truth for the
          theme. Turn it off with <code>show-scheme="false"</code> if your product stores it
          server-side instead.`,
        'info'
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The auth demos. */
export const authRoutes: DemoRoute[] = [
  {
    path: '/auth/sign-in',
    title: 'Sign in',
    group: 'auth',
    icon: 'fa-solid fa-right-to-bracket',
    description: 'The centred card and the sign-in form, against a fake backend.',
    keywords: ['login', 'sign in', 'auth', 'password', 'remember'],
    render: renderSignIn,
  },
  {
    path: '/auth/recovery',
    title: 'Recovery & strength',
    group: 'auth',
    icon: 'fa-solid fa-unlock-keyhole',
    description: 'Request a reset link, set a new password, and score it.',
    keywords: ['forgot', 'reset', 'password', 'strength', 'recovery'],
    render: renderRecovery,
  },
  {
    path: '/auth/two-factor',
    title: 'Two-factor',
    group: 'auth',
    icon: 'fa-solid fa-shield-halved',
    description: 'The challenge, the enrolment flow and the segmented code field.',
    keywords: ['2fa', 'mfa', 'otp', 'totp', 'recovery codes', 'code input'],
    render: renderTwoFactor,
  },
  {
    path: '/auth/prompts',
    title: 'Prompts',
    group: 'auth',
    icon: 'fa-solid fa-circle-question',
    description: 'Awaitable interruptions: a code, a password, a question.',
    keywords: ['prompt', 'otp', 'credentials', 'question', 'reauthenticate'],
    render: renderPrompts,
  },
  {
    path: '/auth/profile',
    title: 'Account panel',
    group: 'auth',
    icon: 'fa-solid fa-id-card',
    description: 'Details, password and preferences, each saved on its own.',
    keywords: ['profile', 'account', 'preferences', 'change password', 'theme'],
    render: renderProfile,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-login': DemoLogin;
    'demo-recovery': DemoRecovery;
    'demo-password-strength': DemoPasswordStrength;
    'demo-two-factor': DemoTwoFactor;
    'demo-two-factor-setup': DemoTwoFactorSetup;
    'demo-code-input': DemoCodeInput;
    'demo-prompts': DemoPrompts;
    'demo-profile': DemoProfile;
  }
}
