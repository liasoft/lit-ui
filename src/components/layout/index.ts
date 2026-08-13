/**
 * Layout & navigation family.
 *
 * Importing this module registers the whole application chrome:
 *
 * | Element              | Role                                              |
 * | -------------------- | ------------------------------------------------- |
 * | `lia-app-shell`      | banners + navbar + sidebar + main + sub-sidebar    |
 * | `lia-navbar`         | top bar: brand, search, utility nav                |
 * | `lia-sidebar`        | primary, collapsible, grouped navigation rail      |
 * | `lia-sub-sidebar`    | secondary rail on the right of the content         |
 * | `lia-page-heading`   | title bar with description and action toolbar      |
 * | `lia-page`           | heading + alerts + content, ready for the shell    |
 * | `lia-footer`         | centred footer strip with legal links              |
 * | `lia-global-search`  | debounced navbar search with a results panel       |
 * | `lia-theme-toggle`   | light / dark / auto colour-scheme switcher         |
 * | `lia-time-range`     | preset or absolute time picker for a dashboard    |
 * | `lia-breadcrumb`     | Bootstrap breadcrumb from a `NavItem[]` trail      |
 *
 * ```ts
 * import '@liasoft/lit-ui/components/layout';
 * ```
 *
 * `./internal.js` is deliberately not re-exported: it holds implementation
 * details whose names are too generic to travel through the root barrel.
 * Action toolbars are rendered by the primitives family's `renderActions`, so
 * a `confirm` on an `ActionDescriptor` goes through `lia-confirm-dialog` here
 * exactly as it does in a table row.
 */
export * from './light-content.js';
export * from './flag.js';
export * from './app-shell.js';
export * from './navbar.js';
export * from './sidebar.js';
export * from './sub-sidebar.js';
export * from './page-heading.js';
export * from './page.js';
export * from './footer.js';
export * from './global-search.js';
export * from './theme-toggle.js';
export * from './time-range.js';
export * from './breadcrumb.js';
