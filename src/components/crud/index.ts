/**
 * CRUD family — the chrome that turns a table into a working list/edit system.
 *
 * | Element                 | What it is                                            |
 * | ----------------------- | ----------------------------------------------------- |
 * | `<lia-crud-page>`       | a complete list page: heading, filters, search, table |
 * | `<lia-crud-form-page>`  | its create/edit counterpart with a save/reset bar     |
 * | `<lia-column-manager>`  | the "which columns do I want?" dialog, persisted      |
 * | `<lia-table-search>`    | search-by-column, as a dialog or an inline input group |
 * | `<lia-filter-bar>`      | active-filter chips plus quick-filter selects          |
 * | `<lia-inline-edit>`     | edit one value in place, inside a table cell           |
 * | `<lia-delete-confirm>`  | the delete button that always asks first               |
 *
 * Plus the pieces you can use without any element:
 *
 * - {@link createCrudController} — page/sort/search/filter/selection state and
 *   the fetching it implies, with stale-response protection built in.
 * - {@link loadColumnPrefs} / {@link saveColumnPrefs} / {@link applyColumnPrefs}
 *   — the column-preference storage the manager uses.
 * - {@link confirmDelete} / {@link deletePrompt} — the delete prompt, reusable
 *   on any `ActionDescriptor.confirm`.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/crud';
 * ```
 *
 * @example
 * ```ts
 * const crud = createCrudController<User>({
 *   id: 'users',
 *   columns,
 *   fetch: ({ page, search, signal }) => api.users({ page, q: search?.text }, signal),
 *   onChange: () => host.requestUpdate(),
 *   autoLoad: true,
 * });
 *
 * html`<lia-crud-page
 *   title="Users"
 *   .listing=${crud.listing}
 *   .allColumns=${crud.allColumns}
 *   .filters=${crud.filterChips}
 *   .loading=${crud.state.loading}
 *   .error=${crud.state.error ?? ''}
 * ></lia-crud-page>`;
 * ```
 */

export * from './column-prefs.js';
export * from './column-manager.js';
export * from './table-search.js';
export * from './filter-bar.js';
export * from './inline-edit.js';
export * from './delete-confirm.js';
export * from './crud-controller.js';
export * from './crud-page.js';
export * from './crud-form-page.js';
