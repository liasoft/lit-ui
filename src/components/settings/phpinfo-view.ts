import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { normaliseFilter, stripTags } from './settings-model.js';

/** One cell of a report row. Strings are rendered as trusted HTML. */
export type ReportCell = string | { value: string; note?: string };

/** One row: an array of cells, or the same with a couple of flags. */
export type ReportRow = ReportCell[] | { cells: ReportCell[]; heading?: boolean };

/** A titled block of a system report. */
export interface ReportSection {
  /** Heading printed across the full table width. Trusted HTML. */
  title: string;
  /** Column headers for this section, e.g. `['Directive', 'Local', 'Master']`. */
  columns?: string[];
  /** `[name, ...values]` per row. A one-cell row spans the whole width. */
  rows: ReportRow[];
}

/** The cells of a row, whichever shape it was written in. */
export function reportRowCells(row: ReportRow): ReportCell[] {
  return Array.isArray(row) ? row : row.cells;
}

/** The text of a cell, markup stripped — what the filter matches against. */
export function reportCellText(cell: ReportCell): string {
  return typeof cell === 'string'
    ? stripTags(cell)
    : `${stripTags(cell.value)} ${stripTags(cell.note ?? '')}`;
}

/** Keep the rows of a section that match an already-normalised filter. */
export function filterReportSection(
  section: ReportSection,
  needle: string
): ReportSection | undefined {
  if (!needle) return section;
  if (stripTags(section.title).toLowerCase().includes(needle)) return section;
  const rows = section.rows.filter((row) =>
    reportRowCells(row).some((cell) => reportCellText(cell).toLowerCase().includes(needle))
  );
  return rows.length > 0 ? { ...section, rows } : undefined;
}

/**
 * A viewer for the long, dense key/value dumps a runtime produces —
 * `phpinfo()`, an opcode-cache summary, an extension's runtime configuration.
 *
 * Two modes:
 *
 * 1. **Structured** (`sections`): titled blocks of `[name, …values]` rows,
 *    rendered as one fixed-layout, optionally scrollable table. Values may
 *    carry a `note`, which is how "local value / master value" pairs stay
 *    readable on a phone.
 * 2. **Embedded** (`html`): a pre-rendered fragment dropped into a container
 *    that neutralises its own styling, for the case where you have the
 *    runtime's HTML and no parser.
 *
 * The optional filter box narrows the rows as you type — a report with two
 * thousand directives is otherwise unusable.
 *
 * The content is **trusted HTML** in both modes: it is a report your server
 * produced, not user input.
 *
 * @example
 * ```ts
 * html`<lia-phpinfo-view
 *   title="Runtime information"
 *   searchable
 *   max-height="70vh"
 *   .sections=${[
 *     {
 *       title: 'Core',
 *       columns: ['Directive', 'Local', 'Master'],
 *       rows: [
 *         ['memory_limit', '512M', '128M'],
 *         ['display_errors', { value: 'Off', note: 'set in /etc/php.ini' }],
 *       ],
 *     },
 *   ]}
 * ></lia-phpinfo-view>`
 * ```
 *
 * @example
 * ```html
 * <lia-phpinfo-view id="report" title="phpinfo()"></lia-phpinfo-view>
 * <script type="module">
 *   document.getElementById('report').html = await (await fetch('/api/phpinfo')).text();
 * </script>
 * ```
 */
@customElement('lia-phpinfo-view')
export class LiaPhpinfoView extends LiaElement {
  /** The report, section by section. */
  @property({ attribute: false }) sections: ReportSection[] = [];

  /** A pre-rendered report fragment. Wins over {@link sections}. Trusted HTML. */
  @property({ type: String }) html = '';

  /**
   * Heading above the report.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = '';

  /** Icon before the heading. */
  @property({ type: String }) icon: IconName = '';

  /** Line under the heading. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Offer the filter box. */
  @property({ type: Boolean }) searchable = false;

  /** Current filter text. */
  @property({ type: String, attribute: 'filter-text' }) filterText = '';

  /** Maximum height of the scroll area, as a CSS length. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '';

  /** Width of the name column, as a CSS length. */
  @property({ type: String, attribute: 'name-width' }) nameWidth = '14rem';

  /** Zebra striping. */
  @property({ type: Boolean, attribute: 'no-stripes' }) noStripes = false;

  /** Tighter row padding, for very long reports. */
  @property({ type: Boolean }) dense = false;

  /* -- overridable strings ---------------------------------------------- */

  @property({ type: String, attribute: 'filter-label' }) filterLabel = 'Filter entries';

  @property({ type: String, attribute: 'filter-placeholder' }) filterPlaceholder = 'Filter…';

  @property({ type: String, attribute: 'clear-filter-label' }) clearFilterLabel = 'Clear filter';

  /** Accessible name of the report table. */
  @property({ type: String, attribute: 'table-label' }) tableLabel = 'System report';

  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No entries to show.';

  @property({ type: String, attribute: 'no-match-message' }) noMatchMessage =
    'Nothing matches the filter.';

  private readonly instanceId = uid('lia-report');

  /** The sections as they are currently rendered, filter applied. */
  get visibleSections(): ReportSection[] {
    const needle = normaliseFilter(this.filterText);
    if (!needle) return this.sections;
    const result: ReportSection[] = [];
    for (const section of this.sections) {
      const filtered = filterReportSection(section, needle);
      if (filtered) result.push(filtered);
    }
    return result;
  }

  /** The widest row in the report — how many columns the table needs. */
  get columnCount(): number {
    let widest = 2;
    for (const section of this.sections) {
      if (section.columns) widest = Math.max(widest, section.columns.length);
      for (const row of section.rows) widest = Math.max(widest, reportRowCells(row).length);
    }
    return widest;
  }

  private handleFilterInput(event: Event): void {
    this.filterText = (event.target as HTMLInputElement).value;
  }

  private renderCell(cell: ReportCell): TemplateResult {
    if (typeof cell === 'string') return html`${renderRich(cell)}`;
    return html`${renderRich(cell.value)}${cell.note
      ? html`<br /><small class="text-body-secondary">${renderRich(cell.note)}</small>`
      : nothing}`;
  }

  private renderRow(row: ReportRow, columns: number): TemplateResult {
    const cells = reportRowCells(row);
    const heading = !Array.isArray(row) && row.heading === true;

    // A single cell is a caption-like row: centre it across the table.
    if (cells.length === 1) {
      return html`<tr>
        <td colspan=${columns} class="text-center">${this.renderCell(cells[0])}</td>
      </tr>`;
    }

    const [name, ...values] = cells;
    const span = Math.max(1, columns - 1 - (values.length - 1));
    return html`<tr>
      <th
        scope="row"
        class=${cx('lia-report-name', heading ? 'fw-bold' : 'fw-normal')}
        style=${this.nameWidth ? `width:${this.nameWidth}` : nothing}
      >
        ${this.renderCell(name)}
      </th>
      ${values.map(
        (value, index) =>
          html`<td colspan=${index === values.length - 1 ? span : 1}>
            ${this.renderCell(value)}
          </td>`
      )}
    </tr>`;
  }

  private renderSection(section: ReportSection, columns: number): TemplateResult {
    return html`<tbody class="lia-report-body">
      <tr>
        <th colspan=${columns} scope="colgroup" class="lia-report-section">
          ${renderRich(section.title)}
        </th>
      </tr>
      ${section.columns
        ? html`<tr class="lia-report-columns">
            ${section.columns.map(
              (label, index) =>
                html`<th scope="col" class=${cx(index === 0 && 'lia-report-name')}>${label}</th>`
            )}
          </tr>`
        : nothing}
      ${section.rows.map((row) => this.renderRow(row, columns))}
    </tbody>`;
  }

  private renderFilter(): TemplateResult | typeof nothing {
    if (!this.searchable) return nothing;
    const id = `${this.instanceId}-filter`;
    return html`<div class="input-group mb-3">
      <span class="input-group-text" aria-hidden="true">
        <i class="fa-solid fa-magnifying-glass"></i>
      </span>
      <input
        id=${id}
        type="search"
        class="form-control"
        autocomplete="off"
        placeholder=${this.filterPlaceholder}
        aria-label=${this.filterLabel}
        .value=${this.filterText}
        @input=${this.handleFilterInput}
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        title=${this.clearFilterLabel}
        aria-label=${this.clearFilterLabel}
        ?disabled=${this.filterText === ''}
        @click=${() => (this.filterText = '')}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>`;
  }

  private renderHeader(): TemplateResult | typeof nothing {
    if (!this.title && !this.description) return nothing;
    return html`<div class="mb-3">
      ${this.title
        ? html`<h2 class="h5 mb-1">${renderIcon(this.icon, { class: 'me-2' })}${this.title}</h2>`
        : nothing}
      ${this.description
        ? html`<p class="text-body-secondary mb-0">${renderRich(this.description)}</p>`
        : nothing}
    </div>`;
  }

  protected override render(): unknown {
    const header = html`${this.renderHeader()}${this.renderFilter()}`;

    if (this.html) {
      return html`${header}
        <div
          class="card lia-report-embed overflow-auto p-3"
          style=${this.maxHeight ? `max-height:${this.maxHeight}` : nothing}
          tabindex="0"
          role="region"
          aria-label=${this.tableLabel}
        >
          ${renderRich(this.html)}
        </div>`;
    }

    const sections = this.visibleSections;
    if (sections.length === 0) {
      return html`${header}
        <p class="text-body-secondary fst-italic mb-0">
          ${this.sections.length === 0 ? this.emptyMessage : this.noMatchMessage}
        </p>`;
    }

    const columns = this.columnCount;
    return html`${header}
      <div
        class=${cx('card', 'lia-report', this.maxHeight && 'lia-report-scroll', 'overflow-auto')}
        style=${this.maxHeight ? `max-height:${this.maxHeight}` : nothing}
        tabindex="0"
        role="region"
        aria-label=${this.tableLabel}
      >
        <table
          class=${cx(
            'table',
            'table-borderless',
            'align-middle',
            'mb-0',
            'lia-report-table',
            !this.noStripes && 'table-striped',
            this.dense && 'table-sm'
          )}
        >
          ${sections.map((section) => this.renderSection(section, columns))}
        </table>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-phpinfo-view': LiaPhpinfoView;
  }
}
