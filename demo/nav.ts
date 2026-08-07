/**
 * Turns the flat route registry into the things the shell needs: a grouped
 * sidebar tree and the hits of the global search.
 *
 * The groups mirror the component families one-to-one, which is the point of
 * the demo — if a family cannot be demonstrated from its own group, it is not
 * really a family.
 */

import type { IconName, NavItem, SearchResult } from '@liasoft/lit-ui';
import { normalizePath, routeHref, type DemoGroup, type DemoRoute } from './router.js';

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

/** Presentation of one sidebar group. */
export interface DemoGroupMeta {
  id: DemoGroup;
  label: string;
  icon: IconName;
  /** One line, used as the group's search-hit heading and on the index page. */
  description: string;
}

/**
 * Presentation of every group, keyed by id.
 *
 * A `Record<DemoGroup, …>` on purpose: adding a member to the union without
 * describing it here is a compile error, so the sidebar can never silently
 * lose a family.
 */
const GROUP_META: Record<DemoGroup, Omit<DemoGroupMeta, 'id'>> = {
  'getting-started': {
    label: 'Getting started',
    icon: 'fa-solid fa-rocket',
    description: 'What the kit is, how to install it and the conventions it follows.',
  },
  layout: {
    label: 'Layout & navigation',
    icon: 'fa-solid fa-table-columns',
    description: 'The application chrome: shell, navbar, rails, headings and footer.',
  },
  primitives: {
    label: 'Primitives',
    icon: 'fa-solid fa-shapes',
    description: 'The small building blocks every other family composes.',
  },
  feedback: {
    label: 'Feedback',
    icon: 'fa-solid fa-bell',
    description: 'Alerts, banners, modals, toasts and the confirmation flow.',
  },
  table: {
    label: 'Tables',
    icon: 'fa-solid fa-table',
    description: 'Listings, cell renderers, sorting and pagination.',
  },
  crud: {
    label: 'CRUD',
    icon: 'fa-solid fa-pen-to-square',
    description: 'List pages, filters, column preferences and inline editing.',
  },
  forms: {
    label: 'Forms',
    icon: 'fa-solid fa-rectangle-list',
    description: 'The data-driven form system, every field type and validation.',
  },
  dashboard: {
    label: 'Dashboard',
    icon: 'fa-solid fa-gauge-high',
    description: 'Resource meters, KPI cards, activity lists, charts and grids.',
  },
  settings: {
    label: 'Settings & wizard',
    icon: 'fa-solid fa-sliders',
    description: 'Grouped settings, configuration generators and multi-step flows.',
  },
  auth: {
    label: 'Auth',
    icon: 'fa-solid fa-right-to-bracket',
    description: 'Sign-in, recovery, second factor and the account panel.',
  },
  editors: {
    label: 'Editors',
    icon: 'fa-solid fa-code',
    description: 'Record tables, log output, diffs, usage views and credentials.',
  },
  'full-pages': {
    label: 'Full pages',
    icon: 'fa-solid fa-window-maximize',
    description: 'Whole screens assembled from the families, end to end.',
  },
};

/** The order the sidebar lists the groups in — the component families, in build order. */
export const DEMO_GROUP_ORDER: readonly DemoGroup[] = [
  'getting-started',
  'layout',
  'primitives',
  'feedback',
  'table',
  'crud',
  'forms',
  'dashboard',
  'settings',
  'auth',
  'editors',
  'full-pages',
];

/**
 * Every group, in the order the sidebar shows them.
 *
 * @example
 * ```ts
 * DEMO_GROUPS.map((group) => group.label); // → ['Getting started', 'Layout & navigation', …]
 * ```
 */
export const DEMO_GROUPS: readonly DemoGroupMeta[] = DEMO_GROUP_ORDER.map((id) => ({
  id,
  ...GROUP_META[id],
}));

/** Group metadata by id. */
export const DEMO_GROUP_BY_ID: Record<DemoGroup, DemoGroupMeta> = Object.fromEntries(
  DEMO_GROUPS.map((group) => [group.id, group])
) as Record<DemoGroup, DemoGroupMeta>;

/** Human-readable name of a group. */
export function groupLabel(id: DemoGroup): string {
  return DEMO_GROUP_BY_ID[id]?.label ?? id;
}

/* ------------------------------------------------------------------ *
 * Sidebar
 * ------------------------------------------------------------------ */

/** Options of {@link buildNav}. */
export interface BuildNavOptions {
  /** Show a counter pill with the number of demos per group. Defaults to `true`. */
  counts?: boolean;
  /** Collapse groups other than the active one — the sidebar does this itself. */
  includeEmpty?: boolean;
}

/**
 * Build the sidebar tree from the route registry.
 *
 * Every group becomes a collapsible parent entry holding its routes; the entry
 * matching `activePath` is marked `active`, and so is its group, which is what
 * makes `<lia-sidebar>` open the right section on load.
 *
 * @example
 * ```ts
 * html`<lia-app-shell .navItems=${buildNav(router.routes, match.path)}></lia-app-shell>`;
 * ```
 */
export function buildNav(
  routes: readonly DemoRoute[],
  activePath: string,
  options: BuildNavOptions = {}
): NavItem[] {
  const active = normalizePath(activePath);
  const counts = options.counts !== false;
  const items: NavItem[] = [];

  for (const group of DEMO_GROUPS) {
    const children = routes.filter((route) => route.group === group.id && route.hidden !== true);
    if (children.length === 0 && options.includeEmpty !== true) continue;

    const entries: NavItem[] = children.map((route) => ({
      id: route.path,
      label: route.title,
      url: routeHref(route.path),
      icon: route.icon,
      badge: route.badge,
      active: normalizePath(route.path) === active,
    }));

    items.push({
      id: group.id,
      label: group.label,
      icon: group.icon,
      active: entries.some((entry) => entry.active === true),
      badge: counts ? { text: entries.length, variant: 'secondary' } : undefined,
      items: entries,
    });
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

interface ScoredRoute {
  route: DemoRoute;
  score: number;
}

function scoreRoute(route: DemoRoute, needle: string): number {
  const title = route.title.toLowerCase();
  if (title === needle) return 100;
  if (title.startsWith(needle)) return 80;
  if (title.includes(needle)) return 60;

  const path = route.path.toLowerCase();
  if (path.includes(needle)) return 45;

  const keywords = (route.keywords ?? []).map((word) => word.toLowerCase());
  if (keywords.some((word) => word === needle)) return 40;
  if (keywords.some((word) => word.includes(needle))) return 30;

  if (groupLabel(route.group).toLowerCase().includes(needle)) return 20;
  if ((route.description ?? '').toLowerCase().includes(needle)) return 10;
  return 0;
}

/**
 * Rank the registry against a free-text query and return the hits in the shape
 * `<lia-global-search>` expects.
 *
 * Every whitespace-separated term must match somewhere, so `form select`
 * narrows rather than widens. Hits keep their group heading, which is what the
 * search panel renders its sticky separators from.
 *
 * @example
 * ```ts
 * shell.searchResults = searchRoutes(router.routes, event.detail.text);
 * ```
 */
export function searchRoutes(
  routes: readonly DemoRoute[],
  query: string,
  limit = 12
): SearchResult[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: ScoredRoute[] = [];
  for (const route of routes) {
    let total = 0;
    let matchedAll = true;
    for (const term of terms) {
      const score = scoreRoute(route, term);
      if (score === 0) {
        matchedAll = false;
        break;
      }
      total += score;
    }
    if (matchedAll) scored.push({ route, score: total });
  }

  scored.sort((a, b) => b.score - a.score || a.route.title.localeCompare(b.route.title));

  // Keep the group order of the sidebar inside equal scores by grouping after
  // ranking: the panel renders a sticky heading per contiguous run.
  return scored.slice(0, limit).map(({ route }) => ({
    label: route.title,
    description: route.description,
    url: routeHref(route.path),
    icon: route.icon,
    group: groupLabel(route.group),
  }));
}

/* ------------------------------------------------------------------ *
 * Breadcrumb
 * ------------------------------------------------------------------ */

/**
 * The trail for `<lia-breadcrumb>`: kit → group → page.
 *
 * @example
 * ```ts
 * html`<lia-breadcrumb .items=${routeTrail(route)}></lia-breadcrumb>`;
 * ```
 */
export function routeTrail(route: DemoRoute): NavItem[] {
  const group = DEMO_GROUP_BY_ID[route.group];
  return [
    { label: 'Overview', url: routeHref('/'), icon: 'fa-solid fa-house' },
    ...(group ? [{ label: group.label, icon: group.icon }] : []),
    { label: route.title, active: true },
  ];
}
