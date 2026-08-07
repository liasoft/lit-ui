/**
 * Table family — listings, cells and paging.
 *
 * | Export                | What it is                                              |
 * | --------------------- | ------------------------------------------------------- |
 * | `<lia-table>`         | the listing renderer, driven by a `TableListing`          |
 * | `<lia-data-table>`    | the same look, sorting/filtering/paging a local array     |
 * | `<lia-pagination>`    | first/prev/numbers/next/last, summary, per-page selector  |
 * | `<lia-table-cell>`    | one cell's content, for hand-written tables               |
 * | `renderCell()`        | the pure cell renderer every `CellRenderer` runs through   |
 * | `paginationRange()`   | the numbered-page list with ellipsis truncation           |
 * | `compareCellValues()` | the default client-side ordering                          |
 * | `nextSortOrder()`     | the asc → desc → unsorted cycle                           |
 *
 * Every string the components render themselves is overridable:
 * {@link DEFAULT_TABLE_LABELS}, {@link DEFAULT_PAGINATION_LABELS} and
 * {@link DEFAULT_CELL_FORMAT} document the defaults.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/table';
 * ```
 */

export * from './cell-renderers.js';
export * from './lia-table-cell.js';
export * from './lia-pagination.js';
export * from './lia-table.js';
export * from './lia-data-table.js';
