/**
 * The demo's primary dataset: 60 "members" of a fictional operations console.
 *
 * It exists to exercise the table layer, so every column deliberately lands on
 * a different {@link CellRenderer}: plain text, trusted HTML, booleans with and
 * without an info suffix, a progress meter, a link, a single badge, a badge
 * list, byte sizes, dates, date-times, monospace code, a two-line
 * domain/SAN pair and a row-action toolbar.
 *
 * Everything is generated from a seeded pseudo-random sequence, so the rows are
 * identical on every reload — screenshots and manual comparisons stay stable.
 */

import type {
  ActionDescriptor,
  BadgeCellValue,
  BooleanWithInfoCellValue,
  DomainWithSanCellValue,
  LinkCellValue,
  ProgressCellValue,
  SelectOption,
  TableColumn,
  TableListing,
  Variant,
} from '@liasoft/lit-ui';
import { formatBytes, usagePercent, usageVariant } from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** How a member may sign in. */
export type DemoUserRole = 'owner' | 'operator' | 'developer' | 'auditor';

/** Where a member's account currently stands. */
export type DemoUserStatus = 'active' | 'invited' | 'suspended' | 'locked';

/** One row of {@link demoUsers}. */
export interface DemoUser {
  id: number;
  /** Display name. */
  name: string;
  /** Sign-in identifier. */
  loginname: string;
  email: string;
  /** `link` renderer — a deep link to the member's page. */
  profile: LinkCellValue;
  /** `badge` renderer. */
  role: BadgeCellValue;
  /** `badges` renderer — zero to three chips. */
  tags: BadgeCellValue[];
  /** `text` renderer, but also the quick-filter key. */
  status: DemoUserStatus;
  team: string;
  location: string;
  /** `boolean` renderer. */
  active: boolean;
  /** `booleanWithInfo` renderer — the tick plus the method used. */
  mfa: BooleanWithInfoCellValue;
  /** `progressbar` renderer. */
  storage: ProgressCellValue;
  /** `bytes` renderer. Negative means unlimited. */
  quota: number;
  /** `bytes` renderer. */
  transfer: number;
  /** `date` renderer — an ISO date string. */
  created: string;
  /** `datetime` renderer — epoch seconds, `0` for "never". */
  lastSeen: number;
  /** `code` renderer. */
  apiKey: string;
  /** `domainWithSan` renderer. */
  endpoint: DomainWithSanCellValue;
  /** `html` renderer — trusted markup owned by the application. */
  note: string;
  /** Number of open items, used for a sortable numeric column. */
  openIssues: number;
}

/* ------------------------------------------------------------------ *
 * Deterministic generation
 * ------------------------------------------------------------------ */

/** A 32-bit linear congruential generator — same sequence on every reload. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const FIRST_NAMES = [
  'Amara', 'Jonas', 'Wei', 'Sofia', 'Idris', 'Noor', 'Petra', 'Mateo', 'Hana', 'Tomás',
  'Leila', 'Kwame', 'Ingrid', 'Rafael', 'Yuki', 'Anouk', 'Dmitri', 'Chiara', 'Omar', 'Freya',
  'Bilal', 'Sanne', 'Ravi', 'Marta', 'Kofi', 'Elena', 'Tariq', 'Aiko', 'Lucas', 'Nadia',
];

const LAST_NAMES = [
  'Okonkwo', 'Lindqvist', 'Chen', 'Marquez', 'Rahman', 'Haddad', 'Novak', 'Silva', 'Tanaka', 'Ferreira',
  'Habib', 'Mensah', 'Dahl', 'Costa', 'Yamamoto', 'de Vries', 'Volkov', 'Ricci', 'Aziz', 'Berg',
  'Farouk', 'Bakker', 'Iyer', 'Kowalska', 'Boateng', 'Petrova', 'Nasser', 'Sato', 'Moreau', 'Karim',
];

const TEAMS = ['Platform', 'Payments', 'Identity', 'Data', 'Edge', 'Support', 'Security'];

const LOCATIONS = [
  'Amsterdam', 'Berlin', 'Lagos', 'Lisbon', 'Montréal', 'Nairobi', 'Osaka', 'São Paulo',
  'Stockholm', 'Singapore', 'Toronto', 'Warsaw',
];

const ROLES: Array<{ value: DemoUserRole; label: string; variant: Variant; icon: string }> = [
  { value: 'owner', label: 'Owner', variant: 'primary', icon: 'fa-solid fa-crown' },
  { value: 'operator', label: 'Operator', variant: 'info', icon: 'fa-solid fa-user-gear' },
  { value: 'developer', label: 'Developer', variant: 'secondary', icon: 'fa-solid fa-code' },
  { value: 'auditor', label: 'Auditor', variant: 'dark', icon: 'fa-solid fa-magnifying-glass' },
];

const TAGS: BadgeCellValue[] = [
  { text: 'on-call', variant: 'warning', icon: 'fa-solid fa-pager' },
  { text: 'billing', variant: 'success' },
  { text: 'read-only', variant: 'secondary' },
  { text: 'external', variant: 'dark' },
  { text: 'new', variant: 'info' },
];

const MFA_METHODS = ['authenticator app', 'security key', 'recovery codes'];

const NOTES = [
  '',
  'Escalation contact for <strong>Edge</strong>.',
  'Account is <em>pending</em> a security review.',
  'Migrated from the legacy directory on <time>2024-11-02</time>.',
  'Uses a <code>service</code> account for automation.',
];

const STATUSES: DemoUserStatus[] = ['active', 'active', 'active', 'active', 'invited', 'suspended', 'locked'];

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hex(length: number, random: () => number): string {
  let out = '';
  while (out.length < length) out += Math.floor(random() * 16).toString(16);
  return out.slice(0, length);
}

const NOW = Date.UTC(2026, 6, 1, 9, 30, 0);

function buildUsers(count: number): DemoUser[] {
  const random = seeded(0x5eed_1a50);
  const users: DemoUser[] = [];

  for (let index = 0; index < count; index += 1) {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const loginname = `${first[0].toLowerCase()}.${slugify(last)}${index > 29 ? index : ''}`;
    const role = index === 0 ? ROLES[0] : pick(ROLES.slice(1), random);
    const status = index === 0 ? 'active' : pick(STATUSES, random);
    const unlimited = index % 17 === 0;
    const quota = unlimited ? -1 : (2 + Math.floor(random() * 30)) * 1024 ** 3;
    const used = unlimited
      ? Math.floor(random() * 40) * 1024 ** 3
      : Math.floor(quota * (0.05 + random() * 1.05));
    const percent = unlimited ? 0 : usagePercent(used, quota);
    const tagCount = Math.floor(random() * 3);
    const created = new Date(NOW - Math.floor(random() * 900) * 86_400_000);
    const seenDaysAgo = Math.floor(random() * 120);

    users.push({
      id: 1000 + index,
      name,
      loginname,
      email: `${loginname}@example.org`,
      profile: {
        href: `#/orbit/members/${1000 + index}`,
        text: loginname,
        icon: 'fa-solid fa-arrow-up-right-from-square',
        title: `Open ${name}`,
      },
      role: { text: role.label, variant: role.variant, icon: role.icon },
      tags: [...TAGS]
        .sort(() => random() - 0.5)
        .slice(0, tagCount)
        .map((tag) => ({ ...tag })),
      status,
      team: pick(TEAMS, random),
      location: pick(LOCATIONS, random),
      active: status === 'active',
      mfa:
        random() > 0.35
          ? { checked: true, info: pick(MFA_METHODS, random) }
          : { checked: false, info: 'not enrolled' },
      storage: {
        percent: unlimited ? 8 : percent,
        text: unlimited
          ? `${formatBytes(used)} / ∞`
          : `${formatBytes(used)} / ${formatBytes(quota)}`,
        style: usageVariant(percent, unlimited),
        infotext:
          percent >= 90
            ? 'Above the soft limit — uploads will start failing soon.'
            : undefined,
      },
      quota,
      transfer: Math.floor(random() * 700) * 1024 ** 2,
      created: created.toISOString().slice(0, 10),
      lastSeen: status === 'invited' ? 0 : Math.floor((NOW - seenDaysAgo * 86_400_000) / 1000),
      apiKey: `key_${hex(24, random)}`,
      endpoint: {
        domain: `${loginname}.svc.example.net`,
        san: index % 4 === 0 ? `alt-${loginname}.example.net, ${loginname}.example.com` : undefined,
      },
      note: pick(NOTES, random),
      openIssues: Math.floor(random() * 12),
    });
  }

  return users;
}

/** 60 rows, stable across reloads. */
export const demoUsers: DemoUser[] = buildUsers(60);

/** The first `count` rows — handy for examples that must stay short. */
export function someUsers(count = 8): DemoUser[] {
  return demoUsers.slice(0, count);
}

/** Look one up by id. */
export function findUser(id: number): DemoUser | undefined {
  return demoUsers.find((user) => user.id === id);
}

/* ------------------------------------------------------------------ *
 * Columns
 * ------------------------------------------------------------------ */

/**
 * The full column set — one column per {@link CellRenderer} the kit ships.
 *
 * `checked: false` marks the columns the column manager starts with hidden, so
 * the default table is readable and the manager has something to reveal.
 *
 * @example
 * ```ts
 * html`<lia-table .listing=${{ id: 'members', columns: userColumns, rows: demoUsers }}></lia-table>`;
 * ```
 */
export const userColumns: TableColumn<DemoUser>[] = [
  { key: 'name', label: 'Name', sortable: true, searchable: true, defaultSearchField: true, locked: true },
  { key: 'profile', label: 'Account', renderer: 'link', searchable: false },
  { key: 'email', label: 'Email', sortable: true, searchable: true, checked: false },
  { key: 'role', label: 'Role', renderer: 'badge', sortable: true },
  { key: 'tags', label: 'Tags', renderer: 'badges' },
  { key: 'team', label: 'Team', sortable: true, searchable: true },
  { key: 'location', label: 'Location', sortable: true, searchable: true, checked: false },
  { key: 'active', label: 'Enabled', renderer: 'boolean', class: 'text-center' },
  { key: 'mfa', label: 'Two-factor', renderer: 'booleanWithInfo' },
  { key: 'storage', label: 'Storage', renderer: 'progressbar', class: 'lia-col-progress' },
  { key: 'quota', label: 'Quota', renderer: 'bytes', sortable: true, class: 'text-end' },
  { key: 'transfer', label: 'Transfer', renderer: 'bytes', sortable: true, class: 'text-end', checked: false },
  { key: 'openIssues', label: 'Open', sortable: true, class: 'text-end', checked: false },
  { key: 'created', label: 'Created', renderer: 'date', sortable: true },
  { key: 'lastSeen', label: 'Last seen', renderer: 'datetime', sortable: true },
  { key: 'apiKey', label: 'Key', renderer: 'code', checked: false },
  { key: 'endpoint', label: 'Endpoint', renderer: 'domainWithSan', checked: false },
  { key: 'note', label: 'Note', renderer: 'html', checked: false },
];

/** A four-column subset, for examples where the full table would drown the point. */
export const userColumnsCompact: TableColumn<DemoUser>[] = [
  { key: 'name', label: 'Name', sortable: true, searchable: true, defaultSearchField: true },
  { key: 'role', label: 'Role', renderer: 'badge' },
  { key: 'active', label: 'Enabled', renderer: 'boolean', class: 'text-center' },
  { key: 'storage', label: 'Storage', renderer: 'progressbar' },
];

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/** The per-row toolbar: open, impersonate, disable, delete. */
export function userRowActions(user: DemoUser): ActionDescriptor[] {
  return [
    {
      id: 'edit',
      icon: 'fa-solid fa-pen-to-square',
      title: `Edit ${user.name}`,
      variant: 'outline-secondary',
      data: { id: user.id },
    },
    {
      id: 'impersonate',
      icon: 'fa-solid fa-user-secret',
      title: `Sign in as ${user.name}`,
      variant: 'outline-secondary',
      disabled: !user.active,
      data: { id: user.id },
    },
    {
      id: 'toggle',
      icon: user.active ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off',
      title: user.active ? 'Disable this account' : 'Enable this account',
      variant: 'outline-secondary',
      data: { id: user.id },
    },
    {
      id: 'delete',
      icon: 'fa-solid fa-trash-can',
      title: `Remove ${user.name}`,
      variant: 'outline-danger',
      confirm: {
        title: 'Remove member',
        message: `${user.name} loses access immediately. This cannot be undone.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep',
        variant: 'danger',
      },
      data: { id: user.id },
    },
  ];
}

/** The bulk bar shown once rows are selected. */
export const userBulkActions: ActionDescriptor[] = [
  { id: 'enable', label: 'Enable', icon: 'fa-solid fa-circle-check', variant: 'outline-success', size: 'sm' },
  { id: 'disable', label: 'Disable', icon: 'fa-solid fa-circle-minus', variant: 'outline-secondary', size: 'sm' },
  { id: 'export', label: 'Export', icon: 'fa-solid fa-file-arrow-down', variant: 'outline-secondary', size: 'sm' },
  {
    id: 'delete',
    label: 'Remove',
    icon: 'fa-solid fa-trash-can',
    variant: 'outline-danger',
    size: 'sm',
    confirm: {
      title: 'Remove the selected members',
      message: 'Every selected account loses access immediately.',
      confirmLabel: 'Remove them',
      variant: 'danger',
    },
  },
];

/** Toolbar of the members list page. */
export const userPageActions: ActionDescriptor[] = [
  { id: 'create', label: 'Add member', icon: 'fa-solid fa-plus-circle', variant: 'primary' },
  { id: 'invite', label: 'Invite by email', icon: 'fa-solid fa-envelope', variant: 'outline-secondary' },
  { id: 'import', label: 'Import', icon: 'fa-solid fa-file-import', variant: 'outline-secondary' },
];

/* ------------------------------------------------------------------ *
 * Listings & filters
 * ------------------------------------------------------------------ */

/** Options of {@link userListing}. */
export interface UserListingOptions {
  rows?: DemoUser[];
  columns?: TableColumn<DemoUser>[];
  page?: number;
  perPage?: number;
  selectable?: boolean;
  withActions?: boolean;
}

/**
 * A ready-made {@link TableListing} over the dataset, paged client-side.
 *
 * @example
 * ```ts
 * html`<lia-table .listing=${userListing({ perPage: 10, selectable: true })}></lia-table>`;
 * ```
 */
export function userListing(options: UserListingOptions = {}): TableListing<DemoUser> {
  const rows = options.rows ?? demoUsers;
  const perPage = options.perPage ?? 15;
  const page = options.page ?? 1;
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const slice = rows.slice((page - 1) * perPage, page * perPage);

  return {
    id: 'members',
    columns: options.columns ?? userColumns,
    rows: slice,
    rowKey: (row) => row.id,
    rowClass: (row) => (row.active ? undefined : 'deactivated'),
    rowActions: options.withActions === false ? undefined : userRowActions,
    selectable: options.selectable === true,
    bulkActions: options.selectable === true ? userBulkActions : undefined,
    pagination: { currentPage: page, lastPage, perPage, total: rows.length },
    sort: { field: 'name', order: 'asc' },
    emptyTitle: 'No members yet',
    emptyMessage: 'Invite someone to get started.',
  };
}

/** Quick-filter choices for the role column. */
export const userRoleOptions: SelectOption[] = ROLES.map((role) => ({
  value: role.value,
  label: role.label,
}));

/** Quick-filter choices for the status column. */
export const userStatusOptions: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'locked', label: 'Locked' },
];

/** Quick-filter choices for the team column. */
export const userTeamOptions: SelectOption[] = TEAMS.map((team) => ({ value: team, label: team }));

/** Filter the dataset the way the CRUD demo does. */
export function filterUsers(
  rows: readonly DemoUser[],
  filters: { text?: string; field?: string; role?: string; status?: string; team?: string }
): DemoUser[] {
  const needle = (filters.text ?? '').trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.role && row.role.text.toLowerCase() !== filters.role.toLowerCase()) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.team && row.team !== filters.team) return false;
    if (needle === '') return true;
    const field = filters.field;
    if (field && field !== 'all') {
      const value = (row as unknown as Record<string, unknown>)[field];
      return String(value ?? '').toLowerCase().includes(needle);
    }
    return `${row.name} ${row.loginname} ${row.email} ${row.team} ${row.location}`
      .toLowerCase()
      .includes(needle);
  });
}
