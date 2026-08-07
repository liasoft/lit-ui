import { nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { CellRenderer, TableColumn } from '../../core/types.js';
import { renderCell, renderCellValue, type CellFormatOptions } from './cell-renderers.js';

/**
 * One table cell's *content*, rendered by the shared cell renderers.
 *
 * `<lia-table>` calls {@link renderCell} directly — a listing of 200 rows must
 * not create 2000 custom elements. This element exists for the other case: a
 * hand-written `<table>` (or a `<dl>`, or a card) that wants the same value
 * formatting without adopting the whole listing component.
 *
 * HTML parsing does not allow a custom element as a child of `<tr>`, so place
 * it **inside** the `<td>`; the host renders `display: contents` and adds no
 * box of its own.
 *
 * @example
 * ```html
 * <td>
 *   <lia-table-cell renderer="bytes" value="1073741824"></lia-table-cell>
 * </td>
 * ```
 *
 * @example
 * ```ts
 * html`<td class=${column.class ?? ''}>
 *   <lia-table-cell .column=${column} .row=${row} .index=${i}></lia-table-cell>
 * </td>`;
 * ```
 */
@customElement('lia-table-cell')
export class LiaTableCell<Row = Record<string, unknown>> extends LiaElement {
  /**
   * The column definition. When present the value is read from `row` through
   * `column.key`, and `column.render()` / `column.renderer` decide the output.
   */
  @property({ attribute: false }) column?: TableColumn<Row>;

  /** The row the value is read from. */
  @property({ attribute: false }) row?: Row;

  /** Position of the row on the current page, echoed in action events. */
  @property({ type: Number }) index?: number;

  /**
   * An explicit value, for use without a `row`. Also wins over the value the
   * column key would resolve to.
   */
  @property({ attribute: false }) value?: unknown;

  /** Renderer to use when no `column` is given. */
  @property({ type: String }) renderer: CellRenderer = 'text';

  /** Overrides for the built-in strings, glyphs and date/number formats. */
  @property({ attribute: false }) format?: CellFormatOptions;

  override render(): unknown {
    const column: TableColumn<Row> = this.column ?? { key: '', label: '', renderer: this.renderer };

    // A row plus a column is the full contract: `render()` and dotted keys work.
    if (this.value === undefined && this.row !== undefined) {
      return renderCell(this.row, column, {
        index: this.index,
        host: this,
        format: this.format,
      });
    }

    if (column.render && this.row !== undefined) return column.render(this.row, column) ?? nothing;

    return renderCellValue(this.value, column.renderer ?? this.renderer, {
      column,
      row: this.row,
      index: this.index,
      host: this,
      format: this.format,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-table-cell': LiaTableCell;
  }
}
