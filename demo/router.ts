/**
 * The demo application's hash router.
 *
 * Deliberately tiny — the demo is a static site served from a file path, so a
 * history router is out and there is nothing to match beyond an exact path.
 * What it *does* do properly:
 *
 * - a **route table** of {@link DemoRoute}s, indexed by normalised path,
 * - `navigate()` / `subscribe()` / `current` as the whole public surface,
 * - a **404** route synthesised for anything unknown (overridable),
 * - **per-route scroll restoration**: the outgoing position is captured before
 *   the new route is announced, and re-applied once the host has rendered.
 *
 * Both a class ({@link DemoRouter}) and a module-level singleton API
 * ({@link createRouter}, {@link navigate}, {@link subscribe}) are exported.
 * Page modules only ever need {@link DemoRoute} and {@link routeHref}.
 *
 * @example
 * ```ts
 * const router = createRouter(demoRoutes, {
 *   home: '/',
 *   scrollTarget: () => document.querySelector('lia-app-shell main'),
 * });
 * router.subscribe((match) => host.requestUpdate());
 * router.start();
 * ```
 */

import { html, type TemplateResult } from 'lit';
import type { IconName, Variant } from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Route model
 * ------------------------------------------------------------------ */

/**
 * The sidebar groups of the demo. One per component family, in the order the
 * rail shows them; the ids double as the page-module file names
 * (`table` → `demo/pages/table.ts`).
 */
export type DemoGroup =
  | 'getting-started'
  | 'layout'
  | 'primitives'
  | 'feedback'
  | 'table'
  | 'forms'
  | 'dashboard'
  | 'settings'
  | 'auth'
  | 'editors'
  | 'full-pages';

/** One screen of the demo. */
export interface DemoRoute {
  /** Path *without* the leading `#`, e.g. `/table/listing`. */
  path: string;
  /** Shown in the sidebar, the page heading and the search hits. */
  title: string;
  /** Which sidebar group the entry belongs to. */
  group: DemoGroup;
  /** Icon-font class for the sidebar entry, e.g. `fa-solid fa-table`. */
  icon?: IconName;
  /** One line under the title — used by the heading and the search hits. */
  description?: string;
  /** Extra words the global search should match on. */
  keywords?: string[];
  /** Counter pill on the sidebar entry. */
  badge?: { text: string | number; variant?: Variant };
  /** Render without the application shell — auth screens and full pages. */
  fullscreen?: boolean;
  /** Reachable by URL and by search, but not listed in the sidebar. */
  hidden?: boolean;
  /** The screen itself. Called on every render of the host. */
  render(): TemplateResult;
}

/** What {@link DemoRouter.current} reports. */
export interface RouteMatch {
  /** The route to render — the 404 route when nothing matched. */
  route: DemoRoute;
  /** The normalised path that was requested. */
  path: string;
  /** Everything after `?` in the hash. */
  query: URLSearchParams;
  /** `false` when the 404 route was synthesised. */
  found: boolean;
}

/** A subscriber of route changes. */
export type RouteListener = (match: RouteMatch) => void;

/** Options of {@link DemoRouter}. */
export interface DemoRouterOptions {
  /** Path used when the URL carries no hash at all. Defaults to `/`. */
  home?: string;
  /** Builds the route rendered for an unknown path. */
  notFound?: (path: string) => DemoRoute;
  /**
   * The element whose `scrollTop` is preserved per route, resolved lazily on
   * every use. Window scroll is always preserved as well, so it is safe to
   * return `null` when the page scrolls the document instead.
   */
  scrollTarget?: () => Element | null | undefined;
}

/** Options of {@link DemoRouter.navigate}. */
export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/* ------------------------------------------------------------------ *
 * Path helpers
 * ------------------------------------------------------------------ */

/**
 * Canonical form of a route path: no `#`, exactly one leading slash, no
 * trailing slash, no query string.
 *
 * @example
 * ```ts
 * normalizePath('#/table/listing/?page=2'); // → '/table/listing'
 * ```
 */
export function normalizePath(input: string | null | undefined): string {
  let path = (input ?? '').trim();
  if (path.startsWith('#')) path = path.slice(1);
  const cut = path.search(/[?]/);
  if (cut >= 0) path = path.slice(0, cut);
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** The query string of a path or href, as a `URLSearchParams`. */
export function routeQuery(input: string | null | undefined): URLSearchParams {
  const raw = input ?? '';
  const cut = raw.indexOf('?');
  return new URLSearchParams(cut >= 0 ? raw.slice(cut + 1) : '');
}

/**
 * The `href` a link to a demo route needs. Preserves a query string.
 *
 * @example
 * ```ts
 * html`<a href=${routeHref('/forms/fields')}>Fields</a>`; // href="#/forms/fields"
 * ```
 */
export function routeHref(path: string, params?: Record<string, string | number>): string {
  const base = normalizePath(path);
  const query = routeQuery(path);
  for (const [key, value] of Object.entries(params ?? {})) query.set(key, String(value));
  const search = query.toString();
  return search ? `#${base}?${search}` : `#${base}`;
}

/** `true` for anything the demo must not swallow — `http:`, `mailto:`, … */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function readLocationHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/* ------------------------------------------------------------------ *
 * The 404 route
 * ------------------------------------------------------------------ */

/** The route rendered when nothing in the table matches. */
export function notFoundRoute(path: string): DemoRoute {
  return {
    path,
    title: 'Page not found',
    group: 'getting-started',
    icon: 'fa-solid fa-triangle-exclamation',
    hidden: true,
    render: () => html`
      <div class="container-fluid py-5 text-center">
        <p class="display-1 fw-semibold text-body-tertiary mb-0">404</p>
        <h1 class="h4 mt-3">No demo is registered here</h1>
        <p class="text-body-secondary">
          Nothing answers to <code>${path}</code>.
        </p>
        <a class="btn btn-primary" href="#/">
          <i class="fa-solid fa-house me-2" aria-hidden="true"></i>Back to the overview
        </a>
      </div>
    `,
  };
}

/* ------------------------------------------------------------------ *
 * The router
 * ------------------------------------------------------------------ */

interface ScrollPosition {
  /** Document scroll. */
  x: number;
  y: number;
  /** Scroll of the configured target element. */
  tx: number;
  ty: number;
}

/**
 * A hash router over a fixed route table.
 *
 * The router never renders anything itself: it resolves a path to a
 * {@link RouteMatch} and tells its subscribers. The host renders
 * `match.route.render()` and calls {@link DemoRouter.restoreScroll} once it
 * has — that split is what makes scroll restoration land on the *new* layout
 * rather than the old one.
 */
export class DemoRouter {
  /** The table, in registration order. */
  readonly routes: readonly DemoRoute[];

  private readonly index = new Map<string, DemoRoute>();
  private readonly listeners = new Set<RouteListener>();
  private readonly positions = new Map<string, ScrollPosition>();
  private readonly options: DemoRouterOptions;
  private readonly home: string;
  private match: RouteMatch;
  private started = false;
  private pendingRestore = false;

  private readonly onHashChange = (): void => {
    this.handleLocation();
  };

  constructor(routes: readonly DemoRoute[], options: DemoRouterOptions = {}) {
    this.routes = [...routes];
    this.options = options;
    this.home = normalizePath(options.home ?? '/');
    for (const route of this.routes) {
      const path = normalizePath(route.path);
      if (this.index.has(path)) {
        console.warn(`[demo-router] duplicate route path: ${path}`);
      }
      this.index.set(path, route);
    }
    this.match = this.resolve(readLocationHash() || this.home);
  }

  /** The match currently on screen. */
  get current(): RouteMatch {
    return this.match;
  }

  /** `true` when `path` is a registered route. */
  has(path: string): boolean {
    return this.index.has(normalizePath(path));
  }

  /** The route registered at `path`, if any. */
  route(path: string): DemoRoute | undefined {
    return this.index.get(normalizePath(path));
  }

  /** Resolve a path (or href) without navigating. */
  resolve(input: string): RouteMatch {
    const path = normalizePath(input);
    const query = routeQuery(input);
    const route = this.index.get(path);
    if (route) return { route, path, query, found: true };
    const build = this.options.notFound ?? notFoundRoute;
    return { route: build(path), path, query, found: false };
  }

  /**
   * Begin listening to `hashchange`. Seeds the URL with {@link home} when the
   * document was opened without a hash, then announces the first match.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('hashchange', this.onHashChange);
    const hash = readLocationHash();
    if (hash === '' || hash === '#') {
      history.replaceState(null, '', routeHref(this.home));
    }
    this.handleLocation();
  }

  /** Stop listening. Subscribers stay registered. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('hashchange', this.onHashChange);
  }

  /** Add a listener; returns the function that removes it again. */
  subscribe(listener: RouteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Go to a path. Accepts `'/forms'`, `'#/forms'` and `'forms'` alike; a path
   * that is already current is re-announced rather than ignored, so a link to
   * the current page still scrolls it back to the top.
   */
  navigate(path: string, options: NavigateOptions = {}): void {
    const href = routeHref(path);
    if (options.replace) {
      history.replaceState(null, '', href);
      this.handleLocation();
      return;
    }
    if (readLocationHash() === href) {
      this.handleLocation();
      return;
    }
    window.location.hash = href;
  }

  /** Capture the scroll position of the route currently on screen. */
  saveScroll(path: string = this.match.path): void {
    const element = this.options.scrollTarget?.() ?? null;
    this.positions.set(path, {
      x: window.scrollX,
      y: window.scrollY,
      tx: element?.scrollLeft ?? 0,
      ty: element?.scrollTop ?? 0,
    });
  }

  /**
   * Re-apply the position stored for the current route — top of the page for a
   * route that has not been visited yet. Call it from the host's `updated()`;
   * it is a no-op unless a navigation is waiting for it.
   */
  restoreScroll(): void {
    if (!this.pendingRestore) return;
    this.pendingRestore = false;
    const stored = this.positions.get(this.match.path);
    const element = this.options.scrollTarget?.() ?? null;
    if (element) {
      element.scrollLeft = stored?.tx ?? 0;
      element.scrollTop = stored?.ty ?? 0;
    }
    window.scrollTo(stored?.x ?? 0, stored?.y ?? 0);
  }

  /** Forget every stored scroll position. */
  clearScroll(): void {
    this.positions.clear();
  }

  private handleLocation(): void {
    const next = this.resolve(readLocationHash() || this.home);
    // The DOM still shows the outgoing route, so this reads the right offsets.
    if (next.path !== this.match.path) this.saveScroll(this.match.path);
    this.match = next;
    this.pendingRestore = true;
    for (const listener of [...this.listeners]) listener(next);
  }
}

/* ------------------------------------------------------------------ *
 * Singleton API
 * ------------------------------------------------------------------ */

let active: DemoRouter | undefined;

/** Create the application-wide router and make it the target of the helpers below. */
export function createRouter(
  routes: readonly DemoRoute[],
  options: DemoRouterOptions = {}
): DemoRouter {
  active = new DemoRouter(routes, options);
  return active;
}

/** The router created by {@link createRouter}. Throws before that happened. */
export function getRouter(): DemoRouter {
  if (!active) throw new Error('[demo-router] createRouter() has not been called yet');
  return active;
}

/** Go to a path on the application-wide router. */
export function navigate(path: string, options: NavigateOptions = {}): void {
  getRouter().navigate(path, options);
}

/** Subscribe to the application-wide router. */
export function subscribe(listener: RouteListener): () => void {
  return getRouter().subscribe(listener);
}

/** The match currently on screen. */
export function currentMatch(): RouteMatch {
  return getRouter().current;
}
