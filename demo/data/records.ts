/**
 * Fixtures for the repeatable-record editor, the credentials panel and the
 * hierarchical tree — the three editors that are neither a table nor a form.
 *
 * The record editor is deliberately shown with **two** schemas over the same
 * component: a routing table and a key/value environment. That is the point of
 * the element — one editor, any flat record shape.
 */

import type {
  CredentialEntry,
  NewCredential,
  RecordColumn,
  RecordRow,
  TreeNode,
} from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Routing records
 * ------------------------------------------------------------------ */

/** Choices of the routing table's `type` column. */
export const routeTypeOptions = [
  { value: 'A', label: 'A — address' },
  { value: 'AAAA', label: 'AAAA — IPv6 address' },
  { value: 'CNAME', label: 'CNAME — alias' },
  { value: 'TXT', label: 'TXT — text' },
  { value: 'SRV', label: 'SRV — service' },
];

/**
 * Schema of the routing editor: a required name, a typed value, a numeric
 * priority with bounds, and a boolean.
 *
 * @example
 * ```ts
 * html`<lia-record-editor .columns=${routeColumns} .records=${routeRecords}></lia-record-editor>`;
 * ```
 */
export const routeColumns: RecordColumn[] = [
  {
    key: 'name',
    label: 'Name',
    required: true,
    placeholder: 'api',
    width: '22%',
    hint: 'Relative to the zone, or @ for the zone itself.',
    validate: (value) =>
      typeof value === 'string' && /\s/.test(value) ? 'Names may not contain spaces.' : undefined,
  },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: routeTypeOptions,
    width: '9rem',
    defaultValue: 'A',
  },
  { key: 'value', label: 'Value', required: true, placeholder: '203.0.113.10', width: '30%' },
  { key: 'ttl', label: 'TTL', type: 'number', width: '7rem', min: 60, max: 86_400, step: 60, defaultValue: 3600 },
  { key: 'priority', label: 'Priority', type: 'number', width: '7rem', min: 0, max: 65_535 },
  { key: 'proxied', label: 'Proxied', type: 'checkbox', width: '6rem', defaultValue: false },
];

/** Eleven routing records, including one that fails its own validation. */
export const routeRecords: RecordRow[] = [
  { name: '@', type: 'A', value: '203.0.113.10', ttl: 3600, priority: null, proxied: true },
  { name: '@', type: 'AAAA', value: '2001:db8::10', ttl: 3600, priority: null, proxied: true },
  { name: 'www', type: 'CNAME', value: 'example.org.', ttl: 3600, priority: null, proxied: true },
  { name: 'api', type: 'A', value: '203.0.113.21', ttl: 300, priority: null, proxied: false },
  { name: 'api-eu', type: 'A', value: '203.0.113.22', ttl: 300, priority: null, proxied: false },
  { name: 'status', type: 'CNAME', value: 'status.example.net.', ttl: 3600, priority: null, proxied: false },
  { name: 'ingest', type: 'A', value: '203.0.113.40', ttl: 60, priority: null, proxied: false },
  { name: '_orbit._tcp', type: 'SRV', value: '10 5 8443 ingest.example.org.', ttl: 3600, priority: 10, proxied: false },
  { name: '@', type: 'TXT', value: 'v=spf1 include:_spf.example.net -all', ttl: 3600, priority: null, proxied: false },
  { name: 'verify', type: 'TXT', value: 'orbit-site-verification=2f8c41d0a97b', ttl: 300, priority: null, proxied: false },
  { name: 'bad name', type: 'A', value: '203.0.113.99', ttl: 3600, priority: null, proxied: false },
];

/* ------------------------------------------------------------------ *
 * Environment records
 * ------------------------------------------------------------------ */

/** A two-column key/value schema — the smallest useful record editor. */
export const environmentColumns: RecordColumn[] = [
  {
    key: 'key',
    label: 'Variable',
    required: true,
    placeholder: 'DATABASE_URL',
    width: '32%',
    validate: (value) =>
      typeof value === 'string' && value !== '' && !/^[A-Z_][A-Z0-9_]*$/.test(value)
        ? 'Use upper case, digits and underscores only.'
        : undefined,
  },
  { key: 'value', label: 'Value', required: true, placeholder: 'postgres://…' },
  { key: 'secret', label: 'Secret', type: 'checkbox', width: '6rem', defaultValue: false },
];

/** Seven environment variables. */
export const environmentRecords: RecordRow[] = [
  { key: 'NODE_ENV', value: 'production', secret: false },
  { key: 'LOG_LEVEL', value: 'info', secret: false },
  { key: 'DATABASE_URL', value: 'postgres://orbit@db.internal:5432/orbit', secret: true },
  { key: 'CACHE_URL', value: 'valkey://cache.internal:6379/0', secret: true },
  { key: 'REGION', value: 'eu-central', secret: false },
  { key: 'FEATURE_PASSKEYS', value: '1', secret: false },
  { key: 'WEBHOOK_SIGNING_KEY', value: 'whsec_2f8c41d0a97b4e15', secret: true },
];

/* ------------------------------------------------------------------ *
 * Credentials
 * ------------------------------------------------------------------ */

/** Issued credentials for `<lia-api-keys-panel>` — never carrying a secret. */
export const demoCredentials: CredentialEntry[] = [
  {
    id: 'key_9f21c7',
    label: 'CI pipeline',
    identifier: 'key_9f21c7…4e15',
    created: '2025-11-04T09:12:00Z',
    lastUsed: '2026-07-01T04:02:11Z',
    scopes: ['read', 'deploy'],
    allowedFrom: '198.51.100.0/24',
  },
  {
    id: 'key_2b71ef',
    label: 'Metrics exporter',
    identifier: 'key_2b71ef…8a30',
    created: '2026-01-19T14:41:00Z',
    lastUsed: '2026-07-01T04:44:52Z',
    scopes: ['read'],
  },
  {
    id: 'key_5c08aa',
    label: 'Terraform',
    identifier: 'key_5c08aa…c771',
    created: '2026-03-02T08:00:00Z',
    lastUsed: '2026-06-28T21:15:03Z',
    expires: '2026-09-02T08:00:00Z',
    scopes: ['read', 'write', 'deploy'],
    allowedFrom: '203.0.113.0/24, 2001:db8::/32',
  },
  {
    id: 'key_71dd90',
    label: 'Retired dashboard',
    identifier: 'key_71dd90…0b12',
    created: '2024-08-11T11:30:00Z',
    lastUsed: 0,
    scopes: ['read'],
    disabled: true,
  },
];

/** The one-time reveal shown right after a credential is created. */
export const freshCredential: NewCredential = {
  id: 'key_e4a913',
  label: 'Release bot',
  identifier: 'key_e4a913…9d47',
  secret: 'orbit_sk_e4a9139d47c2b6f80153ae7241bc95d0',
  note: 'Store it in the pipeline’s secret manager; the console will not show it again.',
};

/* ------------------------------------------------------------------ *
 * Tree
 * ------------------------------------------------------------------ */

/**
 * A configuration directory, for `<lia-file-tree>`.
 *
 * `var` is marked `expandable` with no children — the shape a lazily loaded
 * branch has before its contents arrive.
 */
export const configTree: TreeNode[] = [
  {
    id: '/etc',
    label: 'etc',
    children: [
      {
        id: '/etc/orbit',
        label: 'orbit',
        badge: { text: 'managed', variant: 'info' },
        children: [
          { id: '/etc/orbit/agent.toml', label: 'agent.toml', meta: '1.2 KiB' },
          { id: '/etc/orbit/telemetry.toml', label: 'telemetry.toml', meta: '640 B' },
          {
            id: '/etc/orbit/tls',
            label: 'tls',
            children: [
              { id: '/etc/orbit/tls/fullchain.pem', label: 'fullchain.pem', meta: '4.1 KiB' },
              { id: '/etc/orbit/tls/privkey.pem', label: 'privkey.pem', meta: '1.7 KiB', badge: { text: '0600', variant: 'warning' } },
            ],
          },
        ],
      },
      {
        id: '/etc/nginx',
        label: 'nginx',
        children: [
          { id: '/etc/nginx/nginx.conf', label: 'nginx.conf', meta: '2.8 KiB' },
          {
            id: '/etc/nginx/sites-available',
            label: 'sites-available',
            children: [
              { id: '/etc/nginx/sites-available/console.conf', label: 'console.conf', meta: '812 B' },
              { id: '/etc/nginx/sites-available/ingest.conf', label: 'ingest.conf', meta: '744 B' },
              { id: '/etc/nginx/sites-available/default', label: 'default', meta: '1.5 KiB', disabled: true },
            ],
          },
        ],
      },
      { id: '/etc/hosts', label: 'hosts', meta: '318 B' },
      { id: '/etc/resolv.conf', label: 'resolv.conf', meta: '92 B' },
    ],
  },
  {
    id: '/srv',
    label: 'srv',
    children: [
      {
        id: '/srv/orbit',
        label: 'orbit',
        children: [
          { id: '/srv/orbit/edge', label: 'edge', expandable: true },
          { id: '/srv/orbit/scheduler', label: 'scheduler', expandable: true },
          { id: '/srv/orbit/api', label: 'api', expandable: true },
        ],
      },
    ],
  },
  { id: '/var', label: 'var', expandable: true, meta: 'not loaded' },
];
