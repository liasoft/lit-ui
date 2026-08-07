import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { TableColumn, TableSearchState } from '../../core/types.js';
import { uid } from '../../core/utils.js';
import { ModalController } from '../feedback/modal-controller.js';

/** Columns a user may search in: everything not marked `searchable: false`. */
export function searchableColumns<Row>(columns: readonly TableColumn<Row>[]): TableColumn<Row>[] {
  return columns.filter((column) => column.searchable !== false);
}

/**
 * The field a search starts on: the column flagged `defaultSearchField`, else
 * the first searchable one.
 */
export function defaultSearchField<Row>(columns: readonly TableColumn<Row>[]): string {
  const candidates = searchableColumns(columns);
  const preferred = candidates.find((column) => column.defaultSearchField === true);
  return (preferred ?? candidates[0])?.key ?? '';
}

/**
 * Search a listing by column: a `<select>` of searchable columns plus a text
 * box, emitting `lia-search` with a {@link TableSearchState}.
 *
 * Two shapes, one component. By default it is a dialog — the shape the
 * reference panel uses, and the right one when a table has fifteen searchable
 * columns. Add `inline` and it collapses into a single Bootstrap input group
 * you can drop straight into a toolbar, which is far less ceremony for a list
 * with three columns. With `live`, typing searches as you go (debounced);
 * without it, the user submits explicitly.
 *
 * Searching is a *request*, not a state change: the component never filters
 * anything itself, it tells you what the user asked for.
 *
 * @example
 * ```ts
 * html`<lia-table-search
 *   inline
 *   .columns=${listing.columns}
 *   .field=${this.search.field}
 *   .text=${this.search.text}
 *   @lia-search=${(e: CustomEvent) => this.reload(e.detail)}
 * ></lia-table-search>`;
 * ```
 *
 * @example
 * ```ts
 * html`<lia-table-search
 *   listing-id="users"
 *   .columns=${listing.columns}
 *   .open=${this.searching}
 *   @lia-modal-hide=${() => (this.searching = false)}
 * ></lia-table-search>`;
 * ```
 */
@customElement('lia-table-search')
export class LiaTableSearch extends LiaElement {
  /** Identifies the listing; used for the generated modal id. */
  @property({ type: String, attribute: 'listing-id' }) listingId = 'listing';

  /** The listing's columns. Only searchable ones are offered. */
  @property({ attribute: false }) columns: TableColumn[] = [];

  /** Selected column key. Defaults to {@link defaultSearchField}. */
  @property({ type: String }) field = '';

  /** Current search text. */
  @property({ type: String }) text = '';

  /** Render as an input group instead of a dialog. */
  @property({ type: Boolean }) inline = false;

  /** Emit `lia-search` while the user types, instead of on submit. */
  @property({ type: Boolean }) live = false;

  /** Debounce for {@link live}, in milliseconds. */
  @property({ type: Number }) delay = 300;

  /** Whether the dialog is on screen. Ignored when `inline`. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Explicit DOM id for the `.modal`, so `data-bs-target="#…"` can find it. */
  @property({ type: String, attribute: 'modal-id' }) modalId?: string;

  /** Disable every control, e.g. while a request is in flight. */
  @property({ type: Boolean }) disabled = false;

  /** Hide the column `<select>` — for listings that search one field only. */
  @property({ type: Boolean, attribute: 'hide-field' }) hideField = false;

  /** Dialog heading. */
  @property({ type: String }) heading = 'Search';

  /** Explanatory line above the controls, dialog only. */
  @property({ type: String }) description = 'Pick a column and enter what you are looking for.';

  /** Accessible name of the column `<select>`. */
  @property({ type: String, attribute: 'field-label' }) fieldLabel = 'Search in';

  /** Accessible name of the text input. */
  @property({ type: String, attribute: 'text-label' }) textLabel = 'Search term';

  @property({ type: String }) placeholder = 'Search…';

  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Search';

  @property({ type: String, attribute: 'clear-label' }) clearLabel = 'Clear search';

  @property({ type: String, attribute: 'close-label' }) closeLabel = 'Close';

  /** Working copy of the text box, committed on submit. */
  @state() private draftText = '';

  /** Working copy of the column select, committed on submit. */
  @state() private draftField = '';

  private readonly titleId = uid('lia-search-title');
  private readonly descriptionId = uid('lia-search-desc');
  private readonly fieldId = uid('lia-search-field');
  private readonly textId = uid('lia-search-text');
  private readonly fallbackId = uid('lia-search');

  private readonly modal = new ModalController(
    this,
    { backdrop: true, keyboard: true, focus: true },
    {
      onShown: () => {
        this.emit('lia-modal-show', { id: this.resolvedId });
        this.querySelector<HTMLInputElement>(`#${CSS.escape(this.textId)}`)?.focus();
      },
      onHidden: () => {
        this.open = false;
        this.emit('lia-modal-hide', { id: this.resolvedId });
      },
    }
  );

  /** Timer backing {@link live}. Rebuilt on demand so `delay` stays editable. */
  private liveTimer?: ReturnType<typeof setTimeout>;

  /** Schedule a `lia-search` for after the user stopped typing. */
  private scheduleLive(): void {
    this.cancelLive();
    this.liveTimer = setTimeout(() => {
      this.liveTimer = undefined;
      this.submit();
    }, Math.max(0, this.delay));
  }

  private cancelLive(): void {
    if (this.liveTimer === undefined) return;
    clearTimeout(this.liveTimer);
    this.liveTimer = undefined;
  }

  /** The DOM id the `.modal` element renders with. */
  get resolvedId(): string {
    return this.modalId ?? `${this.fallbackId}-${this.listingId}`;
  }

  /** The column keys that may be searched. */
  get options(): TableColumn[] {
    return searchableColumns(this.columns);
  }

  /** The search as it would be emitted right now. */
  get value(): TableSearchState {
    return { field: this.draftField, text: this.draftText };
  }

  /** Open the dialog. */
  show(): void {
    this.open = true;
  }

  /** Close the dialog. */
  hide(): void {
    this.open = false;
  }

  /** Announce the current draft as a `lia-search` request. */
  submit(): void {
    this.field = this.draftField;
    this.text = this.draftText;
    this.emit('lia-search', { field: this.draftField, text: this.draftText });
  }

  /** Empty the text box and announce the cleared search. */
  clear(): void {
    this.cancelLive();
    this.draftText = '';
    this.submit();
    if (!this.inline) this.hide();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns') && !this.draftField) {
      this.draftField = this.field || defaultSearchField(this.columns);
    }
    if (changed.has('field')) this.draftField = this.field || defaultSearchField(this.columns);
    if (changed.has('text')) this.draftText = this.text;
    // Re-seed the dialog every time it opens, so an abandoned edit is not
    // silently resurrected on the next visit.
    if (changed.has('open') && this.open) {
      this.draftField = this.field || defaultSearchField(this.columns);
      this.draftText = this.text;
    }
  }

  protected override firstUpdated(): void {
    if (!this.draftField) this.draftField = this.field || defaultSearchField(this.columns);
    if (this.inline) return;
    const element = this.querySelector<HTMLElement>(':scope > .modal');
    if (element) this.modal.attach(element);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (this.inline || !changed.has('open')) return;
    if (this.open) this.modal.show();
    else this.modal.hide();
  }

  override disconnectedCallback(): void {
    this.cancelLive();
    super.disconnectedCallback();
  }

  private handleTextInput(event: Event): void {
    this.draftText = (event.currentTarget as HTMLInputElement).value;
    if (this.live) this.scheduleLive();
  }

  private handleFieldInput(event: Event): void {
    this.draftField = (event.currentTarget as HTMLSelectElement).value;
    if (this.live && this.draftText) this.scheduleLive();
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    this.cancelLive();
    this.submit();
    if (!this.inline) this.hide();
  }

  private renderFieldSelect(classes: string): TemplateResult | typeof nothing {
    const options = this.options;
    if (this.hideField || options.length < 2) return nothing;
    return html`<select
      class=${classes}
      id=${this.fieldId}
      name="searchfield"
      aria-label=${this.fieldLabel}
      ?disabled=${this.disabled}
      .value=${this.draftField}
      @change=${(event: Event) => this.handleFieldInput(event)}
    >
      ${options.map(
        (column) =>
          html`<option value=${column.key} ?selected=${column.key === this.draftField}>
            ${column.label}
          </option>`
      )}
    </select>`;
  }

  private renderInline(): TemplateResult {
    return html`<form
      class="lia-table-search input-group input-group-sm"
      role="search"
      @submit=${(event: Event) => this.handleSubmit(event)}
    >
      ${this.renderFieldSelect('form-select flex-grow-0 w-auto')}
      <input
        class="form-control"
        type="search"
        id=${this.textId}
        name="searchtext"
        aria-label=${this.textLabel}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        .value=${this.draftText}
        @input=${(event: Event) => this.handleTextInput(event)}
      />
      ${this.draftText
        ? html`<button
            type="button"
            class="btn btn-outline-secondary"
            title=${this.clearLabel}
            aria-label=${this.clearLabel}
            ?disabled=${this.disabled}
            @click=${() => this.clear()}
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>`
        : nothing}
      <button
        type="submit"
        class="btn btn-outline-secondary"
        title=${this.submitLabel}
        aria-label=${this.submitLabel}
        ?disabled=${this.disabled}
      >
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      </button>
    </form>`;
  }

  private renderModal(): TemplateResult {
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
      <div class="modal-dialog">
        <form
          class="modal-content"
          role="search"
          @submit=${(event: Event) => this.handleSubmit(event)}
        >
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
            ${this.hideField || this.options.length < 2
              ? nothing
              : html`<div class="mb-3">
                  <label class="form-label" for=${this.fieldId}>${this.fieldLabel}</label>
                  ${this.renderFieldSelect('form-select')}
                </div>`}
            <div class="mb-0">
              <label class="form-label" for=${this.textId}>${this.textLabel}</label>
              <input
                class="form-control"
                type="search"
                id=${this.textId}
                name="searchtext"
                placeholder=${this.placeholder}
                ?disabled=${this.disabled}
                .value=${this.draftText}
                @input=${(event: Event) => this.handleTextInput(event)}
              />
            </div>
          </div>
          <div class="modal-footer">
            ${this.text
              ? html`<button type="button" class="btn btn-secondary" @click=${() => this.clear()}>
                  ${this.clearLabel}
                </button>`
              : nothing}
            <button type="button" class="btn btn-secondary" @click=${() => this.hide()}>
              ${this.closeLabel}
            </button>
            <button type="submit" class="btn btn-primary" ?disabled=${this.disabled}>
              ${this.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult {
    return this.inline ? this.renderInline() : this.renderModal();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-table-search': LiaTableSearch;
  }
}
