/**
 * A second dataset with a deliberately different shape from `users.ts`.
 *
 * Where the member list is wide and renderer-heavy, this one is narrow, has a
 * grouped/hierarchical flavour (every project belongs to a portfolio), carries
 * a *custom* column renderer and a nested value read through a dotted key —
 * the two `TableColumn` features the member list does not use.
 */

import { html } from 'lit';
import type {
  ActionDescriptor,
  BadgeCellValue,
  ProgressCellValue,
  SelectOption,
  TableColumn,
  TableListing,
  TreeNode,
  Variant,
} from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** Delivery state of a project. */
export type ProjectStage = 'discovery' | 'building' | 'review' | 'live' | 'paused';

/** Traffic-light health of a project. */
export type ProjectHealth = 'good' | 'at-risk' | 'blocked';

/** One row of {@link demoProjects}. */
export interface DemoProject {
  id: string;
  /** Human-readable name. */
  name: string;
  /** Which portfolio the project rolls up to. */
  portfolio: string;
  /** Nested value, read by the table through the dotted key `lead.name`. */
  lead: { name: string; email: string };
  stage: ProjectStage;
  health: ProjectHealth;
  /** `badges` renderer. */
  environments: BadgeCellValue[];
  /** `progressbar` renderer. */
  completion: ProgressCellValue;
  /** Plain number, formatted by a custom renderer. */
  budget: number;
  spent: number;
  /** ISO date. */
  due: string;
  /** Number of open review comments. */
  comments: number;
  archived: boolean;
}

const STAGE_META: Record<ProjectStage, { label: string; variant: Variant }> = {
  discovery: { label: 'Discovery', variant: 'secondary' },
  building: { label: 'Building', variant: 'primary' },
  review: { label: 'In review', variant: 'info' },
  live: { label: 'Live', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
};

const HEALTH_META: Record<ProjectHealth, { label: string; variant: Variant; icon: string }> = {
  good: { label: 'On track', variant: 'success', icon: 'fa-solid fa-circle-check' },
  'at-risk': { label: 'At risk', variant: 'warning', icon: 'fa-solid fa-triangle-exclamation' },
  blocked: { label: 'Blocked', variant: 'danger', icon: 'fa-solid fa-circle-exclamation' },
};

interface Seed {
  name: string;
  portfolio: string;
  lead: string;
  stage: ProjectStage;
  health: ProjectHealth;
  environments: string[];
  percent: number;
  budget: number;
  spent: number;
  due: string;
  comments: number;
  archived?: boolean;
}

const SEEDS: Seed[] = [
  { name: 'Ledger rewrite', portfolio: 'Payments', lead: 'Amara Okonkwo', stage: 'building', health: 'good', environments: ['dev', 'staging'], percent: 62, budget: 240_000, spent: 141_500, due: '2026-10-15', comments: 4 },
  { name: 'Checkout redesign', portfolio: 'Payments', lead: 'Sofia Marquez', stage: 'review', health: 'at-risk', environments: ['staging'], percent: 88, budget: 120_000, spent: 118_900, due: '2026-08-30', comments: 17 },
  { name: 'Fraud signals', portfolio: 'Payments', lead: 'Idris Rahman', stage: 'discovery', health: 'good', environments: [], percent: 12, budget: 90_000, spent: 8_200, due: '2027-02-01', comments: 0 },
  { name: 'Single sign-on', portfolio: 'Identity', lead: 'Jonas Lindqvist', stage: 'live', health: 'good', environments: ['dev', 'staging', 'prod'], percent: 100, budget: 180_000, spent: 174_300, due: '2026-05-04', comments: 1 },
  { name: 'Passkey rollout', portfolio: 'Identity', lead: 'Noor Haddad', stage: 'building', health: 'good', environments: ['dev'], percent: 41, budget: 75_000, spent: 26_100, due: '2026-11-20', comments: 6 },
  { name: 'Directory sync', portfolio: 'Identity', lead: 'Petra Novak', stage: 'paused', health: 'blocked', environments: ['dev'], percent: 33, budget: 60_000, spent: 44_800, due: '2026-09-09', comments: 22 },
  { name: 'Event pipeline', portfolio: 'Data', lead: 'Wei Chen', stage: 'building', health: 'at-risk', environments: ['dev', 'staging'], percent: 57, budget: 310_000, spent: 205_000, due: '2026-12-01', comments: 9 },
  { name: 'Warehouse migration', portfolio: 'Data', lead: 'Mateo Silva', stage: 'review', health: 'good', environments: ['staging'], percent: 91, budget: 420_000, spent: 388_000, due: '2026-08-12', comments: 3 },
  { name: 'Metrics catalogue', portfolio: 'Data', lead: 'Hana Tanaka', stage: 'discovery', health: 'good', environments: [], percent: 5, budget: 45_000, spent: 1_100, due: '2027-04-30', comments: 0 },
  { name: 'Edge cache', portfolio: 'Edge', lead: 'Tomás Ferreira', stage: 'live', health: 'good', environments: ['prod'], percent: 100, budget: 150_000, spent: 139_400, due: '2026-03-18', comments: 0 },
  { name: 'Regional failover', portfolio: 'Edge', lead: 'Leila Habib', stage: 'building', health: 'blocked', environments: ['dev', 'staging'], percent: 46, budget: 260_000, spent: 198_700, due: '2026-10-02', comments: 31 },
  { name: 'Image pipeline', portfolio: 'Edge', lead: 'Kwame Mensah', stage: 'review', health: 'good', environments: ['staging'], percent: 79, budget: 95_000, spent: 71_000, due: '2026-09-25', comments: 5 },
  { name: 'Incident console', portfolio: 'Platform', lead: 'Ingrid Dahl', stage: 'building', health: 'good', environments: ['dev'], percent: 68, budget: 130_000, spent: 84_600, due: '2026-11-06', comments: 8 },
  { name: 'Policy engine', portfolio: 'Platform', lead: 'Rafael Costa', stage: 'discovery', health: 'at-risk', environments: [], percent: 18, budget: 210_000, spent: 39_500, due: '2027-01-15', comments: 2 },
  { name: 'Build cache', portfolio: 'Platform', lead: 'Yuki Yamamoto', stage: 'live', health: 'good', environments: ['dev', 'prod'], percent: 100, budget: 70_000, spent: 66_200, due: '2026-02-27', comments: 0 },
  { name: 'Runtime upgrade', portfolio: 'Platform', lead: 'Anouk de Vries', stage: 'paused', health: 'at-risk', environments: ['dev'], percent: 24, budget: 88_000, spent: 31_900, due: '2026-12-19', comments: 11 },
  { name: 'Ticket triage', portfolio: 'Support', lead: 'Dmitri Volkov', stage: 'building', health: 'good', environments: ['staging'], percent: 52, budget: 55_000, spent: 27_400, due: '2026-10-28', comments: 7 },
  { name: 'Knowledge base', portfolio: 'Support', lead: 'Chiara Ricci', stage: 'review', health: 'good', environments: ['staging'], percent: 84, budget: 40_000, spent: 33_800, due: '2026-08-21', comments: 2 },
  { name: 'Chat handover', portfolio: 'Support', lead: 'Omar Aziz', stage: 'live', health: 'good', environments: ['prod'], percent: 100, budget: 62_000, spent: 61_100, due: '2026-01-30', comments: 0, archived: true },
  { name: 'Secret rotation', portfolio: 'Security', lead: 'Freya Berg', stage: 'building', health: 'at-risk', environments: ['dev', 'staging'], percent: 71, budget: 145_000, spent: 122_000, due: '2026-09-30', comments: 13 },
  { name: 'Audit trail', portfolio: 'Security', lead: 'Bilal Farouk', stage: 'review', health: 'good', environments: ['staging'], percent: 93, budget: 98_000, spent: 90_400, due: '2026-08-08', comments: 1 },
  { name: 'Threat feed', portfolio: 'Security', lead: 'Sanne Bakker', stage: 'discovery', health: 'good', environments: [], percent: 9, budget: 52_000, spent: 3_600, due: '2027-03-12', comments: 0 },
  { name: 'Access reviews', portfolio: 'Security', lead: 'Ravi Iyer', stage: 'paused', health: 'blocked', environments: ['dev'], percent: 38, budget: 76_000, spent: 51_200, due: '2026-11-14', comments: 19 },
  { name: 'Legacy shutdown', portfolio: 'Platform', lead: 'Marta Kowalska', stage: 'live', health: 'good', environments: ['prod'], percent: 100, budget: 34_000, spent: 30_900, due: '2025-12-05', comments: 0, archived: true },
];

const ENVIRONMENT_VARIANT: Record<string, Variant> = {
  dev: 'secondary',
  staging: 'info',
  prod: 'success',
};

function progressFor(seed: Seed): ProgressCellValue {
  const overspent = seed.spent > seed.budget * 0.95 && seed.percent < 95;
  return {
    percent: seed.percent,
    text: `${seed.percent}%`,
    style: overspent ? 'bg-warning' : seed.health === 'blocked' ? 'bg-danger' : '',
    infotext: overspent ? 'Nearly all of the budget is spent with work outstanding.' : undefined,
  };
}

/** 24 rows, hand-written so the numbers tell a plausible story. */
export const demoProjects: DemoProject[] = SEEDS.map((seed, index) => ({
  id: `PRJ-${String(index + 1).padStart(3, '0')}`,
  name: seed.name,
  portfolio: seed.portfolio,
  lead: {
    name: seed.lead,
    email: `${seed.lead.split(' ')[0].toLowerCase()}@example.org`,
  },
  stage: seed.stage,
  health: seed.health,
  environments: seed.environments.map((env) => ({
    text: env,
    variant: ENVIRONMENT_VARIANT[env] ?? 'secondary',
  })),
  completion: progressFor(seed),
  budget: seed.budget,
  spent: seed.spent,
  due: seed.due,
  comments: seed.comments,
  archived: seed.archived === true,
}));

/* ------------------------------------------------------------------ *
 * Columns
 * ------------------------------------------------------------------ */

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * Columns for the project listing.
 *
 * Two things the member list does not show:
 * `lead.name` reads a **nested** value through a dotted key, and `budget` uses
 * a **custom** `render()` that draws two numbers and a bar in one cell.
 *
 * @example
 * ```ts
 * html`<lia-data-table .columns=${projectColumns} .rows=${demoProjects}></lia-data-table>`;
 * ```
 */
export const projectColumns: TableColumn<DemoProject>[] = [
  { key: 'id', label: 'Ref', renderer: 'code', sortable: true, class: 'text-nowrap' },
  { key: 'name', label: 'Project', sortable: true, searchable: true, defaultSearchField: true, locked: true },
  { key: 'portfolio', label: 'Portfolio', sortable: true, searchable: true },
  { key: 'lead.name', label: 'Lead', sortable: true, searchable: true },
  {
    key: 'stage',
    label: 'Stage',
    sortable: true,
    render: (row) => {
      const meta = STAGE_META[row.stage];
      return html`<span class="badge text-bg-${meta.variant}">${meta.label}</span>`;
    },
  },
  {
    key: 'health',
    label: 'Health',
    sortable: true,
    render: (row) => {
      const meta = HEALTH_META[row.health];
      return html`<span class="text-${meta.variant} d-inline-flex align-items-center gap-1">
        <i class="${meta.icon}" aria-hidden="true"></i>${meta.label}
      </span>`;
    },
  },
  { key: 'environments', label: 'Environments', renderer: 'badges' },
  { key: 'completion', label: 'Completion', renderer: 'progressbar', class: 'lia-col-progress' },
  {
    key: 'budget',
    label: 'Budget',
    sortable: true,
    class: 'text-end text-nowrap',
    render: (row) => {
      const share = Math.min(100, Math.round((row.spent / row.budget) * 100));
      return html`<span class="d-block">${money.format(row.spent)}</span>
        <small class="text-body-secondary">of ${money.format(row.budget)} · ${share}%</small>`;
    },
  },
  { key: 'due', label: 'Due', renderer: 'date', sortable: true },
  { key: 'comments', label: 'Comments', sortable: true, class: 'text-end', checked: false },
];

/** Per-row toolbar for the project listing. */
export function projectRowActions(project: DemoProject): ActionDescriptor[] {
  return [
    { id: 'open', icon: 'fa-solid fa-folder-open', title: `Open ${project.name}`, variant: 'outline-secondary' },
    { id: 'report', icon: 'fa-solid fa-file-lines', title: 'Status report', variant: 'outline-secondary' },
    {
      id: 'archive',
      icon: 'fa-solid fa-box-archive',
      title: project.archived ? 'Restore this project' : 'Archive this project',
      variant: 'outline-secondary',
      confirm: project.archived
        ? undefined
        : {
            title: 'Archive project',
            message: `${project.name} becomes read-only for everyone.`,
            confirmLabel: 'Archive',
            variant: 'warning',
          },
    },
  ];
}

/** A ready-made listing over every project. */
export function projectListing(rows: DemoProject[] = demoProjects): TableListing<DemoProject> {
  return {
    id: 'projects',
    columns: projectColumns,
    rows,
    rowKey: (row) => row.id,
    rowClass: (row) => (row.archived ? 'deactivated' : undefined),
    rowActions: projectRowActions,
    sort: { field: 'due', order: 'asc' },
    emptyTitle: 'No projects',
    emptyMessage: 'Nothing is being delivered in this portfolio yet.',
  };
}

/** Quick-filter choices for the stage column. */
export const projectStageOptions: SelectOption[] = (
  Object.keys(STAGE_META) as ProjectStage[]
).map((stage) => ({ value: stage, label: STAGE_META[stage].label }));

/** Quick-filter choices for the portfolio column. */
export const projectPortfolioOptions: SelectOption[] = [
  ...new Set(demoProjects.map((project) => project.portfolio)),
]
  .sort()
  .map((portfolio) => ({ value: portfolio, label: portfolio }));

/* ------------------------------------------------------------------ *
 * Hierarchy
 * ------------------------------------------------------------------ */

/**
 * The same projects as a tree, grouped by portfolio — the input of
 * `<lia-file-tree>`.
 *
 * @example
 * ```ts
 * html`<lia-file-tree .nodes=${projectTree} filterable></lia-file-tree>`;
 * ```
 */
export const projectTree: TreeNode[] = [
  ...new Set(demoProjects.map((project) => project.portfolio)),
]
  .sort()
  .map((portfolio) => {
    const children = demoProjects.filter((project) => project.portfolio === portfolio);
    return {
      id: `portfolio:${portfolio}`,
      label: portfolio,
      icon: 'fa-solid fa-folder-tree',
      meta: `${children.length} projects`,
      children: children.map((project) => ({
        id: project.id,
        label: project.name,
        icon: 'fa-regular fa-file-lines',
        meta: `${project.completion.percent}%`,
        badge:
          project.health === 'good'
            ? undefined
            : {
                text: HEALTH_META[project.health].label,
                variant: HEALTH_META[project.health].variant,
              },
        disabled: project.archived,
      })),
    };
  });
