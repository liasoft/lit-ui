/**
 * A rich, deliberately fictional navigation tree for the layout demos.
 *
 * It is *not* the demo's own sidebar (that one is generated from the route
 * registry in `demo/nav.ts`); it exists to exercise every feature `NavItem`
 * has: nesting, per-entry icons, counter badges, "+" add-shortcuts, external
 * links, hidden entries and a pre-marked active row.
 *
 * The domain is a made-up "Orbit" operations console — generic enough that
 * nothing here reads as a port of any particular product.
 */

import type { FooterLink, NavItem, UserInfo, UserMenuItem } from '@liasoft/lit-ui';

/** Hrefs are inert: they point at paths the demo router does not know. */
const base = '#/orbit';

/**
 * The primary rail: five collapsible groups plus two standalone entries.
 *
 * @example
 * ```ts
 * html`<lia-sidebar .items=${demoNavItems}></lia-sidebar>`;
 * ```
 */
export const demoNavItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'fa-solid fa-gauge-high',
    url: `${base}/overview`,
    active: true,
  },
  {
    id: 'workloads',
    label: 'Workloads',
    icon: 'fa-solid fa-cubes',
    badge: { text: 24, variant: 'primary' },
    items: [
      {
        id: 'workloads.services',
        label: 'Services',
        icon: 'fa-solid fa-diagram-project',
        url: `${base}/services`,
        addUrl: `${base}/services/new`,
        badge: { text: 12 },
      },
      {
        id: 'workloads.jobs',
        label: 'Scheduled jobs',
        icon: 'fa-solid fa-clock-rotate-left',
        url: `${base}/jobs`,
        addUrl: `${base}/jobs/new`,
        badge: { text: 8 },
      },
      {
        id: 'workloads.functions',
        label: 'Functions',
        icon: 'fa-solid fa-bolt',
        url: `${base}/functions`,
        addUrl: `${base}/functions/new`,
        badge: { text: 4, variant: 'success' },
      },
      {
        id: 'workloads.archive',
        label: 'Archived',
        icon: 'fa-solid fa-box-archive',
        url: `${base}/workloads/archived`,
        visible: false,
      },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'fa-solid fa-database',
    items: [
      {
        id: 'storage.volumes',
        label: 'Volumes',
        icon: 'fa-solid fa-hard-drive',
        url: `${base}/volumes`,
        addUrl: `${base}/volumes/new`,
        badge: { text: 6 },
      },
      {
        id: 'storage.buckets',
        label: 'Object buckets',
        icon: 'fa-solid fa-bucket',
        url: `${base}/buckets`,
        addUrl: `${base}/buckets/new`,
      },
      {
        id: 'storage.snapshots',
        label: 'Snapshots',
        icon: 'fa-solid fa-camera',
        url: `${base}/snapshots`,
        badge: { text: 118, variant: 'secondary' },
      },
      {
        id: 'storage.backups',
        label: 'Backups',
        icon: 'fa-solid fa-shield-halved',
        url: `${base}/backups`,
        badge: { text: '2 failed', variant: 'danger' },
      },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'fa-solid fa-network-wired',
    items: [
      {
        id: 'network.endpoints',
        label: 'Endpoints',
        icon: 'fa-solid fa-plug',
        url: `${base}/endpoints`,
        addUrl: `${base}/endpoints/new`,
      },
      {
        id: 'network.certificates',
        label: 'Certificates',
        icon: 'fa-solid fa-certificate',
        url: `${base}/certificates`,
        badge: { text: '3 expiring', variant: 'warning' },
      },
      {
        id: 'network.firewall',
        label: 'Firewall rules',
        icon: 'fa-solid fa-fire',
        url: `${base}/firewall`,
        addUrl: `${base}/firewall/new`,
      },
      {
        id: 'network.zones',
        label: 'Zones',
        icon: 'fa-solid fa-globe',
        url: `${base}/zones`,
        addUrl: `${base}/zones/new`,
      },
    ],
  },
  {
    id: 'people',
    label: 'People & access',
    icon: 'fa-solid fa-users',
    items: [
      {
        id: 'people.members',
        label: 'Members',
        icon: 'fa-solid fa-user',
        url: `${base}/members`,
        addUrl: `${base}/members/new`,
        badge: { text: 60 },
      },
      {
        id: 'people.teams',
        label: 'Teams',
        icon: 'fa-solid fa-user-group',
        url: `${base}/teams`,
        addUrl: `${base}/teams/new`,
      },
      {
        id: 'people.roles',
        label: 'Roles',
        icon: 'fa-solid fa-user-shield',
        url: `${base}/roles`,
      },
      {
        id: 'people.invitations',
        label: 'Invitations',
        icon: 'fa-solid fa-envelope-open-text',
        url: `${base}/invitations`,
        badge: { text: 3, variant: 'info' },
      },
    ],
  },
  {
    id: 'observability',
    label: 'Observability',
    icon: 'fa-solid fa-chart-line',
    items: [
      { id: 'obs.metrics', label: 'Metrics', icon: 'fa-solid fa-wave-square', url: `${base}/metrics` },
      { id: 'obs.logs', label: 'Logs', icon: 'fa-solid fa-file-lines', url: `${base}/logs` },
      { id: 'obs.traces', label: 'Traces', icon: 'fa-solid fa-route', url: `${base}/traces` },
      {
        id: 'obs.alerts',
        label: 'Alert rules',
        icon: 'fa-solid fa-bell',
        url: `${base}/alerts`,
        addUrl: `${base}/alerts/new`,
        badge: { text: 2, variant: 'danger' },
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'fa-solid fa-sliders',
    url: `${base}/settings`,
  },
  {
    id: 'docs',
    label: 'Documentation',
    icon: 'fa-solid fa-book',
    url: 'https://developer.mozilla.org/',
    external: true,
  },
];

/**
 * A short, flat rail — for demos that need navigation without the noise.
 *
 * @example
 * ```ts
 * html`<lia-sidebar .items=${demoNavItemsCompact}></lia-sidebar>`;
 * ```
 */
export const demoNavItemsCompact: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'fa-solid fa-gauge-high', url: `${base}/overview`, active: true },
  { id: 'services', label: 'Services', icon: 'fa-solid fa-diagram-project', url: `${base}/services` },
  { id: 'volumes', label: 'Volumes', icon: 'fa-solid fa-hard-drive', url: `${base}/volumes` },
  { id: 'members', label: 'Members', icon: 'fa-solid fa-users', url: `${base}/members`, badge: { text: 60 } },
  { id: 'settings', label: 'Settings', icon: 'fa-solid fa-sliders', url: `${base}/settings` },
];

/**
 * The secondary rail on the right of the content — a page-local table of
 * contents, which is what `<lia-sub-sidebar>` is for.
 */
export const demoSubNavItems: NavItem[] = [
  { id: 'general', label: 'General', icon: 'fa-solid fa-gear', url: '#general', active: true },
  { id: 'limits', label: 'Limits & quotas', icon: 'fa-solid fa-gauge', url: '#limits' },
  { id: 'network', label: 'Networking', icon: 'fa-solid fa-network-wired', url: '#network' },
  { id: 'security', label: 'Security', icon: 'fa-solid fa-lock', url: '#security', badge: { text: '!', variant: 'warning' } },
  { id: 'advanced', label: 'Advanced', icon: 'fa-solid fa-screwdriver-wrench', url: '#advanced' },
];

/** The signed-in operator shown in the navbar of the layout demos. */
export const demoUser: UserInfo = {
  loginname: 'a.okonkwo',
  name: 'Amara Okonkwo',
  email: 'amara.okonkwo@example.org',
  isAdmin: true,
};

/** A second account, without administrator rights. */
export const demoMemberUser: UserInfo = {
  loginname: 'j.lindqvist',
  name: 'Jonas Lindqvist',
  email: 'jonas.lindqvist@example.org',
  isAdmin: false,
};

/** Entries of the navbar's user drop-down. */
export const demoUserMenu: UserMenuItem[] = [
  { id: 'profile', label: 'Your profile', icon: 'fa-solid fa-id-card', href: `${base}/profile` },
  { id: 'keys', label: 'Access credentials', icon: 'fa-solid fa-key', href: `${base}/credentials` },
  { id: 'prefs', label: 'Preferences', icon: 'fa-solid fa-sliders', href: `${base}/preferences` },
  {
    id: 'status',
    label: 'Service status',
    icon: 'fa-solid fa-heart-pulse',
    href: 'https://example.org/status',
    external: true,
    divider: true,
  },
];

/** Links for the footer strip. */
export const demoFooterLinks: FooterLink[] = [
  { label: 'Documentation', href: 'https://developer.mozilla.org/', external: true },
  { label: 'Keyboard shortcuts', href: `${base}/shortcuts` },
  { label: 'Privacy', href: `${base}/privacy` },
  { label: 'Licence', href: `${base}/licence` },
];

/** A breadcrumb trail for `<lia-breadcrumb>`. */
export const demoBreadcrumb: NavItem[] = [
  { label: 'Overview', url: `${base}/overview`, icon: 'fa-solid fa-house' },
  { label: 'Storage', url: `${base}/storage` },
  { label: 'Volumes', url: `${base}/volumes` },
  { label: 'vol-eu-central-041', active: true },
];
