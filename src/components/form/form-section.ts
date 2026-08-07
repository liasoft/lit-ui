import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
// Importing Collapse registers Bootstrap's collapse data-api, which drives the
// header toggle below without a click handler of our own.
import { Collapse } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import type { FormErrors, FormSection, FormValues } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import {
  DEFAULT_FORM_FIELD_LABELS,
  isFieldVisible,
  isSectionVisible,
  slugifyName,
  type FormFieldLabels,
} from './field-model.js';
import { EMPTY_ASYNC_FIELD_STATE, type AsyncFieldState } from './async-fields.js';
import './form-field.js';

/**
 * One card of a data-driven form: an optional header with icon and title, an
 * optional description, and the field rows.
 *
 * Set `collapsible` on the section and the header grows a chevron that folds
 * the card away — driven by Bootstrap's own collapse plugin, so it animates
 * and reports `shown.bs.collapse` exactly like hand-written markup would.
 *
 * The section is a pure pass-through for values: it renders `values[name]`
 * into each field and lets the fields' `lia-change` events bubble up to
 * `<lia-form>`.
 *
 * @example
 * ```ts
 * html`<lia-form-section
 *   section-id="network"
 *   .section=${{
 *     title: 'Network',
 *     icon: 'fa-solid fa-network-wired',
 *     collapsible: true,
 *     fields: {
 *       hostname: { type: 'text', label: 'Hostname', mandatory: true },
 *       port: { type: 'number', label: 'Port', value: 443, min: 1, max: 65535 },
 *     },
 *   }}
 *   .values=${values}
 *   .errors=${errors}
 * ></lia-form-section>`
 * ```
 */
@customElement('lia-form-section')
export class LiaFormSection extends LiaElement {
  /** Key of this section; becomes the card's DOM id. */
  @property({ type: String, attribute: 'section-id' }) sectionId = '';

  /** The section definition. */
  @property({ attribute: false }) section: FormSection = { fields: {} };

  /** The form's value model. */
  @property({ attribute: false }) values: FormValues = {};

  /** Validation messages by field name. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Disable every field in the section. */
  @property({ type: Boolean }) disabled = false;

  /** Render the fields with Bootstrap's floating labels. */
  @property({ type: Boolean }) floating = false;

  /** Render `visible: false` fields anyway, disabled. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Name of a field to highlight, e.g. one linked to from a search result. */
  @property({ type: String }) highlight = '';

  /** Prefix for generated DOM ids. */
  @property({ type: String, attribute: 'id-prefix' }) idPrefix = '';

  /** Accessible name of the collapse toggle. */
  @property({ type: String, attribute: 'toggle-label' }) toggleLabel = 'Toggle this section';

  /** Overridable user-visible strings, passed down to every field. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Async progress from `<lia-form>`, passed straight through to the fields. */
  @property({ attribute: false }) asyncState: AsyncFieldState = EMPTY_ASYNC_FIELD_STATE;

  /** Extra classes on the `.card`. */
  @property({ type: String, attribute: 'card-class' }) cardClass = 'mb-3';

  private readonly instanceId = uid('lia-form-section');

  override disconnectedCallback(): void {
    for (const element of Array.from(this.querySelectorAll('.collapse'))) {
      Collapse.getInstance(element)?.dispose();
    }
    super.disconnectedCallback();
  }

  /** DOM id of the collapsible body. */
  get bodyId(): string {
    return this.sectionId ? `${this.cardId}-body` : `${this.instanceId}-body`;
  }

  /** DOM id of the card. */
  get cardId(): string {
    if (!this.sectionId) return this.instanceId;
    const slug = slugifyName(this.sectionId);
    return this.idPrefix ? `${this.idPrefix}-${slug}` : slug;
  }

  /**
   * The fields this section will actually render, in declaration order.
   * `showWhen`/`hideWhen` are resolved against the current {@link values}.
   */
  get visibleFields(): Array<[string, FormSection['fields'][string]]> {
    return Object.entries(this.section.fields ?? {}).filter(
      ([, field]) => this.showHidden || isFieldVisible(field, this.values)
    );
  }

  private renderHeader(): TemplateResult | typeof nothing {
    const { title, icon, collapsible } = this.section;
    if (!title && !icon) return nothing;
    const expanded = this.section.collapsed !== true;
    return html`<div class="card-header d-flex align-items-center justify-content-between gap-2">
      <span class="d-inline-flex align-items-center gap-2">
        ${icon ? html`<i class=${icon} aria-hidden="true"></i>` : nothing}
        <span>${renderRich(title ?? '')}</span>
      </span>
      ${
        collapsible
          ? html`<button
              type="button"
              class="btn btn-sm btn-link text-body p-0 lia-form-section-toggle"
              data-bs-toggle="collapse"
              data-bs-target=${`#${this.bodyId}`}
              aria-expanded=${expanded ? 'true' : 'false'}
              aria-controls=${this.bodyId}
              aria-label=${this.toggleLabel}
              title=${this.toggleLabel}
            >
              <i class="fa-solid fa-chevron-down lia-form-section-chevron" aria-hidden="true"></i>
            </button>`
          : nothing
      }
    </div>`;
  }

  protected override render(): unknown {
    if (!isSectionVisible(this.section, this.values) && !this.showHidden) return nothing;

    const { collapsible, description } = this.section;
    const expanded = this.section.collapsed !== true;

    return html`<div class=${cx('card', this.cardClass)} id=${this.cardId}>
      ${this.renderHeader()}
      <div
        id=${this.bodyId}
        class=${cx(collapsible && 'collapse', collapsible && expanded && 'show')}
      >
        ${
          description
            ? html`<div class="card-body pb-0">
                <p class="text-body-secondary mb-0">${renderRich(description)}</p>
              </div>`
            : nothing
        }
        <div class="formfields">
          ${this.visibleFields.map(
            ([name, field]) =>
              html`<lia-form-field
                .name=${name}
                .field=${field}
                .values=${this.values}
                .errors=${this.errors}
                .labels=${this.labels}
                .asyncState=${this.asyncState}
                .disabled=${this.disabled}
                .floating=${this.floating}
                .showHidden=${this.showHidden}
                .highlight=${this.highlight === name}
                .idPrefix=${this.idPrefix}
              ></lia-form-field>`
          )}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-form-section': LiaFormSection;
  }
}
