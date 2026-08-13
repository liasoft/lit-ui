/**
 * Auth family — sign-in, recovery, second factor and the account panel.
 *
 * Importing this module registers every element below. The forms are
 * presentation-only: they validate what they can locally and then emit an
 * event. Nothing posts, nothing navigates, nothing talks to a server, so the
 * same components work against a session cookie, a token endpoint or a mock.
 *
 * | Element                      | What it is                                       |
 * | ---------------------------- | ------------------------------------------------ |
 * | `<lia-auth-layout>`          | the centred card the sign-in pages share          |
 * | `<lia-login-form>`           | identifier + password, remember, language         |
 * | `<lia-forgot-password-form>` | request a reset link, with a sent state           |
 * | `<lia-reset-password-form>`  | new password + confirmation + strength gate       |
 * | `<lia-two-factor-form>`      | enter the one-time code, resend, recovery code    |
 * | `<lia-two-factor-setup>`     | enrolment: method, QR, secret, recovery codes     |
 * | `<lia-code-input>`           | the segmented one-time-code field                 |
 * | `<lia-password-strength>`    | the dependency-free strength meter                |
 * | `<lia-otp-prompt>`           | one-time-password challenge before an action      |
 * | `<lia-credentials-prompt>`   | re-authenticate before an action                  |
 * | `<lia-question-dialog>`      | a titled question with answers and extra opt-ins  |
 * | `<lia-profile-form>`         | details + change password + preferences           |
 *
 * Supporting exports: {@link scorePassword} for scoring a password outside the
 * meter, and {@link LiaAuthPrompt} for building your own awaitable prompt on
 * the same modal machinery.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/auth';
 * ```
 *
 * @example
 * ```ts
 * html`<lia-auth-layout
 *   brand="Control Center"
 *   brand-icon="fa-solid fa-server"
 *   heading="Sign in"
 *   .links=${[{ label: 'Forgot your password?', url: '/forgot' }]}
 * >
 *   <lia-login-form
 *     show-remember
 *     .loading=${this.busy}
 *     .error=${this.error}
 *     @lia-login=${(e: CustomEvent) => this.signIn(e.detail)}
 *   ></lia-login-form>
 * </lia-auth-layout>`
 * ```
 */

export * from './password-strength.js';
export * from './code-input.js';
export * from './prompt-base.js';
export * from './auth-layout.js';
export * from './login-form.js';
export * from './forgot-password-form.js';
export * from './reset-password-form.js';
export * from './two-factor-form.js';
export * from './two-factor-setup.js';
export * from './otp-prompt.js';
export * from './credentials-prompt.js';
export * from './question-dialog.js';
export * from './profile-form.js';
