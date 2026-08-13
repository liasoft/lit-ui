import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName, Variant } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { ModalController } from '../feedback/modal-controller.js';
import { renderAuthFeedback } from './internal.js';

/**
 * Shared machinery for the three "confirm this sensitive action" prompts —
 * `<lia-otp-prompt>`, `<lia-credentials-prompt>` and `<lia-question-dialog>`.
 *
 * The default is a real Bootstrap modal (Esc, backdrop and focus handling
 * included, torn down properly when the host is removed mid-flight), so the
 * user keeps the page they were on; an inline full-page treatment is
 * available behind the `inline` flag for flows that genuinely want their own
 * page.
 *
 * Two ways to drive it, and they compose: set `open` and listen for the
 * element's event, or `await prompt.request()` and read the resolved value —
 * `null` means the user dismissed it.
 *
 * Subclasses supply {@link renderBody}, {@link renderFooter} and
 * {@link submitPrompt}; everything else — the promise, the modal lifecycle,
 * the header, the error region — is handled here.
 *
 * @example
 * ```ts
 * class MyPrompt extends LiaAuthPrompt<{ pin: string }> {
 *   protected renderBody() { return html`<input id="pin" class="form-control" />`; }
 *   protected renderFooter() { return html`<button class="btn btn-primary">OK</button>`; }
 *   protected submitPrompt() { this.close({ pin: this.readPin() }); }
 * }
 * ```
 */
export abstract class LiaAuthPrompt<TResult> extends LiaElement {
  /** Whether the prompt is on screen. Reflected so CSS can key off it. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Render as an inline panel in the page flow instead of a modal. */
  @property({ type: Boolean }) inline = false;

  /** Dialog heading. */
  @property({ type: String }) heading = 'Security check';

  /** The question, rendered as trusted HTML. */
  @property({ type: String }) question = '';

  /** Contextual colour of the inline panel and the header icon. */
  @property({ type: String }) variant: Variant = 'warning';

  /** Icon beside the heading. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-shield-halved';

  /** Error message shown above the footer. */
  @property({ type: String }) error = '';

  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';

  /** Show a spinner on the confirm button and block interaction. */
  @property({ type: Boolean }) loading = false;

  /** Accessible name of the header close button. */
  @property({ type: String, attribute: 'close-label' }) closeLabel = 'Close';

  /** Keep the dialog open when the backdrop or Esc is used. */
  @property({ type: Boolean, attribute: 'static-backdrop' }) staticBackdrop = false;

  /** Id of the heading element, for `aria-labelledby`. */
  protected readonly titleId: string = uid('lia-auth-prompt-title');

  /** Id of the question element, for `aria-describedby`. */
  protected readonly questionId: string = uid('lia-auth-prompt-question');

  private resolver?: (value: TResult | null) => void;
  private outcome: TResult | null = null;

  private readonly modal = new ModalController(
    this,
    {},
    {
      onShown: () => this.focusInitial(),
      onHidden: () => this.finish(),
    }
  );

  /* ------------------------------------------------------------------ *
   * Subclass contract
   * ------------------------------------------------------------------ */

  /** The controls between the question and the buttons. */
  protected abstract renderBody(): unknown;

  /** The button row. Must contain the `type="submit"` confirm button. */
  protected abstract renderFooter(): unknown;

  /** Called when the form is submitted; validate and call {@link close}. */
  protected abstract submitPrompt(): void;

  /** Called once the prompt closed without an answer. Emit your cancel event. */
  protected onCancelled(): void {
    /* subclasses override */
  }

  /** Selector for the control that receives focus when the prompt opens. */
  protected initialFocusSelector = 'input:not([disabled]), select:not([disabled])';

  /* ------------------------------------------------------------------ *
   * Lifecycle
   * ------------------------------------------------------------------ */

  /**
   * Show the prompt and resolve once the user answered, or with `null` when
   * they dismissed it.
   */
  request(): Promise<TResult | null> {
    // A prompt still awaiting an answer is dismissed before it is replaced.
    this.settle(null);
    this.outcome = null;
    this.open = true;
    return new Promise<TResult | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  /** Close the prompt, resolving a pending {@link request} with `result`. */
  close(result: TResult | null = null): void {
    this.outcome = result;
    const wasShown = this.modal.shown;
    this.open = false;
    // Inline panels have no hide transition to wait for.
    if (this.inline || !wasShown) this.finish();
  }

  protected override firstUpdated(): void {
    this.attachModal();
    if (this.inline && this.open) this.focusInitial();
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.attachModal();
    if (changed.has('staticBackdrop')) {
      this.modal.configure({
        backdrop: this.staticBackdrop ? 'static' : true,
        keyboard: !this.staticBackdrop,
        focus: true,
      });
    }
    if (!changed.has('open')) return;
    if (this.inline) {
      if (this.open) this.focusInitial();
      return;
    }
    if (this.open) this.modal.show();
    else this.modal.hide();
  }

  override disconnectedCallback(): void {
    this.settle(null);
    super.disconnectedCallback();
  }

  private attachModal(): void {
    if (this.inline) return;
    const element = this.querySelector<HTMLElement>(':scope > .modal');
    if (element) {
      this.modal.attach(element, {
        backdrop: this.staticBackdrop ? 'static' : true,
        keyboard: !this.staticBackdrop,
        focus: true,
      });
    }
  }

  private settle(result: TResult | null): void {
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(result);
  }

  private finish(): void {
    const result = this.outcome;
    this.outcome = null;
    this.open = false;
    this.settle(result);
    if (result === null) this.onCancelled();
  }

  /** Move focus to the first control of the body. */
  protected focusInitial(): void {
    const control = this.querySelector<HTMLElement>(this.initialFocusSelector);
    control?.focus();
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  private renderQuestion(): TemplateResult | typeof nothing {
    if (!this.question) return nothing;
    return html`<div id=${this.questionId}>${renderRich(this.question)}</div>`;
  }

  private renderError(): TemplateResult | typeof nothing {
    return renderAuthFeedback(this.error, undefined, {
      errorTitle: this.errorTitle,
      successTitle: '',
      class: 'mt-3 mb-0',
    });
  }

  private renderInline(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    return html`<form
      class="lia-auth-prompt lia-auth-prompt-inline"
      novalidate
      @submit=${this.handleSubmit}
    >
      <div class=${cx('alert', `alert-${this.variant}`)} role="alert">
        <h2 class="alert-heading h5 d-flex align-items-center gap-2" id=${this.titleId}>
          ${this.icon ? html`<i class=${this.icon} aria-hidden="true"></i>` : nothing}
          ${this.heading}
        </h2>
        ${this.renderQuestion()}
        <div class="mt-3">${this.renderBody()}</div>
        ${this.renderError()}
        <div class="d-flex flex-wrap gap-2 mt-3">${this.renderFooter()}</div>
      </div>
    </form>`;
  }

  private renderModal(): TemplateResult {
    // NOTE: the `class` on `.modal` stays static — Bootstrap owns the `show`
    // class there and a lit attribute binding would clobber it mid-transition.
    return html`<div
      class="modal fade"
      tabindex="-1"
      aria-labelledby=${this.titleId}
      aria-describedby=${this.question ? this.questionId : nothing}
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <form class="lia-auth-prompt" novalidate @submit=${this.handleSubmit}>
            <div class="modal-header">
              <h5 class="modal-title d-flex align-items-center gap-2" id=${this.titleId}>
                ${this.icon
                  ? html`<i class="${this.icon} text-${this.variant}" aria-hidden="true"></i>`
                  : nothing}
                ${this.heading}
              </h5>
              <button
                type="button"
                class="btn-close"
                aria-label=${this.closeLabel}
                @click=${() => this.close(null)}
              ></button>
            </div>
            <div class="modal-body">
              ${this.renderQuestion()}${this.renderBody()}${this.renderError()}
            </div>
            <div class="modal-footer">${this.renderFooter()}</div>
          </form>
        </div>
      </div>
    </div>`;
  }

  private readonly handleSubmit = (event: Event): void => {
    event.preventDefault();
    if (this.loading) return;
    this.submitPrompt();
  };

  protected override render(): TemplateResult | typeof nothing {
    return this.inline ? this.renderInline() : this.renderModal();
  }
}
