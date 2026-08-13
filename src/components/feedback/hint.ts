import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { copyToClipboard, cx, renderRich } from '../../core/utils.js';
import { feedbackRole, renderActionRow, variantIcon } from './internal.js';

/** One remediation step inside a {@link LiaHint}. */
export interface HintStep {
  /** Bold lead-in for the step. */
  title?: string;
  /** Plain-text explanation. */
  text?: string;
  /** Trusted HTML alternative to {@link HintStep.text}. */
  html?: string;
  /** A command or snippet rendered in a code block under the step. */
  code?: string;
}

/** How the hint frames itself. */
export type HintAppearance = 'card' | 'alert' | 'plain';

/**
 * The reusable "system hint" panel: an icon, a title, an explanation, an
 * optional list of remediation steps, an optional command to run and a row of
 * actions.
 *
 * One component covers every stand-alone diagnostic screen — missing runtime
 * extensions, wrong file ownership, a rate limit, missing vendor files, an
 * unrecoverable database error, a not-yet-installed welcome screen — purely
 * by feeding it different data.
 *
 * @example
 * ```ts
 * html`<lia-hint
 *   page
 *   variant="warning"
 *   heading="Missing requirements"
 *   lead="Some required runtime extensions are not installed."
 *   .body=${['Install them for the runtime version currently in use, then reload.']}
 *   code=${missing.join(' ')}
 *   .actions=${[{ id: 'reload', label: 'Reload', variant: 'primary' }]}
 * ></lia-hint>`
 * ```
 *
 * @example
 * ```ts
 * html`<lia-hint
 *   appearance="alert"
 *   variant="danger"
 *   heading="A database error occurred"
 *   .body=${error.message}
 *   details=${error.stack}
 *   detailsLabel="Technical details"
 *   .actions=${[
 *     { id: 'back', label: 'Go back', variant: 'primary' },
 *     { id: 'report', label: 'Report error', variant: 'warning', href: reportUrl },
 *   ]}
 * ></lia-hint>`
 * ```
 */
@customElement('lia-hint')
export class LiaHint extends LiaElement {
  /** Bootstrap contextual colour. */
  @property({ type: String }) variant: Variant = 'warning';

  /** Icon in the leading chip. Defaults to the variant's icon. */
  @property({ type: String }) icon?: IconName;

  /** Suppress the icon chip. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** The headline. */
  @property({ type: String }) heading = '';

  /** A single emphasised sentence under the heading. Trusted HTML. */
  @property({ type: String }) lead?: string;

  /** Explanatory paragraphs. A string is one paragraph. Trusted HTML. */
  @property({ attribute: false }) body?: string | string[];

  /** Numbered remediation steps. Plain strings become simple steps. */
  @property({ attribute: false }) steps?: Array<string | HintStep>;

  /** A command or snippet the user should run. */
  @property({ type: String }) code?: string;

  /** Raw technical output (a stack trace, a driver message). */
  @property({ type: String }) details?: string;

  /** When set, `details` is collapsed behind a disclosure with this label. */
  @property({ type: String }) detailsLabel?: string;

  /** Buttons rendered in the footer. */
  @property({ attribute: false }) actions?: ActionDescriptor[];

  /** Small print under everything else. Trusted HTML. */
  @property({ type: String }) footnote?: string;

  /** `card` (default), `alert`, or `plain` for no frame at all. */
  @property({ type: String }) appearance: HintAppearance = 'card';

  /** Fill the card with the variant colour — for hard, page-level failures. */
  @property({ type: Boolean }) solid = false;

  /** Centre the hint on a full-height page. */
  @property({ type: Boolean }) page = false;

  /** Max-width utility used by the page wrapper. */
  @property({ type: String, attribute: 'page-width' }) pageWidth = 'max-w-lg';

  /** Label of the copy-to-clipboard button on code blocks. */
  @property({ type: String }) copyLabel = 'Copy';

  /** Label shown for a moment after a successful copy. */
  @property({ type: String }) copiedLabel = 'Copied';

  /** Remove the copy-to-clipboard buttons. */
  @property({ type: Boolean, attribute: 'no-copy' }) noCopy = false;

  @state() private copied?: string;

  private copyTimer?: ReturnType<typeof setTimeout>;

  override disconnectedCallback(): void {
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer);
    super.disconnectedCallback();
  }

  private async copy(code: string): Promise<void> {
    const ok = await copyToClipboard(code);
    if (!ok) return;
    this.copied = code;
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copied = undefined;
    }, 1600);
  }

  private renderCode(code: string, withCopy: boolean): TemplateResult {
    const surface = this.solid
      ? 'bg-black bg-opacity-25 text-white border-0'
      : 'bg-body-tertiary border';
    const done = this.copied === code;
    return html`<div class="position-relative lia-hint-code mb-3">
      <pre
        class=${cx('rounded p-3 mb-0', surface)}
      ><code>${code}</code></pre>
      ${withCopy && !this.noCopy
        ? html`<button
            type="button"
            class="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-2"
            @click=${() => void this.copy(code)}
          >
            <i
              class=${done ? 'fa-solid fa-check me-1' : 'fa-regular fa-copy me-1'}
              aria-hidden="true"
            ></i>
            ${done ? this.copiedLabel : this.copyLabel}
          </button>`
        : nothing}
    </div>`;
  }

  private renderBody(): TemplateResult | typeof nothing {
    if (!this.body) return nothing;
    const paragraphs = Array.isArray(this.body) ? this.body : [this.body];
    if (paragraphs.length === 0) return nothing;
    return html`${paragraphs.map(
      (paragraph) => html`<p class="mb-2">${renderRich(paragraph)}</p>`
    )}`;
  }

  private renderSteps(): TemplateResult | typeof nothing {
    const steps = this.steps ?? [];
    if (steps.length === 0) return nothing;
    return html`<ol class="lia-hint-steps mt-3 mb-3">
      ${steps.map((entry) => {
        const step: HintStep = typeof entry === 'string' ? { text: entry } : entry;
        return html`<li class="mb-2">
          ${step.title ? html`<strong class="d-block">${step.title}</strong>` : nothing}
          ${step.html ? renderRich(step.html) : step.text ? html`<span>${step.text}</span>` : nothing}
          ${step.code ? this.renderCode(step.code, true) : nothing}
        </li>`;
      })}
    </ol>`;
  }

  private renderDetails(): TemplateResult | typeof nothing {
    if (!this.details) return nothing;
    const block = html`<pre
      class=${cx(
        'lia-hint-details rounded p-3 mb-0',
        this.solid ? 'bg-black bg-opacity-25 text-white' : 'bg-body-tertiary border'
      )}
    >${this.details}</pre>`;
    if (!this.detailsLabel) return html`<hr />${block}`;
    return html`<details class="lia-hint-disclosure mt-3">
      <summary class="fw-semibold">${this.detailsLabel}</summary>
      <div class="mt-2">${block}</div>
    </details>`;
  }

  private renderIcon(): TemplateResult | typeof nothing {
    if (this.noIcon) return nothing;
    const chipClass =
      this.appearance === 'alert'
        ? 'alert-icon'
        : this.solid
          ? 'alert-icon lia-hint-icon bg-white bg-opacity-25 text-white'
          : `alert-icon lia-hint-icon bg-${this.variant}-subtle text-${this.variant}-emphasis`;
    return html`<span class=${cx(chipClass, 'flex-shrink-0 fs-4')}
      ><i class=${this.icon ?? variantIcon(this.variant)} aria-hidden="true"></i
    ></span>`;
  }

  private renderActions(extraClass: string): TemplateResult | typeof nothing {
    return renderActionRow(this.actions, cx('justify-content-end', extraClass), {
      host: this,
      variant: this.solid ? 'light' : 'primary',
    });
  }

  private renderInner(): TemplateResult {
    return html`<div class="d-flex gap-3 align-items-start">
      ${this.renderIcon()}
      <div class="flex-grow-1 min-w-0">
        ${this.heading ? html`<h4 class="lia-hint-heading h4 mb-2">${this.heading}</h4>` : nothing}
        ${this.lead ? html`<p class="lead mb-3">${renderRich(this.lead)}</p>` : nothing}
        ${this.renderBody()} ${this.renderSteps()}
        ${this.code ? this.renderCode(this.code, true) : nothing} ${this.renderDetails()}
        ${this.footnote
          ? html`<p class="small opacity-75 mt-3 mb-0">${renderRich(this.footnote)}</p>`
          : nothing}
      </div>
    </div>`;
  }

  private renderFrame(): TemplateResult {
    const role = feedbackRole(this.variant);
    const actions = this.renderActions('');

    if (this.appearance === 'plain') {
      return html`<div class="lia-hint" role=${role}>
        ${this.renderInner()}${actions === nothing ? nothing : html`<div class="mt-3">${actions}</div>`}
      </div>`;
    }

    if (this.appearance === 'alert') {
      return html`<div class=${cx('alert lia-hint', `alert-${this.variant}`)} role=${role}>
        ${this.renderInner()}
        ${actions === nothing ? nothing : html`<hr /><div>${actions}</div>`}
      </div>`;
    }

    return html`<div
      class=${cx('card lia-hint shadow-sm border-0', this.solid ? `text-bg-${this.variant}` : '')}
      role=${role}
    >
      <div class="card-body p-4">${this.renderInner()}</div>
      ${actions === nothing
        ? nothing
        : html`<div class="card-footer bg-transparent border-0 pt-0 p-4">${actions}</div>`}
    </div>`;
  }

  protected override render(): TemplateResult {
    const frame = this.renderFrame();
    if (!this.page) return frame;
    return html`<div class="lia-hint-page min-vh-100 d-flex align-items-center py-5">
      <div class=${cx('container', this.pageWidth)}>${frame}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-hint': LiaHint;
  }
}
