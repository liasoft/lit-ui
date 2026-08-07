import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  FormDefinition,
  FormErrors,
  IconName,
} from '../../core/types.js';
import { renderRich } from '../../core/utils.js';
import { renderActions } from '../primitives/render-action.js';
import { flag } from '../layout/flag.js';
// Registers `<lia-form>`, which renders the fields themselves.
import '../form/index.js';

/**
 * Call a method on an object only if it actually has one.
 *
 * `<lia-form>` is a sibling family: this page drives it through its tag name
 * and its `FormDefinition`, never through its internals, so the imperative
 * hooks are probed rather than assumed.
 */
function tryInvoke(target: unknown, method: string): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const candidate = (target as Record<string, unknown>)[method];
  if (typeof candidate !== 'function') return false;
  (candidate as () => void).call(target);
  return true;
}

/**
 * The create / edit counterpart of `<lia-crud-page>`: a heading with a way
 * back to the listing, the form itself, and a save / reset bar.
 *
 * The element renders `<lia-form>` from the {@link FormDefinition} you pass and
 * suppresses its own button bar, so the actions live in one predictable place
 * at the bottom of the page — sticky, if you want them reachable on a long
 * form. Submitting goes through the real `<form>`, so browser validation and
 * the `lia-submit` event behave exactly as they would standalone.
 *
 * Validation errors arrive as a `FormErrors` map and are summarised above the
 * fields, which is what a screen-reader user needs when the offending input is
 * three screens down.
 *
 * @example
 * ```ts
 * html`<lia-crud-form-page
 *   title="Edit user"
 *   icon="fa-solid fa-user-pen"
 *   back-url="/users"
 *   .form=${definition}
 *   .errors=${this.errors}
 *   .saving=${this.saving}
 *   @lia-submit=${(e: CustomEvent) => this.save(e.detail.values)}
 *   @lia-reset=${() => this.reload()}
 * ></lia-crud-form-page>`;
 * ```
 */
@customElement('lia-crud-form-page')
export class LiaCrudFormPage extends LiaElement {
  /**
   * Page title. Falls back to `form.title`.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = '';

  /** Icon before the title. Falls back to `form.icon`. */
  @property({ type: String }) icon: IconName = '';

  /** Secondary line under the title. Falls back to `form.description`. */
  @property({ type: String }) description = '';

  /** The form to render. */
  @property({ attribute: false }) form?: FormDefinition;

  /** Field name → message. Rendered as a summary and handed to the form. */
  @property({ attribute: false }) errors?: FormErrors;

  /** A page-level failure, e.g. the request itself was rejected. */
  @property({ type: String }) error = '';

  /** Where "back to overview" points. Falls back to `form.backUrl`. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  /** Disable the bar and spin the save button while the request runs. */
  @property({ type: Boolean }) saving = false;

  /** Extra actions in the heading toolbar, e.g. a delete button. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Render the heading block. Turn it off inside a `<lia-page>`. */
  @property({ converter: flag, attribute: 'show-heading' }) showHeading = true;

  /** Render the save / reset bar. */
  @property({ converter: flag, attribute: 'show-buttons' }) showButtons = true;

  /** Keep the button bar visible while the form scrolls. */
  @property({ type: Boolean }) sticky = false;

  /** Show the list of field errors above the form. */
  @property({ converter: flag, attribute: 'show-error-summary' }) showErrorSummary = true;

  @property({ type: String, attribute: 'save-label' }) saveLabel = 'Save';

  @property({ type: String, attribute: 'reset-label' }) resetLabel = 'Reset';

  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = 'Cancel';

  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Heading of the error summary. */
  @property({ type: String, attribute: 'error-summary-label' }) errorSummaryLabel =
    'Please correct the following:';

  /** Show a cancel link pointing at {@link backUrl}. */
  @property({ converter: flag, attribute: 'show-cancel' }) showCancel = true;

  /** Heading level of the title. */
  @property({ type: Number }) level: 1 | 2 | 3 | 4 | 5 | 6 = 5;

  /** The `<lia-form>` element, once rendered. */
  get formElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>('lia-form');
  }

  /** The native `<form>` the fields live in, if the form family renders one. */
  get nativeForm(): HTMLFormElement | null {
    return (
      this.querySelector<HTMLFormElement>('lia-form form') ??
      this.querySelector<HTMLFormElement>(':scope > form')
    );
  }

  /** Resolved heading text: the explicit title, else the definition's. */
  get resolvedTitle(): string {
    return this.title || this.form?.title || '';
  }

  /** Resolved back link: the explicit URL, else the definition's. */
  get resolvedBackUrl(): string {
    return this.backUrl || this.form?.backUrl || '';
  }

  /** Field errors as a list, for the summary and for counting. */
  get errorList(): Array<{ name: string; message: string }> {
    return Object.entries(this.errors ?? {}).map(([name, message]) => ({ name, message }));
  }

  /**
   * Submit the form. Prefers the native `<form>` so constraint validation and
   * the `submit` event fire exactly as the browser intends.
   */
  submit(): void {
    if (this.saving) return;
    const form = this.nativeForm;
    if (form) {
      form.requestSubmit();
      return;
    }
    tryInvoke(this.formElement, 'submit');
  }

  /** Restore the form to the values it was rendered with. */
  reset(): void {
    if (this.saving) return;
    this.nativeForm?.reset();
    tryInvoke(this.formElement, 'reset');
    this.emit('lia-reset', { id: this.form?.id });
  }

  protected override updated(changed: PropertyValues<this>): void {
    // Move the caret to the summary when a submit comes back with errors: the
    // offending field is often far below the fold.
    if (!changed.has('errors') || this.errorList.length === 0) return;
    const previous = changed.get('errors');
    if (previous && Object.keys(previous).length > 0) return;
    this.querySelector<HTMLElement>('.lia-crud-error-summary')?.focus();
  }

  private renderTitleTag(inner: unknown): TemplateResult {
    switch (this.level) {
      case 1:
        return html`<h1 class="h5 mb-1">${inner}</h1>`;
      case 2:
        return html`<h2 class="h5 mb-1">${inner}</h2>`;
      case 3:
        return html`<h3 class="h5 mb-1">${inner}</h3>`;
      case 4:
        return html`<h4 class="h5 mb-1">${inner}</h4>`;
      case 6:
        return html`<h6 class="h5 mb-1">${inner}</h6>`;
      default:
        return html`<h5 class="mb-1">${inner}</h5>`;
    }
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.showHeading) return nothing;
    const title = this.resolvedTitle;
    const description = this.description || this.form?.description || '';
    const icon = this.icon || this.form?.icon || '';
    const backUrl = this.resolvedBackUrl;
    const actions: ActionDescriptor[] = [...this.actions];
    if (backUrl) {
      actions.unshift({
        id: 'back',
        label: this.backLabel,
        icon: 'fa-solid fa-reply',
        href: backUrl,
        variant: 'outline-secondary',
      });
    }
    if (title === '' && description === '' && actions.length === 0) return nothing;

    return html`<div
      class="lia-crud-heading d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3"
    >
      <div class="min-w-0">
        ${title
          ? this.renderTitleTag(
              html`${icon ? html`<i class="${icon} me-1" aria-hidden="true"></i>` : nothing}${title}`
            )
          : nothing}
        ${description
          ? html`<span class="text-body-secondary">${renderRich(description)}</span>`
          : nothing}
      </div>
      ${actions.length
        ? html`<div class="d-flex flex-wrap gap-1" role="group" aria-label=${title || 'Actions'}>
            ${renderActions(actions, {
              host: this,
              variant: 'outline-primary',
              labelResponsive: true,
            })}
          </div>`
        : nothing}
    </div>`;
  }

  private renderErrorSummary(): TemplateResult | typeof nothing {
    const errors = this.errorList;
    if (!this.showErrorSummary || errors.length === 0) return nothing;
    return html`<div class="lia-crud-error-summary alert alert-danger" role="alert" tabindex="-1">
      <p class="mb-2">${this.errorSummaryLabel}</p>
      <ul class="mb-0">
        ${errors.map((entry) => html`<li>${entry.message}</li>`)}
      </ul>
    </div>`;
  }

  private renderButtons(): TemplateResult | typeof nothing {
    if (!this.showButtons) return nothing;
    const backUrl = this.resolvedBackUrl;
    return html`<div
      class="lia-crud-form-buttons d-flex flex-wrap justify-content-end gap-2 mt-3 ${this.sticky
        ? 'lia-crud-form-buttons-sticky'
        : ''}"
    >
      ${this.showCancel && backUrl
        ? html`<a class="btn btn-outline-secondary" href=${backUrl}>${this.cancelLabel}</a>`
        : nothing}
      <button
        type="button"
        class="btn btn-outline-secondary"
        ?disabled=${this.saving}
        @click=${() => this.reset()}
      >
        ${this.resetLabel}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        aria-busy=${this.saving ? 'true' : nothing}
        ?disabled=${this.saving}
        @click=${() => this.submit()}
      >
        ${this.saving
          ? html`<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>`
          : nothing}
        ${this.saveLabel}
      </button>
    </div>`;
  }

  protected override render(): TemplateResult {
    // The page owns the button bar, so the form must not render its own.
    const definition = this.form
      ? { ...this.form, noSubmit: this.showButtons ? true : this.form.noSubmit }
      : undefined;

    return html`${this.renderHeading()}
    ${this.error ? html`<div class="alert alert-danger" role="alert">${this.error}</div>` : nothing}
    ${this.renderErrorSummary()}
    ${definition
      ? html`<lia-form .definition=${definition} .errors=${this.errors}></lia-form>`
      : nothing}
    ${this.renderButtons()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-crud-form-page': LiaCrudFormPage;
  }
  interface HTMLElementEventMap {
    'lia-reset': CustomEvent<{ id?: string }>;
  }
}
