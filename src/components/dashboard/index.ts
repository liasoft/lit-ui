/**
 * Dashboard — the landing-page family: resource meters, KPI cards, detail
 * panels, activity lists, a news panel, charts and the grid that arranges them.
 *
 * Importing this module registers every dashboard element:
 *
 * ```ts
 * import '@liasoft/lit-ui/components/dashboard';
 * ```
 *
 * A complete dashboard is a `lia-widget-grid` holding the rest:
 *
 * ```ts
 * html`
 *   <lia-welcome-panel heading="Welcome" cta-label="Configure" cta-href="/setup"></lia-welcome-panel>
 *   <lia-stat-row .items=${kpis}></lia-stat-row>
 *   <lia-dashboard-grid .items=${meters} columns="5"></lia-dashboard-grid>
 *   <lia-widget-grid
 *     .widgets=${[
 *       { id: 'system', span: 6, content: html`<lia-info-card title="System" .entries=${info} copyable flush></lia-info-card>` },
 *       { id: 'jobs', span: 6, content: html`<lia-activity-list title="Scheduled jobs" .items=${jobs} flush></lia-activity-list>` },
 *       { id: 'traffic', span: 8, content: html`<lia-chart type="bar" .data=${traffic} label="Traffic"></lia-chart>` },
 *       { id: 'news', span: 4, content: html`<lia-newsfeed src="/api/news.json" flush></lia-newsfeed>` },
 *     ]}
 *   ></lia-widget-grid>
 * `;
 * ```
 */

export * from './lia-resource-item.js';
export * from './lia-dashboard-grid.js';
export * from './lia-stat-card.js';
export * from './lia-stat-row.js';
export * from './lia-info-card.js';
export * from './lia-newsfeed.js';
export * from './lia-activity-list.js';
export * from './lia-chart.js';
export * from './lia-widget-grid.js';
export * from './lia-welcome-panel.js';
