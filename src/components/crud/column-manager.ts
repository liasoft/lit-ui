import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { TableColumn } from '../../core/types.js';
import { uid } from '../../core/utils.js';
import { ModalController } from '../feedback/modal-controller.js';
import {
  clearColumnPrefs,
  defaultVisibleColumns,
  loadColumnPrefs,
  saveColumnPrefs,
  type ColumnPrefsOptions,
} from './column-prefs.js';

/**
 * The "manage table columns" dialog: one checkbox per available column plus
 * select-all / unselect-all / restore-defaults shortcuts.
 *
 * The chosen keys are written to `localStorage` under the listing id, so the
 * table keeps its shape across reloads without a backend. Set `persist="false"`
 * to keep the dialog stateless and store the selection yourself from the
 * `lia-columns-change` event — that is how you talk to a server-side profile.
 *
 * Columns flagged `locked` are always shown and rendered as a disabled, ticked
 * checkbox, so an identifier column cannot be hidden by accident.
 *
 * @example
 * ```ts
 * html`<lia-column-manager
 *   listing-id="users"
 *   .columns=${listing.columns}
 *   .open=${this.managingColumns}
 *   @lia-columns-change=${(e: CustomEvent) => (this.shown = e.detail.columns)}
 *   @lia-modal-hide=${() => (this.managingColumns = false)}
 * ></lia-column-manager>`;
 * ```
 *
 * @example
 * ```html
 * <!-- Opened by any Bootstrap trigger pointing at its modal id -->
 * <button data-bs-toggle="modal" data-bs-target="#columns-users">Columns</button>
 * <lia-column-manager listing-id="users" modal-id="columns-users"></lia-column-manager>
 * ```
 */
@customElement('lia-column-manager')
export class LiaColumnManager extends LiaElement {
  /** Identifies the listing; used for the modal id and the storage key. */
  @property({ type: String, attribute: 'listing-id' }) listingId = 'listing';

  /** Every column the listing *could* show, in definition order. */
  @property({ attribute: false }) columns: TableColumn[] = [];

  /**
   * The currently visible column keys. Leave unset to let the dialog resolve
   * them itself (stored preferences, else the definition's defaults).
   */
  @property({ attribute: false }) selected?: string[];

  /** Whether the dialog is on screen. Reflected as an attribute. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Write the selection to storage on save. */
  @property({ type: Boolean }) persist = true;

  /** Storage backend and key prefix. Defaults to `localStorage`. */
  @property({ attribute: false }) storageOptions?: ColumnPrefsOptions;

  /** Explicit DOM id for the `.modal`, so `data-bs-target="#…"` can find it. */
  @property({ type: String, attribute: 'modal-id' }) modalId?: string;

  /** Dialog heading. */
  @property({ type: String }) heading = 'Manage table columns';

  /** Explanatory line above the checkbox list. */
  @property({ type: String }) description = 'Choose the columns you want to see in this table.';

  @property({ type: String, attribute: 'select-all-label' }) selectAllLabel = 'Select all';

  @property({ type: String, attribute: 'unselect-all-label' }) unselectAllLabel = 'Unselect all';

  @property({ type: String, attribute: 'reset-label' }) resetLabel = 'Default';

  @property({ type: String, attribute: 'close-label' }) closeLabel = 'Close';

  @property({ type: String, attribute: 'save-label' }) saveLabel = 'Save';

  /** Message shown when the definition has no columns at all. */
  @property({ type: String, attribute: 'empty-label' }) emptyLabel = 'No columns available.';

  /** Working copy of the selection; committed to storage on save. */
  @state() private draft: string[] = [];

  /** Set by "Default": saving then *clears* storage instead of writing it. */
  @state() private restoringDefaults = false;

  private readonly titleId = uid('lia-columns-title');
  private readonly descriptionId = uid('lia-columns-desc');
  private readonly fallbackId = uid('lia-columns');

  private readonly modal = new ModalController(
    this,
    { backdrop: true, keyboard: true, focus: true },
    {
      onShown: () => this.emit('lia-modal-show', { id: this.resolvedId }),
      onHidden: () => this.handleHidden(),
    }
  );

  /** The DOM id the `.modal` element renders with. */
  get resolvedId(): string {
    return this.modalId ?? `${this.fallbackId}-${this.listingId}`;
  }

  /** Columns that may be toggled — everything that is not `locked`. */
  get manageableColumns(): TableColumn[] {
    return this.columns.filter((column) => column.locked !== true);
  }

  /**
   * The selection in effect right now: the `selected` property if given, else
   * the stored preferences, else the definition's defaults.
   */
  get resolvedSelected(): string[] {
    if (this.selected) return [...this.selected];
    if (this.persist) {
      const stored = loadColumnPrefs(this.listingId, this.storageOptions ?? {});
      if (stored) return stored;
    }
    return defaultVisibleColumns(this.columns);
  }

  /** Open the dialog. */
  show(): void {
    this.open = true;
  }

  /** Close the dialog without saving. */
  hide(): void {
    this.open = false;
  }

  protected override firstUpdated(): void {
    this.draft = this.resolvedSelected;
    const element = this.querySelector<HTMLElement>(':scope > .modal');
    if (element) this.modal.attach(element);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Re-seed the working copy whenever the dialog is (re)opened, or the
    // listing it manages is swapped out underneath it.
    if (changed.has('open') && this.open) {
      this.draft = this.resolvedSelected;
      this.restoringDefaults = false;
    } else if (changed.has('columns') || changed.has('selected') || changed.has('listingId')) {
      if (!this.open) this.draft = this.resolvedSelected;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    if (this.open) this.modal.show();
    else this.modal.hide();
  }

  private handleHidden(): void {
    this.open = false;
    // Mirrors `<lia-modal>`, so a host can keep its own `open` flag in sync
    // when the dialog is dismissed with Esc, the backdrop or the ✕ button.
    this.emit('lia-modal-hide', { id: this.resolvedId });
  }

  private isChecked(column: TableColumn): boolean {
    return column.locked === true || this.draft.includes(column.key);
  }

  private toggle(key: string, checked: boolean): void {
    this.restoringDefaults = false;
    this.draft = checked
      ? [...this.draft.filter((entry) => entry !== key), key]
      : this.draft.filter((entry) => entry !== key);
  }

  private selectAll(checked: boolean): void {
    this.restoringDefaults = false;
    this.draft = checked ? this.manageableColumns.map((column) => column.key) : [];
  }

  private restoreDefaults(): void {
    this.draft = defaultVisibleColumns(this.columns);
    this.restoringDefaults = true;
  }

  /**
   * Commit the working copy: persist it (or drop the stored override when the
   * user asked for the defaults), announce it and close.
   */
  save(): void {
    // Definition order, and locked columns can never be dropped.
    const columns = this.columns
      .filter((column) => this.isChecked(column))
      .map((column) => column.key);

    if (this.persist) {
      if (this.restoringDefaults) clearColumnPrefs(this.listingId, this.storageOptions ?? {});
      else saveColumnPrefs(this.listingId, columns, this.storageOptions ?? {});
    }

    this.selected = columns;
    this.emit('lia-columns-change', { columns });
    this.hide();
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    this.save();
  }

  private renderColumn(column: TableColumn): TemplateResult {
    const id = `${this.resolvedId}-col-${column.key.replace(/[^\w-]/g, '_')}`;
    const locked = column.locked === true;
    return html`<div class="form-check">
      <input
        class="form-check-input"
        type="checkbox"
        id=${id}
        value=${column.key}
        ?disabled=${locked}
        .checked=${this.isChecked(column)}
        @change=${(event: Event) =>
          this.toggle(column.key, (event.currentTarget as HTMLInputElement).checked)}
      />
      <label class="form-check-label" for=${id}>
        ${column.label}
        ${locked
          ? html`<i
              class="fa-solid fa-lock ms-1 small text-body-secondary"
              aria-hidden="true"
            ></i>`
          : nothing}
      </label>
    </div>`;
  }

  protected override render(): TemplateResult {
    const manageable = this.manageableColumns;
    // NOTE: the `class` attribute on `.modal` stays static — Bootstrap owns the
    // `show` class there and a lit binding would clobber it mid-transition.
    return html`<div
      class="modal fade"
      id=${this.resolvedId}
      tabindex="-1"
      aria-labelledby=${this.titleId}
      aria-describedby=${this.descriptionId}
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-scrollable">
        <form class="modal-content" @submit=${(event: Event) => this.handleSubmit(event)}>
          <div class="modal-header">
            <h5 class="modal-title" id=${this.titleId}>${this.heading}</h5>
            <button
              type="button"
              class="btn-close"
              aria-label=${this.closeLabel}
              @click=${() => this.hide()}
            ></button>
          </div>
          <div class="modal-body">
            <p id=${this.descriptionId}>${this.description}</p>
            ${this.columns.length === 0
              ? html`<p class="text-body-secondary mb-0">${this.emptyLabel}</p>`
              : html`<fieldset class="lia-column-list">
                  <legend class="visually-hidden">${this.heading}</legend>
                  ${this.columns.map((column) => this.renderColumn(column))}
                </fieldset>`}
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              ?disabled=${manageable.length === 0}
              @click=${() => this.selectAll(true)}
            >
              ${this.selectAllLabel}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              ?disabled=${manageable.length === 0}
              @click=${() => this.selectAll(false)}
            >
              ${this.unselectAllLabel}
            </button>
            <button type="button" class="btn btn-secondary" @click=${() => this.restoreDefaults()}>
              ${this.resetLabel}
            </button>
            <button type="button" class="btn btn-secondary" @click=${() => this.hide()}>
              ${this.closeLabel}
            </button>
            <button type="submit" class="btn btn-primary">${this.saveLabel}</button>
          </div>
        </form>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-column-manager': LiaColumnManager;
  }
}
