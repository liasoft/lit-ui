import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { renderRich, uid } from '../../core/utils.js';
import type { IconName, Variant } from '../../core/types.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderSpinner } from '../primitives/lia-spinner.js';
import type { CodeBlockLabels } from './lia-code-block.js';
import './lia-code-block.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** One line of the environment block that travels with the report. */
export interface ReportDetail {
  label: string;
  value: string;
}

/** Every string `<lia-report-form>` renders on its own behalf. */
export interface ReportFormLabels {
  message: string;
  messagePlaceholder: string;
  messageRequired: string;
  contact: string;
  contactPlaceholder: string;
  contactHint: string;
  details: string;
  detailsHint: string;
  includeDetails: string;
  showDetails: string;
  hideDetails: string;
  privacy: string;
  consent: string;
  consentRequired: string;
  submit: string;
  submitting: string;
  cancel: string;
  success: string;
}

/** The defaults behind {@link LiaReportForm.labels}. */
export const DEFAULT_REPORT_FORM_LABELS: Readonly<ReportFormLabels> = Object.freeze({
  message: 'What happened?',
  messagePlaceholder: 'Describe what you did and what you expected to happen instead.',
  messageRequired: 'Please describe the problem before sending the report.',
  contact: 'Your email address',
  contactPlaceholder: 'you@example.org',
  contactHint: 'Only used to ask follow-up questions about this report.',
  details: 'Technical details',
  detailsHint: 'These details are sent with your description.',
  includeDetails: 'Include the technical details above',
  showDetails: 'Show details',
  hideDetails: 'Hide details',
  privacy: 'Your report is used to investigate this problem and nothing else.',
  consent: 'I agree that this report may be used to investigate the problem.',
  consentRequired: 'Please confirm before sending the report.',
  submit: 'Send report',
  submitting: 'Sending…',
  cancel: 'Cancel',
  success: 'Thank you — your report has been sent.',
});

/** Detail of `lia-report-submit`. */
export interface ReportSubmitDetail {
  /** What the user wrote. */
  message: string;
  /** The contact address, when the field is shown and filled in. */
  contact: string;
  /** Whether the technical details are part of the report. */
  includeDetails: boolean;
  /** The raw details block, when included. */
  details: string;
  /** The structured details, when included. */
  entries: ReportDetail[];
}

declare global {
  interface HTMLElementEventMap {
    'lia-report-submit': CustomEvent<ReportSubmitDetail>;
    'lia-report-cancel': CustomEvent<Record<string, never>>;
  }
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * The "report a problem" panel: an explanatory note, a description field, the
 * environment block that will travel with the report — shown in full, never
 * hidden from the person sending it — a privacy note and a send action.
 *
 * The original page offered nothing but a pre-rendered mail body and a button;
 * here the reporter can say what happened, decide whether the technical
 * details go along, and see exactly what is being disclosed before agreeing to
 * it. Everything the panel says is a property, so it fits a bug report, an
 * abuse report or a support request equally well.
 *
 * @example
 * ```ts
 * html`<lia-report-form
 *   .entries=${[
 *     { label: 'Version', value: '2.4.1' },
 *     { label: 'Reference', value: errorId },
 *   ]}
 *   .details=${stackTrace}
 *   show-contact
 *   require-consent
 *   ?submitting=${sending}
 *   @lia-report-submit=${(e: CustomEvent) => send(e.detail)}
 * ></lia-report-form>`;
 * ```
 *
 * @example
 * ```html
 * <lia-report-form
 *   title="Report a problem"
 *   description="Tell us what went wrong and we will look into it."
 *   submitted
 * ></lia-report-form>
 * ```
 */
@customElement('lia-report-form')
export class LiaReportForm extends LiaElement {
  /** Heading of the panel. */
  @property({ type: String }) override title = 'Report a problem';

  /** Icon shown next to the heading. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-bug';

  /** Introductory note, rendered as trusted HTML. */
  @property({ type: String }) description =
    'Describe what happened. The technical details below are sent along so the problem can be reproduced.';

  /** Contextual colour of the introductory note. */
  @property({ type: String, attribute: 'description-variant' })
  descriptionVariant: Variant = 'primary';

  /** The description the user has written. Seeds the field. */
  @property({ type: String }) message = '';

  /** Rows of the description field. */
  @property({ type: Number }) rows = 6;

  /** The description may not be empty. */
  @property({ converter: flag, attribute: 'message-required' })
  messageRequired = true;

  /** Offer a contact field. */
  @property({ type: Boolean, attribute: 'show-contact' }) showContact = false;

  /** The contact address. Seeds the field. */
  @property({ type: String }) contact = '';

  /** Raw environment block — a stack trace, a request dump, a config excerpt. */
  @property({ type: String }) details = '';

  /** Structured environment facts, shown as a key/value list. */
  @property({ attribute: false }) entries: ReportDetail[] = [];

  /** Language tag for the details block. */
  @property({ type: String, attribute: 'details-language' }) detailsLanguage = 'text';

  /** Start with the details collapsed. */
  @property({ type: Boolean, attribute: 'details-collapsed' })
  detailsCollapsed = false;

  /** Let the reporter leave the technical details out. */
  @property({ type: Boolean, attribute: 'optional-details' }) optionalDetails = false;

  /** Privacy note under the form, rendered as trusted HTML. Empty hides it. */
  @property({ type: String, attribute: 'privacy-note' }) privacyNote =
    DEFAULT_REPORT_FORM_LABELS.privacy;

  /** Require an explicit consent tick before sending. */
  @property({ type: Boolean, attribute: 'require-consent' }) requireConsent = false;

  /** Offer a cancel button. */
  @property({ type: Boolean, attribute: 'show-cancel' }) showCancel = false;

  /** A submission is in flight. */
  @property({ type: Boolean }) submitting = false;

  /** The report went through: the form is replaced by the success message. */
  @property({ type: Boolean }) submitted = false;

  /** An error to show above the buttons. Empty hides it. */
  @property({ type: String, attribute: 'error-message' }) errorMessage = '';

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<ReportFormLabels> = {};

  /** Overrides for the strings of the `<lia-code-block>` holding the details. */
  @property({ attribute: false }) codeLabels: Partial<CodeBlockLabels> = {};

  @state() private draft = '';
  @state() private contactDraft = '';
  @state() private includeDetails = true;
  @state() private consent = false;
  @state() private detailsOpen = true;
  @state() private touched = false;

  private readonly instanceId = uid('lia-report');

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('message')) this.draft = this.message;
    if (changed.has('contact')) this.contactDraft = this.contact;
    if (changed.has('detailsCollapsed')) this.detailsOpen = !this.detailsCollapsed;
  }

  /** What would be sent if the reporter pressed the button now. */
  get value(): ReportSubmitDetail {
    const include = this.includeDetails || !this.optionalDetails;
    return {
      message: this.draft.trim(),
      contact: this.contactDraft.trim(),
      includeDetails: include,
      details: include ? this.details : '',
      entries: include ? this.entries : [],
    };
  }

  private get strings(): ReportFormLabels {
    return { ...DEFAULT_REPORT_FORM_LABELS, ...this.labels };
  }

  private get messageError(): string {
    if (!this.touched) return '';
    if (this.messageRequired && this.draft.trim() === '') return this.strings.messageRequired;
    return '';
  }

  private get consentError(): string {
    if (!this.touched) return '';
    if (this.requireConsent && !this.consent) return this.strings.consentRequired;
    return '';
  }

  private submit(event: Event): void {
    event.preventDefault();
    this.touched = true;
    if (this.messageError || this.consentError) return;
    this.emit<ReportSubmitDetail>('lia-report-submit', this.value);
  }

  private renderDetails(): TemplateResult | typeof nothing {
    if (!this.details && this.entries.length === 0) return nothing;
    const strings = this.strings;
    const panelId = `${this.instanceId}-details`;
    return html`<section class="mb-3" aria-labelledby="${panelId}-heading">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <h3 class="h6 mb-0" id="${panelId}-heading">${strings.details}</h3>
          <span class="small text-body-secondary">${strings.detailsHint}</span>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          aria-expanded=${this.detailsOpen ? 'true' : 'false'}
          aria-controls=${panelId}
          @click=${() => {
            this.detailsOpen = !this.detailsOpen;
          }}
        >
          ${renderIcon(this.detailsOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down', {
            class: 'me-1',
          })}${this.detailsOpen ? strings.hideDetails : strings.showDetails}
        </button>
      </div>

      <div id=${panelId} class=${this.detailsOpen ? '' : 'd-none'}>
        ${
          this.entries.length
            ? html`<dl class="row mb-2 small">
                ${this.entries.map(
                  (entry) =>
                    html`<dt class="col-sm-4 text-body-secondary fw-normal">${entry.label}</dt>
                      <dd class="col-sm-8 font-monospace text-break">${entry.value}</dd>`,
                )}
              </dl>`
            : nothing
        }
        ${
          this.details
            ? html`<lia-code-block
                language=${this.detailsLanguage}
                max-height="16rem"
                line-numbers="false"
                .code=${this.details}
                .labels=${this.codeLabels}
              ></lia-code-block>`
            : nothing
        }
      </div>

      ${
        this.optionalDetails
          ? html`<div class="form-check mt-2">
              <input
                class="form-check-input"
                type="checkbox"
                id="${this.instanceId}-include"
                .checked=${this.includeDetails}
                @change=${(event: Event) => {
                  this.includeDetails = (event.target as HTMLInputElement).checked;
                }}
              />
              <label class="form-check-label small" for="${this.instanceId}-include"
                >${strings.includeDetails}</label
              >
            </div>`
          : nothing
      }
    </section>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    const messageId = `${this.instanceId}-message`;
    const contactId = `${this.instanceId}-contact`;
    const messageError = this.messageError;
    const consentError = this.consentError;

    if (this.submitted) {
      return html`<div class="lia-report-form">
        <div class="alert alert-success d-flex align-items-center gap-2" role="status">
          ${renderIcon('fa-solid fa-circle-check')}<span>${strings.success}</span>
        </div>
      </div>`;
    }

    return html`<form
      class="lia-report-form card"
      novalidate
      @submit=${(e: Event) => this.submit(e)}
    >
      <div class="card-header d-flex align-items-center gap-1">
        ${renderIcon(this.icon)}<span>${this.title}</span>
      </div>

      <div class="card-body">
        ${
          this.description
            ? html`<div class="alert alert-${this.descriptionVariant}" role="note">
                ${renderRich(this.description)}
              </div>`
            : nothing
        }

        <div class="mb-3">
          <label class="form-label" for=${messageId}>
            ${strings.message}${
              this.messageRequired
                ? html`<span class="text-danger ms-1" aria-hidden="true">*</span>`
                : nothing
            }
          </label>
          <textarea
            id=${messageId}
            class="form-control ${messageError ? 'is-invalid' : ''}"
            rows=${this.rows}
            placeholder=${strings.messagePlaceholder}
            .value=${this.draft}
            ?required=${this.messageRequired}
            ?disabled=${this.submitting}
            aria-invalid=${messageError ? 'true' : 'false'}
            aria-describedby=${messageError ? `${messageId}-error` : ''}
            @input=${(event: Event) => {
              this.draft = (event.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          ${
            messageError
              ? html`<div class="invalid-feedback d-block" id="${messageId}-error">
                  ${messageError}
                </div>`
              : nothing
          }
        </div>

        ${
          this.showContact
            ? html`<div class="mb-3">
                <label class="form-label" for=${contactId}>${strings.contact}</label>
                <input
                  id=${contactId}
                  type="email"
                  class="form-control"
                  autocomplete="email"
                  placeholder=${strings.contactPlaceholder}
                  .value=${this.contactDraft}
                  ?disabled=${this.submitting}
                  aria-describedby="${contactId}-hint"
                  @input=${(event: Event) => {
                    this.contactDraft = (event.target as HTMLInputElement).value;
                  }}
                />
                <div class="form-text" id="${contactId}-hint">${strings.contactHint}</div>
              </div>`
            : nothing
        }
        ${this.renderDetails()}
        ${
          this.privacyNote
            ? html`<p class="small text-body-secondary mb-3">${renderRich(this.privacyNote)}</p>`
            : nothing
        }
        ${
          this.requireConsent
            ? html`<div class="form-check mb-3">
                <input
                  class="form-check-input ${consentError ? 'is-invalid' : ''}"
                  type="checkbox"
                  id="${this.instanceId}-consent"
                  .checked=${this.consent}
                  ?disabled=${this.submitting}
                  aria-invalid=${consentError ? 'true' : 'false'}
                  aria-describedby=${consentError ? `${this.instanceId}-consent-error` : ''}
                  @change=${(event: Event) => {
                    this.consent = (event.target as HTMLInputElement).checked;
                  }}
                />
                <label class="form-check-label" for="${this.instanceId}-consent"
                  >${strings.consent}</label
                >
                ${
                  consentError
                    ? html`<div
                        class="invalid-feedback d-block"
                        id="${this.instanceId}-consent-error"
                      >
                        ${consentError}
                      </div>`
                    : nothing
                }
              </div>`
            : nothing
        }
        ${
          this.errorMessage
            ? html`<div class="alert alert-danger" role="alert">${this.errorMessage}</div>`
            : nothing
        }
      </div>

      <div class="card-footer d-flex flex-wrap justify-content-end gap-2">
        ${
          this.showCancel
            ? html`<button
                type="button"
                class="btn btn-outline-secondary"
                ?disabled=${this.submitting}
                @click=${() => this.emit('lia-report-cancel', {})}
              >
                ${strings.cancel}
              </button>`
            : nothing
        }
        <button type="submit" class="btn btn-primary" ?disabled=${this.submitting}>
          ${
            this.submitting
              ? html`${renderSpinner(strings.submitting, { size: 'sm' })}
                  <span class="ms-1">${strings.submitting}</span>`
              : html`${renderIcon('fa-solid fa-paper-plane', { class: 'me-1' })}${strings.submit}`
          }
        </button>
      </div>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-report-form': LiaReportForm;
  }
}
