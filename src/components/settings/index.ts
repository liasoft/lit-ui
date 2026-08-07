/**
 * Settings & wizard family — the screens that configure a system rather than
 * list its data.
 *
 * | Element                | What it is                                            |
 * | ---------------------- | ----------------------------------------------------- |
 * | `<lia-settings-page>`  | filtered settings groups + anchor rail + one save bar   |
 * | `<lia-settings-nav>`   | the section anchor list, as a rail or a row of pills    |
 * | `<lia-settings-group>` | one titled block of settings rows                       |
 * | `<lia-config-viewer>`  | generated configuration: commands, files, notes         |
 * | `<lia-config-wizard>`  | the picker that asks for a configuration                |
 * | `<lia-stepper>`        | the numbered step indicator of a multi-step flow        |
 * | `<lia-wizard>`         | stepper + per-step form + validation-gated navigation   |
 * | `<lia-phpinfo-view>`   | a viewer for dense runtime reports                      |
 * | `<lia-system-report>`  | the statistics dashboard of a running subsystem         |
 * | `<lia-update-panel>`   | version state, release notes and the update action      |
 *
 * Supporting modules:
 *
 * - `settings-model.js` — the group model, live filtering and `<mark>` highlighting.
 * - `scroll-spy.js` — {@link SectionSpy}, the "which section am I reading?" helper.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/settings';
 * ```
 *
 * @example
 * ```ts
 * html`<lia-settings-page
 *   title="Server settings"
 *   .groups=${[
 *     {
 *       id: 'general',
 *       title: 'General',
 *       icon: 'fa-solid fa-sliders',
 *       form: {
 *         sections: {
 *           main: {
 *             fields: {
 *               hostname: { type: 'text', label: 'Hostname', mandatory: true },
 *               language: {
 *                 type: 'select',
 *                 label: 'Default language',
 *                 options: [
 *                   { value: 'en', label: 'English' },
 *                   { value: 'de', label: 'Deutsch' },
 *                 ],
 *               },
 *             },
 *           },
 *         },
 *       },
 *     },
 *   ]}
 *   @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
 * ></lia-settings-page>`
 * ```
 */

export * from './settings-model.js';
export * from './scroll-spy.js';
export * from './settings-nav.js';
export * from './settings-group.js';
export * from './settings-page.js';
export * from './config-viewer.js';
export * from './config-wizard.js';
export * from './stepper.js';
export * from './wizard.js';
export * from './phpinfo-view.js';
export * from './system-report.js';
export * from './update-panel.js';
