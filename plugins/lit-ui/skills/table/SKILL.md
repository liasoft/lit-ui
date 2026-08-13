---
name: table
description: Build data listings with @liasoft/lit-ui tables — server-paged listings (lia-table), client-side sortable/filterable arrays (lia-data-table), standalone pagers (lia-pagination), and the cell-renderer catalogue (badge, bytes, datetime, progressbar…). Load when rendering tabular data, row actions, bulk selection, or row-detail expansion in an admin UI.
---

# Tables

## When to reach for this family

The choice is about where the data lives, not how it looks — both tables render identically:

- **`<lia-data-table>`** — you hold the whole array in memory. It sorts, filters and pages locally. Settings lists, fixed catalogues, reports.
- **`<lia-table>`** — a paged API owns the data. Controlled: it renders exactly the rows given and *asks* via events (`lia-sort`, `lia-search`, `lia-page-change`); you answer with a new `TableListing`.
- **`<lia-pagination>`** — a pager on its own, outside a table.
- **`renderCell()`** — the pure cell renderer, callable directly for a hand-written `<table>`.

Prefer these over hand-rolling Bootstrap tables: sorting UI, search dialog, column manager, selection, empty state, loading skeleton and pagination come for free. Composes with `lia-card` (attached mode), `lia-empty-state`, `lia-modal` (action dialogs) and `lia-confirm-dialog` from the feedback family (confirm descriptors).

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/table'` for this family only. Stylesheet is loaded once globally. All components render into light DOM — Bootstrap classes and page CSS reach every cell.

## Component reference

### `<lia-table>` — the controlled listing

Driven by one `TableListing<Row>` object: `{ id, columns, rows, rowKey?, rowActions?, rowClass?, rowDetail?, pagination?, sort?, selectable?, bulkActions?, help?, emptyTitle?, emptyMessage?, noSearch?, noColumnManager? }`.

| Property | Type | Notes |
|---|---|---|
| `.listing` | `TableListing<Row>` | The whole definition |
| `loading` | boolean | Overlay, or skeleton rows when empty (`skeleton-rows`) |
| `compact` / `hover` / `striped` | boolean | `striped` defaults true; disable with `striped="false"` |
| `caption` | string | Accessible name; `caption-hidden` defaults true |
| `.search` | `TableSearchState` | Controlled filter chip `{ field, text }` |
| `.selectedKeys` / `.visibleColumns` / `.expandedKeys` | arrays | Controlled selection / columns / row expansion |
| `storage-key` | string | Persist column choice in localStorage |
| `allow-unsorted` | boolean | `false` makes sort a two-way toggle |
| `show-summary` / `show-per-page` / `hide-pagination` | boolean | Footer pager options |
| `server-toggle` / `server` | boolean | Opt-in scope toggle; emits `lia-scope-change` |
| `.labels` / `.format` / `.emptyActions` | objects | i18n chrome strings, cell format, empty-state buttons |

Events (all bubbling CustomEvents): `lia-sort` (`SortState`; empty `field` = clear sorting), `lia-search` (`{field, text}`), `lia-page-change` (`{page}`), `lia-per-page-change` (`{perPage}`), `lia-selection-change` (`{rows, keys}`), `lia-columns-change` (`{columns}`), `lia-scope-change` (`{server}`), `lia-action` (`ActionEventDetail`: `{action, id, row, rows?, index}`).

```ts
html`<lia-table
  .listing=${{ id: 'members', columns, rows, rowKey: (r) => r.id,
    pagination: { currentPage, lastPage, perPage, total },
    sort, selectable: true, bulkActions,
    rowActions: (row) => [{ id: 'edit', icon: 'fa-solid fa-pen', title: 'Edit' }] }}
  .loading=${this.loading} show-summary show-per-page hover storage-key="members"
  @lia-sort=${(e: CustomEvent) => this.load({ sort: e.detail })}
  @lia-page-change=${(e: CustomEvent) => this.load({ page: e.detail.page })}
  @lia-action=${(e: CustomEvent) => this.run(e.detail.id, e.detail.row)}
></lia-table>`;
```

### `<lia-data-table>` — local array

Takes `.columns` and `.rows` as flat properties (no listing object) plus `listing-id`, `per-page` (0 = one page), `.rowActions`, `.rowKey`, `.rowClass`, `.rowDetail`, `.expandedKeys`, `.revealKey`, `selectable`, `.bulkActions`, `.sort`, `.search`, `.help`, `.compare`, `.match`, `.cellValueFor`, `no-search`, `no-column-manager`, and the same chrome props as `lia-table` (`show-summary` defaults **true** here). The same events still fire, so you can observe what it did. Imperative API: `setPage()`, `setSort()`, `setSearch()`, `pageForKey(key)`.

```ts
html`<lia-data-table listing-id="services" per-page="10" hover selectable
  .columns=${columns} .rows=${services} .rowKey=${(r) => r.id}
  .rowActions=${(row) => [{ id: 'open', icon: 'fa-solid fa-eye', title: 'Open', data: row }]}
  @lia-action=${(e: CustomEvent) => open(e.detail.action.data)}
></lia-data-table>`;
```

### `<lia-pagination>` — standalone pager

Props: `.state` (`PaginationState`), or `page`/`last-page`/`total`/`per-page` individually; `show-summary`, `show-per-page`, `.perPageOptions`, `numbered="false"` (arrows only), `show-edges="false"`, `siblings`, `size`, `always-visible`, `.pageHref` (render real anchors for routers), `.labels`. Emits `lia-page-change` `{page}` and `lia-per-page-change` `{perPage}`. Hides itself at one page unless `always-visible`. Rendered automatically by both tables; place it yourself only outside them.

### Cell renderers

`TableColumn`: `{ key, label, renderer?, class?, sortable?, searchable?, defaultSearchField?, checked?, locked?, render?, lookup? }`. `key` supports dotted paths (`lead.name`). `render(row, column)` wins over `renderer`. Renderer catalogue and expected value: `text` (default), `html` (trusted markup), `boolean`, `booleanWithInfo` `{checked, info}`, `progressbar` `{percent, text, style, infotext}`, `link` `{href, text, icon, target}`, `badge` `{text, variant, icon}`, `badges` (array), `actions` (`ActionDescriptor[]`), `bytes`, `date`/`datetime` (epoch seconds/ms, ISO or Date; `0` renders "Never"), `code`, `domainWithSan` `{domain, san}`, `custom`. Localise via `.format` (`CellFormatOptions`: `locale`, `emptyText`, `neverText`, `trueLabel`, `byteDecimals`, `dateOptions`…). `setCellDecorator()` installs one app-wide hook over every rendered cell.

## Patterns and pitfalls

- **Row actions** are `ActionDescriptor`s: `confirm: { message, title?, variant? }` fires cancelable `lia-action-confirm-request` first (claimed by `lia-confirm-dialog`, else falls back to `window.confirm`); `modal: { id, title, body }` opens a dialog instead of acting; `data` is echoed back in `lia-action`.
- **Bulk actions** appear once rows are ticked; their `lia-action` detail carries the selected rows in `detail.rows`. Selection needs a stable `rowKey` — the default is the array index, which breaks across pages.
- **`lia-data-table` sort/search are controlled props**: a fresh object literal in `render()` resets the user's click every re-render. Keep the initial `sort` identity stable (module constant).
- **Row detail** (`rowDetail: (row) => template`) is fully controlled through `expandedKeys` — the table renders the region but never opens or closes it; toggle from your own trigger (typically a row action updating `expandedKeys`). Never sorted/searched/paged; follows its row through re-sorts via `rowKey`. `revealKey` jumps `lia-data-table` to the page containing a key (requires `rowKey`).
- **Sort cycle** is asc → desc → unsorted; unsorted arrives as `{ field: '' }`. Set `allow-unsorted="false"` if your backend cannot return insertion order.
- Inside a `<lia-card>` the table auto-detects `attached` mode: no second card, tool strip handed to the card header.
