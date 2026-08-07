import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { uid } from '../../core/utils.js';
import { renderAuthField, renderAuthPasswordField } from './internal.js';
import { LiaAuthPrompt } from './prompt-base.js';

/** Detail of the `lia-credentials` event. */
export interface CredentialsPromptDetail {
  /** Only present when the username field was shown. */
  username?: string;
  password: string;
}

/**
 * Re-authenticate before a sensitive action: "type your password to confirm".
 *
 * The generic form of the reference panel's `askuserpasswd` interstitial. Like
 * the other auth prompts it can be driven declaratively (`open` plus the
 * `lia-credentials` event) or awaited:
 *
 * ```ts
 * const answer = await prompt.request();
 * if (answer) await api.rotateKeys(answer.password);
 * ```
 *
 * The entered password lives in the element's state and is cleared whenever
 * the prompt closes, so a dismissed dialog never leaves it behind.
 *
 * @example
 * ```html
 * <lia-credentials-prompt
 *   heading="Confirm it is you"
 *   question="Deleting this record is permanent."
 * ></lia-credentials-prompt>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-credentials-prompt
 *   .open=${this.asking}
 *   .loading=${this.busy}
 *   .error=${this.error}
 *   show-username
 *   confirm-label="Delete record"
 *   @lia-credentials=${(e: CustomEvent) => this.reauthenticate(e.detail)}
 *   @lia-credentials-cancel=${() => (this.asking = false)}
 * ></lia-credentials-prompt>`
 * ```
 */
@customElement('lia-credentials-prompt')
export class LiaCredentialsPrompt extends LiaAuthPrompt<CredentialsPromptDetail> {
  /** The password entered so far. Cleared whenever the prompt closes. */
  @property({ type: String }) password = '';

  /** The username entered so far, when {@link showUsername} is set. */
  @property({ type: String }) username = '';

  /** Also ask for the username — full re-authentication rather than a check. */
  @property({ type: Boolean, attribute: 'show-username' }) showUsername = false;

  /** Sentence between the question and the field. */
  @property({ type: String }) description = 'Enter your password to confirm this action.';

  @property({ type: String, attribute: 'password-label' }) passwordLabel = 'Password';
  @property({ type: String, attribute: 'username-label' }) usernameLabel = 'Username';
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = 'Confirm';
  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = 'Cancel';
  @property({ type: String, attribute: 'reveal-label' }) revealLabel = 'Show password';
  @property({ type: String, attribute: 'hide-label' }) hideLabel = 'Hide password';
  @property({ type: String, attribute: 'required-message' }) requiredMessage =
    'This field is required.';

  /** Bootstrap style of the confirm button. */
  @property({ type: String, attribute: 'confirm-variant' }) confirmVariant = 'danger';

  /** Offer the password reveal toggle. */
  @property({ type: Boolean, attribute: 'show-reveal' }) showReveal = false;

  @state() private revealed = false;
  @state() private submitted = false;

  private readonly instanceId = uid('lia-cred');

  protected override initialFocusSelector = 'input[type="password"], input:not([disabled])';

  /** Forget the entered credentials and the validation state. */
  reset(): void {
    this.password = '';
    this.username = '';
    this.revealed = false;
    this.submitted = false;
  }

  private get usernameInvalid(): boolean {
    return this.submitted && this.showUsername && this.username.trim() === '';
  }

  private get passwordInvalid(): boolean {
    return this.submitted && this.password === '';
  }

  protected override submitPrompt(): void {
    this.submitted = true;
    if (this.passwordInvalid || this.usernameInvalid) return;
    const detail: CredentialsPromptDetail = {
      password: this.password,
      ...(this.showUsername ? { username: this.username.trim() } : {}),
    };
    this.emit<CredentialsPromptDetail>('lia-credentials', detail);
    // The caller keeps the value it was handed; the element must not.
    this.close(detail);
    this.reset();
  }

  protected override onCancelled(): void {
    this.emit('lia-credentials-cancel');
    this.reset();
  }

  protected override renderBody(): TemplateResult {
    return html`<div class="mt-3">
      ${this.description ? html`<p class="text-body-secondary">${this.description}</p>` : nothing}
      ${this.showUsername
        ? renderAuthField({
            id: `${this.instanceId}-username`,
            name: 'username',
            label: this.usernameLabel,
            value: this.username,
            autocomplete: 'username',
            disabled: this.loading,
            invalid: this.usernameInvalid,
            error: this.requiredMessage,
            onInput: (value) => {
              this.username = value;
            },
          })
        : nothing}
      ${renderAuthPasswordField({
        id: `${this.instanceId}-password`,
        name: 'password',
        label: this.passwordLabel,
        value: this.password,
        autocomplete: 'current-password',
        disabled: this.loading,
        invalid: this.passwordInvalid,
        error: this.requiredMessage,
        reveal: this.showReveal,
        revealed: this.revealed,
        revealLabel: this.revealLabel,
        hideLabel: this.hideLabel,
        class: 'mb-0',
        onToggleReveal: () => {
          this.revealed = !this.revealed;
        },
        onInput: (value) => {
          this.password = value;
        },
      })}
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
      <button
        type="submit"
        class="btn btn-${this.confirmVariant}"
        ?disabled=${this.loading}
        aria-busy=${this.loading ? 'true' : nothing}
      >
        ${this.loading
          ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
          : nothing}${this.confirmLabel}
      </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-credentials-prompt': LiaCredentialsPrompt;
  }
  interface HTMLElementEventMap {
    'lia-credentials': CustomEvent<CredentialsPromptDetail>;
    'lia-credentials-cancel': CustomEvent<void>;
  }
}
