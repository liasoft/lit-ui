/**
 * Demo pages — Layout & navigation.
 *
 * The application chrome: the shell that owns the viewport, the bars and rails
 * inside it, the page heading, and the small pieces (breadcrumb, footer,
 * theme toggle, global search) that make a screen feel finished.
 *
 * The shell previews are real `<lia-app-shell>` instances, shrunk into a
 * bordered frame with an inline `height`. Everything inside them — collapsing
 * groups, the mobile toggler, the user menu, the search panel — works exactly
 * as it does at full size.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  AlertMessage,
  NavItem,
  SearchResult,
} from '@liasoft/lit-ui';
import { LiaElement } from '@liasoft/lit-ui';
import {
  demoBreadcrumb,
  demoFooterLinks,
  demoNavItems,
  demoNavItemsCompact,
  demoSubNavItems,
  demoUser,
  demoUserMenu,
  demoMemberUser,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { cluster, dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Shared fixtures
 * ------------------------------------------------------------------ */

const FRAME = 'border rounded-3 overflow-hidden d-flex';
const FRAME_STYLE = 'height: 34rem;';
const SHELL_STYLE = 'min-height: 0; flex: 1 1 auto;';

const SHELL_BANNERS: AlertMessage[] = [
  {
    id: 'maintenance',
    variant: 'warning',
    icon: 'fa-solid fa-screwdriver-wrench',
    title: 'Maintenance window',
    message: 'Saturday 02:00–04:00 UTC. Deployments are paused during the window.',
    dismissible: true,
    actions: [{ id: 'details', label: 'Details', variant: 'light', size: 'sm' }],
  },
];

const HEADING_ACTIONS: ActionDescriptor[] = [
  { id: 'create', label: 'New volume', icon: 'fa-solid fa-plus', variant: 'primary' },
  { id: 'snapshot', label: 'Snapshot', icon: 'fa-solid fa-camera', variant: 'outline-secondary' },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'fa-solid fa-trash-can',
    variant: 'outline-danger',
    confirm: {
      title: 'Delete this volume?',
      message: 'The data cannot be recovered once the volume is gone.',
      confirmLabel: 'Delete it',
      variant: 'danger',
    },
  },
];

const PAGE_ALERTS: AlertMessage[] = [
  {
    id: 'saved',
    variant: 'success',
    message: 'The volume was resized to 512 GiB.',
    dismissible: true,
  },
  {
    id: 'note',
    variant: 'info',
    message: 'Resizing is online — no restart is needed.',
  },
];

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * A shrunk-down but fully working application shell, with a transcript of the
 * events it raises.
 *
 * @example
 * ```ts
 * html`<demo-shell-preview></demo-shell-preview>`;
 * ```
 */
@customElement('demo-shell-preview')
export class DemoShellPreview extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];
  @state() private banners: AlertMessage[] = SHELL_BANNERS;
  @state() private results: SearchResult[] = [];

  private log(type: string, detail?: unknown): void {
    this.events = logEvent(this.events, type, detail);
  }

  private onNavigate(event: CustomEvent<{ url: string; item?: NavItem }>): void {
    // The preview's links are fictional: swallow them so the demo stays put.
    event.preventDefault();
    this.log('lia-navigate', { url: event.detail?.url, label: event.detail?.item?.label });
  }

  private onSearch(event: CustomEvent<{ field?: string; text: string }>): void {
    const text = event.detail?.text ?? '';
    this.log('lia-search', event.detail);
    const needle = text.toLowerCase();
    const hits: SearchResult[] = [];
    const walk = (items: NavItem[], group?: string): void => {
      for (const item of items) {
        if (item.visible === false) continue;
        if (item.items) walk(item.items, item.label);
        else if (item.label.toLowerCase().includes(needle)) {
          hits.push({ label: item.label, url: item.url ?? '#', icon: item.icon, group });
        }
      }
    };
    if (needle !== '') walk(demoNavItems);
    this.results = hits.slice(0, 8);
  }

  private onDismiss(event: CustomEvent<{ id?: string }>): void {
    const id = event.detail?.id;
    this.log('lia-dismiss', event.detail);
    if (id) this.banners = this.banners.filter((banner) => banner.id !== id);
  }

  protected override render(): TemplateResult {
    return html`
      <div class=${FRAME} style=${FRAME_STYLE}>
        <lia-app-shell
          style=${SHELL_STYLE}
          brand-label="Orbit Console"
          brand-href="#/layout/app-shell"
          home-href="#/layout/app-shell"
          home-label="Overview"
          nav-label="Console navigation"
          search-placeholder="Search resources…"
          sub-nav-title="On this page"
          footer-text="Orbit Console — a fictional operations product."
          .navItems=${demoNavItems}
          .subNavItems=${demoSubNavItems}
          .user=${demoUser}
          .userMenu=${demoUserMenu}
          .banners=${this.banners}
          .searchResults=${this.results}
          .footerLinks=${demoFooterLinks}
          @lia-navigate=${this.onNavigate}
          @lia-search=${this.onSearch}
          @lia-dismiss=${this.onDismiss}
          @lia-action=${(event: CustomEvent) => this.log('lia-action', event.detail)}
          @lia-logout=${(event: Event) => {
            event.preventDefault();
            this.log('lia-logout');
          }}
        >
          <lia-page
            title="vol-eu-central-041"
            icon="fa-solid fa-hard-drive"
            description="512 GiB · eu-central · attached to ingest-04"
            .badge=${{ text: 'healthy', variant: 'success' }}
            .actions=${HEADING_ACTIONS}
            .alerts=${PAGE_ALERTS}
            back-url="#/layout/app-shell"
            back-label="All volumes"
          >
            <p class="text-body-secondary">
              Everything between the navbar and the footer is your markup — written inside the tag,
              projected into the shell's content area.
            </p>
            <lia-key-value label="Provisioned" value="512 GiB"></lia-key-value>
            <lia-key-value label="Used" value="318 GiB (62%)"></lia-key-value>
            <lia-key-value label="Snapshot schedule" value="every 6 hours"></lia-key-value>
          </lia-page>
        </lia-app-shell>
      </div>
      ${eventLog(this.events, { title: 'What the shell emitted' })}
    `;
  }
}

/** A stand-alone, working `<lia-global-search>` over the demo navigation tree. */
@customElement('demo-global-search')
export class DemoGlobalSearch extends LiaElement {
  @state() private results: SearchResult[] = [];
  @state() private loading = false;
  @state() private events: readonly LoggedEvent[] = [];

  private timer?: ReturnType<typeof setTimeout>;

  override disconnectedCallback(): void {
    if (this.timer) clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  private onSearch(event: CustomEvent<{ field?: string; text: string }>): void {
    const text = (event.detail?.text ?? '').toLowerCase();
    this.events = logEvent(this.events, 'lia-search', event.detail);
    // Pretend the hits come from a server, so the loading state is visible.
    this.loading = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const hits: SearchResult[] = [];
      for (const group of demoNavItems) {
        for (const item of group.items ?? [group]) {
          if (item.visible === false) continue;
          if (!item.label.toLowerCase().includes(text)) continue;
          hits.push({
            label: item.label,
            description: group.items ? `in ${group.label}` : undefined,
            url: item.url ?? '#',
            icon: item.icon,
            group: group.items ? group.label : 'Top level',
          });
        }
      }
      this.results = hits.slice(0, 8);
      this.loading = false;
    }, 400);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Type at least three characters — "vol", "cert" or "log" all match something.')}
      <div class="bg-body-tertiary border rounded-3 p-3" style="max-width: 32rem;">
        <lia-global-search
          placeholder="Search the console…"
          label="Console search"
          field="demo"
          .results=${this.results}
          .loading=${this.loading}
          @lia-search=${this.onSearch}
          @lia-navigate=${(event: CustomEvent<{ url: string }>) => {
            event.preventDefault();
            this.events = logEvent(this.events, 'lia-navigate', event.detail);
          }}
        ></lia-global-search>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** The sidebar on its own, with a live event transcript. */
@customElement('demo-sidebar-preview')
export class DemoSidebarPreview extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];
  @state() private items: NavItem[] = demoNavItems;

  private onNavigate(event: CustomEvent<{ url: string; item?: NavItem }>): void {
    event.preventDefault();
    const url = event.detail?.url ?? '';
    this.events = logEvent(this.events, 'lia-navigate', event.detail);
    // Mark the activated entry, the way a router would.
    const mark = (items: NavItem[]): NavItem[] =>
      items.map((item) => {
        const children = item.items ? mark(item.items) : undefined;
        return {
          ...item,
          active: item.url === url || (children?.some((child) => child.active) ?? false),
          items: children,
        };
      });
    this.items = mark(this.items);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Open a group, pick an entry: the rail marks it active and reports the URL.')}
      <div class="${FRAME} bg-body-tertiary" style="height: 30rem;">
        <lia-sidebar
          label="Console navigation"
          .items=${this.items}
          @lia-navigate=${this.onNavigate}
        ></lia-sidebar>
        <div class="p-3 flex-grow-1 overflow-auto">
          <p class="text-body-secondary mb-0">
            The rail is <code>256px</code> wide (<code>$lia-sidebar-width</code>) and scrolls
            independently of the content beside it.
          </p>
        </div>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const SHELL_CODE = dedent`
  html\`<lia-app-shell
    brand-label="Orbit Console"
    home-href="/"
    search-placeholder="Search resources…"
    sub-nav-title="On this page"
    .navItems=\${navItems}          // NavItem[] — groups, badges, "+" shortcuts
    .subNavItems=\${pageSections}   // NavItem[] — the right-hand rail
    .user=\${{ loginname: 'a.okonkwo', name: 'Amara Okonkwo', isAdmin: true }}
    .userMenu=\${userMenu}          // UserMenuItem[]
    .banners=\${banners}            // AlertMessage[] — full-bleed, above the navbar
    .searchResults=\${hits}         // SearchResult[] — you own the searching
    .footerLinks=\${footerLinks}
    @lia-navigate=\${onNavigate}    // cancelable: preventDefault() to route yourself
    @lia-search=\${onSearch}
    @lia-dismiss=\${onDismissBanner}
    @lia-logout=\${onLogout}
  >
    <lia-page title="vol-eu-central-041" icon="fa-solid fa-hard-drive" .actions=\${actions}>
      …your page…
    </lia-page>
  </lia-app-shell>\`;
`;

const NAV_ITEM_CODE = dedent`
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'fa-solid fa-gauge-high', url: '#/', active: true },
    {
      id: 'storage',
      label: 'Storage',
      icon: 'fa-solid fa-database',
      items: [
        {
          label: 'Volumes',
          icon: 'fa-solid fa-hard-drive',
          url: '#/volumes',
          addUrl: '#/volumes/new',            // the "+" shortcut on the right
          badge: { text: 6 },
        },
        { label: 'Backups', url: '#/backups', badge: { text: '2 failed', variant: 'danger' } },
        { label: 'Archived', url: '#/archived', visible: false },   // hidden, not deleted
      ],
    },
    { label: 'Documentation', url: 'https://example.org/docs', external: true },
  ];
`;

const HEADING_CODE = dedent`
  html\`<lia-page-heading
    level="1"
    title="vol-eu-central-041"
    icon="fa-solid fa-hard-drive"
    description="512 GiB · eu-central · attached to ingest-04"
    back-url="#/volumes"
    back-label="All volumes"
    .badge=\${{ text: 'healthy', variant: 'success' }}
    .actions=\${[
      { id: 'create', label: 'New volume', icon: 'fa-solid fa-plus', variant: 'primary' },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'outline-danger',
        confirm: { message: 'The data cannot be recovered.', variant: 'danger' },
      },
    ]}
    @lia-action=\${(e: CustomEvent) => run(e.detail.id)}
  ></lia-page-heading>\`;
`;

const BREADCRUMB_CODE = dedent`
  html\`<lia-breadcrumb
    .items=\${[
      { label: 'Overview', url: '#/', icon: 'fa-solid fa-house' },
      { label: 'Storage', url: '#/storage' },
      { label: 'vol-eu-central-041', active: true },
    ]}
  ></lia-breadcrumb>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderAppShell(): TemplateResult {
  return html`
    ${section(
      'The whole chrome, in one element',
      'Banners, navbar, primary rail, content, secondary rail and footer. Your markup goes between the tags and is projected into the content area.',
      [
        example('A working shell', html`<demo-shell-preview></demo-shell-preview>`, SHELL_CODE, {
          description: 'Everything in the frame is live',
          bodyClass: 'p-3',
        }),
        note(
          html`There is no <code>&lt;slot&gt;</code>. The shell moves whatever you wrote inside the
            tag into its content section on connect, and watches for late additions with a
            <code>MutationObserver</code>. Appending imperatively works too:
            <code>shell.appendContent(node)</code>.`,
          'info'
        ),
      ]
    )}
    ${section('Composition', 'What the shell is made of, and when to reach for the parts instead.', [
      example(
        'The parts',
        propTable(
          [
            { name: 'banners', type: 'AlertMessage[]', description: 'Full-bleed strips above the navbar. Dismissal raises `lia-dismiss`.' },
            { name: 'navItems', type: 'NavItem[]', description: 'The primary rail. Nested entries become collapsible groups.' },
            { name: 'subNavItems', type: 'NavItem[]', description: 'The secondary rail, right of the content. Empty hides it.' },
            { name: 'subNavSticky', type: 'boolean', default: 'false', description: 'Keep the secondary rail in view while the content scrolls.' },
            { name: 'user / userMenu', type: 'UserInfo / UserMenuItem[]', description: 'The account drop-down at the end of the navbar.' },
            { name: 'searchEnabled', type: 'boolean', default: 'true', description: 'The navbar search field. You supply `searchResults`.' },
            { name: 'contentClass', type: 'string', description: 'Padding of the content section. Cleared automatically for a projected `<lia-page>`.' },
            { name: 'collapsedSidebar', type: 'boolean', default: 'false', description: 'Start with the primary rail collapsed to icons.' },
          ],
          'lia-app-shell properties'
        )
      ),
      example(
        'Without the rails',
        html`<div class=${FRAME} style="height: 22rem;">
          <lia-app-shell
            style=${SHELL_STYLE}
            brand-label="Minimal"
            search-enabled="false"
            content-class="p-4"
            .navItems=${[]}
            .user=${demoMemberUser}
            footer-text="A shell with no navigation is still a shell."
          >
            <h2 class="h5">Content-only</h2>
            <p class="text-body-secondary mb-0">
              No rail, no search, no user menu — useful for wizards, error screens and print views.
            </p>
          </lia-app-shell>
        </div>`,
        dedent`
          html\`<lia-app-shell brand-label="Minimal" search-enabled="false" content-class="p-4">
            …
          </lia-app-shell>\`;
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderNavbar(): TemplateResult {
  return html`
    ${section('Navbar', 'Brand, sidebar toggler, search, utility nav, theme toggle and the account menu.', [
      example(
        'Everything switched on',
        html`<lia-navbar
          brand-label="Orbit Console"
          brand-href="#/layout/navbar"
          home-href="#/layout/navbar"
          home-label="Overview"
          search-placeholder="Search resources…"
          .user=${demoUser}
          .userMenu=${demoUserMenu}
          .extra=${html`<li class="nav-item d-none d-lg-flex align-items-center me-2">
            <span class="badge rounded-pill text-bg-success">eu-central</span>
          </li>`}
          @lia-navigate=${(event: Event) => event.preventDefault()}
          @lia-logout=${(event: Event) => event.preventDefault()}
        ></lia-navbar>`,
        dedent`
          html\`<lia-navbar
            brand-label="Orbit Console"
            home-href="/"
            search-placeholder="Search resources…"
            .user=\${user}
            .userMenu=\${userMenu}
            .extra=\${html\`<li class="nav-item">…</li>\`}
          ></lia-navbar>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'No search, no account',
        html`<lia-navbar
          brand-label="Public status"
          brand-href="#/layout/navbar"
          search-enabled="false"
          show-logout="false"
        ></lia-navbar>`,
        dedent`
          html\`<lia-navbar brand-label="Public status" search-enabled="false" show-logout="false"></lia-navbar>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'A signed-in member, without administrator rights',
        html`<lia-navbar
          brand-label="Orbit Console"
          .user=${demoMemberUser}
          .userMenu=${demoUserMenu.slice(0, 3)}
          show-theme-toggle="false"
          @lia-navigate=${(event: Event) => event.preventDefault()}
          @lia-logout=${(event: Event) => event.preventDefault()}
        ></lia-navbar>`,
        undefined,
        { bodyClass: 'p-0', description: 'The role marker only appears for `isAdmin`' }
      ),
    ])}
    ${section('Global search', 'The navbar field is a `<lia-global-search>`: debounced, keyboard operable, and completely agnostic about where the hits come from.', [
      example('Live', html`<demo-global-search></demo-global-search>`, dedent`
        html\`<lia-global-search
          placeholder="Search the console…"
          field="global"
          min-chars="3"
          delay="250"
          .results=\${this.hits}
          .loading=\${this.loading}
          @lia-search=\${(e: CustomEvent) => this.query(e.detail.text)}
          @lia-navigate=\${(e: CustomEvent) => this.router.go(e.detail.url)}
        ></lia-global-search>\`;
      `),
      example(
        'States',
        html`<div class="row g-3">
          <div class="col-12 col-lg-4">
            <p class="small text-body-secondary mb-1">Below <code>min-chars</code></p>
            <lia-global-search placeholder="Search…" min-chars="3"></lia-global-search>
          </div>
          <div class="col-12 col-lg-4">
            <p class="small text-body-secondary mb-1">Loading</p>
            <lia-global-search placeholder="Search…" loading></lia-global-search>
          </div>
          <div class="col-12 col-lg-4">
            <p class="small text-body-secondary mb-1">Custom copy</p>
            <lia-global-search
              placeholder="Find a member…"
              min-chars-text="Keep going — three letters at least."
              empty-text="No member matches that."
              loading-text="Looking…"
            ></lia-global-search>
          </div>
        </div>`,
        undefined,
        { description: 'Every string is a property' }
      ),
    ])}
  `;
}

function renderSidebar(): TemplateResult {
  return html`
    ${section('Primary rail', 'A tree of `NavItem`s. Nesting makes a collapsible group; the group holding the active entry opens itself.', [
      example('Interactive', html`<demo-sidebar-preview></demo-sidebar-preview>`, NAV_ITEM_CODE, {
        bodyClass: 'p-3',
      }),
      example(
        'Flat and collapsed',
        split(
          html`<div class="${FRAME} bg-body-tertiary" style="height: 18rem;">
            <lia-sidebar
              .items=${demoNavItemsCompact}
              @lia-navigate=${(event: Event) => event.preventDefault()}
            ></lia-sidebar>
            <div class="p-3 small text-body-secondary">A flat rail, no groups.</div>
          </div>`,
          html`<div class="${FRAME} bg-body-tertiary" style="height: 18rem;">
            <lia-sidebar
              collapsed
              .items=${demoNavItemsCompact}
              @lia-navigate=${(event: Event) => event.preventDefault()}
            ></lia-sidebar>
            <div class="p-3 small text-body-secondary">
              <code>collapsed</code>: icons only, labels as tooltips.
            </div>
          </div>`
        ),
        dedent`
          html\`<lia-sidebar .items=\${items}></lia-sidebar>\`;
          html\`<lia-sidebar collapsed .items=\${items}></lia-sidebar>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Empty',
        html`<div class="${FRAME} bg-body-tertiary" style="height: 8rem;">
          <lia-sidebar .items=${[]}></lia-sidebar>
          <div class="p-3 small text-body-secondary">
            With no items the rail renders nothing at all — no empty box to work around.
          </div>
        </div>`,
        undefined,
        { bodyClass: 'p-3' }
      ),
    ])}
    ${section('Secondary rail', 'The right-hand rail: a page-local table of contents, or a context panel.', [
      example(
        'Sub-sidebar',
        html`<div class="${FRAME} bg-body-tertiary" style="height: 20rem;">
          <div class="p-3 flex-grow-1 small text-body-secondary">
            Content sits on the left; the rail docks to the right of it.
          </div>
          <lia-sub-sidebar
            title="On this page"
            .items=${demoSubNavItems}
            @lia-navigate=${(event: Event) => event.preventDefault()}
          ></lia-sub-sidebar>
        </div>`,
        dedent`
          html\`<lia-sub-sidebar
            title="On this page"
            sticky
            .items=\${[
              { label: 'General', url: '#general', active: true },
              { label: 'Security', url: '#security', badge: { text: '!', variant: 'warning' } },
            ]}
          ></lia-sub-sidebar>\`;
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderPage(): TemplateResult {
  return html`
    ${section('Page heading', 'A title bar: back link, icon, title, badge, description and an action toolbar.', [
      example(
        'Full',
        html`<lia-page-heading
          level="2"
          title="vol-eu-central-041"
          icon="fa-solid fa-hard-drive"
          description="512 GiB · eu-central · attached to ingest-04"
          back-url="#/layout/page"
          back-label="All volumes"
          .badge=${{ text: 'healthy', variant: 'success' }}
          .actions=${HEADING_ACTIONS}
          @lia-action=${(event: Event) => event.preventDefault()}
        ></lia-page-heading>`,
        HEADING_CODE,
        { bodyClass: 'p-0' }
      ),
      example(
        'Title only, and title plus one action',
        html`<div class="vstack gap-3">
          <lia-page-heading level="2" title="Members"></lia-page-heading>
          <lia-page-heading
            level="2"
            title="Members"
            icon="fa-solid fa-users"
            .actions=${[
              { id: 'add', label: 'Add member', icon: 'fa-solid fa-plus', variant: 'primary' },
            ] as ActionDescriptor[]}
          ></lia-page-heading>
        </div>`,
        undefined,
        { bodyClass: 'p-0' }
      ),
      example(
        'Heading levels',
        html`<div class="vstack gap-2">
          ${([1, 2, 3, 4, 5] as const).map(
            (level) => html`<lia-page-heading
              level=${level}
              title="level=${level}"
              description="The rendered tag is h${level}."
            ></lia-page-heading>`
          )}
        </div>`,
        dedent`
          // The shell's own heading is the page's <h1>; nested headings step down.
          html\`<lia-page-heading level="1" title="Members"></lia-page-heading>\`;
        `,
        { bodyClass: 'p-0', description: 'Pick the level the document outline needs' }
      ),
    ])}
    ${section('Page', 'Heading plus a dismissible alert region plus your content — ready to drop into the shell.', [
      example(
        'With alerts',
        html`<div class="border rounded-3 overflow-hidden">
          <lia-page
            title="Storage settings"
            icon="fa-solid fa-database"
            description="Defaults applied to every new volume."
            content-class="p-3 p-lg-4"
            .alerts=${PAGE_ALERTS}
            .actions=${[
              { id: 'save', label: 'Save', icon: 'fa-solid fa-check', variant: 'primary' },
            ] as ActionDescriptor[]}
            @lia-action=${(event: Event) => event.preventDefault()}
          >
            <p class="mb-0 text-body-secondary">
              Alerts are a property, not markup — the same <code>AlertMessage[]</code> the shell's
              banners take. Dismissing one raises <code>lia-dismiss</code> with its id.
            </p>
          </lia-page>
        </div>`,
        dedent`
          html\`<lia-page
            title="Storage settings"
            icon="fa-solid fa-database"
            .alerts=\${[{ id: 'saved', variant: 'success', message: 'Saved.', dismissible: true }]}
            .actions=\${actions}
            @lia-dismiss=\${(e: CustomEvent) => this.drop(e.detail.id)}
          >
            …content…
          </lia-page>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'Without the heading',
        html`<div class="border rounded-3 overflow-hidden">
          <lia-page show-heading="false" content-class="p-3">
            <p class="mb-0 text-body-secondary">
              <code>show-heading="false"</code> keeps the alert region and the content padding, and
              leaves the title to whatever is rendering above.
            </p>
          </lia-page>
        </div>`,
        undefined,
        { bodyClass: 'p-0' }
      ),
    ])}
  `;
}

function renderChrome(): TemplateResult {
  return html`
    ${section('Breadcrumb', 'A `NavItem[]` trail. The last entry is the current page and is not a link.', [
      example(
        'Trail',
        html`<lia-breadcrumb
          .items=${demoBreadcrumb}
          @lia-navigate=${(event: Event) => event.preventDefault()}
        ></lia-breadcrumb>`,
        BREADCRUMB_CODE
      ),
      example(
        'With a home shortcut and a custom divider',
        html`<div class="vstack gap-3">
          <lia-breadcrumb
            home-href="#/"
            home-label="Kit"
            .items=${demoBreadcrumb.slice(1)}
            @lia-navigate=${(event: Event) => event.preventDefault()}
          ></lia-breadcrumb>
          <lia-breadcrumb
            divider="›"
            .items=${demoBreadcrumb}
            @lia-navigate=${(event: Event) => event.preventDefault()}
          ></lia-breadcrumb>
        </div>`,
        dedent`
          html\`<lia-breadcrumb home-href="/" home-label="Kit" .items=\${trail}></lia-breadcrumb>\`;
          html\`<lia-breadcrumb divider="›" .items=\${trail}></lia-breadcrumb>\`;
        `
      ),
    ])}
    ${section('Colour scheme', 'One preference, stored once, applied as `data-bs-theme` on `<html>`. Both presentations write the same value.', [
      example(
        'Toggle',
        cluster(
          html`<lia-theme-toggle variant="dropdown"></lia-theme-toggle>`,
          html`<lia-theme-toggle variant="dropdown" show-label></lia-theme-toggle>`,
          html`<lia-theme-toggle variant="button"></lia-theme-toggle>`,
          html`<lia-theme-toggle
            variant="dropdown"
            show-label
            light-label="Day"
            dark-label="Night"
            auto-label="Follow the system"
            label="Appearance"
          ></lia-theme-toggle>`
        ),
        dedent`
          html\`<lia-theme-toggle variant="dropdown" show-label></lia-theme-toggle>\`;
          html\`<lia-theme-toggle variant="button"></lia-theme-toggle>\`;   // cycles light → dark → auto
        `,
        { description: 'Try one — the whole gallery follows' }
      ),
    ])}
    ${section('Footer', 'The strip at the bottom of the shell: a line of text, links, a version pill and an optional note.', [
      example(
        'Everything',
        html`<lia-footer
          text="Orbit Console — a fictional operations product."
          version="4.12.0"
          note="Built from @liasoft/lit-ui."
          .links=${demoFooterLinks}
        ></lia-footer>`,
        dedent`
          html\`<lia-footer
            text="Orbit Console"
            version="4.12.0"
            note="Built from @liasoft/lit-ui."
            .links=\${[{ label: 'Privacy', href: '/privacy' }]}
          ></lia-footer>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'Just the text',
        html`<lia-footer text="© 2026 Northwind Collective" show-version="false"></lia-footer>`,
        undefined,
        { bodyClass: 'p-0' }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The layout & navigation demos. */
export const layoutRoutes: DemoRoute[] = [
  {
    path: '/layout/app-shell',
    title: 'Application shell',
    group: 'layout',
    icon: 'fa-solid fa-table-columns',
    description: 'Banners, navbar, rails, content and footer in one element.',
    keywords: ['shell', 'chrome', 'layout', 'frame', 'projection', 'slot'],
    render: renderAppShell,
  },
  {
    path: '/layout/navbar',
    title: 'Navbar & search',
    group: 'layout',
    icon: 'fa-solid fa-window-maximize',
    description: 'The top bar, and the debounced global search inside it.',
    keywords: ['navbar', 'topbar', 'search', 'user menu', 'brand'],
    render: renderNavbar,
  },
  {
    path: '/layout/sidebar',
    title: 'Navigation rails',
    group: 'layout',
    icon: 'fa-solid fa-bars',
    description: 'The primary tree and the secondary, page-local rail.',
    keywords: ['sidebar', 'nav', 'menu', 'tree', 'collapse', 'sub-sidebar'],
    render: renderSidebar,
  },
  {
    path: '/layout/page',
    title: 'Pages & headings',
    group: 'layout',
    icon: 'fa-solid fa-heading',
    description: 'Title bars with actions, and the page wrapper around them.',
    keywords: ['heading', 'title', 'page', 'toolbar', 'actions', 'alerts'],
    render: renderPage,
  },
  {
    path: '/layout/chrome',
    title: 'Breadcrumb, theme & footer',
    group: 'layout',
    icon: 'fa-solid fa-shoe-prints',
    description: 'The small pieces that finish a screen.',
    keywords: ['breadcrumb', 'footer', 'theme', 'dark mode', 'toggle'],
    render: renderChrome,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-shell-preview': DemoShellPreview;
    'demo-global-search': DemoGlobalSearch;
    'demo-sidebar-preview': DemoSidebarPreview;
  }
}
