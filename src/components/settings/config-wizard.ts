import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { slugifyName } from '../form/field-model.js';
import { renderIcon } from '../primitives/lia-icon.js';

/** One selectable service, daemon or variant inside a {@link ConfigChoice}. */
export interface ConfigOption {
  value: string;
  label: string;
  /** Small line under the label. Trusted HTML. */
  description?: string;
  /** Marked with an asterisk and picked by "select recommended". */
  recommended?: boolean;
  disabled?: boolean;
  /** Offer the "show what this generates" affordance. Defaults to `true`. */
  preview?: boolean;
}

/** One group of options — a distribution, a web server, a set of daemons. */
export interface ConfigChoice {
  id: string;
  label: string;
  /** Explanation under the group title. Trusted HTML. */
  description?: string;
  icon?: IconName;
  /** Several options at once (check boxes) instead of one (radios). */
  multiple?: boolean;
  /** Offer an explicit "skip this" option. Single-choice groups only. */
  optional?: boolean;
  /** Preselected value(s). */
  value?: string | string[];
  options: ConfigOption[];
}

/** What the operator picked, keyed by choice id. */
export type ConfigSelection = Record<string, string | string[]>;

/** Detail of `lia-config-request` — "generate the configuration for this". */
export interface ConfigRequestDetail {
  selection: ConfigSelection;
}

/** Detail of `lia-config-preview` — "show me what this one produces". */
export interface ConfigPreviewDetail {
  choice: ConfigChoice;
  option: ConfigOption;
  selection: ConfigSelection;
}

/** Detail of `lia-config-download` — "give me the selection as a file". */
export interface ConfigDownloadDetail {
  selection: ConfigSelection;
}

declare global {
  interface HTMLElementEventMap {
    'lia-config-request': CustomEvent<ConfigRequestDetail>;
    'lia-config-preview': CustomEvent<ConfigPreviewDetail>;
    'lia-config-download': CustomEvent<ConfigDownloadDetail>;
  }
}

/** How the picker presents its options. */
export type ConfigWizardLayout = 'cards' | 'select';

/** The value that means "do not configure this group at all". */
export const CONFIG_SKIP_VALUE = '';

/** The selection a set of choices starts with. */
export function initialConfigSelection(choices: readonly ConfigChoice[]): ConfigSelection {
  const selection: ConfigSelection = {};
  for (const choice of choices) {
    if (choice.multiple) {
      selection[choice.id] = Array.isArray(choice.value)
        ? [...choice.value]
        : choice.value
          ? [choice.value]
          : [];
    } else {
      selection[choice.id] = typeof choice.value === 'string' ? choice.value : CONFIG_SKIP_VALUE;
    }
  }
  return selection;
}

/** The selection every choice's `recommended` options add up to. */
export function recommendedConfigSelection(choices: readonly ConfigChoice[]): ConfigSelection {
  const selection: ConfigSelection = {};
  for (const choice of choices) {
    const recommended = choice.options.filter((option) => option.recommended && !option.disabled);
    selection[choice.id] = choice.multiple
      ? recommended.map((option) => option.value)
      : (recommended[0]?.value ?? CONFIG_SKIP_VALUE);
  }
  return selection;
}

/**
 * The input half of a configuration generator: pick a distribution, a web
 * server, a mail stack — then ask for the configuration those choices produce.
 *
 * Each {@link ConfigChoice} is a group of options: radios when one may be
 * chosen, check boxes when several may. Options flagged `recommended` are
 * marked with an asterisk and can be selected in one go. Nothing is generated
 * here — submitting emits `lia-config-request` with the selection, and it is
 * up to the application to turn that into the steps a
 * `<lia-config-viewer>` shows.
 *
 * The per-option "preview" button emits `lia-config-preview`, the hook for the
 * "show me what this one writes" dialog.
 *
 * @example
 * ```ts
 * html`<lia-config-wizard
 *   title="Server configuration"
 *   description="Pick the services this host runs."
 *   .choices=${[
 *     {
 *       id: 'distribution',
 *       label: 'Distribution',
 *       options: [
 *         { value: 'deb13', label: 'Debian 13', recommended: true },
 *         { value: 'ubu2404', label: 'Ubuntu 24.04' },
 *       ],
 *     },
 *     {
 *       id: 'http',
 *       label: 'Web server',
 *       optional: true,
 *       options: [
 *         { value: 'nginx', label: 'nginx', recommended: true },
 *         { value: 'apache', label: 'Apache 2.4' },
 *       ],
 *     },
 *     {
 *       id: 'system',
 *       label: 'System services',
 *       multiple: true,
 *       options: [
 *         { value: 'cron', label: 'cron', recommended: true },
 *         { value: 'logrotate', label: 'logrotate' },
 *       ],
 *     },
 *   ]}
 *   @lia-config-request=${(e: CustomEvent) => generate(e.detail.selection)}
 * ></lia-config-wizard>`
 * ```
 */
@customElement('lia-config-wizard')
export class LiaConfigWizard extends LiaElement {
  /** The groups of options to offer. */
  @property({ attribute: false }) choices: ConfigChoice[] = [];

  /** `cards` (a grid of check lists) or `select` (one drop-down per group). */
  @property({ type: String }) layout: ConfigWizardLayout = 'cards';

  /**
   * Heading above the picker.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = '';

  /** Line under the heading. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Disable every control. */
  @property({ type: Boolean }) disabled = false;

  /** Show a spinner in the submit button and block further submits. */
  @property({ type: Boolean }) busy = false;

  /** Hide the "select recommended" button. */
  @property({ type: Boolean, attribute: 'no-recommended' }) noRecommended = false;

  /** Hide the download button. */
  @property({ type: Boolean, attribute: 'no-download' }) noDownload = false;

  /** Hide every per-option preview button. */
  @property({ type: Boolean, attribute: 'no-preview' }) noPreview = false;

  /* -- overridable strings ---------------------------------------------- */

  @property({ type: String, attribute: 'skip-label' }) skipLabel = 'Do not configure this';

  @property({ type: String, attribute: 'recommended-note' }) recommendedNote =
    'Recommended for the current setup.';

  @property({ type: String, attribute: 'recommended-title' }) recommendedTitle = 'Recommended';

  @property({ type: String, attribute: 'select-recommended-label' }) selectRecommendedLabel =
    'Select recommended';

  @property({ type: String, attribute: 'download-label' }) downloadLabel = 'Download selection';

  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Continue';

  @property({ type: String, attribute: 'preview-label' }) previewLabel = 'Show what this generates';

  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'Nothing to configure.';

  /** The current selection, keyed by choice id. */
  @state() private model: ConfigSelection = {};

  private syncedFor?: ConfigChoice[];

  private lastAssignedSelection?: ConfigSelection;

  private explicit: ConfigSelection = {};

  private readonly instanceId = uid('lia-config-wizard');

  /** The current selection. Assigning replaces it wholesale. */
  get selection(): ConfigSelection {
    return this.model;
  }

  set selection(next: ConfigSelection) {
    if (next === this.lastAssignedSelection) return;
    this.lastAssignedSelection = next;
    this.explicit = { ...next };
    this.model = { ...initialConfigSelection(this.choices), ...this.explicit };
  }

  protected override willUpdate(_changed: PropertyValues): void {
    if (this.syncedFor !== this.choices) {
      this.syncedFor = this.choices;
      this.model = { ...initialConfigSelection(this.choices), ...this.explicit };
    }
  }

  /** A copy of the current selection. */
  getSelection(): ConfigSelection {
    return { ...this.model };
  }

  /** Replace every group with its recommended options. */
  selectRecommended(): void {
    this.apply(recommendedConfigSelection(this.choices));
  }

  /** Return every group to the value its definition declares. */
  reset(): void {
    this.explicit = {};
    this.model = initialConfigSelection(this.choices);
  }

  private apply(next: ConfigSelection): void {
    this.explicit = { ...this.explicit, ...next };
    this.model = { ...this.model, ...next };
    this.emit('lia-change', {
      name: '',
      value: this.getSelection(),
      values: this.getSelection(),
    });
  }

  private setChoice(choice: ConfigChoice, value: string | string[]): void {
    this.explicit = { ...this.explicit, [choice.id]: value };
    this.model = { ...this.model, [choice.id]: value };
    this.emit('lia-change', {
      name: choice.id,
      value,
      values: this.getSelection(),
    });
  }

  private toggle(choice: ConfigChoice, option: ConfigOption, checked: boolean): void {
    const current = this.model[choice.id];
    const list = Array.isArray(current) ? current : [];
    const next = checked
      ? [...list.filter((entry) => entry !== option.value), option.value]
      : list.filter((entry) => entry !== option.value);
    this.setChoice(choice, next);
  }

  private isSelected(choice: ConfigChoice, value: string): boolean {
    const current = this.model[choice.id];
    if (Array.isArray(current)) return current.includes(value);
    return (current ?? CONFIG_SKIP_VALUE) === value;
  }

  private preview(choice: ConfigChoice, option: ConfigOption): void {
    this.emit<ConfigPreviewDetail>('lia-config-preview', {
      choice,
      option,
      selection: this.getSelection(),
    });
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    if (this.disabled || this.busy) return;
    this.emit<ConfigRequestDetail>('lia-config-request', { selection: this.getSelection() });
  }

  /** Ask for the selection as a file. */
  download(): void {
    this.emit<ConfigDownloadDetail>('lia-config-download', { selection: this.getSelection() });
  }

  private controlId(choiceId: string, value: string): string {
    return `${this.instanceId}-${slugifyName(choiceId)}-${slugifyName(value || 'skip')}`;
  }

  private renderRecommendedMark(): TemplateResult {
    return html`<span class="text-danger" title=${this.recommendedTitle} aria-hidden="true">*</span
      ><span class="visually-hidden"> ${this.recommendedTitle}</span>`;
  }

  private renderPreviewButton(choice: ConfigChoice, option: ConfigOption): unknown {
    if (this.noPreview || option.preview === false) return nothing;
    return html`<button
      type="button"
      class="btn btn-sm btn-link text-body-secondary p-0 ms-auto"
      title=${this.previewLabel}
      aria-label=${`${this.previewLabel}: ${option.label}`}
      ?disabled=${this.disabled}
      @click=${() => this.preview(choice, option)}
    >
      <i class="fa-regular fa-file-code" aria-hidden="true"></i>
    </button>`;
  }

  private renderCheck(choice: ConfigChoice, option: ConfigOption): TemplateResult {
    const id = this.controlId(choice.id, option.value);
    const checked = this.isSelected(choice, option.value);
    return html`<div class="form-check d-flex align-items-center gap-2">
      <input
        class="form-check-input mt-0 flex-shrink-0"
        type=${choice.multiple ? 'checkbox' : 'radio'}
        name=${`${this.instanceId}-${slugifyName(choice.id)}`}
        id=${id}
        .value=${option.value}
        .checked=${checked}
        ?disabled=${this.disabled || option.disabled === true}
        data-recommended=${option.recommended ? 'true' : 'false'}
        @change=${(event: Event) => {
          const input = event.target as HTMLInputElement;
          if (choice.multiple) this.toggle(choice, option, input.checked);
          else this.setChoice(choice, option.value);
        }}
      />
      <label class="form-check-label flex-grow-1" for=${id}>
        ${option.recommended
          ? html`<strong>${option.label}${this.renderRecommendedMark()}</strong>`
          : option.label}
        ${option.description
          ? html`<small class="d-block text-body-secondary">${renderRich(option.description)}</small>`
          : nothing}
      </label>
      ${this.renderPreviewButton(choice, option)}
    </div>`;
  }

  private renderSkip(choice: ConfigChoice): unknown {
    if (choice.multiple || !choice.optional) return nothing;
    const id = this.controlId(choice.id, CONFIG_SKIP_VALUE);
    return html`<div class="form-check">
      <input
        class="form-check-input"
        type="radio"
        name=${`${this.instanceId}-${slugifyName(choice.id)}`}
        id=${id}
        .checked=${this.isSelected(choice, CONFIG_SKIP_VALUE)}
        ?disabled=${this.disabled}
        @change=${() => this.setChoice(choice, CONFIG_SKIP_VALUE)}
      />
      <label class="form-check-label text-body-secondary" for=${id}>${this.skipLabel}</label>
    </div>`;
  }

  private renderChoiceCard(choice: ConfigChoice): TemplateResult {
    return html`<div class="col">
      <fieldset class="card h-100">
        <div class="card-body">
          <legend class="card-title h6 float-none w-auto d-flex align-items-center gap-2">
            ${renderIcon(choice.icon)}<span>${renderRich(choice.label)}</span>
          </legend>
          ${choice.description
            ? html`<p class="small text-body-secondary">${renderRich(choice.description)}</p>`
            : nothing}
          ${this.renderSkip(choice)}
          ${choice.options.map((option) => this.renderCheck(choice, option))}
        </div>
      </fieldset>
    </div>`;
  }

  private renderChoiceSelect(choice: ConfigChoice): TemplateResult {
    const id = this.controlId(choice.id, 'select');
    const current = this.model[choice.id];
    return html`<div class="col">
      <label class="form-label" for=${id}>
        ${renderIcon(choice.icon, { class: 'me-1' })}${renderRich(choice.label)}
      </label>
      <select
        class="form-select"
        id=${id}
        ?multiple=${choice.multiple === true}
        ?disabled=${this.disabled}
        @change=${(event: Event) => {
          const select = event.target as HTMLSelectElement;
          if (choice.multiple) {
            this.setChoice(
              choice,
              Array.from(select.selectedOptions).map((option) => option.value)
            );
          } else {
            this.setChoice(choice, select.value);
          }
        }}
      >
        ${choice.optional && !choice.multiple
          ? html`<option value="" ?selected=${this.isSelected(choice, CONFIG_SKIP_VALUE)}>
              ${this.skipLabel}
            </option>`
          : nothing}
        ${choice.options.map(
          (option) => html`<option
            value=${option.value}
            ?disabled=${option.disabled === true}
            ?selected=${Array.isArray(current)
              ? current.includes(option.value)
              : current === option.value}
          >
            ${option.label}${option.recommended ? ' *' : ''}
          </option>`
        )}
      </select>
      ${choice.description
        ? html`<div class="form-text">${renderRich(choice.description)}</div>`
        : nothing}
    </div>`;
  }

  private get hasRecommended(): boolean {
    return this.choices.some((choice) => choice.options.some((option) => option.recommended));
  }

  protected override render(): unknown {
    const choices = this.choices;

    return html`<form class="lia-config-wizard" novalidate @submit=${this.handleSubmit}>
      ${this.title || this.description
        ? html`<div class="mb-3">
            ${this.title ? html`<h2 class="h5 mb-1">${this.title}</h2>` : nothing}
            ${this.description
              ? html`<p class="text-body-secondary mb-0">${renderRich(this.description)}</p>`
              : nothing}
          </div>`
        : nothing}
      ${choices.length === 0
        ? html`<p class="text-body-secondary fst-italic">${this.emptyMessage}</p>`
        : html`<div
            class=${cx(
              'row',
              'g-3',
              this.layout === 'cards'
                ? 'row-cols-1 row-cols-md-2 row-cols-xl-4'
                : 'row-cols-1 row-cols-md-2'
            )}
          >
            ${choices.map((choice) =>
              this.layout === 'cards'
                ? this.renderChoiceCard(choice)
                : this.renderChoiceSelect(choice)
            )}
          </div>`}
      <div class="row mt-3 gy-2 align-items-center">
        <div class="col-12 col-md-6">
          ${this.hasRecommended
            ? html`<span class="text-body-secondary"
                >${this.renderRecommendedMark()} ${this.recommendedNote}</span
              >`
            : nothing}
        </div>
        <div class="col-12 col-md-6 text-md-end d-grid d-md-block gap-2">
          ${this.noRecommended || !this.hasRecommended
            ? nothing
            : html`<button
                type="button"
                class="btn btn-outline-secondary me-md-2"
                ?disabled=${this.disabled}
                @click=${() => this.selectRecommended()}
              >
                <i class="fa-solid fa-wand-magic-sparkles me-1" aria-hidden="true"></i>
                ${this.selectRecommendedLabel}
              </button>`}
          ${this.noDownload
            ? nothing
            : html`<button
                type="button"
                class="btn btn-outline-secondary me-md-2"
                ?disabled=${this.disabled}
                @click=${() => this.download()}
              >
                <i class="fa-solid fa-download me-1" aria-hidden="true"></i>
                ${this.downloadLabel}
              </button>`}
          <button
            type="submit"
            class="btn btn-primary"
            ?disabled=${this.disabled || this.busy || choices.length === 0}
            aria-busy=${this.busy ? 'true' : nothing}
          >
            ${this.busy
              ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
              : nothing}${this.submitLabel}
          </button>
        </div>
      </div>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-config-wizard': LiaConfigWizard;
  }
}
