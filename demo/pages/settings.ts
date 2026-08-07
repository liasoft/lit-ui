/**
 * Demo pages — Settings & wizard.
 *
 * The screens that configure a system rather than list its data: a filtered
 * settings page with an anchor rail and one save bar, a configuration
 * generator (the picker and the output it produces), the multi-step flow, and
 * the three report views (version panel, dense runtime dump, statistics
 * dashboard).
 *
 * Everything works: the filter really narrows the groups, the rail really
 * follows the scroll, the wizard really validates before it advances, and the
 * generator really produces different steps for different answers.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type {
  AlertMessage,
  ConfigSelection,
  ConfigStep,
  FormValues,
  FormSubmitDetail,
  LiaWizard,
  ReportGauge,
  ReportSection,
  SettingsGroup,
  StepDescriptor,
  UpdateState,
  WizardFinishDetail,
  WizardStepDetail,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  configStepsToText,
  filterSettingsGroups,
  recommendedConfigSelection,
  settingsNavEntries,
  toast,
} from '@liasoft/lit-ui';
import {
  configChoices,
  configSteps,
  deploymentSteps,
  objectCacheGauges,
  objectCacheListing,
  objectCacheMetrics,
  objectCacheSections,
  onboardingStepDescriptors,
  onboardingSteps,
  runtimeReport,
  settingsGroups,
  updateState,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Derived fixtures
 * ------------------------------------------------------------------ */

/** The runtime report, reshaped for `<lia-phpinfo-view>`. */
const REPORT_SECTIONS: ReportSection[] = Object.entries(runtimeReport).map(([title, entries]) => ({
  title,
  columns: ['Setting', 'Value'],
  rows: entries.map((entry) => [entry.label, entry.value ?? '—']),
}));

const UPDATE_STATES: readonly UpdateState[] = ['unknown', 'checking', 'current', 'available', 'error'];

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

/** The configuration generator: a picker, and the steps it produces. */
@customElement('demo-config')
export class DemoConfig extends LiaElement {
  @state() private selection: ConfigSelection = {};
  @state() private steps: ConfigStep[] = [];
  @state() private busy = false;
  @state() private events: readonly LoggedEvent[] = [];

  private async onRequest(event: CustomEvent<{ selection: ConfigSelection }>): Promise<void> {
    this.selection = event.detail.selection;
    this.events = logEvent(this.events, 'lia-config-request', event.detail.selection);
    this.busy = true;
    await new Promise((resolve) => setTimeout(resolve, 400));
    this.busy = false;
    this.steps = stepsFor(event.detail.selection);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Change the operating system or the proxy and press Continue — the generated steps change with the answers.'
      )}
      <lia-config-wizard
        title="What is this host running?"
        description="The console prints the exact commands for the combination you pick."
        submit-label="Continue"
        .choices=${configChoices}
        .busy=${this.busy}
        @lia-config-request=${this.onRequest}
        @lia-config-preview=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-config-preview', event.detail);
        }}
        @lia-config-download=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-config-download', event.detail);
        }}
      ></lia-config-wizard>

      ${this.steps.length > 0
        ? html`<hr class="my-4" />
            <lia-config-viewer
              title="Add this host"
              description="Generated for ${describeSelection(this.selection)}."
              editor="nano"
              .steps=${this.steps}
            ></lia-config-viewer>`
        : html`<p class="text-body-secondary small mt-3 mb-0">
            <i class="fa-solid fa-arrow-up me-2" aria-hidden="true"></i>Press Continue and the
            configuration appears here.
          </p>`}
      ${eventLog(this.events)}
    `;
  }
}

/** A one-line summary of what the picker was answered with. */
function describeSelection(selection: ConfigSelection): string {
  const parts = Object.entries(selection)
    .filter(([, value]) => value !== '' && !(Array.isArray(value) && value.length === 0))
    .map(([id, value]) => `${id}=${Array.isArray(value) ? value.join('+') : String(value)}`);
  return parts.length === 0 ? 'the default answers' : parts.join(', ');
}

/** Build a plausible step list from the picker's answers. */
function stepsFor(selection: ConfigSelection): ConfigStep[] {
  const platform = String(selection.platform ?? 'debian-13');
  const proxy = String(selection.proxy ?? 'nginx');
  const services = Array.isArray(selection.services) ? selection.services : [];
  const installer =
    platform === 'alpine-322'
      ? 'apk add --no-cache'
      : platform === 'rocky-10'
        ? 'dnf install -y'
        : 'apt-get install -y --no-install-recommends';

  const packages = ['orbit-agent', ...services.map((service) => `orbit-${service}`)].join(' ');

  return [
    {
      id: 'packages',
      type: 'command',
      title: 'Install the agent',
      language: 'bash',
      description: `Package manager chosen for <code>${platform}</code>.`,
      content: `${installer} ${packages}`,
    },
    ...configSteps.filter((step) => step.id === 'agent-config'),
    ...(proxy === 'nginx' ? configSteps.filter((step) => step.id === 'proxy-config') : []),
    ...(proxy === 'caddy'
      ? [
          {
            id: 'caddyfile',
            type: 'file' as const,
            title: 'Caddyfile',
            path: '/etc/caddy/Caddyfile',
            language: 'caddyfile',
            description: 'Caddy requests and renews the certificate for you.',
            content: 'console.example.org {\n    reverse_proxy 127.0.0.1:8443\n}',
          },
        ]
      : []),
    ...configSteps.filter((step) => step.id === 'enable' || step.id === 'verify' || step.id === 'note'),
  ];
}

/** The wizard, advancing for real and gated by validation. */
@customElement('demo-wizard')
export class DemoWizard extends LiaElement {
  @state() private current = 'organisation';
  @state() private finished?: FormValues;
  @state() private events: readonly LoggedEvent[] = [];

  @query('lia-wizard') private wizard?: LiaWizard;

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Press Next with the fields empty — the wizard refuses and marks the step. Fill them in and it moves on.'
      )}
      <lia-wizard
        current=${this.current}
        .steps=${onboardingSteps}
        .rules=${{}}
        @lia-wizard-step=${(event: CustomEvent<WizardStepDetail>) => {
          this.current = event.detail.id;
          this.events = logEvent(this.events, 'lia-wizard-step', event.detail);
        }}
        @lia-wizard-finish=${(event: CustomEvent<WizardFinishDetail>) => {
          this.finished = event.detail.values;
          this.events = logEvent(this.events, 'lia-wizard-finish', {
            fields: Object.keys(event.detail.values).length,
          });
          toast({ variant: 'success', message: 'The organisation would now be created.' });
        }}
      ></lia-wizard>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => this.wizard?.reset()}
        >
          <i class="fa-solid fa-rotate-left me-2" aria-hidden="true"></i>reset()
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => this.wizard?.goTo('review')}
        >
          goTo('review')
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() =>
            this.wizard?.setValues({
              orgName: 'Northwind Collective',
              orgDomain: 'example.org',
              adminName: 'Amara Okonkwo',
              adminEmail: 'amara.okonkwo@example.org',
              adminPassword: 'correct-horse-battery-staple',
            })}
        >
          setValues(…)
        </button>
      </div>
      ${valueDump(this.finished, { title: 'What the wizard finished with', empty: 'Not finished yet.' })}
      ${eventLog(this.events)}
    `;
  }
}

/** The stepper on its own, with every state and both orientations. */
@customElement('demo-stepper')
export class DemoStepper extends LiaElement {
  @state() private current = 'administrator';
  @state() private events: readonly LoggedEvent[] = [];

  protected override render(): TemplateResult {
    return html`
      <div class="vstack gap-4">
        <div>
          <p class="small text-body-secondary mb-2">
            Interactive — states are derived from <code>current</code>.
          </p>
          <lia-stepper
            .steps=${onboardingStepDescriptors}
            current=${this.current}
            @lia-step-select=${(event: CustomEvent<{ id: string }>) => {
              this.current = event.detail.id;
              this.events = logEvent(this.events, 'lia-step-select', event.detail);
            }}
          ></lia-stepper>
        </div>
        <div>
          <p class="small text-body-secondary mb-2">
            Explicit states, including an error and a disabled step.
          </p>
          <lia-stepper no-interactive .steps=${deploymentSteps}></lia-stepper>
        </div>
        <div>
          <p class="small text-body-secondary mb-2">
            <code>orientation="vertical"</code>, without the numbers.
          </p>
          <div style="max-width: 22rem;">
            <lia-stepper
              orientation="vertical"
              no-numbers
              no-interactive
              .steps=${deploymentSteps}
            ></lia-stepper>
          </div>
        </div>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** The version panel, walked through every state. */
@customElement('demo-update-panel')
export class DemoUpdatePanel extends LiaElement {
  @state() private state: UpdateState = 'available';
  @state() private events: readonly LoggedEvent[] = [];

  protected override render(): TemplateResult {
    return html`
      <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Update state">
        ${UPDATE_STATES.map(
          (value) => html`<button
            type="button"
            class="btn btn-outline-secondary ${this.state === value ? 'active' : ''}"
            aria-pressed=${this.state === value}
            @click=${() => {
              this.state = value;
            }}
          >
            ${value}
          </button>`
        )}
      </div>
      <lia-update-panel
        state=${this.state}
        current-version=${updateState.current}
        latest-version=${updateState.latest}
        channel="stable"
        database-version="2026-06-18-04"
        last-checked="7 minutes ago"
        action-label="Install 4.12.1"
        action-href="#/settings/update"
        command="orbitctl self-update --channel stable"
        message=${this.state === 'error'
          ? 'The update server did not answer (connect ETIMEDOUT).'
          : ''}
        changelog=${updateState.notes.map((line) => `• ${line}`).join('\n')}
        changelog-url="https://example.org/changelog"
        @lia-update-check=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-update-check', event.detail);
          this.state = 'checking';
          setTimeout(() => {
            this.state = 'available';
          }, 900);
        }}
      ></lia-update-panel>
      ${eventLog(this.events, { placeholder: 'Press "Check again".' })}
    `;
  }
}

/**
 * The cache statistics dashboard, wired to a fake backend: refreshing really
 * goes through a loading state and comes back with different figures.
 */
@customElement('demo-system-report')
export class DemoSystemReport extends LiaElement {
  @state() private loading = false;
  @state() private error = '';
  @state() private jitter = 0;
  @state() private events: readonly LoggedEvent[] = [];

  /** Built once: a fresh listing object on every render would reset the table. */
  private readonly listing = objectCacheListing();

  /** The gauges, nudged a little on every refresh so the bars visibly move. */
  private get gauges(): ReportGauge[] {
    if (this.jitter === 0) return objectCacheGauges;
    return objectCacheGauges.map((gauge, index) => ({
      ...gauge,
      used: Math.min(gauge.total, Math.round(gauge.used * (1 + this.jitter * (index % 2 ? -1 : 1)))),
    }));
  }

  private async reload(): Promise<void> {
    this.loading = true;
    await new Promise((resolve) => setTimeout(resolve, 900));
    this.jitter = Math.round(Math.random() * 12) / 100;
    this.loading = false;
    this.error = '';
    toast({ variant: 'success', message: 'Figures refreshed.', timeout: 2000 });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Press the refresh icon in the header: the body swaps for a spinner and comes back with different bars. The copy button puts the whole report on the clipboard as plain text — gauges, figures and every detail panel.'
      )}
      <lia-system-report
        title="Object cache"
        icon="fa-solid fa-hard-drive"
        description="Shared-memory cache in front of the primary database."
        ?loading=${this.loading}
        error=${this.error}
        .gauges=${this.gauges}
        .metrics=${objectCacheMetrics}
        .sections=${objectCacheSections}
        .entries=${this.listing}
        .actions=${[
          {
            id: 'flush',
            label: 'Flush the cache',
            icon: 'fa-solid fa-trash-can',
            variant: 'outline-warning',
            confirm: {
              title: 'Flush the cache',
              message: 'Every entry is dropped and rebuilt on demand. Expect a slow minute.',
              confirmLabel: 'Flush',
              variant: 'warning',
            },
          },
        ]}
        @lia-report-refresh=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-report-refresh', event.detail);
          void this.reload();
        }}
        @lia-action=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-action', { id: event.detail.id });
          if (event.detail.id === 'flush') {
            toast({ variant: 'warning', message: 'Cache flushed.', timeout: 2000 });
          }
        }}
        @lia-copy=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-copy', { ok: event.detail.ok });
        }}
      ></lia-system-report>
      ${eventLog(this.events, { placeholder: 'Refresh, flush or copy the report.' })}
    `;
  }
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

const WIZARD_CODE = dedent`
  const steps: WizardStep[] = [
    {
      id: 'organisation',
      label: 'Organisation',
      description: 'Who you are',
      icon: 'fa-solid fa-building',
      title: 'Tell us about the organisation',
      intro: 'This is only used to label the console and its notifications.',
      form: { sections: { main: { fields: { orgName: { type: 'text', label: 'Name', mandatory: true } } } } },
    },
    {
      id: 'review',
      label: 'Review',
      optional: true,                          // may be skipped
      nextLabel: 'Create the organisation',    // overrides the finish label
      content: html\`<ul class="list-group">…</ul>\`,   // arbitrary markup, not a form
      form: { … },
    },
  ];

  html\`<lia-wizard
    current=\${this.step}
    .steps=\${steps}
    .rules=\${rules}
    @lia-wizard-step=\${(e: CustomEvent<WizardStepDetail>) => (this.step = e.detail.id)}
    @lia-wizard-finish=\${(e: CustomEvent<WizardFinishDetail>) => create(e.detail.values)}
  ></lia-wizard>\`;

  // Imperative: next(), back(), goTo(id), reset(), getValues(), setValues(values)
`;

const CONFIG_CODE = dedent`
  // The question half…
  const choices: ConfigChoice[] = [
    {
      id: 'platform',
      label: 'Operating system',
      icon: 'fa-brands fa-linux',
      value: 'debian-13',
      options: [
        { value: 'debian-13', label: 'Debian 13', recommended: true },
        { value: 'alpine-322', label: 'Alpine 3.22', description: 'musl-based; uses <code>apk</code>.' },
        { value: 'traefik', label: 'Traefik', disabled: true },
      ],
    },
    { id: 'services', label: 'Managed services', multiple: true, value: ['metrics'], options: [ … ] },
    { id: 'tls', label: 'Certificates', optional: true, options: [ … ] },   // "do not configure"
  ];

  // …and the answer half.
  const steps: ConfigStep[] = [
    { type: 'command', title: 'Install the agent', language: 'bash', content: 'apt-get install orbit-agent' },
    { type: 'file', title: 'Agent configuration', path: '/etc/orbit/agent.toml', content: '…' },
    { type: 'note', title: 'Firewall', variant: 'warning', content: 'Outbound TCP/443 is required.' },
  ];

  html\`<lia-config-wizard .choices=\${choices} @lia-config-request=\${generate}></lia-config-wizard>\`;
  html\`<lia-config-viewer .steps=\${steps} editor="nano"></lia-config-viewer>\`;
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

function renderConfig(): TemplateResult {
  return html`
    ${section(
      'Generator',
      'Ask what the target looks like, then print exactly the commands and files it needs. Two elements: the picker, and the viewer.',
      example('Live', html`<demo-config></demo-config>`, CONFIG_CODE)
    )}
    ${section('The viewer on its own', 'Commands, files and notes — three shapes, one numbered list, one copy-everything button.', [
      example(
        'Every step type',
        html`<lia-config-viewer
          title="Add a host"
          description="Run these on the host you are adding, as an administrator."
          editor="nano"
          .steps=${configSteps}
        ></lia-config-viewer>`,
        dedent`
          html\`<lia-config-viewer
            title="Add a host"
            editor="nano"                 // quoted in the "create this file" hint
            max-height="24rem"
            .steps=\${steps}
          ></lia-config-viewer>\`;

          // The same content as plain text, for a download or a support bundle:
          configStepsToText(steps, { commentMarker: '#' });
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'As plain text',
        html`<lia-code-block
          .code=${configStepsToText(configSteps)}
          language="bash"
          filename="orbit-setup.txt"
          max-height="20rem"
          download-name="orbit-setup.txt"
        ></lia-code-block>`,
        dedent`
          import { configStepsToText } from '@liasoft/lit-ui';

          const text = configStepsToText(steps);   // headings become comments
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Empty',
        html`<lia-config-viewer
          .steps=${[]}
          empty-message="Nothing needs configuring for this combination."
        ></lia-config-viewer>`,
        undefined
      ),
    ])}
    ${section('The picker on its own', 'Cards or selects, with a recommended answer and an optional "do not configure this".', [
      example(
        'Layouts',
        html`<div class="vstack gap-4">
          <lia-config-wizard
            layout="select"
            title="Compact layout"
            .choices=${configChoices.slice(0, 3)}
            no-preview
            no-download
          ></lia-config-wizard>
        </div>`,
        dedent`
          html\`<lia-config-wizard layout="select" .choices=\${choices}></lia-config-wizard>\`;

          import { initialConfigSelection, recommendedConfigSelection } from '@liasoft/lit-ui';
          initialConfigSelection(choices);       // → the values declared on the choices
          recommendedConfigSelection(choices);   // → every option marked \`recommended\`
        `
      ),
      example(
        'recommendedConfigSelection',
        html`<lia-code-block
          .code=${JSON.stringify(recommendedConfigSelection(configChoices), null, 2)}
          language="json"
          no-header
        ></lia-code-block>`,
        undefined,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderWizard(): TemplateResult {
  return html`
    ${section(
      'Wizard',
      'A stepper, a form per step, and navigation that will not move forward while the current step is invalid.',
      example('Live', html`<demo-wizard></demo-wizard>`, WIZARD_CODE)
    )}
    ${section('Stepper', 'The indicator on its own — five states, two orientations.', [
      example('Live', html`<demo-stepper></demo-stepper>`, dedent`
        import { resolveStepStates } from '@liasoft/lit-ui';

        const steps: StepDescriptor[] = [
          { id: 'build', label: 'Build', description: '2 min 14 s', state: 'done' },
          { id: 'stage', label: 'Stage', description: 'Smoke tests failed', state: 'error' },
          { id: 'canary', label: 'Canary', state: 'disabled' },
        ];

        html\`<lia-stepper
          .steps=\${steps}
          current="stage"
          orientation="auto"        // 'auto' | 'horizontal' | 'vertical'
          @lia-step-select=\${(e: CustomEvent) => (this.step = e.detail.id)}
        ></lia-stepper>\`;

        // Without explicit states, they are derived from \`current\`:
        resolveStepStates(steps, 'stage');   // → done, done, current, upcoming, …
      `),
      example(
        'States',
        propTable(
          [
            { name: 'done', type: 'StepState', description: 'Behind the current step. Clickable, so a user can go back.' },
            { name: 'current', type: 'StepState', description: 'Where the flow is now.' },
            { name: 'upcoming', type: 'StepState', description: 'Ahead of the current step.' },
            { name: 'error', type: 'StepState', description: 'Visited and failed. Rendered in danger.' },
            { name: 'disabled', type: 'StepState', description: 'Not reachable yet — a gate the user has not opened.' },
          ],
          'StepState'
        )
      ),
    ])}
    ${section('Wizard behaviour', 'What the element does for you, and what it hands back.', [
      example(
        'Contract',
        propTable(
          [
            { name: 'steps', type: 'WizardStep[]', description: 'Each step is a `StepDescriptor` plus a `form`, arbitrary `content`, or both.' },
            { name: 'current', type: 'string', description: 'Step id. Controlled — echo `lia-wizard-step` back into it.' },
            { name: 'manual', type: 'boolean', default: 'false', description: 'Do not advance on your own; the host decides after each `lia-wizard-step`.' },
            { name: 'noValidate', type: 'boolean', default: 'false', description: 'Let a step be left in any state.' },
            { name: 'optional (per step)', type: 'boolean', description: 'The step may be skipped even if its form is incomplete.' },
            { name: 'nextLabel (per step)', type: 'string', description: 'Overrides the button label — “Create the organisation” instead of “Finish”.' },
            { name: 'lia-wizard-step', type: 'WizardStepDetail', description: '`{ step, previous, direction, values }` on every move.' },
            { name: 'lia-wizard-finish', type: 'WizardFinishDetail', description: '`{ values }` — the merged model of every step.' },
          ],
          'lia-wizard'
        )
      ),
      example(
        'A shorter flow, without the card',
        html`<lia-wizard
          no-card
          .steps=${onboardingSteps.slice(0, 2).map(
            (step): StepDescriptor & { form?: unknown } => ({ ...step })
          )}
          current="organisation"
          finish-label="Done"
          @lia-wizard-finish=${() => toast({ variant: 'success', message: 'Finished.' })}
        ></lia-wizard>`,
        dedent`
          html\`<lia-wizard no-card no-stepper .steps=\${steps}></lia-wizard>\`;
        `
      ),
    ])}
  `;
}

function renderUpdate(): TemplateResult {
  return html`
    ${section('Version panel', 'What is installed, what is available, and the one command that closes the gap.', [
      example('Live', html`<demo-update-panel></demo-update-panel>`, dedent`
        html\`<lia-update-panel
          state="available"          // unknown | checking | current | available | error
          current-version="4.12.0"
          latest-version="4.12.1"
          channel="stable"
          database-version="2026-06-18-04"
          last-checked="7 minutes ago"
          action-label="Install 4.12.1"
          action-href="/update"
          command="orbitctl self-update --channel stable"
          changelog=\${notes}
          changelog-url="https://example.org/changelog"
          @lia-update-check=\${() => this.check()}
        ></lia-update-panel>\`;
      `),
      example(
        'Inline layout',
        html`<lia-update-panel
          layout="inline"
          state="current"
          current-version="4.12.1"
          channel="stable"
          last-checked="just now"
        ></lia-update-panel>`,
        dedent`
          // For a settings row rather than a card of its own.
          html\`<lia-update-panel layout="inline" state="current" current-version="4.12.1"></lia-update-panel>\`;
        `
      ),
    ])}
    ${section('Runtime report', 'A dense key/value dump — the kind of page that is unreadable without a filter.', [
      example(
        'Filterable',
        html`<lia-phpinfo-view
          title="Runtime report"
          icon="fa-solid fa-microchip"
          description="Everything the console knows about the process it is running in."
          searchable
          dense
          max-height="26rem"
          .sections=${REPORT_SECTIONS}
        ></lia-phpinfo-view>`,
        dedent`
          const sections: ReportSection[] = [
            {
              title: 'Runtime',
              columns: ['Setting', 'Value'],
              rows: [
                ['Version', '22.14.0'],
                ['Heap limit', '4096 MiB'],
                [{ value: 'Flags', note: 'from the service unit' }, '--max-old-space-size=4096'],
              ],
            },
          ];

          html\`<lia-phpinfo-view searchable dense max-height="26rem" .sections=\${sections}></lia-phpinfo-view>\`;

          // A server that already produced markup can hand it over whole:
          html\`<lia-phpinfo-view .html=\${reportHtml}></lia-phpinfo-view>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Empty and unmatched',
        split(
          html`<lia-phpinfo-view
            .sections=${[]}
            empty-message="No report is available for this host."
          ></lia-phpinfo-view>`,
          html`<lia-phpinfo-view
            searchable
            filter-text="zzzz"
            .sections=${REPORT_SECTIONS}
            no-match-message="Nothing matches “zzzz”."
          ></lia-phpinfo-view>`
        ),
        undefined
      ),
    ])}
  `;
}

function renderReport(): TemplateResult {
  return html`
    ${section(
      'Statistics dashboard',
      'Gauges, headline figures, the configuration behind them and the entries the subsystem is holding.',
      [
        example('Live', html`<demo-system-report></demo-system-report>`, dedent`
          html\`<lia-system-report
            title="Object cache"
            icon="fa-solid fa-hard-drive"
            description="Shared-memory cache in front of the primary database."
            .gauges=\${gauges}
            .metrics=\${metrics}
            .sections=\${sections}
            .entries=\${listing}          // an ordinary TableListing
            .actions=\${[{ id: 'flush', label: 'Flush the cache', icon: 'fa-solid fa-trash-can' }]}
            @lia-report-refresh=\${() => this.reload()}
            @lia-action=\${(e: CustomEvent) => e.detail.id === 'flush' && this.flush()}
          ></lia-system-report>\`;
        `),
        note(
          html`Nothing in the element knows it is looking at a cache. The same four inputs render
          a connection pool, a job queue or a storage tier — which is why the gauge, metric and
          section types live in the settings family rather than in any one screen.`
        ),
      ]
    )}
    ${section('Gauges', 'An "x of y" bar, coloured by the kit’s shared usage thresholds.', [
      example(
        'Four bars',
        html`<lia-system-report
          no-refresh
          no-copy
          .gauges=${objectCacheGauges}
        ></lia-system-report>`,
        dedent`
          const gauges: ReportGauge[] = [
            // Consumption: the colour is derived — neutral, then warning at 75 %, danger at 90 %.
            { label: 'Shared memory', used: 2_684_354_560, total: 4_294_967_296, formatBytes: true,
              infotext: 'One 4 GiB arena, sized at start-up.' },
            // A high hit rate is good news, so it pins its own colour.
            { label: 'Hit rate', used: 18_402_611, total: 18_913_004, variant: 'success' },
            { label: 'Key slots', used: 184_021, total: 262_144 },
          ];

          html\`<lia-system-report .gauges=\${gauges}></lia-system-report>\`;

          // The maths is the kit's own, not the component's:
          usagePercent(used, total);   // → 63
          usageVariant(63);            // → '' (neutral); 'bg-warning' at 75, 'bg-danger' at 90
        `
      ),
      example(
        'Figures and detail panels',
        html`<lia-system-report
          no-refresh
          no-copy
          .metrics=${objectCacheMetrics}
          .sections=${objectCacheSections.slice(0, 2)}
        ></lia-system-report>`,
        dedent`
          const metrics: ReportMetric[] = [
            { label: 'Requests', value: '2 641', unit: 'req/s', delta: '+8.4 %',
              icon: 'fa-solid fa-bolt', variant: 'info', description: 'mean since start-up' },
          ];

          const sections: ReportInfoSection[] = [
            { title: 'Runtime configuration', icon: 'fa-solid fa-sliders', entries: [
              { label: 'cache.arena_size', value: '4096 MiB' },
              { label: 'cache.eviction', value: 'least-recently-used' },
            ] },
          ];

          html\`<lia-system-report
            .metrics=\${metrics}          // → a <lia-stat-row> of <lia-stat-card>s
            .sections=\${sections}         // → <lia-info-card>s in a responsive grid
            metric-columns="4"
            section-columns="2"
          ></lia-system-report>\`;
        `
      ),
    ])}
    ${section('While it is loading, and when it is not there', 'The two states a report spends real time in.', [
      example(
        'Loading and failed',
        split(
          html`<lia-system-report
            title="Object cache"
            icon="fa-solid fa-hard-drive"
            loading
            loading-label="Asking the cache…"
          ></lia-system-report>`,
          html`<lia-system-report
            title="Object cache"
            icon="fa-solid fa-hard-drive"
            error="The cache did not answer within 5 s (connect ETIMEDOUT)."
            error-title="No figures could be read"
          ></lia-system-report>`
        ),
        dedent`
          // Nothing to draw yet — the header stays, the body becomes a spinner.
          html\`<lia-system-report title="Object cache" loading></lia-system-report>\`;

          // The request failed. The alert says so; no empty state is stacked underneath.
          html\`<lia-system-report title="Object cache" error=\${message}></lia-system-report>\`;

          // Answered, but with nothing in it.
          html\`<lia-system-report
            title="Object cache"
            empty-title="The cache is cold"
            empty-message="Nothing has been stored since the last restart."
          ></lia-system-report>\`;
        `
      ),
      example(
        'Empty',
        html`<lia-system-report
          title="Object cache"
          icon="fa-solid fa-hard-drive"
          empty-title="The cache is cold"
          empty-message="Nothing has been stored since the last restart."
        ></lia-system-report>`
      ),
    ])}
    ${section('Contract', 'What goes in, and what comes back out.', [
      example(
        'Properties and events',
        propTable(
          [
            { name: 'gauges', type: 'ReportGauge[]', description: '`{ label, used, total, formatBytes?, infotext?, variant? }` — a `<lia-progress>` card each.' },
            { name: 'metrics', type: 'ReportMetric[]', description: '`{ label, value, unit?, delta?, variant?, description?, icon? }` — a `<lia-stat-row>`.' },
            { name: 'sections', type: 'ReportInfoSection[]', description: '`{ title, icon?, entries: InfoEntry[] }` — `<lia-info-card>`s in a grid.' },
            { name: 'entries', type: 'TableListing', description: 'What the subsystem is holding, rendered by `<lia-table>`.' },
            { name: 'actions', type: 'ActionDescriptor[]', description: 'Header toolbar — "flush", "reset", "download". Emits `lia-action`.' },
            { name: 'loading', type: 'boolean', default: 'false', description: 'Swap the body for a spinner; the header stays operable.' },
            { name: 'error', type: 'string', description: 'Alert above the body. Empty hides it.' },
            { name: 'noRefresh / noCopy', type: 'boolean', default: 'false', description: 'Drop the refresh or the copy affordance.' },
            { name: 'lia-report-refresh', type: 'ReportRefreshDetail', description: '`{ id }` — the reader asked for fresh figures.' },
            { name: 'systemReportToText()', type: 'function', description: 'The plain-text rendering the copy button uses; call it yourself for a ticket or a log line.' },
          ],
          'lia-system-report'
        )
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The settings & wizard demos. */
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
  {
    path: '/settings/config',
    title: 'Configuration generator',
    group: 'settings',
    icon: 'fa-solid fa-wand-magic-sparkles',
    description: 'Ask what the target is, print the commands and files it needs.',
    keywords: ['config', 'generator', 'wizard', 'commands', 'files', 'install'],
    render: renderConfig,
  },
  {
    path: '/settings/wizard',
    title: 'Wizard & stepper',
    group: 'settings',
    icon: 'fa-solid fa-shoe-prints',
    description: 'A multi-step flow, gated by validation, plus the indicator alone.',
    keywords: ['wizard', 'stepper', 'steps', 'onboarding', 'multi-step'],
    render: renderWizard,
  },
  {
    path: '/settings/update',
    title: 'Version & reports',
    group: 'settings',
    icon: 'fa-solid fa-arrows-rotate',
    description: 'The update panel, and the viewer for dense runtime reports.',
    keywords: ['update', 'version', 'changelog', 'phpinfo', 'report', 'runtime'],
    render: renderUpdate,
  },
  {
    path: '/settings/report',
    title: 'System report',
    group: 'settings',
    icon: 'fa-solid fa-gauge-high',
    description: 'Gauges, key figures, configuration panels and the entries a cache is holding.',
    keywords: [
      'report',
      'statistics',
      'cache',
      'gauge',
      'memory',
      'hit rate',
      'metrics',
      'dashboard',
    ],
    render: renderReport,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-settings-page': DemoSettingsPage;
    'demo-settings-filter': DemoSettingsFilter;
    'demo-config': DemoConfig;
    'demo-wizard': DemoWizard;
    'demo-stepper': DemoStepper;
    'demo-update-panel': DemoUpdatePanel;
    'demo-system-report': DemoSystemReport;
  }
}
