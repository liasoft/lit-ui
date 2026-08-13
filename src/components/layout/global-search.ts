import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type { NavItem, SearchResult } from '../../core/types.js';
import { debounce, uid } from '../../core/utils.js';

interface ResultGroup {
  name?: string;
  items: SearchResult[];
}

/**
 * The navbar's global search: a borderless input with an absolutely positioned
 * results panel.
 *
 * The component is **controlled** — it never fetches anything itself. It
 * debounces typing, emits `lia-search` with the query, and renders whatever the
 * host later assigns to `results` (set `loading` while the request is in
 * flight). Results carrying a `group` are rendered under a sticky group header.
 * The panel has a row for every outcome: too few characters, searching,
 * failed, nothing found, hits.
 *
 * Keyboard: `↓`/`↑` move through the hits, `Enter` opens the highlighted one,
 * `Escape` closes the panel, `Home`/`End` jump to the first/last hit. Choosing
 * a hit emits a cancelable `lia-navigate` — cancel it to route client-side.
 *
 * @example
 * ```ts
 * html`<lia-global-search
 *   placeholder="Search…"
 *   .results=${hits}
 *   ?loading=${pending}
 *   @lia-search=${(e: CustomEvent) => void load(e.detail.text)}
 *   @lia-navigate=${(e: CustomEvent) => { e.preventDefault(); router.go(e.detail.url); }}
 * ></lia-global-search>`
 * ```
 */
@customElement('lia-global-search')
export class LiaGlobalSearch extends LiaElement {
  /** Hits to display. Assign after handling `lia-search`. */
  @property({ attribute: false }) results: SearchResult[] = [];

  @property({ type: String }) placeholder = 'Search';

  /** Accessible name of the input. */
  @property({ type: String }) label = 'Search';

  /** Echoed as `detail.field` of `lia-search`, so one handler can serve many inputs. */
  @property({ type: String }) field = 'global';

  /** Show the spinner row while the host is fetching. */
  @property({ type: Boolean }) loading = false;

  /**
   * Report a failed lookup. Any non-empty string replaces the hit list with an
   * error row; the string itself is used as the row's title, so a bare `"1"`
   * is enough to show {@link errorText}.
   */
  @property({ type: String }) error = '';

  /** Characters required before a query is emitted. */
  @property({ type: Number, attribute: 'min-chars' }) minChars = 3;

  /** Debounce for the `lia-search` event, in milliseconds. */
  @property({ type: Number }) delay = 250;

  @property({ type: String, attribute: 'min-chars-text' }) minCharsText =
    'Keep typing to search…';
  @property({ type: String, attribute: 'empty-text' }) emptyText = 'Nothing found.';
  @property({ type: String, attribute: 'loading-text' }) loadingText = 'Searching…';
  @property({ type: String, attribute: 'error-text' }) errorText = 'The search could not be run.';

  @state() private query = '';
  @state() private open = false;
  @state() private activeIndex = -1;

  private readonly boxId = uid('lia-search');

  private emitSearch = debounce((text: string) => {
    this.emit('lia-search', { field: this.field, text });
  }, this.delay);

  private readonly onDocumentPointerDown = (event: Event): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) this.close();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.emitSearch.cancel();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('delay')) {
      this.emitSearch.cancel();
      this.emitSearch = debounce((text: string) => {
        this.emit('lia-search', { field: this.field, text });
      }, this.delay);
    }
    if (changed.has('results')) this.activeIndex = -1;
  }

  /** Clear the query and close the panel. */
  reset(): void {
    this.query = '';
    this.results = [];
    this.close();
  }

  private close(): void {
    this.open = false;
    this.activeIndex = -1;
  }

  private get flatResults(): SearchResult[] {
    return this.groups.flatMap((group) => group.items);
  }

  private get groups(): ResultGroup[] {
    const groups: ResultGroup[] = [];
    for (const result of this.results) {
      const last = groups[groups.length - 1];
      if (last && last.name === result.group) last.items.push(result);
      else groups.push({ name: result.group, items: [result] });
    }
    return groups;
  }

  private onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query = value;
    this.activeIndex = -1;

    if (value.trim().length === 0) {
      this.emitSearch.cancel();
      this.results = [];
      this.close();
      return;
    }

    this.open = true;
    if (value.trim().length < this.minChars) {
      this.emitSearch.cancel();
      this.results = [];
      return;
    }
    this.emitSearch(value.trim());
  }

  private onKeyDown(event: KeyboardEvent): void {
    const hits = this.flatResults;

    if (event.key === 'Escape') {
      this.close();
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      this.open = true;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = this.activeIndex + step;
      this.activeIndex = next < 0 ? hits.length - 1 : next % hits.length;
      return;
    }
    if (event.key === 'Home' && hits.length > 0) {
      event.preventDefault();
      this.activeIndex = 0;
      return;
    }
    if (event.key === 'End' && hits.length > 0) {
      event.preventDefault();
      this.activeIndex = hits.length - 1;
      return;
    }
    if (event.key === 'Enter') {
      const hit = hits[this.activeIndex];
      if (hit) {
        event.preventDefault();
        this.choose(hit, event);
      }
    }
  }

  private choose(result: SearchResult, source: Event): void {
    const item: NavItem = { label: result.label, url: result.url, icon: result.icon };
    const event = this.emit('lia-navigate', { url: result.url, item }, { cancelable: true });
    if (event.defaultPrevented) source.preventDefault();
    this.close();
  }

  private optionId(index: number): string {
    return `${this.boxId}-opt-${index}`;
  }

  private renderPanelBody(): unknown {
    if (this.loading) {
      return html`<li class="list-group-item text-body-secondary py-1">
        <i class="fa-solid fa-spinner fa-spin me-1" aria-hidden="true"></i>${this.loadingText}
      </li>`;
    }
    if (this.query.trim().length < this.minChars) {
      return html`<li class="list-group-item text-body-secondary py-1">${this.minCharsText}</li>`;
    }
    if (this.error) {
      return html`<li
        class="list-group-item text-danger py-1"
        role="alert"
        title=${this.error === '1' ? nothing : this.error}
      >
        <i class="fa-solid fa-triangle-exclamation me-1" aria-hidden="true"></i>${this.errorText}
      </li>`;
    }
    if (this.results.length === 0) {
      return html`<li class="list-group-item text-body-secondary py-1">${this.emptyText}</li>`;
    }

    let index = -1;
    return this.groups.map(
      (group) => html`${group.name
        ? html`<li
            class="list-group-item text-body-secondary text-capitalize fw-bold py-1 border-bottom"
            role="presentation"
          >
            ${group.name}
          </li>`
        : nothing}
      ${group.items.map((result) => {
        index += 1;
        const current = index;
        return html`<li
          id="${this.optionId(current)}"
          class="list-group-item mt-1 ${current === this.activeIndex ? 'active' : ''}"
          role="option"
          aria-selected="${current === this.activeIndex ? 'true' : 'false'}"
        >
          <a
            href="${result.url}"
            class="text-decoration-none d-flex align-items-baseline gap-2"
            @click="${(event: MouseEvent) => this.choose(result, event)}"
            @mousemove="${() => {
              this.activeIndex = current;
            }}"
          >
            ${result.icon
              ? html`<i class="${result.icon}" aria-hidden="true"></i>`
              : nothing}
            <span>
              ${result.label}
              ${result.description
                ? html`<small class="d-block text-body-secondary">${result.description}</small>`
                : nothing}
            </span>
          </a>
        </li>`;
      })}`
    );
  }

  protected override render(): unknown {
    const activeId = this.activeIndex >= 0 ? this.optionId(this.activeIndex) : undefined;

    return html`<form
      class="lia-search w-100"
      role="search"
      @submit="${(event: Event) => event.preventDefault()}"
    >
      <div class="d-flex align-items-center w-100">
        <i class="fa-solid fa-magnifying-glass text-body-secondary" aria-hidden="true"></i>
        <input
          class="lia-search-input w-75"
          type="search"
          role="combobox"
          autocomplete="off"
          aria-label="${this.label}"
          aria-controls="${this.boxId}"
          aria-expanded="${this.open ? 'true' : 'false'}"
          aria-autocomplete="list"
          aria-activedescendant="${ifDefined(activeId)}"
          placeholder="${this.placeholder}"
          .value="${this.query}"
          @input="${(event: Event) => this.onInput(event)}"
          @keydown="${(event: KeyboardEvent) => this.onKeyDown(event)}"
          @focus="${() => {
            if (this.query.trim().length > 0) this.open = true;
          }}"
        />
      </div>
      <div class="lia-search-results-box p-2 shadow" ?hidden="${!this.open}">
        <ul
          class="lia-search-results list-group list-group-flush"
          id="${this.boxId}"
          role="listbox"
          aria-label="${this.label}"
        >
          ${this.renderPanelBody()}
        </ul>
      </div>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-global-search': LiaGlobalSearch;
  }
}
