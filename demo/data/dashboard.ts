/**
 * Everything the dashboard demos display.
 *
 * Chart series use one fixed categorical palette rather than inventing colours
 * per chart: the six hues are checked for adjacent-pair separation under
 * normal and colour-deficient vision. Series identity never rests on colour
 * alone here either — every chart in the demo is paired with a legend and a
 * table.
 */

import type {
  ActivityItem,
  ChartData,
  InfoEntry,
  StatCardData,
} from '@liasoft/lit-ui';

/** Six categorical hues, validated for adjacent-pair separation on light surfaces. */
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const;

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

/* ------------------------------------------------------------------ *
 * KPI cards
 * ------------------------------------------------------------------ */

/**
 * The KPI row above the meters.
 *
 * @example
 * ```ts
 * html`<lia-stat-row .items=${statCards}></lia-stat-row>`;
 * ```
 */
export const statCards: StatCardData[] = [
  {
    label: 'Requests today',
    value: '4.18 M',
    icon: 'fa-solid fa-bolt',
    variant: 'primary',
    delta: '+6.2%',
    deltaVariant: 'success',
    description: 'vs. the same hour yesterday',
  },
  {
    label: 'Error rate',
    value: '0.42%',
    icon: 'fa-solid fa-triangle-exclamation',
    variant: 'warning',
    delta: '+0.11 pp',
    deltaVariant: 'danger',
    description: 'mostly 502s from the edge cache',
  },
  {
    label: 'p95 latency',
    value: '184 ms',
    icon: 'fa-solid fa-stopwatch',
    variant: 'info',
    delta: '−12 ms',
    deltaVariant: 'success',
  },
  {
    label: 'Open incidents',
    value: 2,
    icon: 'fa-solid fa-fire',
    variant: 'danger',
    description: 'one at severity 2',
    href: '#/dashboard/activity',
  },
  {
    label: 'Deploys this week',
    value: 37,
    icon: 'fa-solid fa-rocket',
    variant: 'success',
    delta: '+9',
    deltaVariant: 'success',
  },
];

/* ------------------------------------------------------------------ *
 * Info panels
 * ------------------------------------------------------------------ */

/** Key/value rows of the "environment" panel. */
export const systemInfo: InfoEntry[] = [
  { label: 'Console version', value: '4.12.0', icon: 'fa-solid fa-tag' },
  { label: 'Control plane', value: 'orbit-eu-central-1', icon: 'fa-solid fa-server' },
  { label: 'Runtime', html: 'Node <code>22.14.0</code> · V8 <code>12.4</code>' },
  { label: 'Database', value: 'PostgreSQL 16.3' },
  { label: 'Scheduler', value: 'running', badge: { text: 'healthy', variant: 'success' } },
  {
    label: 'Message broker',
    value: 'degraded',
    badge: { text: '1 replica down', variant: 'warning' },
    variant: 'warning',
  },
  { label: 'Uptime', value: '41 days, 6 hours' },
  {
    label: 'Support bundle',
    value: 'Download the latest bundle',
    href: '#/editors/logs',
    icon: 'fa-solid fa-file-arrow-down',
  },
];

/** Key/value rows of the "account" panel. */
export const accountInfo: InfoEntry[] = [
  { label: 'Organisation', value: 'Northwind Collective' },
  { label: 'Plan', value: 'Scale', badge: { text: 'annual', variant: 'info' } },
  { label: 'Account id', value: 'acct_01J9ZK4M2QF3' },
  { label: 'Primary contact', value: 'amara.okonkwo@example.org', href: 'mailto:amara.okonkwo@example.org' },
  { label: 'Renews on', value: '1 March 2027' },
  { label: 'Seats', value: '60 of 80 used' },
];

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

/** Recent events, newest first. */
export const recentActivity: ActivityItem[] = [
  {
    id: 'a1',
    icon: 'fa-solid fa-rocket',
    text: 'Released <strong>checkout</strong> v2.31.0 to production',
    html: 'Released <strong>checkout</strong> v2.31.0 to production',
    meta: '3 min ago',
    metaVariant: 'success',
    description: 'by j.lindqvist · rollout 100%',
  },
  {
    id: 'a2',
    icon: 'fa-solid fa-triangle-exclamation',
    text: 'Alert "edge 5xx rate" fired',
    meta: '18 min ago',
    metaVariant: 'danger',
    variant: 'danger',
    description: 'threshold 0.5% exceeded for 5 minutes',
    href: '#/dashboard/activity',
  },
  {
    id: 'a3',
    icon: 'fa-solid fa-user-plus',
    text: 'Invited noor.haddad@example.org as Developer',
    meta: '1 h ago',
  },
  {
    id: 'a4',
    icon: 'fa-solid fa-key',
    text: 'Access key key_9f21c7 was revoked',
    meta: '2 h ago',
    metaVariant: 'warning',
  },
  {
    id: 'a5',
    icon: 'fa-solid fa-database',
    text: 'Nightly backup completed',
    meta: '02:15',
    metaVariant: 'secondary',
    description: '1.61 TiB written, 12 min 40 s',
  },
  {
    id: 'a6',
    icon: 'fa-solid fa-shield-halved',
    text: 'Certificate for svc.example.net renewed',
    meta: 'yesterday',
  },
];

/** Things still to do — the "outstanding tasks" flavour of the same list. */
export const pendingTasks: ActivityItem[] = [
  {
    id: 't1',
    icon: 'fa-solid fa-certificate',
    text: '3 certificates expire within 14 days',
    meta: 'act now',
    metaVariant: 'warning',
    href: '#/table/data-table',
  },
  {
    id: 't2',
    icon: 'fa-solid fa-user-shield',
    text: '11 members have not enrolled in two-factor authentication',
    meta: 'security',
    metaVariant: 'danger',
  },
  {
    id: 't3',
    icon: 'fa-solid fa-box-archive',
    text: '2 projects are ready to be archived',
    meta: 'housekeeping',
    metaVariant: 'secondary',
  },
  {
    id: 't4',
    icon: 'fa-solid fa-arrows-rotate',
    text: 'A minor update is available',
    meta: '4.12.1',
    metaVariant: 'info',
    href: '#/settings/update',
  },
];

/** Scheduled jobs and when they last ran. */
export const scheduledJobs: ActivityItem[] = [
  { id: 'j1', icon: 'fa-solid fa-database', text: 'Backup', meta: '02:15', metaVariant: 'primary' },
  { id: 'j2', icon: 'fa-solid fa-broom', text: 'Log rotation', meta: '03:00', metaVariant: 'primary' },
  { id: 'j3', icon: 'fa-solid fa-envelope', text: 'Digest email', meta: '07:30', metaVariant: 'primary' },
  { id: 'j4', icon: 'fa-solid fa-certificate', text: 'Certificate renewal', meta: 'never run', metaVariant: 'secondary' },
  { id: 'j5', icon: 'fa-solid fa-chart-line', text: 'Usage rollup', meta: 'failed', metaVariant: 'danger', variant: 'danger' },
];

/* ------------------------------------------------------------------ *
 * Charts
 * ------------------------------------------------------------------ */

/** The last twelve months, as axis labels. */
export const monthLabels: string[] = [
  'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
];

const inbound = [2.1, 2.4, 2.2, 2.8, 3.4, 2.9, 3.1, 3.6, 3.9, 4.2, 4.0, 4.4];
const outbound = [5.4, 5.9, 5.6, 6.8, 8.1, 7.2, 7.6, 8.4, 9.1, 9.8, 9.4, 10.2];

/**
 * A two-series bar chart: inbound and outbound transfer per month, in TiB.
 *
 * @example
 * ```ts
 * html`<lia-chart type="bar" .data=${transferChart} height="18rem"></lia-chart>`;
 * ```
 */
export const transferChart: ChartData = {
  labels: monthLabels,
  datasets: [
    {
      label: 'Inbound (TiB)',
      data: inbound,
      backgroundColor: PALETTE[0],
      borderColor: PALETTE[0],
      borderWidth: 1,
    },
    {
      label: 'Outbound (TiB)',
      data: outbound,
      backgroundColor: PALETTE[1],
      borderColor: PALETTE[1],
      borderWidth: 1,
    },
  ],
};

/** The same figures as a line chart, for the "same data, other mark" example. */
export const transferLineChart: ChartData = {
  labels: monthLabels,
  datasets: [
    {
      label: 'Inbound (TiB)',
      data: inbound,
      borderColor: PALETTE[0],
      backgroundColor: 'transparent',
      tension: 0.25,
      pointRadius: 2,
    },
    {
      label: 'Outbound (TiB)',
      data: outbound,
      borderColor: PALETTE[1],
      backgroundColor: 'transparent',
      tension: 0.25,
      pointRadius: 2,
    },
  ],
};

/** A composition chart — where the storage on the dashboard sits. */
export const storageBreakdownChart: ChartData = {
  labels: ['Volumes', 'Object buckets', 'Snapshots', 'Backups', 'Free'],
  datasets: [
    {
      label: 'GiB',
      data: [780, 402, 291, 182, 393],
      backgroundColor: [
        PALETTE[0],
        PALETTE[1],
        PALETTE[2],
        PALETTE[3],
        PALETTE[4],
      ],
      borderWidth: 0,
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Welcome copy
 * ------------------------------------------------------------------ */

/** Welcome copy for the full-page dashboard hint, kept here so the page stays declarative. */
export const welcomeCopy = {
  heading: 'Good morning, Amara',
  message:
    'Everything is running. Two alerts fired overnight and are already acknowledged; the nightly backup wrote 1.61 TiB.',
  ctaLabel: 'Review the incidents',
  ctaHref: '#/dashboard/activity',
} as const;

/** Byte figures used by the "formatting" examples. */
export const byteSamples: number[] = [0, 512, 64 * 1024, 5 * MIB, 1.5 * GIB, 2048 * GIB, -1];
