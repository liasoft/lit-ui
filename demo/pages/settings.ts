/**
 * Demo pages — Settings.
 *
 * The screens that configure a system rather than list its data: a filtered
 * settings page with an anchor rail and one save bar, plus the pieces it is
 * built from — the group element, the anchor rail and the scroll spy.
 *
 * Everything works: the filter really narrows the groups and the rail really
 * follows the scroll.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  AlertMessage,
  FormValues,
  FormSubmitDetail,
  SettingsGroup,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  filterSettingsGroups,
  settingsNavEntries,
  toast,
} from '@liasoft/lit-ui';
import { settingsGroups } from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * A complete settings page: filter, anchor rail, six groups, one save bar.
 *
 * @example
 * ```ts
 * html`<demo-settings-page></demo-settings-page>`;
 * ```
 */
@customElement('demo-settings-page')
export class DemoSettingsPage extends LiaElement {
  @state() private busy = false;
  @state() private saved?: FormValues;
  @state() private alerts: AlertMessage[] = [];
  @state() private events: readonly LoggedEvent[] = [];

  private async onSubmit(event: CustomEvent<FormSubmitDetail>): Promise<void> {
    this.busy = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.busy = false;
    this.saved = event.detail.values;
    this.alerts = [
      {
        id: 'saved',
        variant: 'success',
        message: `Saved ${Object.keys(event.detail.values).length} settings.`,
        dismissible: true,
      },
    ];
    toast({ variant: 'success', message: 'Settings saved.', timeout: 2500 });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Type "password" or "webhook" into the filter — groups and rows narrow, and the matches are highlighted. Then save and see the whole value model.'
      )}
      <div class="border rounded-3 overflow-hidden">
        <lia-settings-page
          title="Console settings"
          icon="fa-solid fa-gears"
          description="Everything that applies to this installation."
          content-class="p-3 p-lg-4"
          .groups=${settingsGroups}
          .alerts=${this.alerts}
          .busy=${this.busy}
          @lia-submit=${this.onSubmit}
          @lia-settings-filter=${(event: CustomEvent<{ text: string; matches: number }>) => {
            this.events = logEvent(this.events, 'lia-settings-filter', event.detail);
          }}
          @lia-settings-active=${(event: CustomEvent<{ id: string }>) => {
            this.events = logEvent(this.events, 'lia-settings-active', event.detail);
          }}
          @lia-dismiss=${(event: CustomEvent<{ id?: string }>) => {
            this.alerts = this.alerts.filter((alert) => alert.id !== event.detail?.id);
          }}
        ></lia-settings-page>
      </div>
      ${valueDump(this.saved, {
        title: 'Saved settings',
        empty: 'Press "Save" at the bottom of the page.',
        maxHeight: '20rem',
      })}
      ${eventLog(this.events)}
    `;
  }
}

/** The filtering model, on its own — no element involved. */
@customElement('demo-settings-filter')
export class DemoSettingsFilter extends LiaElement {
  @state() private text = '';

  protected override render(): TemplateResult {
    const matched = filterSettingsGroups(settingsGroups, this.text);
    return html`
      <div class="mb-3" style="max-width: 26rem;">
        <label class="form-label small" for="demo-settings-filter-input">Filter</label>
        <input
          id="demo-settings-filter-input"
          class="form-control"
          type="search"
          placeholder="password, webhook, region…"
          .value=${this.text}
          @input=${(event: Event) => {
            this.text = (event.target as HTMLInputElement).value;
          }}
        />
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <caption class="visually-hidden">Groups surviving the filter</caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Fields before</th>
              <th scope="col">Fields after</th>
            </tr>
          </thead>
          <tbody>
            ${settingsGroups.map((group: SettingsGroup) => {
              const after = matched.find((entry) => entry.id === group.id);
              const before = countFields(group);
              const remaining = after ? countFields(after) : 0;
              return html`<tr class=${remaining === 0 ? 'text-body-tertiary' : ''}>
                <th scope="row" class="fw-normal">
                  ${group.icon ? html`<i class="${group.icon} me-2" aria-hidden="true"></i>` : ''}
                  ${group.title}
                </th>
                <td>${before}</td>
                <td>
                  ${remaining === 0
                    ? html`<span class="badge text-bg-secondary">hidden</span>`
                    : html`<span class="badge text-bg-primary">${remaining}</span>`}
                </td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

function countFields(group: SettingsGroup): number {
  return Object.values(group.form.sections ?? {}).reduce(
    (total, formSection) => total + Object.keys(formSection.fields ?? {}).length,
    0
  );
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const SETTINGS_CODE = dedent`
  // A settings group is a titled FormDefinition with an id and an icon.
  const groups: SettingsGroup[] = [
    {
      id: 'security',
      title: 'Security',
      icon: 'fa-solid fa-shield-halved',
      description: 'Sign-in policy, session lifetime and password strength.',
      badge: { text: 2, variant: 'primary' },      // e.g. unsaved changes
      form: {
        sections: {
          authentication: {
            title: 'Authentication',
            fields: {
              requireMfa: { type: 'switch', label: 'Require two-factor authentication', checked: true },
              maxAttempts: { type: 'number', label: 'Failed attempts before lock-out', value: 5 },
            },
          },
        },
      },
    },
    { id: 'integrations', title: 'Integrations', activated: false, form: { … } },  // configured, switched off
  ];

  html\`<lia-settings-page
    title="Console settings"
    icon="fa-solid fa-gears"
    .groups=\${groups}
    .alerts=\${alerts}
    .busy=\${this.saving}
    @lia-submit=\${(e: CustomEvent) => save(e.detail.values)}
    @lia-settings-filter=\${(e: CustomEvent) => console.log(e.detail.count)}
    @lia-settings-active=\${(e: CustomEvent) => (this.section = e.detail.id)}
  ></lia-settings-page>\`;
`;

const MODEL_CODE = dedent`
  import {
    filterSettingsGroups, settingsDefinition, settingsGroupAnchor, settingsNavEntries,
  } from '@liasoft/lit-ui';

  settingsNavEntries(groups);        // → SettingsNavEntry[] for <lia-settings-nav>
  settingsDefinition(groups);        // → one FormDefinition covering every group
  settingsGroupAnchor('security');   // → 'settings-security'
  filterSettingsGroups(groups, 'password');
  // → the same groups with non-matching fields removed and matches wrapped in <mark>
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderPage(): TemplateResult {
  return html`
    ${section(
      'A settings page',
      'Groups of settings, an anchor rail that follows the scroll, a filter that narrows both, and exactly one save bar for the lot.',
      example('Live', html`<demo-settings-page></demo-settings-page>`, SETTINGS_CODE, {
        bodyClass: 'p-3',
      })
    )}
    ${section('The model', 'Groups are data. Everything the page does — the rail, the filter, the single form — is derived from them.', [
      example('Helpers', html`<lia-code-block .code=${MODEL_CODE} language="ts" no-header></lia-code-block>`, undefined, {
        bodyClass: 'p-3',
      }),
      example('Filtering, without the element', html`<demo-settings-filter></demo-settings-filter>`, dedent`
        import { filterSettingsGroups } from '@liasoft/lit-ui';

        // Matches a field's name, label, description, note and its option labels.
        // Non-matching fields are dropped; matches come back wrapped in <mark>.
        const narrowed = filterSettingsGroups(groups, 'password');
      `),
      example(
        'Properties worth knowing',
        propTable(
          [
            { name: 'groups', type: 'SettingsGroup[]', description: 'The whole page.' },
            { name: 'activeGroup', type: 'string', description: 'Which anchor the rail marks. Set by the scroll spy unless `no-spy`.' },
            { name: 'filterText', type: 'string', description: 'Controlled filter. Omit it and the page owns the input.' },
            { name: 'noFilter / noNav / noSpy / noSubmit', type: 'boolean', description: 'Drop the filter, the rail, the scroll spy or the save bar.' },
            { name: 'rules / messages', type: 'Record<string, FieldRules> / ValidationMessages', description: 'Validation, exactly as on `<lia-form>`.' },
            { name: 'buttons', type: 'FormButton[]', description: 'Replace the default Save/Reset pair.' },
            { name: 'filterStatus', type: 'string', default: "'{count} matching sections'", description: 'The live-region message the filter announces.' },
          ],
          'lia-settings-page'
        )
      ),
    ])}
  `;
}

function renderGroups(): TemplateResult {
  return html`
    ${section('Settings group', 'One titled block of rows. Useful on its own when a page has a single group.', [
      example(
        'Two groups',
        html`<div class="vstack gap-4">
          <lia-settings-group
            .group=${settingsGroups[1]}
            .values=${{ requireMfa: true, allowPasskeys: true, maxAttempts: 5 }}
          ></lia-settings-group>
          <lia-settings-group
            .group=${settingsGroups[4]}
            inactive-label="Not configured yet"
          ></lia-settings-group>
        </div>`,
        dedent`
          html\`<lia-settings-group
            .group=\${group}
            .values=\${values}
            .errors=\${errors}
            level="2"
            inactive-label="Not configured"
          ></lia-settings-group>\`;

          // \`activated: false\` on the group dims it and shows the inactive label —
          // the "configured, but switched off" state.
        `
      ),
      example(
        'With a filter applied',
        html`<lia-settings-group
          .group=${filterSettingsGroups(settingsGroups, 'password')[0] ?? settingsGroups[1]}
          highlight="password"
        ></lia-settings-group>`,
        dedent`
          const [group] = filterSettingsGroups(groups, 'password');
          html\`<lia-settings-group .group=\${group} highlight="password"></lia-settings-group>\`;
        `,
        { description: 'Matches come back wrapped in `<mark>`' }
      ),
    ])}
    ${section('Anchor rail', 'The list of sections, as a sticky rail or as a row of pills.', [
      example(
        'Both layouts',
        split(
          html`<div class="border rounded-3 p-3">
            <lia-settings-nav
              layout="rail"
              heading="Sections"
              active="security"
              .items=${settingsNavEntries(settingsGroups)}
            ></lia-settings-nav>
          </div>`,
          html`<div class="border rounded-3 p-3">
            <lia-settings-nav
              layout="inline"
              active="limits"
              .items=${settingsNavEntries(settingsGroups)}
            ></lia-settings-nav>
          </div>`
        ),
        dedent`
          import { settingsNavEntries } from '@liasoft/lit-ui';

          html\`<lia-settings-nav
            layout="rail"           // 'rail' | 'inline'
            heading="Sections"
            sticky
            active=\${this.active}
            .items=\${settingsNavEntries(groups)}
            @lia-settings-navigate=\${(e: CustomEvent) => (this.active = e.detail.id)}
          ></lia-settings-nav>\`;
        `
      ),
    ])}
    ${section('Scroll spy', 'The "which section am I reading?" helper, usable outside the settings page.', [
      example(
        'SectionSpy',
        html`<lia-code-block
          .code=${dedent`
            import { SectionSpy } from '@liasoft/lit-ui';

            const spy = new SectionSpy({
              // Resolve the sections lazily — they come and go with the filter.
              targets: () => [...root.querySelectorAll('[data-section]')].map((element) => ({
                id: element.id,
                element,
              })),
              onChange: (id) => (this.active = id),
              // The heading bar is sticky; discount its height.
              offset: 96,
            });

            spy.observe();
            // …and in disconnectedCallback():
            spy.disconnect();
          `}
          language="ts"
          no-header
        ></lia-code-block>`,
        undefined,
        { bodyClass: 'p-3' }
      ),
      note(
        html`<code>&lt;lia-settings-page&gt;</code> installs one itself. Set
          <code>no-spy</code> and drive <code>active-group</code> yourself when the page scrolls
          inside a container the spy cannot see.`,
        'info'
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The settings demos. */
export const settingsRoutes: DemoRoute[] = [
  {
    path: '/settings/page',
    title: 'Settings page',
    group: 'settings',
    icon: 'fa-solid fa-gears',
    description: 'Grouped settings, an anchor rail, a live filter and one save bar.',
    keywords: ['settings', 'preferences', 'groups', 'filter', 'anchor', 'save'],
    render: renderPage,
  },
  {
    path: '/settings/groups',
    title: 'Groups & anchors',
    group: 'settings',
    icon: 'fa-solid fa-list-ul',
    description: 'The group element, the anchor rail and the scroll spy.',
    keywords: ['group', 'nav', 'anchor', 'scroll spy', 'section'],
    render: renderGroups,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-settings-page': DemoSettingsPage;
    'demo-settings-filter': DemoSettingsFilter;
  }
}
