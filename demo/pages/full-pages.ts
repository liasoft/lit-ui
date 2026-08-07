/**
 * Demo pages — Full pages.
 *
 * The payoff: eight complete screens of a fictional operations console,
 * assembled from nothing but the kit and the mock data. No page here contains a
 * single line of bespoke layout CSS — every one of them is an
 * `<lia-app-shell>`, a `<lia-page>` and the family elements inside it.
 *
 * All eight are `fullscreen` routes, so they get the whole viewport rather than
 * sitting inside the gallery's own chrome. The floating bar in the corner is
 * the demo's, not the product's.
 */

import { html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  AlertMessage,
  CrudFetchParams,
  CrudFetchResult,
  CrudController,
  DashboardWidget,
  FormSubmitDetail,
  FormValues,
  LogLine,
  LoginSubmitDetail,
  NavItem,
  QuickFilter,
  SearchResult,
  TreeNode,
  UsageSeriesPoint,
  WizardFinishDetail,
  WizardStepDetail,
} from '@liasoft/lit-ui';
import { LiaElement, createCrudController, formatBytes, toast } from '@liasoft/lit-ui';
import {
  accountInfo,
  configTree,
  createMemberForm,
  demoLogLines,
  demoUser,
  demoUserMenu,
  demoFooterLinks,
  filterUsers,
  memberFormErrors,
  newsItems,
  onboardingSteps,
  pendingTasks,
  recentActivity,
  requestMetrics,
  requestsByDay,
  resourceItems,
  scheduledJobs,
  settingsGroups,
  statCards,
  storageGrowth,
  storageMetrics,
  systemInfo,
  transferChart,
  usageFor,
  usageMetricsExtended,
  usagePeriods,
  userBulkActions,
  userColumns,
  userPageActions,
  userRoleOptions,
  userRowActions,
  userStatusOptions,
  userTeamOptions,
  welcomeCopy,
  demoUsers,
  type DemoUser,
} from '../data/index.js';
import { routeHref, type DemoRoute } from '../router.js';

/* ------------------------------------------------------------------ *
 * The product's own chrome
 * ------------------------------------------------------------------ */

/** Where each screen of the fictional console lives. */
const PAGE = {
  dashboard: '/full-pages/dashboard',
  members: '/full-pages/members',
  member: '/full-pages/member-form',
  settings: '/full-pages/settings',
  logs: '/full-pages/logs',
  usage: '/full-pages/usage',
  login: '/full-pages/login',
  install: '/full-pages/install',
} as const;

/**
 * The console's navigation. Entries that lead to a real screen carry its route;
 * the rest are plausible-but-inert, the way a product's rail always has more
 * entries than a demo can build.
 *
 * @example
 * ```ts
 * html`<lia-app-shell .navItems=${consoleNav(PAGE.dashboard)}></lia-app-shell>`;
 * ```
 */
export function consoleNav(active: string): NavItem[] {
  const at = (path: string): boolean => path === active;
  return [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'fa-solid fa-gauge-high',
      url: routeHref(PAGE.dashboard),
      active: at(PAGE.dashboard),
    },
    {
      id: 'people',
      label: 'People & access',
      icon: 'fa-solid fa-users',
      active: at(PAGE.members) || at(PAGE.member),
      items: [
        {
          label: 'Members',
          icon: 'fa-solid fa-user',
          url: routeHref(PAGE.members),
          addUrl: routeHref(PAGE.member),
          badge: { text: demoUsers.length },
          active: at(PAGE.members),
        },
        { label: 'Teams', icon: 'fa-solid fa-user-group', url: '#/orbit/teams' },
        { label: 'Roles', icon: 'fa-solid fa-user-shield', url: '#/orbit/roles' },
        {
          label: 'Invitations',
          icon: 'fa-solid fa-envelope-open-text',
          url: '#/orbit/invitations',
          badge: { text: 3, variant: 'info' },
        },
      ],
    },
    {
      id: 'workloads',
      label: 'Workloads',
      icon: 'fa-solid fa-cubes',
      items: [
        { label: 'Services', icon: 'fa-solid fa-diagram-project', url: '#/orbit/services', badge: { text: 31 } },
        { label: 'Scheduled jobs', icon: 'fa-solid fa-clock-rotate-left', url: '#/orbit/jobs', badge: { text: 18 } },
        { label: 'Volumes', icon: 'fa-solid fa-hard-drive', url: '#/orbit/volumes', badge: { text: 24 } },
      ],
    },
    {
      id: 'observability',
      label: 'Observability',
      icon: 'fa-solid fa-chart-line',
      active: at(PAGE.logs) || at(PAGE.usage),
      items: [
        {
          label: 'Usage',
          icon: 'fa-solid fa-chart-area',
          url: routeHref(PAGE.usage),
          active: at(PAGE.usage),
        },
        {
          label: 'Logs',
          icon: 'fa-solid fa-file-lines',
          url: routeHref(PAGE.logs),
          active: at(PAGE.logs),
        },
        {
          label: 'Alert rules',
          icon: 'fa-solid fa-bell',
          url: '#/orbit/alerts',
          badge: { text: 2, variant: 'danger' },
        },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'fa-solid fa-sliders',
      url: routeHref(PAGE.settings),
      active: at(PAGE.settings),
    },
    {
      id: 'install',
      label: 'Add a host',
      icon: 'fa-solid fa-wand-magic-sparkles',
      url: routeHref(PAGE.install),
    },
    {
      id: 'docs',
      label: 'Documentation',
      icon: 'fa-solid fa-book',
      url: 'https://developer.mozilla.org/',
      external: true,
    },
  ];
}

const CONSOLE_MENU = [
  ...demoUserMenu.slice(0, 1),
  { id: 'settings', label: 'Settings', icon: 'fa-solid fa-sliders', href: routeHref(PAGE.settings) },
  { id: 'usage', label: 'Usage', icon: 'fa-solid fa-chart-area', href: routeHref(PAGE.usage) },
  ...demoUserMenu.slice(3),
];

/** Search the console's own navigation — the shell's search field made real. */
function searchConsole(text: string, active: string): SearchResult[] {
  const needle = text.trim().toLowerCase();
  if (needle === '') return [];
  const hits: SearchResult[] = [];
  for (const group of consoleNav(active)) {
    for (const entry of group.items ?? [group]) {
      if (entry.visible === false) continue;
      if (!entry.label.toLowerCase().includes(needle)) continue;
      hits.push({
        label: entry.label,
        description: group.items ? `in ${group.label}` : undefined,
        url: entry.url ?? '#',
        icon: entry.icon,
        group: group.items ? group.label : 'Console',
      });
    }
  }
  const members = demoUsers
    .filter((user) => user.name.toLowerCase().includes(needle))
    .slice(0, 4)
    .map((user) => ({
      label: user.name,
      description: user.email,
      url: routeHref(PAGE.member),
      icon: 'fa-solid fa-user',
      group: 'Members',
    }));
  return [...hits, ...members].slice(0, 10);
}

/**
 * The base every console screen extends: it owns the shell's chrome, the
 * search and the banner, and leaves the page body to the subclass.
 */
abstract class ConsoleScreen extends LiaElement {
  /** Route of the screen, used to mark the rail. */
  protected abstract readonly here: string;

  @state() protected searchResults: SearchResult[] = [];
  @state() protected banners: AlertMessage[] = [];
  @state() protected subNav: NavItem[] = [];
  @state() protected subNavTitle = '';

  /** The page inside the shell. */
  protected abstract renderBody(): unknown;

  protected onSearch(event: CustomEvent<{ field?: string; text: string }>): void {
    this.searchResults = searchConsole(event.detail?.text ?? '', this.here);
  }

  protected onDismissBanner(event: CustomEvent<{ id?: string }>): void {
    this.banners = this.banners.filter((banner) => banner.id !== event.detail?.id);
  }

  /** Swallow the fictional links so the demo never lands on a 404. */
  protected onNavigate(event: CustomEvent<{ url: string }>): void {
    const url = event.detail?.url ?? '';
    if (url.startsWith('#/orbit') || url === '#') {
      event.preventDefault();
      toast({
        variant: 'secondary',
        message: 'That screen is not part of the demo.',
        timeout: 2500,
      });
    }
  }

  protected override render(): TemplateResult {
    return html`
      <lia-app-shell
        brand-label="Orbit Console"
        brand-href=${routeHref(PAGE.dashboard)}
        home-href=${routeHref(PAGE.dashboard)}
        home-label="Overview"
        nav-label="Console navigation"
        search-placeholder="Search members, services, hosts…"
        logout-label="Sign out"
        sub-nav-title=${this.subNavTitle}
        sub-nav-sticky
        footer-text="Orbit Console — a fictional operations product, built entirely from @liasoft/lit-ui."
        footer-version="4.12.0"
        .navItems=${consoleNav(this.here)}
        .subNavItems=${this.subNav}
        .user=${demoUser}
        .userMenu=${CONSOLE_MENU}
        .searchResults=${this.searchResults}
        .banners=${this.banners}
        .footerLinks=${demoFooterLinks}
        .navExtra=${html`<li class="nav-item d-none d-xl-flex align-items-center me-2">
          <span class="badge rounded-pill text-bg-success">eu-central</span>
        </li>`}
        @lia-search=${this.onSearch}
        @lia-dismiss=${this.onDismissBanner}
        @lia-navigate=${this.onNavigate}
        @lia-logout=${(event: Event) => {
          event.preventDefault();
          window.location.hash = routeHref(PAGE.login);
        }}
      >
        ${this.renderBody()}
      </lia-app-shell>
    `;
  }
}

/* ------------------------------------------------------------------ *
 * 1. Dashboard
 * ------------------------------------------------------------------ */

/** The console's landing page. */
@customElement('demo-page-dashboard')
export class DemoPageDashboard extends ConsoleScreen {
  protected readonly here = PAGE.dashboard;

  @state() private welcome = true;

  override connectedCallback(): void {
    super.connectedCallback();
    this.banners = [
      {
        id: 'maintenance',
        variant: 'warning',
        icon: 'fa-solid fa-screwdriver-wrench',
        title: 'Maintenance window',
        message: 'Saturday 02:00–04:00 UTC — deployments are paused for the duration.',
        dismissible: true,
        actions: [{ id: 'details', label: 'Details', variant: 'light', size: 'sm' }],
      },
    ];
    this.subNavTitle = 'On this page';
    this.subNav = [
      { label: 'Key figures', url: '#figures', icon: 'fa-solid fa-chart-simple', active: true },
      { label: 'Capacity', url: '#capacity', icon: 'fa-solid fa-gauge' },
      { label: 'Transfer', url: '#transfer', icon: 'fa-solid fa-arrow-right-arrow-left' },
      { label: 'Environment', url: '#environment', icon: 'fa-solid fa-server' },
      {
        label: 'Incidents',
        url: '#incidents',
        icon: 'fa-solid fa-fire',
        badge: { text: 2, variant: 'danger' },
      },
    ];
  }

  private get widgets(): DashboardWidget[] {
    return [
      {
        id: 'transfer',
        span: 8,
        content: html`<div class="card h-100" id="transfer">
          <div class="card-header bg-body-tertiary d-flex align-items-center gap-2">
            <i class="fa-solid fa-arrow-right-arrow-left text-body-secondary" aria-hidden="true"></i>
            <span class="fw-semibold flex-grow-1">Transfer, last twelve months</span>
            <a class="btn btn-sm btn-outline-secondary" href=${routeHref(PAGE.usage)}>Details</a>
          </div>
          <div class="card-body">
            <lia-chart
              type="bar"
              height="260"
              label="Transfer per month, inbound and outbound, in tebibytes"
              summary="Outbound grew from 5.4 TiB in August to 10.2 TiB in July; inbound roughly doubled."
              .data=${transferChart}
            ></lia-chart>
          </div>
        </div>`,
      },
      {
        id: 'incidents',
        span: 4,
        content: html`<div id="incidents" class="h-100">
          <lia-activity-list
            title="Needs attention"
            icon="fa-solid fa-fire"
            card
            flush
            interactive
            .items=${pendingTasks}
            @lia-activity-select=${() =>
              toast({ variant: 'info', message: 'This would open the incident.' })}
          ></lia-activity-list>
        </div>`,
      },
      {
        id: 'environment',
        span: 5,
        content: html`<div id="environment" class="h-100">
          <lia-info-card
            title="Environment"
            icon="fa-solid fa-server"
            copyable
            flush
            .entries=${systemInfo}
          ></lia-info-card>
        </div>`,
      },
      {
        id: 'activity',
        span: 4,
        content: html`<lia-activity-list
          title="Recent activity"
          icon="fa-solid fa-clock-rotate-left"
          card
          flush
          .items=${recentActivity.slice(0, 5)}
        ></lia-activity-list>`,
      },
      {
        id: 'jobs',
        span: 3,
        content: html`<lia-activity-list
          title="Scheduled jobs"
          icon="fa-solid fa-clock"
          card
          flush
          .items=${scheduledJobs}
        ></lia-activity-list>`,
      },
      {
        id: 'account',
        span: 6,
        content: html`<lia-info-card
          title="Account"
          icon="fa-solid fa-building"
          flush
          .entries=${accountInfo}
        ></lia-info-card>`,
      },
      {
        id: 'news',
        span: 6,
        content: html`<lia-newsfeed
          title="Product news"
          .items=${newsItems}
          max-items="3"
          flush
        ></lia-newsfeed>`,
      },
    ];
  }

  protected renderBody(): unknown {
    const actions: ActionDescriptor[] = [
      { id: 'refresh', label: 'Refresh', icon: 'fa-solid fa-arrows-rotate', variant: 'outline-secondary' },
      { id: 'report', label: 'Weekly report', icon: 'fa-solid fa-file-arrow-down', variant: 'outline-secondary' },
      { id: 'invite', label: 'Invite a member', icon: 'fa-solid fa-user-plus', variant: 'primary', href: routeHref(PAGE.member) },
    ];

    return html`<lia-page
      title="Overview"
      icon="fa-solid fa-gauge-high"
      description="Northwind Collective · eu-central · 41 days uptime"
      .badge=${{ text: 'all systems normal', variant: 'success' }}
      .actions=${actions}
      content-class="p-3 p-lg-4"
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        if (event.detail?.id === 'refresh') {
          toast({ variant: 'secondary', message: 'Refreshed 4 seconds ago.', timeout: 2000 });
        }
      }}
    >
      ${this.welcome
        ? html`<lia-welcome-panel
            class="d-block mb-3"
            heading=${welcomeCopy.heading}
            text=${welcomeCopy.message}
            cta-label=${welcomeCopy.ctaLabel}
            cta-icon="fa-solid fa-fire"
            dismissible
            @lia-dismiss=${() => {
              this.welcome = false;
            }}
            @lia-action=${() => {
              const target = this.querySelector('#incidents');
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          ></lia-welcome-panel>`
        : nothing}

      <h2 class="h6 text-uppercase text-body-secondary mb-2" id="figures">Key figures</h2>
      <lia-stat-row .items=${statCards} columns="3" class="d-block mb-4"></lia-stat-row>

      <h2 class="h6 text-uppercase text-body-secondary mb-2" id="capacity">Capacity</h2>
      <lia-dashboard-grid
        class="d-block mb-4"
        .items=${resourceItems}
        columns="3"
      ></lia-dashboard-grid>

      <lia-widget-grid .widgets=${this.widgets} label="Dashboard panels"></lia-widget-grid>
    </lia-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 2. Members — a CRUD list page
 * ------------------------------------------------------------------ */

async function fetchMembers(params: CrudFetchParams): Promise<CrudFetchResult<DemoUser>> {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 300);
    params.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

  const rows = filterUsers(demoUsers, {
    text: params.search?.text,
    field: params.search?.field,
    role: typeof params.filters.role === 'string' ? params.filters.role : undefined,
    status: typeof params.filters.status === 'string' ? params.filters.status : undefined,
    team: typeof params.filters.team === 'string' ? params.filters.team : undefined,
  });

  const sort = params.sort;
  const sorted =
    sort && sort.field !== ''
      ? [...rows].sort((a, b) => {
          const read = (row: DemoUser): string =>
            String((row as unknown as Record<string, unknown>)[sort.field] ?? '');
          return (
            (sort.order === 'desc' ? -1 : 1) *
            read(a).localeCompare(read(b), undefined, { numeric: true })
          );
        })
      : rows;

  const start = (params.page - 1) * params.perPage;
  return {
    rows: sorted.slice(start, start + params.perPage),
    total: sorted.length,
    lastPage: Math.max(1, Math.ceil(sorted.length / params.perPage)),
  };
}

const MEMBER_FILTERS: QuickFilter[] = [
  { id: 'role', label: 'Role', placeholder: 'Any role', options: userRoleOptions },
  { id: 'status', label: 'Status', placeholder: 'Any status', options: userStatusOptions },
  { id: 'team', label: 'Team', placeholder: 'Any team', options: userTeamOptions },
];

/** The members list: filters, search, bulk actions, paging. */
@customElement('demo-page-members')
export class DemoPageMembers extends ConsoleScreen {
  protected readonly here = PAGE.members;

  private readonly crud: CrudController<DemoUser> = createCrudController<DemoUser>({
    id: 'members',
    columns: userColumns,
    perPage: 12,
    sort: { field: 'name', order: 'asc' },
    filterDefinitions: [
      { id: 'role', label: 'Role' },
      { id: 'status', label: 'Status' },
      { id: 'team', label: 'Team' },
    ],
    rowKey: (row) => row.id,
    rowClass: (row) => (row.active ? undefined : 'deactivated'),
    rowActions: userRowActions,
    selectable: true,
    bulkActions: userBulkActions,
    emptyTitle: 'Nothing matches these filters',
    emptyMessage: 'Remove a chip above to widen the search.',
    searchChipLabel: 'Contains',
    persistColumns: false,
    fetch: fetchMembers,
    onChange: () => this.requestUpdate(),
  });

  private disconnect?: () => void;

  override firstUpdated(): void {
    this.disconnect = this.crud.connect(this);
    void this.crud.load();
  }

  override disconnectedCallback(): void {
    this.disconnect?.();
    this.crud.destroy();
    super.disconnectedCallback();
  }

  private onAction(event: CustomEvent<ActionEventDetail<DemoUser>>): void {
    const id = event.detail?.id;
    const selected = this.crud.state.selection.length;
    if (id === 'create' || id === 'edit') {
      window.location.hash = routeHref(PAGE.member);
      return;
    }
    if (id === 'delete' && event.detail?.row) {
      toast({ variant: 'danger', message: `${event.detail.row.name} would be removed.` });
      return;
    }
    if (selected > 0 && (id === 'enable' || id === 'disable' || id === 'export')) {
      toast({ variant: 'success', message: `${id}: ${selected} member(s).` });
      this.crud.clearSelection();
      return;
    }
    toast({ variant: 'secondary', message: `Action “${id ?? '?'}” is not wired up in the demo.` });
  }

  protected renderBody(): unknown {
    const state = this.crud.state;
    const actions: ActionDescriptor[] = userPageActions.map((action) =>
      action.id === 'create' ? { ...action, href: routeHref(PAGE.member) } : action
    );

    return html`<lia-crud-page
      title="Members"
      icon="fa-solid fa-users"
      description="Everyone who can sign in to this organisation."
      search-mode="inline"
      live-search
      persist="false"
      .badge=${{ text: `${state.total ?? 0} of ${demoUsers.length}`, variant: 'secondary' }}
      .listing=${this.crud.listing}
      .allColumns=${this.crud.allColumns}
      .actions=${actions}
      .filters=${this.crud.filterChips}
      .quickFilters=${MEMBER_FILTERS.map((filter) => ({
        ...filter,
        value: (state.filters[filter.id] as string | undefined) ?? '',
      }))}
      .loading=${state.loading}
      .error=${state.error ?? ''}
      @lia-action=${this.onAction}
    ></lia-crud-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 3. Member form — create / edit
 * ------------------------------------------------------------------ */

/** The create screen, with a section rail and a sticky save bar. */
@customElement('demo-page-member-form')
export class DemoPageMemberForm extends ConsoleScreen {
  protected readonly here = PAGE.member;

  @state() private saving = false;
  @state() private errors: Record<string, string> = {};

  override connectedCallback(): void {
    super.connectedCallback();
    this.subNavTitle = 'Sections';
    this.subNav = [
      { label: 'Identity', url: '#identity', icon: 'fa-solid fa-id-card', active: true },
      { label: 'Access', url: '#access', icon: 'fa-solid fa-key' },
      { label: 'Limits', url: '#limits', icon: 'fa-solid fa-gauge' },
    ];
  }

  private async onSubmit(event: CustomEvent<FormSubmitDetail>): Promise<void> {
    this.saving = true;
    this.errors = {};
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.saving = false;

    if (String(event.detail.values.loginname ?? '') === 'a.okonkwo') {
      this.errors = memberFormErrors;
      toast({ variant: 'danger', message: 'The server rejected three fields.' });
      return;
    }
    toast({
      variant: 'success',
      message: `${String(event.detail.values.name ?? 'The member')} was invited.`,
    });
    window.location.hash = routeHref(PAGE.members);
  }

  protected renderBody(): unknown {
    return html`<lia-crud-form-page
      title="Add a member"
      icon="fa-solid fa-user-plus"
      description="They receive an invitation as soon as you save. Try the sign-in name “a.okonkwo” to see a rejected save."
      back-url=${routeHref(PAGE.members)}
      back-label="All members"
      save-label="Create member"
      cancel-label="Discard"
      sticky
      level="1"
      .form=${{ ...createMemberForm, backUrl: routeHref(PAGE.members) }}
      .errors=${this.errors}
      .saving=${this.saving}
      .actions=${[
        {
          id: 'import',
          label: 'Import from a directory',
          icon: 'fa-solid fa-file-import',
          variant: 'outline-secondary',
        },
      ] as ActionDescriptor[]}
      @lia-submit=${this.onSubmit}
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        if (event.detail?.id === 'cancel') window.location.hash = routeHref(PAGE.members);
        else toast({ variant: 'secondary', message: 'Not part of the demo.' });
      }}
    ></lia-crud-form-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 4. Settings
 * ------------------------------------------------------------------ */

/** The settings screen, with the sub-sidebar mirroring the anchor rail. */
@customElement('demo-page-settings')
export class DemoPageSettings extends ConsoleScreen {
  protected readonly here = PAGE.settings;

  @state() private busy = false;
  @state() private alerts: AlertMessage[] = [];
  @state() private active = 'general';

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncSubNav();
  }

  private syncSubNav(): void {
    this.subNavTitle = 'Settings';
    this.subNav = settingsGroups.map((group) => ({
      label: group.title,
      url: `#settings-${group.id}`,
      icon: group.icon,
      badge: group.badge,
      active: group.id === this.active,
    }));
  }

  private async onSubmit(event: CustomEvent<FormSubmitDetail>): Promise<void> {
    this.busy = true;
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.busy = false;
    this.alerts = [
      {
        id: 'saved',
        variant: 'success',
        icon: 'fa-solid fa-check',
        message: `Saved ${Object.keys(event.detail.values).length} settings. Two of them need the edge router reloaded.`,
        dismissible: true,
        actions: [{ id: 'reload', label: 'Reload it now', variant: 'light', size: 'sm' }],
      },
    ];
  }

  protected renderBody(): unknown {
    return html`<lia-settings-page
      title="Console settings"
      icon="fa-solid fa-gears"
      description="Everything that applies to this installation of the console."
      content-class="p-3 p-lg-4"
      active-group=${this.active}
      .groups=${settingsGroups}
      .alerts=${this.alerts}
      .busy=${this.busy}
      .actions=${[
        {
          id: 'export',
          label: 'Export as JSON',
          icon: 'fa-solid fa-file-arrow-down',
          variant: 'outline-secondary',
        },
      ] as ActionDescriptor[]}
      @lia-submit=${this.onSubmit}
      @lia-settings-active=${(event: CustomEvent<{ id: string }>) => {
        this.active = event.detail.id;
        this.syncSubNav();
      }}
      @lia-dismiss=${(event: CustomEvent<{ id?: string }>) => {
        this.alerts = this.alerts.filter((alert) => alert.id !== event.detail?.id);
      }}
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        if (event.detail?.id === 'reload') {
          toast({ variant: 'success', message: 'The edge router was reloaded.' });
          this.alerts = [];
        }
      }}
    ></lia-settings-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 5. Log viewer page
 * ------------------------------------------------------------------ */

/** The observability screen: a source tree, a filter bar and the log pane. */
@customElement('demo-page-logs')
export class DemoPageLogs extends ConsoleScreen {
  protected readonly here = PAGE.logs;

  @state() private lines: LogLine[] = demoLogLines;
  @state() private tailing = false;
  @state() private source = '/etc/orbit/agent.toml';

  private timer?: ReturnType<typeof setInterval>;
  private counter = 0;

  private readonly sources: TreeNode[] = [
    {
      id: 'hosts',
      label: 'Hosts',
      icon: 'fa-solid fa-server',
      children: [
        { id: 'host-014', label: 'host-eu-central-014', meta: '4.12.0', icon: 'fa-solid fa-microchip' },
        { id: 'host-021', label: 'host-eu-central-021', meta: '4.12.0', icon: 'fa-solid fa-microchip' },
        {
          id: 'host-033',
          label: 'host-eu-central-033',
          meta: 'draining',
          icon: 'fa-solid fa-microchip',
          badge: { text: 'draining', variant: 'warning' },
        },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      icon: 'fa-solid fa-diagram-project',
      children: [
        { id: 'edge', label: 'edge', badge: { text: '2 errors', variant: 'danger' } },
        { id: 'scheduler', label: 'scheduler' },
        { id: 'ledger', label: 'ledger' },
        { id: 'checkout', label: 'checkout' },
      ],
    },
    ...configTree.slice(0, 1),
  ];

  override disconnectedCallback(): void {
    this.stopTail();
    super.disconnectedCallback();
  }

  private startTail(): void {
    if (this.timer) return;
    this.tailing = true;
    this.timer = setInterval(() => {
      this.counter += 1;
      const level = this.counter % 11 === 0 ? 'error' : this.counter % 4 === 0 ? 'warning' : 'info';
      this.lines = [
        ...this.lines.slice(-500),
        {
          ts: Date.now(),
          level,
          source: 'edge',
          text:
            level === 'error'
              ? `upstream 10.0.4.${18 + (this.counter % 3)}:8443 returned 502 for GET /v2/checkout/session`
              : level === 'warning'
                ? `request queue depth ${40 + (this.counter % 60)} on host-eu-central-014`
                : `GET /v2/services 200 in ${18 + (this.counter % 70)}ms`,
        },
      ];
    }, 800);
  }

  private stopTail(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.tailing = false;
  }

  protected renderBody(): unknown {
    const actions: ActionDescriptor[] = [
      {
        id: 'tail',
        label: this.tailing ? 'Stop the tail' : 'Live tail',
        icon: this.tailing ? 'fa-solid fa-stop' : 'fa-solid fa-play',
        variant: this.tailing ? 'danger' : 'outline-primary',
      },
      { id: 'bundle', label: 'Support bundle', icon: 'fa-solid fa-box-archive', variant: 'outline-secondary' },
      { id: 'report', label: 'Report a problem', icon: 'fa-solid fa-bug', variant: 'outline-secondary' },
    ];

    return html`<lia-page
      title="Logs"
      icon="fa-solid fa-file-lines"
      description="Live output from the control plane. Pick a source on the left."
      .badge=${{ text: `${this.lines.length} lines`, variant: 'secondary' }}
      .actions=${actions}
      content-class="p-3 p-lg-4"
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        const id = event.detail?.id;
        if (id === 'tail') return this.tailing ? this.stopTail() : this.startTail();
        toast({ variant: 'secondary', message: 'Not part of the demo.' });
        return undefined;
      }}
    >
      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="card h-100">
            <div class="card-header bg-body-tertiary fw-semibold">Sources</div>
            <div class="card-body p-2">
              <lia-file-tree
                label="Log sources"
                filterable
                max-height="60vh"
                selected-id=${this.source}
                .nodes=${this.sources}
                @lia-tree-select=${(event: CustomEvent<{ node: TreeNode }>) => {
                  this.source = event.detail.node.id;
                }}
              ></lia-file-tree>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-9">
          <lia-log-viewer
            filename="orbit · ${this.source}"
            download-name="orbit.log"
            max-height="60vh"
            .lines=${this.lines}
            .follow=${this.tailing}
          ></lia-log-viewer>
          <div class="row g-3 mt-1">
            <div class="col-12 col-md-6">
              <lia-info-card
                title="Collector"
                icon="fa-solid fa-satellite-dish"
                flush
                .entries=${[
                  { label: 'Retention', value: '30 days' },
                  { label: 'Ingested today', value: formatBytes(41 * 1024 ** 3) },
                  { label: 'Dropped', value: '0', badge: { text: 'healthy', variant: 'success' } },
                  { label: 'Shipper', value: 'orbit-log-shipper 4.12.0' },
                ]}
              ></lia-info-card>
            </div>
            <div class="col-12 col-md-6">
              <lia-activity-list
                title="Related alerts"
                icon="fa-solid fa-bell"
                card
                flush
                .items=${recentActivity.slice(1, 4)}
              ></lia-activity-list>
            </div>
          </div>
        </div>
      </div>
    </lia-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 6. Usage page
 * ------------------------------------------------------------------ */

/** The usage screen: meters, transfer, requests and stored data. */
@customElement('demo-page-usage')
export class DemoPageUsage extends ConsoleScreen {
  protected readonly here = PAGE.usage;

  @state() private period = 'month';
  @state() private loading = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.subNavTitle = 'On this page';
    this.subNav = [
      { label: 'Capacity', url: '#capacity', icon: 'fa-solid fa-gauge', active: true },
      { label: 'Transfer', url: '#transfer', icon: 'fa-solid fa-arrow-right-arrow-left' },
      { label: 'Requests', url: '#requests', icon: 'fa-solid fa-bolt' },
      { label: 'Stored data', url: '#stored', icon: 'fa-solid fa-database' },
    ];
  }

  private async setPeriod(period: string): Promise<void> {
    this.loading = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    this.period = period;
    this.loading = false;
  }

  private get series(): UsageSeriesPoint[] {
    return usageFor(this.period);
  }

  protected renderBody(): unknown {
    return html`<lia-page
      title="Usage"
      icon="fa-solid fa-chart-area"
      description="What this organisation consumed, and what it is allowed to."
      .actions=${[
        { id: 'csv', label: 'Export CSV', icon: 'fa-solid fa-file-csv', variant: 'outline-secondary' },
        { id: 'invoice', label: 'Current invoice', icon: 'fa-solid fa-receipt', variant: 'outline-secondary' },
      ] as ActionDescriptor[]}
      content-class="p-3 p-lg-4"
      @lia-action=${() => toast({ variant: 'secondary', message: 'Not part of the demo.' })}
    >
      <h2 class="h6 text-uppercase text-body-secondary mb-2" id="capacity">Capacity</h2>
      <lia-dashboard-grid class="d-block mb-4" .items=${resourceItems} columns="4"></lia-dashboard-grid>

      <div id="transfer" class="mb-4">
        <lia-traffic-view
          title="Transfer"
          icon="fa-solid fa-arrow-right-arrow-left"
          format="bytes"
          chart-type="bar"
          stacked
          height="300"
          period=${this.period}
          .periods=${usagePeriods}
          .metrics=${usageMetricsExtended}
          .series=${this.series}
          .loading=${this.loading}
          @lia-period-change=${(event: CustomEvent<{ period: string }>) => {
            void this.setPeriod(event.detail.period);
          }}
        ></lia-traffic-view>
      </div>

      <div class="row g-3">
        <div class="col-12 col-xl-7" id="requests">
          <lia-traffic-view
            title="Requests"
            icon="fa-solid fa-bolt"
            format="number"
            chart-type="line"
            stacked="false"
            show-table="false"
            height="240"
            .periods=${[]}
            .metrics=${requestMetrics}
            .series=${requestsByDay}
          ></lia-traffic-view>
        </div>
        <div class="col-12 col-xl-5" id="stored">
          <lia-traffic-view
            title="Stored data"
            icon="fa-solid fa-database"
            format="bytes"
            chart-type="line"
            show-table="false"
            height="240"
            .periods=${[]}
            .metrics=${storageMetrics}
            .series=${storageGrowth}
          ></lia-traffic-view>
        </div>
      </div>
    </lia-page>`;
  }
}

/* ------------------------------------------------------------------ *
 * 7. Sign-in screen
 * ------------------------------------------------------------------ */

/** The sign-in screen — no shell, the whole viewport. */
@customElement('demo-page-login')
export class DemoPageLogin extends LiaElement {
  @state() private stage: 'password' | 'code' = 'password';
  @state() private loading = false;
  @state() private error = '';

  private async signIn(event: CustomEvent<LoginSubmitDetail>): Promise<void> {
    this.loading = true;
    this.error = '';
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.loading = false;
    if (event.detail.username === 'you' && event.detail.password === 'demo') {
      this.stage = 'code';
      return;
    }
    this.error = 'That combination is not recognised. Try <code>you</code> / <code>demo</code>.';
  }

  private async verify(event: CustomEvent<{ code: string }>): Promise<void> {
    this.loading = true;
    this.error = '';
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.loading = false;
    if (event.detail.code === '123456') {
      toast({ variant: 'success', message: 'Signed in.' });
      window.location.hash = routeHref(PAGE.dashboard);
      return;
    }
    this.error = 'That code is not valid. The demo accepts <code>123456</code>.';
  }

  protected override render(): TemplateResult {
    return html`
      <lia-auth-layout
        brand="Orbit Console"
        brand-icon="fa-solid fa-satellite"
        heading=${this.stage === 'password' ? 'Sign in' : 'Confirm it is you'}
        description=${this.stage === 'password'
          ? 'Use the credentials your administrator gave you. This demo accepts you / demo.'
          : 'Enter the six-digit code from your authenticator app. This demo accepts 123456.'}
        error=${this.error}
        trusted-html
        max-width="440"
        footer-text="Orbit Console 4.12.0 · eu-central"
        .links=${this.stage === 'password'
          ? // Recovery is deliberately *not* listed here — the login form
            // already renders it inline under the password field.
            [{ label: 'Set up a new installation', url: routeHref(PAGE.install) }]
          : [{ label: 'Use a different account', url: routeHref(PAGE.login) }]}
      >
        ${this.stage === 'password'
          ? html`<lia-login-form
              show-remember
              show-forgot
              forgot-href=${routeHref('/auth/recovery')}
              username-placeholder="you"
              password-placeholder="demo"
              .languages=${[
                { value: 'en', label: 'English' },
                { value: 'de', label: 'Deutsch' },
                { value: 'pt', label: 'Português' },
              ]}
              language="en"
              .loading=${this.loading}
              @lia-login=${this.signIn}
            ></lia-login-form>`
          : html`<lia-two-factor-form
              show-remember
              show-resend
              show-recovery
              resend-cooldown="15"
              .loading=${this.loading}
              @lia-two-factor=${this.verify}
              @lia-two-factor-resend=${() =>
                toast({ variant: 'info', message: 'A new code was sent.', timeout: 2500 })}
            ></lia-two-factor-form>`}
      </lia-auth-layout>
    `;
  }
}

/* ------------------------------------------------------------------ *
 * 8. Install wizard
 * ------------------------------------------------------------------ */

/** The first-run installer — a wizard on a bare page, no shell at all. */
@customElement('demo-page-install')
export class DemoPageInstall extends LiaElement {
  @state() private current = 'organisation';
  @state() private done = false;
  @state() private values: FormValues = {};

  private get stepIndex(): number {
    return Math.max(
      0,
      onboardingSteps.findIndex((step) => step.id === this.current)
    );
  }

  protected override render(): TemplateResult {
    return html`
      <div class="min-vh-100 d-flex flex-column bg-body-tertiary">
        <header class="border-bottom bg-body">
          <div class="container-xl py-3 d-flex flex-wrap align-items-center gap-3">
            <span class="fs-4 text-primary"
              ><i class="fa-solid fa-satellite" aria-hidden="true"></i
            ></span>
            <div class="flex-grow-1">
              <p class="h5 mb-0">Set up Orbit Console</p>
              <p class="small text-body-secondary mb-0">
                Four steps. Nothing is written until the last one.
              </p>
            </div>
            <span class="badge rounded-pill text-bg-secondary"
              >Step ${this.stepIndex + 1} of ${onboardingSteps.length}</span
            >
            <!-- Every other fullscreen screen carries its own colour-scheme
                 switch (the shell's navbar, the auth layout's); the installer
                 header is where this one belongs. -->
            <lia-theme-toggle></lia-theme-toggle>
          </div>
        </header>

        <main class="flex-grow-1">
          <div class="container-xl py-4">
            ${this.done
              ? html`<div class="row justify-content-center">
                  <div class="col-12 col-lg-8">
                    <lia-hint
                      variant="success"
                      icon="fa-solid fa-circle-check"
                      heading="The organisation is ready"
                      lead="Everything below was created. You can sign in with the administrator account you just defined."
                      .steps=${[
                        { title: 'Sign in', text: 'Use the address and password from step two.' },
                        {
                          title: 'Add your first host',
                          code: 'orbitctl agent install --token orbit_join_2f8c41d0a97b',
                        },
                        { title: 'Invite the rest of the team', text: 'People & access → Members.' },
                      ]}
                      .actions=${[
                        {
                          id: 'signin',
                          label: 'Go to the sign-in screen',
                          icon: 'fa-solid fa-right-to-bracket',
                          variant: 'primary',
                          href: routeHref(PAGE.login),
                        },
                        {
                          id: 'restart',
                          label: 'Start again',
                          icon: 'fa-solid fa-rotate-left',
                          variant: 'outline-secondary',
                        },
                      ] as ActionDescriptor[]}
                      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
                        if (event.detail?.id !== 'restart') return;
                        this.done = false;
                        this.current = 'organisation';
                        this.values = {};
                      }}
                    ></lia-hint>
                    <div class="mt-3">
                      <lia-code-block
                        .code=${JSON.stringify(this.values, null, 2)}
                        language="json"
                        filename="what the installer collected"
                        max-height="18rem"
                      ></lia-code-block>
                    </div>
                  </div>
                </div>`
              : html`<div class="row justify-content-center">
                  <div class="col-12 col-lg-10 col-xl-8">
                    <lia-wizard
                      current=${this.current}
                      .steps=${onboardingSteps}
                      @lia-wizard-step=${(event: CustomEvent<WizardStepDetail>) => {
                        this.current = event.detail.id;
                      }}
                      @lia-wizard-finish=${(event: CustomEvent<WizardFinishDetail>) => {
                        this.values = event.detail.values;
                        this.done = true;
                      }}
                    ></lia-wizard>
                  </div>
                </div>`}
          </div>
        </main>

        <lia-footer
          text="Orbit Console — a fictional operations product."
          version="4.12.0"
          note="Nothing on this screen is persisted."
        ></lia-footer>
      </div>
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The eight complete screens. */
export const fullPageRoutes: DemoRoute[] = [
  {
    path: PAGE.dashboard,
    title: 'Admin dashboard',
    group: 'full-pages',
    icon: 'fa-solid fa-gauge-high',
    description: 'A landing page: KPIs, capacity meters, charts and activity.',
    keywords: ['dashboard', 'overview', 'landing', 'admin', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-dashboard></demo-page-dashboard>`,
  },
  {
    path: PAGE.members,
    title: 'CRUD list page',
    group: 'full-pages',
    icon: 'fa-solid fa-users',
    description: 'Members: filters, search, bulk actions and paging over an API.',
    keywords: ['crud', 'list', 'members', 'filters', 'bulk', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-members></demo-page-members>`,
  },
  {
    path: PAGE.member,
    title: 'Create & edit page',
    group: 'full-pages',
    icon: 'fa-solid fa-user-plus',
    description: 'A form screen with a section rail, validation and a sticky save bar.',
    keywords: ['form', 'create', 'edit', 'validation', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-member-form></demo-page-member-form>`,
  },
  {
    path: PAGE.settings,
    title: 'Settings page',
    group: 'full-pages',
    icon: 'fa-solid fa-gears',
    description: 'Six groups, a filter, an anchor rail and a matching sub-sidebar.',
    keywords: ['settings', 'preferences', 'sub-sidebar', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-settings></demo-page-settings>`,
  },
  {
    path: PAGE.logs,
    title: 'Log viewer page',
    group: 'full-pages',
    icon: 'fa-solid fa-file-lines',
    description: 'A source tree beside a tailing log pane, with related alerts.',
    keywords: ['logs', 'tail', 'observability', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-logs></demo-page-logs>`,
  },
  {
    path: PAGE.usage,
    title: 'Usage & traffic page',
    group: 'full-pages',
    icon: 'fa-solid fa-chart-area',
    description: 'Capacity meters over three usage views with a period picker.',
    keywords: ['usage', 'traffic', 'quota', 'billing', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-usage></demo-page-usage>`,
  },
  {
    path: PAGE.login,
    title: 'Sign-in screen',
    group: 'full-pages',
    icon: 'fa-solid fa-right-to-bracket',
    description: 'Password, then the second factor — the whole viewport.',
    keywords: ['login', 'sign in', 'auth', '2fa', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-login></demo-page-login>`,
  },
  {
    path: PAGE.install,
    title: 'Install wizard',
    group: 'full-pages',
    icon: 'fa-solid fa-wand-magic-sparkles',
    description: 'First-run setup: four gated steps and a finished state.',
    keywords: ['install', 'setup', 'wizard', 'onboarding', 'product'],
    fullscreen: true,
    render: () => html`<demo-page-install></demo-page-install>`,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-page-dashboard': DemoPageDashboard;
    'demo-page-members': DemoPageMembers;
    'demo-page-member-form': DemoPageMemberForm;
    'demo-page-settings': DemoPageSettings;
    'demo-page-logs': DemoPageLogs;
    'demo-page-usage': DemoPageUsage;
    'demo-page-login': DemoPageLogin;
    'demo-page-install': DemoPageInstall;
  }
}
