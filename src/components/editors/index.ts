/**
 * Editors — the specialised views.
 *
 * Where the other families render *any* listing or *any* form, these are the
 * screens that were never generic in the original panel: the DNS record table,
 * the log dump, the traffic page, the error report. Each one is ported as the
 * interaction pattern it really is, with the hosting semantics stripped out.
 *
 * | Element                 | The pattern                                                  |
 * | ----------------------- | ------------------------------------------------------------ |
 * | `<lia-record-editor>`   | repeatable records edited in place, with a save/discard bar    |
 * | `<lia-log-viewer>`      | a filterable, tailing log pane                                 |
 * | `<lia-traffic-view>`    | usage over time: period picker, chart and summary table        |
 * | `<lia-diff-view>`       | a dependency-free line diff, unified or side by side           |
 * | `<lia-code-block>`      | monospace text with a gutter, copy, download and wrap          |
 * | `<lia-report-form>`     | "report a problem", with the disclosed details in plain sight  |
 * | `<lia-api-keys-panel>`  | credentials management, with a one-time secret reveal          |
 * | `<lia-file-tree>`       | a keyboard-operable tree over hierarchical data                |
 *
 * `<lia-code-block>` is the shared substrate: the log viewer, the report form
 * and any config viewer compose it rather than re-implementing a `<pre>`.
 *
 * The diffing itself is exported as plain functions — {@link diffLines},
 * {@link collapseDiff}, {@link pairDiff}, {@link diffStats} — so a host can
 * compare two texts without rendering anything.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/editors';
 * ```
 *
 * @example
 * ```ts
 * // One schema, three former pages: records, address/port pairs, forwarders.
 * html`<lia-record-editor
 *   .columns=${[
 *     { key: 'name', label: 'Name', required: true },
 *     { key: 'type', label: 'Type', type: 'select', width: '8rem', options: types },
 *     { key: 'value', label: 'Value', required: true },
 *   ]}
 *   .records=${records}
 *   @lia-records-save=${(e: CustomEvent) => persist(e.detail.records)}
 * ></lia-record-editor>`;
 * ```
 */

export * from './lia-code-block.js';
export * from './lia-log-viewer.js';
export * from './lia-diff-view.js';
export * from './lia-record-editor.js';
export * from './lia-traffic-view.js';
export * from './lia-report-form.js';
export * from './lia-api-keys-panel.js';
export * from './lia-file-tree.js';
