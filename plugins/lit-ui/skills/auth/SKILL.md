---
name: auth
description: Use when building sign-in and account security screens with @liasoft/lit-ui - login, forgot/reset password, two-factor challenge and enrolment, re-authentication prompts before sensitive actions, yes/no question dialogs, and the account/profile panel. Covers lia-auth-layout, lia-login-form, lia-forgot-password-form, lia-reset-password-form, lia-two-factor-form, lia-two-factor-setup, lia-code-input, lia-password-strength, lia-otp-prompt, lia-credentials-prompt, lia-question-dialog, lia-profile-form.
---

# Auth

Markup-complete auth screens: every form validates locally, then emits a `lia-*` CustomEvent with what the user typed. Nothing posts, nothing navigates — the app supplies only the transport, so the same elements work against a session cookie, a token endpoint or a mock. Light DOM throughout.

## When to reach for this family

- Any sign-in page: `<lia-auth-layout>` (centred card, brand, alerts, footer links, theme toggle) wrapping one of the forms as its child. Never hand-roll the card.
- Sign-in: `<lia-login-form>`. Recovery: `<lia-forgot-password-form>` → `<lia-reset-password-form>`. Second factor: `<lia-two-factor-form>`; enrolment: `<lia-two-factor-setup>`.
- "Confirm this sensitive action" mid-app: `<lia-otp-prompt>` (code), `<lia-credentials-prompt>` (password), `<lia-question-dialog>` (arbitrary answers + opt-ins). All three are awaitable Bootstrap modals on the shared `LiaAuthPrompt` base — prefer them over `lia-modal` plus hand-built fields.
- Account page: `<lia-profile-form>` — details card driven by a `FormDefinition` and rendered by `<lia-form>` from the form family, plus change-password and preferences cards.
- Segmented OTP field or strength meter standalone: `<lia-code-input>`, `<lia-password-strength>` (plus the exported `scorePassword()` helper).

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/auth'` for this family; load `@liasoft/lit-ui/styles.css` once globally. Light DOM — Bootstrap classes and page CSS reach everything.

## Component reference

Shared across forms: `error` / `success` (+ `error-title`/`success-title`, `trusted-html`), `loading` (spinner + block), `disabled`, `auto-focus` (default on), and label properties for every visible string.

| Tag | Purpose | Key properties | Events |
| --- | --- | --- | --- |
| `lia-auth-layout` | Centred sign-in card shell | `brand`, `brand-icon`, `logo-src`/`logo-alt`, `heading`, `description`, `.alerts` (AlertMessage[]), `error`/`success` shorthand, `.links` (NavItem[], card footer), `footer-text`, `show-theme-toggle` (default on), `max-width` (420), `centered` (default on), `.content` (template alternative to children) | — |
| `lia-login-form` | Identifier + password | `username`, `password`, `remember`, `show-remember`, `show-forgot` (on) + `forgot-href` (empty → emits event), `show-reveal` (on), `.languages` (SelectOption[], empty hides picker) + `language`, `username-autocomplete` (`username`/`email`); `values` getter, `reset()` | `lia-login` `{username, password, remember, language?}`, `lia-language-change` `{language}`, `lia-forgot-request` `{username}` |
| `lia-forgot-password-form` | Request a reset link | `identifier`, `email`, `require-identifier`/`require-email` (both on; switch off one), `sent` (flips to confirmation panel), `sent-message`, `back-href` (empty → emits `lia-auth-back`); `reset()` | `lia-forgot-password` `{identifier, email}`, `lia-auth-back` |
| `lia-reset-password-form` | New password + confirm + strength gate | `password`, `confirmation`, `require-current` + `current`, `min-length` (8), `min-score` (0–4, default 2, `0` = advisory only), `show-strength` (on), `show-checks`, `show-back` (off for in-app change), `back-href`; `errors`/`isValid` getters, `reset()` | `lia-reset-password` `{password, current?}` |
| `lia-two-factor-form` | Enter the one-time code | `code`, `length` (6), `simple` (plain input instead of boxes), `alphanumeric`, `auto-submit` (on: submits when last box fills), `show-remember`, `show-resend` + `resend-cooldown` (30s), `show-recovery` (toggle to recovery-code field), `recovery-code`; `reset()`, `setRecoveryMode(bool)` | `lia-two-factor` `{code, remember, recovery}`, `lia-two-factor-resend` `{attempt}` |
| `lia-two-factor-setup` | Enrolment: method → verify → active | `stage` (`choose`/`verify`/`active`), `method`, `.methods` (TwoFactorMethodOption[], default off/email/app), `compact` (select instead of radio cards), `qr-src` (bring your own data URI — no QR lib bundled), `secret` (copyable fallback), `code`, `code-length`, `.recoveryCodes` (string[]), `show-regenerate`, `card` (on) | `lia-two-factor-method`/`-verify`/`-disable`/`-cancel` (`{method, code?, secret?}`), `lia-recovery-codes` `{action: 'copy'\|'download'\|'regenerate', codes}` |
| `lia-code-input` | Segmented OTP boxes (paste, auto-advance, per-box a11y labels) | `value`, `length` (6), `alphanumeric`, `uppercase`, `invalid`, `size` (`lg`/`md`), `label`; `complete` getter, `clear()`, `focus()` | `lia-code-input-change`, `lia-code-input-complete` (both `{value, complete}`) |
| `lia-password-strength` | Local, dependency-free strength meter | `password`, `min-length` (8), `required` (min acceptable score, 2), `show-checks` (requirement chips), `show-empty`, `.labels`, `.blocklist`; `score`/`acceptable` getters | `lia-password-strength` (PasswordScore + `{acceptable}`) |
| `lia-otp-prompt` | OTP challenge before an action (modal) | `open`, `inline` (full-page panel), `heading`, `question`, `code`, `length`, `simple`, `alphanumeric`, `auto-submit` (off here), `confirm-label`, `static-backdrop`; `request()` → `Promise<{code} \| null>`, `reset()` | `lia-otp` `{code}`, `lia-otp-cancel` |
| `lia-credentials-prompt` | "Type your password to confirm" (modal) | `open`, `inline`, `question`, `show-username` (full re-auth), `confirm-variant` (`danger`), `show-reveal` (off); `request()` → `Promise<{username?, password} \| null>`; password state cleared on close | `lia-credentials` `{username?, password}`, `lia-credentials-cancel` |
| `lia-question-dialog` | Titled question, N answers, extra opt-ins | `heading` ("Are you sure?"), `question`, `detail` (trusted HTML), `.answers` (QuestionAnswer[]: `{id, label, variant?, icon?}`, default No/Yes), `.extras` (QuestionExtra[]: `{name, label, checked?, control?}`), `default-answer`, `submit-answer`; `ask()` → `Promise<detail \| null>`, `answer(id)` | `lia-answer` `{answer: string \| null, extras: Record<string, boolean>}` — dismissal reports `answer: null` |
| `lia-profile-form` | Account panel: details, password, preferences cards | `.user` (UserInfo), `.details` (FormDefinition, rendered by `lia-form`), `.detailsValues`, `.detailsErrors`, `.passwordExtras` (QuestionExtra[]), `require-current` (on), `min-length`/`min-score`, `.themes`/`.languages` (SelectOption[]), `show-scheme` (light/dark/auto picker, applies immediately), `busy-section` (`''`/`details`/`password`/`preferences`), `show-details`/`show-password`/`show-preferences`, `column-class`; `resetPassword()` | `lia-profile-save` (FormSubmitDetail), `lia-change-password` `{current, password, extras}`, `lia-preferences` `{theme?, language?, scheme?}` |

```ts
html`<lia-auth-layout brand="Control Center" heading="Sign in"
  .links=${[{ label: 'Forgot your password?', url: '/forgot' }]}>
  <lia-login-form show-remember .loading=${this.busy} .error=${this.error}
    @lia-login=${(e: CustomEvent<LoginSubmitDetail>) => this.signIn(e.detail)}></lia-login-form>
</lia-auth-layout>`;

html`<lia-two-factor-form show-resend show-recovery .loading=${this.busy}
  @lia-two-factor=${(e) => this.verify(e.detail)}
  @lia-two-factor-resend=${() => this.sendCode()}></lia-two-factor-form>`;

const answer = await this.otpPrompt.request();          // null = dismissed
if (answer) await api.rotateKeys(answer.code);

const q = await dialog.ask();                           // lia-question-dialog
if (q?.answer === 'delete') await remove(q.extras.purgeFiles);
```

## Patterns and pitfalls

- **The app owns the flow.** On `lia-login`, set `.loading`, call your API, then set `.error` (and `form.reset()` to clear the password) or navigate. Same shape for every form. `success` wins over `error` when both are set.
- **Prompts compose two ways:** declarative (`open` + event) or `await request()` / `ask()` — `null` always means dismissed. Cancel also fires `lia-otp-cancel` / `lia-credentials-cancel` / `lia-answer {answer: null}`, so one listener can cover every exit.
- **Two-factor challenge vs. setup are different elements.** The challenge auto-submits on the last digit by default; keep the code field controlled via the emitted detail, not by reading inputs. Setup is stage-driven: you advance `stage` yourself after each server round trip, and you supply `qr-src` yourself (no QR library is bundled).
- **Strength gating is wiring, not policy.** `min-score` on reset/profile forms blocks submit until `lia-password-strength` reports `acceptable`; the blocklist is a tiny hint list — do real breach checks server-side. `scorePassword(pw, {minLength, blocklist})` gives the same scoring outside the meter.
- **`lia-profile-form` re-badges** its embedded `lia-form`'s `lia-submit` as `lia-profile-save`, and each card reports separately — drive spinners per card with `busy-section`, not a global flag. The colour-scheme picker applies instantly; persist it on `lia-preferences`.
- **Empty `href` means event.** `forgot-href`/`back-href` render links when set; left empty the click emits `lia-forgot-request` / `lia-auth-back` for router-driven apps.
- **Custom prompts:** extend the exported `LiaAuthPrompt<TResult>` (implement `renderBody`, `renderFooter`, `submitPrompt`) to get the modal lifecycle, promise machinery and error region for free.
