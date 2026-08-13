/**
 * Demo pages — Getting started.
 *
 * The four screens a reader wants before they look at a single component: what
 * the kit is, how to install it, why it renders into the light DOM, how to
 * re-brand it, and where every family lives.
 *
 * The overview doubles as the application's home route (`/`), so it is the
 * first thing the router resolves.
 */

import { html, type TemplateResult } from 'lit';
import { DEMO_GROUPS } from '../nav.js';
import { routeHref, type DemoRoute } from '../router.js';
import { dedent, example, grid, note, propTable, section } from './_kit.js';

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const INSTALL_NPM = dedent`
  npm install @liasoft/lit-ui lit bootstrap
`;

const BOOTSTRAP_ENTRY = dedent`
  // main.ts — the whole set-up, once, at application start-up.

  // 1. The stylesheet. Mandatory: the kit renders into the light DOM, so
  //    Bootstrap's rules and the kit's own partials must be global.
  import '@liasoft/lit-ui/styles.css';

  // 2. The elements. Importing the package registers every <lia-*> tag.
  import { initTheme, installConfirmHandler } from '@liasoft/lit-ui';

  // 3. The two document-level services.
  initTheme();              // light / dark / auto, persisted
  installConfirmHandler();  // upgrades ActionDescriptor.confirm to a real dialog
`;

const FIRST_SCREEN = dedent`
  import { html, LitElement } from 'lit';
  import { customElement, state } from 'lit/decorators.js';
  import type { NavItem, TableListing } from '@liasoft/lit-ui';

  const nav: NavItem[] = [
    { label: 'Overview', icon: 'fa-solid fa-gauge-high', url: '#/', active: true },
    {
      label: 'People',
      icon: 'fa-solid fa-users',
      items: [{ label: 'Members', url: '#/members', badge: { text: 60 } }],
    },
  ];

  const listing: TableListing = {
    id: 'members',
    columns: [
      { key: 'name', label: 'Name', sortable: true, searchable: true },
      { key: 'role', label: 'Role', renderer: 'badge' },
      { key: 'active', label: 'Enabled', renderer: 'boolean' },
    ],
    rows: [
      { name: 'Amara Okonkwo', role: { text: 'Owner', variant: 'primary' }, active: true },
      { name: 'Jonas Lindqvist', role: { text: 'Operator', variant: 'info' }, active: false },
    ],
  };

  @customElement('my-app')
  export class MyApp extends LitElement {
    // Light DOM — see "The light-DOM contract" below.
    protected createRenderRoot() { return this; }

    @state() private sort = { field: 'name', order: 'asc' as const };

    render() {
      return html\`
        <lia-app-shell brand-label="Console" .navItems=\${nav}>
          <lia-page title="Members" icon="fa-solid fa-users">
            <lia-table
              .listing=\${{ ...listing, sort: this.sort }}
              @lia-sort=\${(e: CustomEvent) => (this.sort = e.detail)}
            ></lia-table>
          </lia-page>
        </lia-app-shell>
      \`;
    }
  }
`;

const LIGHT_DOM = dedent`
  // Every element in the kit does this, and so must any host that wraps one:
  class MyThing extends LitElement {
    protected createRenderRoot(): HTMLElement { return this; }
  }

  // Or, simply extend the kit's base class, which does it for you and adds
  // the typed \`this.emit()\` helper every kit event goes through:
  import { LiaElement } from '@liasoft/lit-ui';

  class MyThing extends LiaElement {}
`;

const THEME_SCSS = dedent`
  // styles/app.scss — your stylesheet, replacing '@liasoft/lit-ui/styles.css'.
  //
  // Every token in the kit is declared with \`!default\`, so anything you set
  // first wins. Set the brand ramp and the semantic colours fall in behind it.

  $lia-500: #7c3aed;   // brand ramp, 50 → 900
  $lia-800: #5b21b6;

  $primary:   $lia-800;
  $success:   #047857;
  $danger:    #b91c1c;

  $font-size-root:    15px;
  $spacer:            1.15rem;
  $lia-sidebar-width: 288px;

  // …then pull in the kit, which imports Bootstrap, the icon font and every
  // component partial:
  @use '@liasoft/lit-ui/scss/app';
`;

const THEME_RUNTIME = dedent`
  import { applyScheme, getEffectiveScheme, getPreferredScheme } from '@liasoft/lit-ui';

  getPreferredScheme();  // → 'light' | 'dark' | 'auto'  (what the user picked)
  getEffectiveScheme();  // → 'light' | 'dark'           (what is on screen)
  applyScheme('dark');   // stamps data-bs-theme="dark" on <html> and persists it

  // Anything that needs to repaint listens for the notification:
  window.addEventListener('lia-theme-change', (event) => {
    console.log(event.detail); // { scheme: 'dark', effective: 'dark' }
  });
`;

const DATA_DRIVEN = dedent`
  // The same idea in all three layers: describe it, hand it over, listen.

  const listing: TableListing<Member> = { id, columns, rows, pagination, rowActions };
  const definition: FormDefinition   = { title, sections: { main: { fields } } };
  const nav: NavItem[]               = [{ label, icon, url, items }];

  html\`
    <lia-table    .listing=\${listing}       @lia-sort=\${onSort}></lia-table>
    <lia-form     .definition=\${definition} @lia-submit=\${onSubmit}></lia-form>
    <lia-sidebar  .items=\${nav}             @lia-navigate=\${onNavigate}></lia-sidebar>
  \`;
`;

/* ------------------------------------------------------------------ *
 * Page bodies
 * ------------------------------------------------------------------ */

function familyCard(
  label: string,
  icon: string,
  description: string,
  href: string
): TemplateResult {
  return html`<div class="col">
    <a class="card h-100 text-decoration-none text-body demo-family-card" href=${href}>
      <div class="card-body d-flex gap-3">
        <span class="fs-4 text-primary flex-shrink-0"
          ><i class=${icon} aria-hidden="true"></i
        ></span>
        <span>
          <span class="d-block fw-semibold">${label}</span>
          <span class="d-block small text-body-secondary">${description}</span>
        </span>
      </div>
    </a>
  </div>`;
}

function renderOverview(): TemplateResult {
  return html`
    ${section(
      'What this is',
      'A Bootstrap 5 web-components kit for building administration interfaces — the chrome, the listings and the forms, as custom elements you drive with plain objects.',
      [
        example(
          'Three ideas, and that is the whole kit',
          html`
            <div class="row g-3">
              <div class="col-12 col-lg-4">
                <div class="h-100 p-3 border rounded-3 bg-body-tertiary">
                  <p class="fw-semibold mb-1">
                    <i class="fa-solid fa-database text-primary me-2" aria-hidden="true"></i>Data
                    driven
                  </p>
                  <p class="small text-body-secondary mb-0">
                    A page is a value. A listing is an object, a form is an object, the navigation
                    is an array. Nothing is templated by hand twice.
                  </p>
                </div>
              </div>
              <div class="col-12 col-lg-4">
                <div class="h-100 p-3 border rounded-3 bg-body-tertiary">
                  <p class="fw-semibold mb-1">
                    <i class="fa-brands fa-bootstrap text-primary me-2" aria-hidden="true"></i>Real
                    Bootstrap
                  </p>
                  <p class="small text-body-secondary mb-0">
                    Light DOM, Bootstrap classes, Bootstrap's own JavaScript plugins. Your utility
                    classes reach inside every component, because there is no boundary to cross.
                  </p>
                </div>
              </div>
              <div class="col-12 col-lg-4">
                <div class="h-100 p-3 border rounded-3 bg-body-tertiary">
                  <p class="fw-semibold mb-1">
                    <i class="fa-solid fa-plug text-primary me-2" aria-hidden="true"></i>Framework
                    free
                  </p>
                  <p class="small text-body-secondary mb-0">
                    Custom elements and DOM events. Usable from Lit, React, Vue, Svelte, a Twig
                    template or a plain <code>&lt;script&gt;</code> tag.
                  </p>
                </div>
              </div>
            </div>
          `,
          DATA_DRIVEN,
          { description: 'The pattern every family repeats' }
        ),
        example(
          'A first screen',
          html`<p class="mb-0 text-body-secondary">
            An application shell, a page and a sortable listing — the shape of most admin screens,
            in about forty lines.
          </p>`,
          FIRST_SCREEN,
          { openCode: true, codeLabel: 'my-app.ts' }
        ),
      ]
    )}
    ${section(
      'The families',
      'Eleven groups of elements. Every one of them has its own pages in the sidebar, with every variation the element supports.',
      grid(
        3,
        DEMO_GROUPS.filter((group) => group.id !== 'getting-started').map((group) =>
          familyCard(group.label, group.icon, group.description, routeHref(firstPathOf(group.id)))
        )
      )
    )}
    ${section(
      'Where to go next',
      'The three pages that answer the questions people actually ask first.',
      example(
        '',
        html`<div class="list-group list-group-flush">
          <a class="list-group-item list-group-item-action d-flex gap-3" href=${routeHref(
            '/getting-started/installation'
          )}>
            <i class="fa-solid fa-download fs-5 text-body-secondary" aria-hidden="true"></i>
            <span
              ><span class="d-block fw-semibold">Installation</span>
              <span class="small text-body-secondary"
                >The three imports, and what happens if you skip the stylesheet.</span
              ></span
            >
          </a>
          <a class="list-group-item list-group-item-action d-flex gap-3" href=${routeHref(
            '/getting-started/light-dom'
          )}>
            <i class="fa-solid fa-code-branch fs-5 text-body-secondary" aria-hidden="true"></i>
            <span
              ><span class="d-block fw-semibold">The light-DOM contract</span>
              <span class="small text-body-secondary"
                >Why there is no shadow root, and what that buys you.</span
              ></span
            >
          </a>
          <a class="list-group-item list-group-item-action d-flex gap-3" href=${routeHref(
            '/getting-started/theming'
          )}>
            <i class="fa-solid fa-palette fs-5 text-body-secondary" aria-hidden="true"></i>
            <span
              ><span class="d-block fw-semibold">Theming</span>
              <span class="small text-body-secondary"
                >Override the SCSS tokens; dark mode comes for free.</span
              ></span
            >
          </a>
          <a class="list-group-item list-group-item-action d-flex gap-3" href=${routeHref(
            '/full-pages/dashboard'
          )}>
            <i class="fa-solid fa-window-maximize fs-5 text-body-secondary" aria-hidden="true"></i>
            <span
              ><span class="d-block fw-semibold">Full pages</span>
              <span class="small text-body-secondary"
                >Six complete screens, assembled from the families.</span
              ></span
            >
          </a>
        </div>`,
        undefined,
        { bodyClass: 'p-0' }
      )
    )}
  `;
}

/** The first demo path of a family, used by the overview's family cards. */
function firstPathOf(group: string): string {
  const entry = FAMILY_ENTRY[group];
  return entry ?? '/';
}

const FAMILY_ENTRY: Record<string, string> = {
  layout: '/layout/app-shell',
  primitives: '/primitives/buttons',
  feedback: '/feedback/alerts',
  table: '/table/listing',
  crud: '/crud/list',
  forms: '/forms/fields',
  dashboard: '/dashboard/overview',
  settings: '/settings/page',
  auth: '/auth/sign-in',
  editors: '/editors/records',
  'full-pages': '/full-pages/dashboard',
};

function renderInstallation(): TemplateResult {
  return html`
    ${section('Install', 'One package, two peers: Lit renders the elements, Bootstrap styles them.', [
      example(
        'From npm',
        html`<lia-code-block .code=${INSTALL_NPM} language="bash" no-header></lia-code-block>`,
        undefined,
        { bodyClass: 'p-3' }
      ),
      example(
        'Wire it up once',
        html`<lia-code-block
          .code=${BOOTSTRAP_ENTRY}
          language="ts"
          filename="main.ts"
          max-height="26rem"
        ></lia-code-block>`,
        undefined,
        { bodyClass: 'p-3' }
      ),
      note(
        html`<strong>The stylesheet is not optional.</strong> Without it the elements still render
          and still work — they simply have no styling at all, because a light-DOM component cannot
          carry its own. If a page looks like unstyled HTML, that import is missing.`,
        'warning',
        'fa-solid fa-triangle-exclamation'
      ),
    ])}
    ${section(
      'What you get',
      'The package entry registers everything. Sub-paths exist for the families, if you would rather not pay for the whole kit.',
      [
        example(
          'Entry points',
          propTable(
            [
              {
                name: '@liasoft/lit-ui',
                type: 'module',
                description: 'Registers every element and re-exports the types, utilities and theme helpers.',
              },
              {
                name: '@liasoft/lit-ui/styles.css',
                type: 'css',
                description: 'The compiled stylesheet: tokens, Bootstrap, the icon font, the component partials.',
              },
              {
                name: '@liasoft/lit-ui/scss/app',
                type: 'scss',
                description: 'The uncompiled source, for when you want to override the tokens first.',
              },
              {
                name: '@liasoft/lit-ui/components/<family>',
                type: 'module',
                description: 'One family, e.g. `table` or `form`, when a subset is enough.',
              },
            ],
            'Package entry points'
          )
        ),
        example(
          'Peer dependencies',
          propTable(
            [
              { name: 'lit', type: '^3.3', description: 'The rendering library the elements are built on.' },
              {
                name: 'bootstrap',
                type: '^5.3',
                description:
                  'CSS *and* JS. Collapse, dropdown, modal, popover and tooltip are used directly — no jQuery anywhere.',
              },
              {
                name: 'chart.js',
                type: '^4.4 (optional)',
                description:
                  '`<lia-chart>` loads it lazily and degrades to a plain message if it is absent.',
              },
            ],
            'Peer dependencies'
          )
        ),
      ]
    )}
  `;
}

function renderLightDom(): TemplateResult {
  return html`
    ${section(
      'No shadow root. Anywhere.',
      'Every element in the kit renders its markup as ordinary children of its own tag. That is a deliberate trade, and it is the single most important thing to know about the kit.',
      [
        example(
          'What it buys you',
          html`<div class="row g-3">
            <div class="col-12 col-md-6">
              <ul class="list-group list-group-flush">
                <li class="list-group-item">
                  <i class="fa-solid fa-check text-success me-2" aria-hidden="true"></i>Bootstrap's
                  stylesheet reaches every element — no duplicated CSS per component.
                </li>
                <li class="list-group-item">
                  <i class="fa-solid fa-check text-success me-2" aria-hidden="true"></i>Bootstrap's
                  JavaScript plugins work, because they can query the DOM they expect.
                </li>
                <li class="list-group-item">
                  <i class="fa-solid fa-check text-success me-2" aria-hidden="true"></i>Utility
                  classes on a host apply inside it: <code>&lt;lia-card class="mb-0"&gt;</code>.
                </li>
                <li class="list-group-item">
                  <i class="fa-solid fa-check text-success me-2" aria-hidden="true"></i>Browser
                  find-in-page, print stylesheets and screen readers see one flat document.
                </li>
              </ul>
            </div>
            <div class="col-12 col-md-6">
              <ul class="list-group list-group-flush">
                <li class="list-group-item">
                  <i class="fa-solid fa-xmark text-danger me-2" aria-hidden="true"></i>You must load
                  the stylesheet yourself, once, globally.
                </li>
                <li class="list-group-item">
                  <i class="fa-solid fa-xmark text-danger me-2" aria-hidden="true"></i>Your CSS can
                  reach in and break a component. Treat the markup as public.
                </li>
                <li class="list-group-item">
                  <i class="fa-solid fa-xmark text-danger me-2" aria-hidden="true"></i>No
                  <code>&lt;slot&gt;</code>: content is projected through properties instead —
                  <code>.content=\${…}</code> takes any Lit template.
                </li>
              </ul>
            </div>
          </div>`,
          LIGHT_DOM
        ),
        example(
          'Content, without slots',
          html`<lia-card
            title="Projected content"
            subtitle="…passed as a property, not a slot"
            icon="fa-solid fa-cube"
            .content=${html`<p class="mb-0">
              This paragraph was handed to <code>&lt;lia-card&gt;</code> as
              <code>.content</code>. Anything Lit can render works: a template, an array, a string,
              another element.
            </p>`}
          ></lia-card>`,
          dedent`
            html\`<lia-card
              title="Projected content"
              .content=\${html\`<p class="mb-0">Anything Lit can render.</p>\`}
            ></lia-card>\`;
          `
        ),
      ]
    )}
    ${section(
      'Events, not callbacks',
      'Components never take a handler prop. They dispatch composed, bubbling `CustomEvent`s named `lia-*`, so a listener anywhere up the tree hears them.',
      example(
        'The convention',
        propTable([
          { name: 'lia-action', type: 'ActionEventDetail', description: 'A button described by an `ActionDescriptor` was pressed.' },
          { name: 'lia-submit', type: 'FormSubmitDetail', description: 'A form passed validation and wants to be saved.' },
          { name: 'lia-change', type: '{ name, value, values }', description: 'One field of a form changed.' },
          { name: 'lia-sort', type: 'SortState', description: 'A sortable column header was clicked.' },
          { name: 'lia-page-change', type: '{ page }', description: 'A pagination control was used.' },
          { name: 'lia-navigate', type: '{ url, item }', description: 'A navigation entry was activated. Cancelable.' },
          { name: 'lia-dismiss', type: '{ id }', description: 'An alert, banner or toast was closed.' },
        ], 'Core events')
      )
    )}
  `;
}

function renderTheming(): TemplateResult {
  return html`
    ${section(
      'Re-brand with tokens',
      'Every SCSS variable is declared `!default`, so setting it before the import wins. There is no `!important` anywhere in the kit and no hard-coded colour in any component.',
      [
        example(
          'Your stylesheet',
          html`<lia-code-block
            .code=${THEME_SCSS}
            language="scss"
            filename="styles/app.scss"
            max-height="26rem"
          ></lia-code-block>`,
          undefined,
          { bodyClass: 'p-3' }
        ),
        example(
          'The tokens worth knowing',
          propTable([
            { name: '$lia-50 … $lia-900', type: 'color', default: 'blue ramp', description: 'The brand ramp. Everything else derives from it.' },
            { name: '$primary', type: 'color', default: '$lia-800', description: 'Bootstrap primary — buttons, links, active states.' },
            { name: '$success / $warning / $danger / $info', type: 'color', description: 'The semantic colours used by badges, alerts and usage meters.' },
            { name: '$body-bg / $body-color', type: 'color', description: 'Light-mode surface and text. Dark mode is derived by Bootstrap.' },
            { name: '$font-size-root', type: 'length', default: '16px', description: 'Scales the entire kit — every size is in `rem`.' },
            { name: '$spacer', type: 'length', default: '1.25rem', description: 'The spacing scale Bootstrap utilities are built from.' },
            { name: '$lia-sidebar-width', type: 'length', default: '256px', description: 'Width of the primary navigation rail.' },
            { name: '$navbar-bg', type: 'color', default: '$white', description: 'Top-bar surface. A separate token exists for the mobile drawer.' },
          ], 'Design tokens')
        ),
      ]
    )}
    ${section(
      'Dark mode',
      'The kit uses Bootstrap 5.3 colour modes: one `data-bs-theme` attribute on `<html>` and every component follows. Nothing in the kit reads the media query directly.',
      [
        example(
          'The runtime API',
          html`<div class="vstack gap-3">
            <div class="d-flex flex-wrap align-items-center gap-3">
              <lia-theme-toggle variant="dropdown" show-label></lia-theme-toggle>
              <lia-theme-toggle variant="button"></lia-theme-toggle>
              <span class="small text-body-secondary"
                >Both write the same preference — try them, then reload.</span
              >
            </div>
            <lia-code-block .code=${THEME_RUNTIME} language="ts" no-header></lia-code-block>
          </div>`,
          undefined
        ),
        note(
          html`Because contrast is Bootstrap's job, components only ever use contextual classes
            (<code>text-bg-success</code>, <code>bg-body-tertiary</code>,
            <code>border-danger</code>). If you add a colour of your own, add it as a token so it
            gets a dark-mode counterpart too.`,
          'info'
        ),
      ]
    )}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The introductory screens, including the application's home route. */
export const gettingStartedRoutes: DemoRoute[] = [
  {
    path: '/',
    title: 'Overview',
    group: 'getting-started',
    icon: 'fa-solid fa-house',
    description: 'A Bootstrap 5 web-components kit for administration interfaces.',
    keywords: ['home', 'intro', 'about', 'start', 'readme'],
    render: renderOverview,
  },
  {
    path: '/getting-started/installation',
    title: 'Installation',
    group: 'getting-started',
    icon: 'fa-solid fa-download',
    description: 'One package, two peer dependencies and three imports.',
    keywords: ['npm', 'install', 'setup', 'peer', 'stylesheet', 'bundler'],
    render: renderInstallation,
  },
  {
    path: '/getting-started/light-dom',
    title: 'The light-DOM contract',
    group: 'getting-started',
    icon: 'fa-solid fa-code-branch',
    description: 'No shadow roots: what that buys you, and what it costs.',
    keywords: ['shadow', 'dom', 'slot', 'events', 'conventions', 'css'],
    render: renderLightDom,
  },
  {
    path: '/getting-started/theming',
    title: 'Theming',
    group: 'getting-started',
    icon: 'fa-solid fa-palette',
    description: 'Override the SCSS tokens; dark mode follows on its own.',
    keywords: ['theme', 'dark', 'colour', 'color', 'scss', 'brand', 'tokens'],
    render: renderTheming,
  },
];
