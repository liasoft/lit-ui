import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName, SelectOption, Variant } from '../../core/types.js';
import { cx, uid } from '../../core/utils.js';

/**
 * One active filter, shown as a removable chip.
 *
 * Deliberately generic: a chip knows what it is *called* and what it *reads
 * as*, never how the filtering is done. That is the caller's business.
 */
export interface FilterChip {
  /** Stable identifier, echoed back when the chip is removed. */
  id: string;
  /** What the filter is, e.g. `Status`. */
  label: string;
  /** What it is set to, e.g. `active`. Omit for a label-only chip. */
  value?: string;
  /** Set to `false` for a chip the user may not remove. Defaults to `true`. */
  removable?: boolean;
  /** Bootstrap contextual colour of the chip. Defaults to `secondary`. */
  variant?: Variant;
  icon?: IconName;
  /** Native tooltip on the chip. */
  title?: string;
}

/** A `<select>` rendered in the bar that sets one filter directly. */
export interface QuickFilter {
  /** Identifier reported in `lia-filter-change`. */
  id: string;
  /** Accessible name; also the placeholder-option text. */
  label: string;
  options: SelectOption[];
  /** Currently selected value. Empty string means "no filter". */
  value?: string | number;
  /** Text of the leading "any" option. Defaults to the label. */
  placeholder?: string;
  /** Drop the leading "any" option — for a filter that is always set. */
  required?: boolean;
  disabled?: boolean;
}

/** Detail of `lia-filter-remove`. */
export interface FilterRemoveDetail {
  id: string;
  filter: FilterChip;
}

/** Detail of `lia-filter-change`, fired by a {@link QuickFilter}. */
export interface FilterChangeDetail {
  id: string;
  value: string;
  filter: QuickFilter;
}

/**
 * The strip of active filters above a listing: a chip per filter with its own
 * ✕, an optional row of quick-filter selects, and a "clear all" escape hatch.
 *
 * It is a pure view over the filter state you own. Removing a chip emits
 * `lia-filter-remove`, changing a select emits `lia-filter-change` and the
 * escape hatch emits `lia-filter-clear`; nothing is mutated locally, so the
 * bar can never disagree with the data actually being shown.
 *
 * With no chips and no quick filters it renders nothing at all, so you can
 * leave it in the template unconditionally.
 *
 * @example
 * ```ts
 * html`<lia-filter-bar
 *   .filters=${[{ id: 'status', label: 'Status', value: 'active' }]}
 *   .quickFilters=${[
 *     { id: 'group', label: 'Group', value: this.group, options: groupOptions },
 *   ]}
 *   @lia-filter-remove=${(e: CustomEvent) => this.unset(e.detail.id)}
 *   @lia-filter-change=${(e: CustomEvent) => this.set(e.detail.id, e.detail.value)}
 *   @lia-filter-clear=${() => this.reset()}
 * ></lia-filter-bar>`;
 * ```
 */
@customElement('lia-filter-bar')
export class LiaFilterBar extends LiaElement {
  /** The active filters, rendered as chips in order. */
  @property({ attribute: false }) filters: FilterChip[] = [];

  /** Selects rendered before the chips, for the one or two filters used most. */
  @property({ attribute: false }) quickFilters: QuickFilter[] = [];

  /** Leading caption. Set to an empty string to drop it. */
  @property({ type: String }) label = 'Filters';

  /** Show the "clear all" button when more than one chip is removable. */
  @property({ type: Boolean, attribute: 'show-clear' }) showClear = true;

  @property({ type: String, attribute: 'clear-label' }) clearLabel = 'Clear all';

  /** Accessible name pattern for a chip's ✕; `{label}` is substituted. */
  @property({ type: String, attribute: 'remove-label' }) removeLabel = 'Remove filter {label}';

  /** Accessible name of the whole bar. */
  @property({ type: String, attribute: 'region-label' }) regionLabel = 'Active filters';

  /** Disable every control, e.g. while a request is in flight. */
  @property({ type: Boolean }) disabled = false;

  private readonly instanceId = uid('lia-filter');

  /** Chips the user is allowed to remove. */
  get removableFilters(): FilterChip[] {
    return this.filters.filter((filter) => filter.removable !== false);
  }

  /** True when there is nothing to show — the host can skip the row. */
  get isEmpty(): boolean {
    return this.filters.length === 0 && this.quickFilters.length === 0;
  }

  private removeChip(filter: FilterChip): void {
    this.emit<FilterRemoveDetail>('lia-filter-remove', { id: filter.id, filter });
  }

  private clearAll(): void {
    this.emit('lia-filter-clear', { ids: this.removableFilters.map((filter) => filter.id) });
  }

  private handleQuickChange(filter: QuickFilter, event: Event): void {
    const value = (event.currentTarget as HTMLSelectElement).value;
    this.emit<FilterChangeDetail>('lia-filter-change', { id: filter.id, value, filter });
  }

  private renderChip(filter: FilterChip): TemplateResult {
    const removable = filter.removable !== false;
    const variant = filter.variant ?? 'secondary';
    return html`<span
      class=${cx('lia-filter-chip', 'badge', 'rounded-pill', `text-bg-${variant}`)}
      title=${filter.title ?? nothing}
    >
      ${filter.icon ? html`<i class="${filter.icon}" aria-hidden="true"></i>` : nothing}
      <span class="lia-filter-chip-text">
        ${filter.label}${filter.value
          ? html`: <span class="fw-semibold">${filter.value}</span>`
          : nothing}
      </span>
      ${removable
        ? html`<button
            type="button"
            class="lia-filter-chip-remove btn btn-sm btn-link p-0 text-reset"
            aria-label=${this.removeLabel.replace('{label}', filter.label)}
            ?disabled=${this.disabled}
            @click=${() => this.removeChip(filter)}
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>`
        : nothing}
    </span>`;
  }

  private renderQuickFilter(filter: QuickFilter): TemplateResult {
    const id = `${this.instanceId}-${filter.id.replace(/[^\w-]/g, '_')}`;
    const value = filter.value === undefined || filter.value === null ? '' : String(filter.value);
    return html`<div class="lia-filter-quick d-flex align-items-center gap-1">
      <label class="visually-hidden" for=${id}>${filter.label}</label>
      <select
        class="form-select form-select-sm w-auto"
        id=${id}
        aria-label=${filter.label}
        ?disabled=${this.disabled || filter.disabled === true}
        .value=${value}
        @change=${(event: Event) => this.handleQuickChange(filter, event)}
      >
        ${filter.required === true
          ? nothing
          : html`<option value="" ?selected=${value === ''}>
              ${filter.placeholder ?? filter.label}
            </option>`}
        ${filter.options.map(
          (option) =>
            html`<option
              value=${String(option.value)}
              ?disabled=${option.disabled === true}
              ?selected=${String(option.value) === value}
            >
              ${option.label}
            </option>`
        )}
      </select>
    </div>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.isEmpty) return nothing;
    const removable = this.removableFilters;
    return html`<div
      class="lia-filter-bar d-flex flex-wrap align-items-center gap-2"
      role="group"
      aria-label=${this.regionLabel}
    >
      ${this.quickFilters.map((filter) => this.renderQuickFilter(filter))}
      ${this.label && this.filters.length > 0
        ? html`<span class="text-body-secondary small">${this.label}:</span>`
        : nothing}
      ${this.filters.map((filter) => this.renderChip(filter))}
      ${this.showClear && removable.length > 1
        ? html`<button
            type="button"
            class="btn btn-sm btn-link p-0 text-body-secondary"
            ?disabled=${this.disabled}
            @click=${() => this.clearAll()}
          >
            ${this.clearLabel}
          </button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-filter-bar': LiaFilterBar;
  }
  interface HTMLElementEventMap {
    'lia-filter-remove': CustomEvent<FilterRemoveDetail>;
    'lia-filter-change': CustomEvent<FilterChangeDetail>;
    'lia-filter-clear': CustomEvent<{ ids: string[] }>;
  }
}
