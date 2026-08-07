import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, uid } from '../../core/utils.js';
import type { IconName, SelectOption } from '../../core/types.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderSpinner } from '../primitives/lia-spinner.js';
import { confirmAction } from '../feedback/confirm-dialog.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** What a single cell may hold. */
export type RecordValue = string | number | boolean | null;

/** One editable record — a flat bag of cell values keyed by column. */
export type RecordRow = Record<string, RecordValue>;

/** The control a column is edited with. */
export type RecordColumnType = 'text' | 'number' | 'select' | 'checkbox';

/** One column of the editor. */
export interface RecordColumn {
  /** Key into the record object. */
  key: string;
  /** Column heading, and the accessible name of every cell below it. */
  label: string;
  /** Control type. Defaults to `text`. */
  type?: RecordColumnType;
  /** Choices for `type: 'select'`. */
  options?: SelectOption[];
  /** Any CSS width for the column, e.g. `8rem` or `20%`. */
  width?: string;
  placeholder?: string;
  /** Empty values are rejected. */
  required?: boolean;
  /** Render the value as text instead of a control. */
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxlength?: number;
  pattern?: string;
  autocomplete?: string;
  /** Seed for cells of a newly added record. */
  defaultValue?: RecordValue;
  /** Small helper text under the control in the "new record" row. */
  hint?: string;
  /** Extra classes on the control. */
  class?: string;
  /**
   * Per-cell validation. Return a message to mark the cell invalid, or
   * `undefined` when it is fine. Runs after the `required` check.
   */
  validate?: (value: RecordValue, record: RecordRow, index: number) => string | undefined;
}

/** How new records are offered. */
export type RecordAddMode = 'form' | 'append';

/** Every string `<lia-record-editor>` renders on its own behalf. */
export interface RecordEditorLabels {
  /** Accessible caption of the table. */
  caption: string;
  actions: string;
  add: string;
  addTitle: string;
  /** Accessible name of the "new record" footer row. */
  newRecord: string;
  remove: string;
  /** `{row}` is replaced with the 1-based row number. */
  removeTitle: string;
  save: string;
  saving: string;
  discard: string;
  /** `{count}` is replaced. */
  dirty: string;
  saved: string;
  /** `{count}` is replaced. */
  invalid: string;
  empty: string;
  required: string;
  /** `{label}` is replaced with the column heading. */
  requiredError: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmAccept: string;
  confirmCancel: string;
}

/** The defaults behind {@link LiaRecordEditor.labels}. */
export const DEFAULT_RECORD_EDITOR_LABELS: Readonly<RecordEditorLabels> = Object.freeze({
  caption: 'Editable records',
  actions: 'Actions',
  add: 'Add',
  addTitle: 'Add this entry',
  newRecord: 'New entry',
  remove: 'Remove',
  removeTitle: 'Remove row {row}',
  save: 'Save changes',
  saving: 'Saving…',
  discard: 'Discard',
  dirty: '{count} unsaved change(s)',
  saved: 'All changes saved.',
  invalid: '{count} field(s) need attention.',
  empty: 'No entries yet.',
  required: 'Required',
  requiredError: '{label} is required.',
  confirmTitle: 'Remove entry',
  confirmMessage: 'Remove this entry? The change is applied when you save.',
  confirmAccept: 'Remove',
  confirmCancel: 'Keep',
});

/** What changed, in the `lia-records-change` event. */
export interface RecordChange {
  type: 'edit' | 'add' | 'remove';
  /** Row the change applied to, when there is one. */
  index?: number;
  /** Column the change applied to, for `edit`. */
  key?: string;
}

/** Detail of `lia-records-change`. */
export interface RecordsChangeDetail {
  /** The working copy, after the change. */
  records: RecordRow[];
  /** Whether the working copy differs from the last-seeded `records`. */
  dirty: boolean;
  /** Whether every cell passes validation. */
  valid: boolean;
  change: RecordChange;
}

/** Detail of `lia-records-save`. */
export interface RecordsSaveDetail {
  /** The working copy the user asked to persist. */
  records: RecordRow[];
}

declare global {
  interface HTMLElementEventMap {
    'lia-records-change': CustomEvent<RecordsChangeDetail>;
    'lia-records-save': CustomEvent<RecordsSaveDetail>;
  }
}

/** A cell's value is "empty" when there is nothing to persist. */
function isBlank(value: RecordValue): boolean {
  return value === null || value === undefined || value === '';
}

/** Build a fresh record from the column defaults. */
export function blankRecord(columns: readonly RecordColumn[]): RecordRow {
  const record: RecordRow = {};
  for (const column of columns) {
    if (column.defaultValue !== undefined) record[column.key] = column.defaultValue;
    else if (column.type === 'checkbox') record[column.key] = false;
    else record[column.key] = '';
  }
  return record;
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * A repeatable record table: rows edited in place against a typed column
 * schema, a footer row for adding entries, per-row removal, per-cell
 * validation, dirty tracking and a save/discard bar.
 *
 * This is the general form of every "list of small structured things" screen —
 * DNS records, address/port pairs, mail forwarders, header rewrites,
 * environment variables. Describe the columns, hand it an array, listen for
 * `lia-records-save`.
 *
 * The element keeps a **working copy**. Nothing is written back to `records`;
 * edits are reported through `lia-records-change` and the user's explicit save
 * emits `lia-records-save`. Re-seeding happens when the `records` property
 * changes to a value that differs from the working copy's baseline, so a host
 * that re-renders with an equal array will not throw away pending edits.
 *
 * @example
 * ```ts
 * html`<lia-record-editor
 *   .columns=${[
 *     { key: 'name', label: 'Name', required: true, placeholder: '@' },
 *     { key: 'type', label: 'Type', type: 'select', width: '8rem',
 *       options: [{ value: 'A', label: 'A' }, { value: 'TXT', label: 'TXT' }] },
 *     { key: 'ttl', label: 'TTL', type: 'number', width: '7rem', min: 30, defaultValue: 3600 },
 *     { key: 'content', label: 'Value', required: true },
 *   ]}
 *   .records=${records}
 *   @lia-records-save=${(e: CustomEvent) => persist(e.detail.records)}
 * ></lia-record-editor>`;
 * ```
 *
 * @example
 * ```html
 * <lia-record-editor add-mode="append" no-confirm-remove></lia-record-editor>
 * ```
 */
@customElement('lia-record-editor')
export class LiaRecordEditor extends LiaElement {
  /** The column schema. */
  @property({ attribute: false }) columns: RecordColumn[] = [];

  /** The records to edit. Seeds the working copy. */
  @property({ attribute: false }) records: RecordRow[] = [];

  /** Optional heading above the table. */
  @property({ type: String }) override title = '';

  /** Icon shown next to the heading. */
  @property({ type: String }) icon: IconName = '';

  /** Muted line under the heading. */
  @property({ type: String }) description = '';

  /** How new records are offered: a footer form, or an appended blank row. */
  @property({ type: String, attribute: 'add-mode' }) addMode: RecordAddMode = 'form';

  /** Allow adding records. */
  @property({ converter: flag }) addable = true;

  /** Allow removing records. */
  @property({ converter: flag }) deletable = true;

  /** Ask before removing a row. */
  @property({ type: Boolean, attribute: 'no-confirm-remove' }) noConfirmRemove = false;

  /** Show every control as read-only and hide the save bar. */
  @property({ type: Boolean }) readonly = false;

  /** A save is in flight: the bar shows a spinner and controls are disabled. */
  @property({ type: Boolean }) saving = false;

  /** Hide the save/discard bar — for hosts that save on every change. */
  @property({ type: Boolean, attribute: 'no-save-bar' }) noSaveBar = false;

  /** Maximum height of the scroll area around the table. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '';

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<RecordEditorLabels> = {};

  @state() private draft: RecordRow[] = [];
  @state() private pending: RecordRow = {};
  @state() private errors: Record<string, string> = {};
  @state() private pendingErrors: Record<string, string> = {};

  private baseline = '[]';
  private baselineRecords: RecordRow[] = [];
  private readonly instanceId = uid('lia-records');
  private focusAfterUpdate?: string;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns') && Object.keys(this.pending).length === 0) {
      this.pending = blankRecord(this.columns);
    }
    if (changed.has('records')) {
      const incoming = JSON.stringify(this.records ?? []);
      // Re-seeding on an *equal* array would discard pending edits for nothing.
      if (incoming !== this.baseline) this.seed();
    }
  }

  override updated(): void {
    if (!this.focusAfterUpdate) return;
    const target = this.querySelector<HTMLElement>(`#${CSS.escape(this.focusAfterUpdate)}`);
    this.focusAfterUpdate = undefined;
    target?.focus();
  }

  /** The working copy, as it stands. */
  get value(): RecordRow[] {
    return this.draft.map((record) => ({ ...record }));
  }

  /** Whether the working copy differs from the seeded records. */
  get dirty(): boolean {
    return JSON.stringify(this.draft) !== this.baseline;
  }

  /** Whether every cell of the working copy passes validation. */
  get valid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /** Throw the working copy away and start again from `records`. */
  discard(): void {
    this.seed();
    this.emitChange({ type: 'edit' });
  }

  /**
   * Accept the working copy as the new baseline without emitting a save. Use
   * this when the host persists changes itself and only needs the dirty flag
   * cleared.
   */
  commit(): void {
    this.baselineRecords = this.value;
    this.baseline = JSON.stringify(this.draft);
    this.requestUpdate();
  }

  /** Validate and, if everything passes, emit `lia-records-save`. */
  save(): void {
    const errors = this.validateAll(this.draft);
    this.errors = errors;
    const first = Object.keys(errors)[0];
    if (first !== undefined) {
      this.focusAfterUpdate = `${this.instanceId}-${first}`;
      return;
    }
    this.emit<RecordsSaveDetail>('lia-records-save', { records: this.value });
  }

  /** Append a record built from the column defaults and focus its first cell. */
  addRecord(record: RecordRow = blankRecord(this.columns)): void {
    // A brand-new row is not "wrong" yet — it is validated on edit and on save,
    // so appending must not paint every required cell red straight away.
    this.draft = [...this.draft, { ...record }];
    const index = this.draft.length - 1;
    const firstEditable = this.columns.find((column) => !column.readonly);
    if (firstEditable) this.focusAfterUpdate = this.cellId(index, firstEditable.key);
    this.emitChange({ type: 'add', index });
  }

  /** Remove the record at `index`, asking first unless confirmation is off. */
  async removeRecord(index: number): Promise<void> {
    if (!this.noConfirmRemove) {
      const strings = this.strings;
      const ok = await confirmAction({
        title: strings.confirmTitle,
        message: strings.confirmMessage,
        confirmLabel: strings.confirmAccept,
        cancelLabel: strings.confirmCancel,
        variant: 'danger',
      });
      if (!ok) return;
    }
    const errors = this.shiftErrors(index);
    this.draft = this.draft.filter((_, position) => position !== index);
    this.errors = errors;
    this.emitChange({ type: 'remove', index });
  }

  private get strings(): RecordEditorLabels {
    return { ...DEFAULT_RECORD_EDITOR_LABELS, ...this.labels };
  }

  private seed(): void {
    const source = this.records ?? [];
    this.draft = source.map((record) => ({ ...record }));
    this.baselineRecords = this.draft;
    this.baseline = JSON.stringify(source);
    this.errors = {};
    this.pending = blankRecord(this.columns);
    this.pendingErrors = {};
  }

  /** How many records were added, removed or edited since the last seed. */
  private get changeCount(): number {
    const baseline = this.baselineRecords;
    let count = Math.abs(this.draft.length - baseline.length);
    const shared = Math.min(this.draft.length, baseline.length);
    for (let index = 0; index < shared; index += 1) {
      if (JSON.stringify(this.draft[index]) !== JSON.stringify(baseline[index])) count += 1;
    }
    return count;
  }

  /** Re-key the error map after a row was dropped, without re-validating. */
  private shiftErrors(removedIndex: number): Record<string, string> {
    const next: Record<string, string> = {};
    for (const [key, message] of Object.entries(this.errors)) {
      const separator = key.indexOf('-');
      const index = Number(key.slice(0, separator));
      if (index === removedIndex) continue;
      next[`${index > removedIndex ? index - 1 : index}-${key.slice(separator + 1)}`] = message;
    }
    return next;
  }

  private cellId(index: number | 'new', key: string): string {
    return `${this.instanceId}-${index}-${key}`;
  }

  private errorKey(index: number, key: string): string {
    return `${index}-${key}`;
  }

  private emitChange(change: RecordChange): void {
    this.emit<RecordsChangeDetail>('lia-records-change', {
      records: this.value,
      dirty: this.dirty,
      valid: this.valid,
      change,
    });
  }

  private validateCell(
    column: RecordColumn,
    value: RecordValue,
    record: RecordRow,
    index: number,
  ): string | undefined {
    if (column.required && column.type !== 'checkbox' && isBlank(value)) {
      return this.strings.requiredError.replace('{label}', column.label);
    }
    return column.validate?.(value, record, index);
  }

  private validateAll(records: readonly RecordRow[]): Record<string, string> {
    const errors: Record<string, string> = {};
    records.forEach((record, index) => {
      for (const column of this.columns) {
        if (column.readonly) continue;
        const message = this.validateCell(column, record[column.key] ?? null, record, index);
        if (message) errors[this.errorKey(index, column.key)] = message;
      }
    });
    return errors;
  }

  /** Read a control's value back in the type the column promises. */
  private readControl(column: RecordColumn, element: HTMLElement): RecordValue {
    if (column.type === 'checkbox') return (element as HTMLInputElement).checked;
    const raw = (element as HTMLInputElement | HTMLSelectElement).value;
    if (column.type === 'number') {
      if (raw === '') return null;
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? raw : parsed;
    }
    if (column.type === 'select') {
      const match = column.options?.find((option) => String(option.value) === raw);
      return match ? match.value : raw;
    }
    return raw;
  }

  private setCell(index: number, column: RecordColumn, value: RecordValue): void {
    const next = this.draft.map((record, position) =>
      position === index ? { ...record, [column.key]: value } : record,
    );
    this.draft = next;
    const message = this.validateCell(column, value, next[index], index);
    const key = this.errorKey(index, column.key);
    const errors = { ...this.errors };
    if (message) errors[key] = message;
    else delete errors[key];
    this.errors = errors;
    this.emitChange({ type: 'edit', index, key: column.key });
  }

  private setPendingCell(column: RecordColumn, value: RecordValue): void {
    this.pending = { ...this.pending, [column.key]: value };
    const errors = { ...this.pendingErrors };
    delete errors[column.key];
    this.pendingErrors = errors;
  }

  private commitPending(): void {
    const record = this.pending;
    const errors: Record<string, string> = {};
    for (const column of this.columns) {
      if (column.readonly) continue;
      const message = this.validateCell(column, record[column.key] ?? null, record, -1);
      if (message) errors[column.key] = message;
    }
    this.pendingErrors = errors;
    const firstBad = Object.keys(errors)[0];
    if (firstBad !== undefined) {
      this.focusAfterUpdate = this.cellId('new', firstBad);
      return;
    }
    this.draft = [...this.draft, { ...record }];
    this.pending = blankRecord(this.columns);
    const firstEditable = this.columns.find((column) => !column.readonly);
    if (firstEditable) this.focusAfterUpdate = this.cellId('new', firstEditable.key);
    this.emitChange({ type: 'add', index: this.draft.length - 1 });
  }

  private renderControl(options: {
    column: RecordColumn;
    value: RecordValue;
    id: string;
    ariaLabel: string;
    error?: string;
    disabled: boolean;
    onInput: (value: RecordValue) => void;
    onEnter?: () => void;
  }): TemplateResult {
    const { column, value, id, ariaLabel, error, disabled } = options;
    const invalid = Boolean(error);
    const describedBy = invalid ? `${id}-error` : undefined;
    const type = column.type ?? 'text';

    const onKeydown = (event: KeyboardEvent): void => {
      if (!options.onEnter || event.key !== 'Enter') return;
      event.preventDefault();
      options.onEnter();
    };

    if (column.readonly) {
      return html`<span class="form-control-plaintext py-0" id=${id}
        >${value === null || value === false ? '' : String(value)}</span
      >`;
    }

    if (type === 'checkbox') {
      return html`<div class="form-check mb-0">
        <input
          id=${id}
          class=${cx('form-check-input', invalid && 'is-invalid', column.class)}
          type="checkbox"
          .checked=${value === true}
          ?disabled=${disabled}
          aria-label=${ariaLabel}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(describedBy)}
          @change=${(event: Event) =>
            options.onInput(this.readControl(column, event.target as HTMLElement))}
        />
      </div>`;
    }

    if (type === 'select') {
      // `selected` on the options rather than `.value` on the select: a
      // property binding on the parent commits before its children exist.
      const current = value === null || value === undefined ? '' : String(value);
      return html`<select
        id=${id}
        class=${cx('form-select form-select-sm', invalid && 'is-invalid', column.class)}
        ?disabled=${disabled}
        aria-label=${ariaLabel}
        aria-invalid=${invalid ? 'true' : 'false'}
        aria-describedby=${ifDefined(describedBy)}
        @change=${(event: Event) =>
          options.onInput(this.readControl(column, event.target as HTMLElement))}
      >
        ${
          column.placeholder
            ? html`<option value="" ?selected=${current === ''}>${column.placeholder}</option>`
            : nothing
        }
        ${(column.options ?? []).map(
          (option) =>
            html`<option
              value=${String(option.value)}
              ?disabled=${option.disabled}
              ?selected=${String(option.value) === current}
            >
              ${option.label}
            </option>`,
        )}
      </select>`;
    }

    return html`<input
      id=${id}
      class=${cx('form-control form-control-sm', invalid && 'is-invalid', column.class)}
      type=${type === 'number' ? 'number' : 'text'}
      .value=${value === null || value === undefined ? '' : String(value)}
      placeholder=${ifDefined(column.placeholder)}
      min=${ifDefined(column.min)}
      max=${ifDefined(column.max)}
      step=${ifDefined(column.step)}
      maxlength=${ifDefined(column.maxlength)}
      pattern=${ifDefined(column.pattern)}
      autocomplete=${ifDefined(column.autocomplete)}
      ?disabled=${disabled}
      ?required=${column.required}
      aria-label=${ariaLabel}
      aria-invalid=${invalid ? 'true' : 'false'}
      aria-describedby=${ifDefined(describedBy)}
      @input=${(event: Event) =>
        options.onInput(this.readControl(column, event.target as HTMLElement))}
      @keydown=${onKeydown}
    />`;
  }

  private renderCell(
    column: RecordColumn,
    value: RecordValue,
    index: number,
    error: string | undefined,
  ): TemplateResult {
    const id = this.cellId(index, column.key);
    return html`<td class=${cx('lia-record-cell', column.class)}>
      ${this.renderControl({
        column,
        value,
        id,
        ariaLabel: `${column.label}, row ${index + 1}`,
        error,
        disabled: this.readonly || this.saving,
        onInput: (next) => this.setCell(index, column, next),
      })}
      ${error ? html`<div class="invalid-feedback d-block" id="${id}-error">${error}</div>` : nothing}
    </td>`;
  }

  private renderRow(record: RecordRow, index: number): TemplateResult {
    const strings = this.strings;
    return html`<tr>
      ${this.columns.map((column) =>
        this.renderCell(
          column,
          record[column.key] ?? null,
          index,
          this.errors[this.errorKey(index, column.key)],
        ),
      )}
      ${
        this.deletable && !this.readonly
          ? html`<td class="text-end">
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                title=${strings.removeTitle.replace('{row}', String(index + 1))}
                ?disabled=${this.saving}
                @click=${() => void this.removeRecord(index)}
              >
                ${renderIcon('fa-solid fa-trash', {
                  label: strings.removeTitle.replace('{row}', String(index + 1)),
                })}
              </button>
            </td>`
          : nothing
      }
    </tr>`;
  }

  private renderAddRow(): TemplateResult {
    const strings = this.strings;
    return html`<tr class="table-group-divider" aria-label=${strings.newRecord}>
      ${this.columns.map((column) => {
        const id = this.cellId('new', column.key);
        const error = this.pendingErrors[column.key];
        return html`<td class=${cx('lia-record-cell', column.class)}>
          ${this.renderControl({
            column,
            value: this.pending[column.key] ?? null,
            id,
            ariaLabel: `${column.label}, ${strings.newRecord}`,
            error,
            disabled: this.saving,
            onInput: (next) => this.setPendingCell(column, next),
            onEnter: () => this.commitPending(),
          })}
          ${
            error
              ? html`<div class="invalid-feedback d-block" id="${id}-error">${error}</div>`
              : column.hint
                ? html`<div class="form-text small">${column.hint}</div>`
                : nothing
          }
        </td>`;
      })}
      <td class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          title=${strings.addTitle}
          ?disabled=${this.saving}
          @click=${() => this.commitPending()}
        >
          ${renderIcon('fa-solid fa-plus')}
          <span class="d-none d-lg-inline ms-lg-1">${strings.add}</span>
        </button>
      </td>
    </tr>`;
  }

  private renderSaveBar(): TemplateResult | typeof nothing {
    if (this.noSaveBar || this.readonly) return nothing;
    const strings = this.strings;
    const dirty = this.dirty;
    const invalidCount = Object.keys(this.errors).length;
    return html`<div
      class="card-footer lia-record-savebar d-flex flex-wrap align-items-center justify-content-between gap-2"
    >
      <span class="small text-body-secondary" role="status" aria-live="polite">
        ${
          invalidCount > 0
            ? html`<span class="text-danger-emphasis"
                >${strings.invalid.replace('{count}', String(invalidCount))}</span
              >`
            : dirty
              ? strings.dirty.replace('{count}', String(this.changeCount))
              : strings.saved
        }
      </span>
      <span class="d-flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          ?disabled=${!dirty || this.saving}
          @click=${() => this.discard()}
        >
          ${strings.discard}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          ?disabled=${!dirty || this.saving || invalidCount > 0}
          @click=${() => this.save()}
        >
          ${
            this.saving
              ? html`${renderSpinner(strings.saving, { size: 'sm' })}
                  <span class="ms-1">${strings.saving}</span>`
              : strings.save
          }
        </button>
      </span>
    </div>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    const showAddForm = this.addable && !this.readonly && this.addMode === 'form';
    const showAppendButton = this.addable && !this.readonly && this.addMode === 'append';
    const hasActionColumn = (this.deletable || showAddForm) && !this.readonly;

    return html`<div class="lia-record-editor">
      <div class="card">
        ${
          this.title || this.description
            ? html`<div class="card-header d-flex flex-wrap align-items-center gap-2">
                <div class="flex-grow-1">
                  <span class="d-inline-flex align-items-center gap-1"
                    >${renderIcon(this.icon)}${this.title}</span
                  >
                  ${
                    this.description
                      ? html`<div class="small fw-normal text-body-secondary">
                          ${this.description}
                        </div>`
                      : nothing
                  }
                </div>
              </div>`
            : nothing
        }

        <div
          class="table-responsive"
          style=${styleMap(this.maxHeight ? { maxHeight: this.maxHeight, overflowY: 'auto' } : {})}
        >
          <table class="table table-sm align-middle mb-0">
            <caption class="visually-hidden">
              ${this.title || strings.caption}
            </caption>
            <thead>
              <tr>
                ${this.columns.map(
                  (column) =>
                    html`<th
                      scope="col"
                      class="small"
                      style=${styleMap(column.width ? { width: column.width } : {})}
                    >
                      ${column.label}${
                        column.required
                          ? html`<span class="text-danger ms-1" title=${strings.required}
                              >*<span class="visually-hidden"> ${strings.required}</span></span
                            >`
                          : nothing
                      }
                    </th>`,
                )}
                ${
                  hasActionColumn
                    ? html`<th scope="col" class="text-end small">
                        <span class="visually-hidden">${strings.actions}</span>
                      </th>`
                    : nothing
                }
              </tr>
            </thead>
            <tbody>
              ${
                this.draft.length === 0 && !showAddForm
                  ? html`<tr>
                      <td
                        colspan=${this.columns.length + (hasActionColumn ? 1 : 0)}
                        class="text-body-secondary small"
                      >
                        ${strings.empty}
                      </td>
                    </tr>`
                  : this.draft.map((record, index) => this.renderRow(record, index))
              }
            </tbody>
            ${
              showAddForm
                ? html`<tfoot>
                    ${this.renderAddRow()}
                  </tfoot>`
                : nothing
            }
          </table>
        </div>

        ${
          showAppendButton
            ? html`<div class="card-body py-2">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  ?disabled=${this.saving}
                  @click=${() => this.addRecord()}
                >
                  ${renderIcon('fa-solid fa-plus', { class: 'me-1' })}${strings.add}
                </button>
              </div>`
            : nothing
        }
        ${this.renderSaveBar()}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-record-editor': LiaRecordEditor;
  }
}
