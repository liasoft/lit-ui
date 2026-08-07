/**
 * Data for the settings & wizard demos:
 *
 * - {@link settingsGroups} — grouped settings for `<lia-settings-page>`,
 * - {@link configChoices} — the input half of a configuration generator,
 * - {@link configSteps} — its output half, for `<lia-config-viewer>`,
 * - {@link onboardingSteps} — a four-step flow for `<lia-wizard>`,
 * - {@link runtimeReport} — a dense key/value report for `<lia-phpinfo-view>`,
 * - {@link objectCacheReport} — a cache statistics dashboard for `<lia-system-report>`.
 */

import { html } from 'lit';
import type {
  ConfigChoice,
  ConfigStep,
  InfoEntry,
  ReportGauge,
  ReportInfoSection,
  ReportMetric,
  SettingsGroup,
  StepDescriptor,
  TableListing,
  WizardStep,
} from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Settings groups
 * ------------------------------------------------------------------ */

/**
 * Six groups of settings, each one a small {@link FormDefinition}.
 *
 * The `activated: false` group demonstrates the "configured but switched off"
 * state, and the badges demonstrate the change counters a settings page shows
 * once the model is dirty.
 *
 * @example
 * ```ts
 * html`<lia-settings-page title="Console settings" .groups=${settingsGroups}></lia-settings-page>`;
 * ```
 */
export const settingsGroups: SettingsGroup[] = [
  {
    id: 'general',
    title: 'General',
    icon: 'fa-solid fa-gear',
    description: 'Identity of this installation and the defaults new members inherit.',
    form: {
      sections: {
        main: {
          fields: {
            instanceName: {
              type: 'text',
              label: 'Instance name',
              value: 'Northwind Console',
              mandatory: true,
              note: 'Shown in the navbar and in every notification email.',
            },
            baseUrl: {
              type: 'url',
              label: 'Public base URL',
              value: 'https://console.example.org',
              mandatory: true,
              requiresReconf: ['edge router'],
            },
            language: {
              type: 'select',
              label: 'Default language',
              value: 'en',
              options: [
                { value: 'en', label: 'English' },
                { value: 'de', label: 'Deutsch' },
                { value: 'fr', label: 'Français' },
                { value: 'nl', label: 'Nederlands' },
                { value: 'pt', label: 'Português' },
              ],
            },
            timezone: {
              type: 'select',
              label: 'Default time zone',
              value: 'Europe/Amsterdam',
              options: [
                { value: 'UTC', label: 'UTC' },
                { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
                { value: 'Europe/Lisbon', label: 'Europe/Lisbon' },
                { value: 'America/Toronto', label: 'America/Toronto' },
                { value: 'Asia/Singapore', label: 'Asia/Singapore' },
              ],
            },
            theme: {
              type: 'radio',
              label: 'Default colour scheme',
              value: 'auto',
              values: [
                { value: 'auto', label: 'Follow the operating system' },
                { value: 'light', label: 'Always light' },
                { value: 'dark', label: 'Always dark' },
              ],
            },
          },
        },
      },
    },
  },

  {
    id: 'security',
    title: 'Security',
    icon: 'fa-solid fa-shield-halved',
    description: 'Sign-in policy, session lifetime and what counts as a strong password.',
    badge: { text: 2, variant: 'primary' },
    form: {
      sections: {
        authentication: {
          title: 'Authentication',
          fields: {
            requireMfa: {
              type: 'switch',
              label: 'Require two-factor authentication',
              checked: true,
              desc: 'Members without a second factor are asked to enrol at their next sign-in.',
            },
            allowPasskeys: { type: 'switch', label: 'Allow passkeys', checked: true },
            maxAttempts: {
              type: 'number',
              label: 'Failed attempts before lock-out',
              value: 5,
              min: 3,
              max: 20,
            },
            lockoutMinutes: {
              type: 'number',
              label: 'Lock-out duration',
              value: 15,
              min: 1,
              nextTo: {
                lockoutUnit: {
                  type: 'label',
                  label: 'Unit',
                  value: 'minutes',
                },
              },
            },
          },
        },
        passwords: {
          title: 'Passwords',
          fields: {
            minLength: { type: 'number', label: 'Minimum length', value: 12, min: 8, max: 128 },
            complexity: {
              type: 'checkbox',
              label: 'Must contain',
              selected: ['lower', 'upper', 'digit'],
              values: [
                { value: 'lower', label: 'a lower-case letter' },
                { value: 'upper', label: 'an upper-case letter' },
                { value: 'digit', label: 'a digit' },
                { value: 'symbol', label: 'a symbol' },
              ],
            },
            expiryDays: {
              type: 'textul',
              label: 'Force a change after',
              value: -1,
              note: 'In days. Unlimited means passwords never expire.',
            },
          },
        },
        sessions: {
          title: 'Sessions',
          collapsible: true,
          collapsed: true,
          fields: {
            idleMinutes: { type: 'number', label: 'Idle timeout', value: 60, min: 5 },
            absoluteHours: { type: 'number', label: 'Absolute lifetime', value: 12, min: 1 },
            singleSession: { type: 'switch', label: 'One session per member', checked: false },
          },
        },
      },
    },
  },

  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'fa-solid fa-bell',
    description: 'Where the console sends what.',
    form: {
      sections: {
        main: {
          fields: {
            fromAddress: {
              type: 'email',
              label: 'Sender address',
              value: 'console@example.org',
              mandatory: true,
            },
            replyTo: { type: 'email', label: 'Reply-to address', value: 'ops@example.org' },
            digest: {
              type: 'select',
              label: 'Daily digest',
              value: 'weekdays',
              options: [
                { value: 'off', label: 'Do not send a digest' },
                { value: 'daily', label: 'Every day' },
                { value: 'weekdays', label: 'Weekdays only' },
              ],
            },
            events: {
              type: 'checkbox',
              label: 'Send an email when',
              selected: ['incident', 'quota'],
              values: [
                { value: 'incident', label: 'an incident is opened' },
                { value: 'quota', label: 'a quota passes 90%' },
                { value: 'member', label: 'a member is added or removed' },
                { value: 'deploy', label: 'a release reaches production' },
              ],
            },
            footer: {
              type: 'textarea',
              label: 'Email footer',
              rows: 3,
              value: 'Northwind Collective · console.example.org',
            },
          },
        },
      },
    },
  },

  {
    id: 'limits',
    title: 'Limits & quotas',
    icon: 'fa-solid fa-gauge',
    description: 'Defaults applied to every new account. Individual accounts can override them.',
    badge: { text: 1, variant: 'primary' },
    form: {
      sections: {
        main: {
          fields: {
            storage: { type: 'textul', label: 'Storage per member', value: 10, note: 'In gibibytes.' },
            transfer: { type: 'textul', label: 'Monthly transfer', value: 500, note: 'In gibibytes.' },
            services: { type: 'textul', label: 'Services per member', value: 5 },
            keys: { type: 'textul', label: 'Access keys per member', value: -1 },
            overcommit: {
              type: 'switch',
              label: 'Allow over-commitment',
              checked: false,
              desc: 'Hand out more capacity than the pool actually has.',
              requiresReconf: ['scheduler'],
            },
          },
        },
      },
    },
  },

  {
    id: 'integrations',
    title: 'Integrations',
    icon: 'fa-solid fa-plug',
    description: 'Outbound webhooks and the identity provider.',
    activated: false,
    form: {
      sections: {
        main: {
          fields: {
            enabled: { type: 'switch', label: 'Enable the identity provider', checked: false },
            issuer: {
              type: 'url',
              label: 'Issuer URL',
              placeholder: 'https://id.example.org/realms/main',
              disabled: true,
            },
            clientId: { type: 'text', label: 'Client id', disabled: true },
            clientSecret: { type: 'password', label: 'Client secret', disabled: true },
            webhook: {
              type: 'url',
              label: 'Webhook endpoint',
              placeholder: 'https://hooks.example.org/orbit',
            },
          },
        },
      },
    },
  },

  {
    id: 'advanced',
    title: 'Advanced',
    icon: 'fa-solid fa-screwdriver-wrench',
    description: 'Only change these if you know why you are changing them.',
    form: {
      sections: {
        main: {
          fields: {
            warning: {
              type: 'infotext',
              label: 'Careful',
              value:
                'The settings below take effect immediately and can make the console unreachable.',
            },
            logLevel: {
              type: 'select',
              label: 'Log level',
              value: 'info',
              options: [
                { value: 'error', label: 'error' },
                { value: 'warning', label: 'warning' },
                { value: 'info', label: 'info' },
                { value: 'debug', label: 'debug' },
              ],
            },
            workers: { type: 'number', label: 'Worker processes', value: 8, min: 1, max: 64 },
            maintenance: {
              type: 'switch',
              label: 'Maintenance mode',
              checked: false,
              requiresReconf: ['edge router', 'status page'],
            },
            banner: {
              type: 'textarea',
              label: 'Maintenance banner',
              rows: 2,
              placeholder: 'Shown at the top of every page while maintenance mode is on.',
            },
          },
        },
      },
    },
  },
];

/* ------------------------------------------------------------------ *
 * Configuration generator
 * ------------------------------------------------------------------ */

/**
 * The picker of `<lia-config-wizard>` — what the operator is running, so the
 * console can print the right commands.
 */
export const configChoices: ConfigChoice[] = [
  {
    id: 'platform',
    label: 'Operating system',
    icon: 'fa-brands fa-linux',
    description: 'Determines the package manager and the service paths.',
    value: 'debian-13',
    options: [
      { value: 'debian-13', label: 'Debian 13', recommended: true },
      { value: 'ubuntu-2604', label: 'Ubuntu 26.04 LTS' },
      { value: 'rocky-10', label: 'Rocky Linux 10' },
      { value: 'alpine-322', label: 'Alpine 3.22', description: 'musl-based; uses <code>apk</code>.' },
    ],
  },
  {
    id: 'proxy',
    label: 'Reverse proxy',
    icon: 'fa-solid fa-diagram-project',
    value: 'nginx',
    options: [
      { value: 'nginx', label: 'nginx', recommended: true },
      { value: 'caddy', label: 'Caddy', description: 'Certificates are handled for you.' },
      { value: 'haproxy', label: 'HAProxy' },
      { value: 'traefik', label: 'Traefik', disabled: true, description: 'Not yet generated.' },
    ],
  },
  {
    id: 'services',
    label: 'Managed services',
    icon: 'fa-solid fa-cubes',
    description: 'Pick everything this host should run.',
    multiple: true,
    value: ['metrics', 'logs'],
    options: [
      { value: 'metrics', label: 'Metrics collector', recommended: true },
      { value: 'logs', label: 'Log shipper', recommended: true },
      { value: 'traces', label: 'Trace collector' },
      { value: 'backup', label: 'Backup agent', recommended: true },
      { value: 'cache', label: 'Edge cache' },
    ],
  },
  {
    id: 'tls',
    label: 'Certificates',
    icon: 'fa-solid fa-certificate',
    optional: true,
    value: 'acme',
    options: [
      { value: 'acme', label: 'Request them automatically (ACME)', recommended: true },
      { value: 'manual', label: 'I will install them myself', preview: false },
    ],
  },
];

/**
 * The output of the generator: three commands, two files and a note — the
 * shapes `<lia-config-viewer>` renders differently.
 */
export const configSteps: ConfigStep[] = [
  {
    id: 'packages',
    type: 'command',
    title: 'Install the agent',
    language: 'bash',
    description: 'Run this as <code>root</code> on the host you are adding.',
    content:
      'apt-get update\napt-get install -y --no-install-recommends orbit-agent orbit-log-shipper',
  },
  {
    id: 'agent-config',
    type: 'file',
    title: 'Agent configuration',
    path: '/etc/orbit/agent.toml',
    language: 'toml',
    description: 'Replace the placeholder token with the one shown after you save.',
    content: [
      '[agent]',
      'id      = "host-eu-central-014"',
      'region  = "eu-central"',
      'token   = "REPLACE_ME"',
      '',
      '[telemetry]',
      'metrics = true',
      'logs    = true',
      'traces  = false',
      'interval = "15s"',
      '',
      '[limits]',
      'max_memory = "512MiB"',
      'max_cpu    = 1.0',
    ].join('\n'),
  },
  {
    id: 'proxy-config',
    type: 'file',
    title: 'Reverse-proxy site',
    path: '/etc/nginx/sites-available/console.conf',
    language: 'nginx',
    content: [
      'server {',
      '    listen 443 ssl http2;',
      '    server_name console.example.org;',
      '',
      '    ssl_certificate     /etc/orbit/tls/fullchain.pem;',
      '    ssl_certificate_key /etc/orbit/tls/privkey.pem;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:8443;',
      '        proxy_set_header Host              $host;',
      '        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    id: 'enable',
    type: 'command',
    title: 'Enable and start',
    language: 'bash',
    content: 'systemctl enable --now orbit-agent\nsystemctl reload nginx',
  },
  {
    id: 'verify',
    type: 'command',
    title: 'Verify',
    language: 'bash',
    description: 'The host should appear in the console within a minute.',
    content: 'orbitctl agent status --wait 60s',
  },
  {
    id: 'note',
    type: 'note',
    title: 'Firewall',
    variant: 'warning',
    content:
      'The agent needs outbound TCP/443 to ingest.eu-central.example.net.\nNothing needs to be opened inbound.',
  },
];

/* ------------------------------------------------------------------ *
 * Wizard
 * ------------------------------------------------------------------ */

/** A four-step onboarding flow with a validation-gated middle. */
export const onboardingSteps: WizardStep[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    description: 'Who you are',
    icon: 'fa-solid fa-building',
    title: 'Tell us about the organisation',
    intro: 'This is only used to label the console and its notifications.',
    form: {
      sections: {
        main: {
          fields: {
            orgName: { type: 'text', label: 'Organisation name', mandatory: true },
            orgDomain: {
              type: 'text',
              label: 'Primary domain',
              placeholder: 'example.org',
              mandatory: true,
            },
            size: {
              type: 'select',
              label: 'Size',
              value: '11-50',
              options: [
                { value: '1-10', label: '1–10 people' },
                { value: '11-50', label: '11–50 people' },
                { value: '51-250', label: '51–250 people' },
                { value: '250+', label: 'More than 250' },
              ],
            },
          },
        },
      },
    },
  },
  {
    id: 'administrator',
    label: 'Administrator',
    description: 'The first account',
    icon: 'fa-solid fa-user-shield',
    title: 'Create the first administrator',
    intro: 'You can add more people once you are signed in.',
    form: {
      sections: {
        main: {
          fields: {
            adminName: { type: 'text', label: 'Full name', mandatory: true },
            adminEmail: { type: 'email', label: 'Email address', mandatory: true },
            adminPassword: {
              type: 'password',
              label: { title: 'Password', description: 'At least twelve characters.' },
              mandatory: true,
              autocomplete: 'new-password',
            },
            adminMfa: {
              type: 'switch',
              label: 'Enrol a second factor straight away',
              checked: true,
            },
          },
        },
      },
    },
  },
  {
    id: 'region',
    label: 'Region',
    description: 'Where data lives',
    icon: 'fa-solid fa-earth-europe',
    title: 'Pick a home region',
    intro: 'Data at rest stays in the region you choose. This cannot be changed later.',
    form: {
      sections: {
        main: {
          fields: {
            region: {
              type: 'radio',
              label: 'Home region',
              value: 'eu-central',
              values: [
                { value: 'eu-west', label: 'Ireland (eu-west)' },
                { value: 'eu-central', label: 'Frankfurt (eu-central)' },
                { value: 'us-east', label: 'Virginia (us-east)' },
                { value: 'ap-southeast', label: 'Singapore (ap-southeast)' },
              ],
            },
            replicate: {
              type: 'switch',
              label: 'Replicate backups to a second region',
              checked: true,
            },
          },
        },
      },
    },
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Confirm and finish',
    icon: 'fa-solid fa-clipboard-check',
    title: 'Ready to go',
    intro: 'Nothing is created until you press finish.',
    optional: true,
    nextLabel: 'Create the organisation',
    content: html`
      <ul class="list-group list-group-flush mb-3">
        <li class="list-group-item d-flex justify-content-between">
          <span>Console</span><span class="text-body-secondary">console.example.org</span>
        </li>
        <li class="list-group-item d-flex justify-content-between">
          <span>Plan</span><span class="text-body-secondary">Scale, billed annually</span>
        </li>
        <li class="list-group-item d-flex justify-content-between">
          <span>First administrator</span><span class="text-body-secondary">you</span>
        </li>
      </ul>
    `,
    form: {
      sections: {
        main: {
          fields: {
            accept: {
              type: 'checkbox',
              label: 'Agreements',
              values: [{ value: 'terms', label: 'I accept the terms of service' }],
            },
          },
        },
      },
    },
  },
];

/** The same flow as bare {@link StepDescriptor}s, for `<lia-stepper>` on its own. */
export const onboardingStepDescriptors: StepDescriptor[] = onboardingSteps.map((step) => ({
  id: step.id,
  label: step.label,
  description: step.description,
  icon: step.icon,
}));

/** A stepper with a failed step, to show the `error` state. */
export const deploymentSteps: StepDescriptor[] = [
  { id: 'build', label: 'Build', description: '2 min 14 s', state: 'done' },
  { id: 'test', label: 'Test', description: '412 passed', state: 'done' },
  { id: 'stage', label: 'Stage', description: 'Smoke tests failed', state: 'error' },
  { id: 'canary', label: 'Canary', description: 'Waiting', state: 'disabled' },
  { id: 'production', label: 'Production', description: 'Waiting', state: 'upcoming' },
];

/* ------------------------------------------------------------------ *
 * Runtime report
 * ------------------------------------------------------------------ */

/** A dense key/value report, of the kind `<lia-phpinfo-view>` renders. */
export const runtimeReport: Record<string, InfoEntry[]> = {
  Runtime: [
    { label: 'Version', value: '22.14.0' },
    { label: 'Architecture', value: 'linux-arm64' },
    { label: 'Heap limit', value: '4096 MiB' },
    { label: 'Started', value: '2026-05-21T04:12:07Z' },
    { label: 'Flags', value: '--max-old-space-size=4096 --enable-source-maps' },
  ],
  Database: [
    { label: 'Engine', value: 'PostgreSQL 16.3' },
    { label: 'Pool size', value: '32' },
    { label: 'In use', value: '11' },
    { label: 'Slowest query (1 h)', value: '412 ms' },
    { label: 'Replication lag', value: '38 ms', badge: { text: 'healthy', variant: 'success' } },
  ],
  Cache: [
    { label: 'Engine', value: 'Valkey 8.1' },
    { label: 'Keys', value: '1 284 991' },
    { label: 'Memory', value: '2.1 GiB of 4 GiB' },
    { label: 'Hit rate (1 h)', value: '97.4%' },
    { label: 'Evictions (1 h)', value: '0' },
  ],
  Queue: [
    { label: 'Broker', value: 'NATS 2.11' },
    { label: 'Consumers', value: '8' },
    { label: 'Pending', value: '143' },
    { label: 'Dead letters', value: '2', badge: { text: 'check', variant: 'warning' } },
  ],
};

/** Version state for `<lia-update-panel>`. */
export const updateState = {
  current: '4.12.0',
  latest: '4.12.1',
  notes: [
    'Fixes a crash when a settings group contains only static fields.',
    'The column manager now keeps its order after a reset.',
    'Log viewer: the level filter is remembered per session.',
  ],
  releasedOn: '2026-07-02',
} as const;

/* ------------------------------------------------------------------ *
 * Object-cache statistics
 * ------------------------------------------------------------------ */

/** One row of the "what is in the cache right now" table. */
export interface CacheEntry {
  key: string;
  kind: string;
  size: number;
  hits: number;
  ttl: string;
  lastUsed: string;
}

/**
 * The utilisation bars of the object cache: how full the arena is, how the
 * hits compare to the lookups, how many key slots are taken, how badly the
 * free list is fragmented.
 *
 * Note the hit-rate gauge pins its own `variant`: a full memory bar should
 * turn red, a full hit-rate bar is the best news on the page.
 */
export const objectCacheGauges: ReportGauge[] = [
  {
    label: 'Shared memory',
    used: 2_684_354_560,
    total: 4_294_967_296,
    formatBytes: true,
    infotext: 'One 4 GiB arena, sized at start-up. Restart the workers to change it.',
  },
  {
    label: 'Hit rate',
    used: 18_402_611,
    total: 18_913_004,
    variant: 'success',
    infotext: '18 402 611 hits against 510 393 misses since the last flush.',
  },
  {
    label: 'Key slots',
    used: 184_021,
    total: 262_144,
    infotext: 'Slots are allocated up front; a full table starts evicting early.',
  },
  {
    label: 'Fragmentation',
    used: 96_468_992,
    total: 1_610_612_736,
    formatBytes: true,
    infotext: 'Free blocks under 5 MiB, as a share of all free memory.',
  },
];

/** The headline figures printed above the detail panels. */
export const objectCacheMetrics: ReportMetric[] = [
  {
    label: 'Entries',
    value: '184 021',
    icon: 'fa-solid fa-key',
    variant: 'primary',
    description: 'across 12 namespaces',
  },
  {
    label: 'Requests',
    value: '2 641',
    unit: 'req/s',
    icon: 'fa-solid fa-bolt',
    variant: 'info',
    delta: '+8.4 %',
    description: 'mean since start-up',
  },
  {
    label: 'Evictions',
    value: 0,
    icon: 'fa-solid fa-broom',
    variant: 'success',
    description: 'last 24 hours',
  },
  {
    label: 'Uptime',
    value: '6 d 4 h',
    icon: 'fa-solid fa-clock',
    variant: 'secondary',
    description: 'started 2026-08-01 03:11',
  },
];

/** The configuration and provenance panels under the figures. */
export const objectCacheSections: ReportInfoSection[] = [
  {
    title: 'General',
    icon: 'fa-solid fa-circle-info',
    entries: [
      { label: 'Engine', value: 'Valkey 8.1.2' },
      { label: 'Client library', value: 'orbit-cache 3.4.0' },
      { label: 'Host', value: 'cache-01.internal' },
      { label: 'Runtime', value: 'linux-arm64 · 8 vCPU' },
      { label: 'Started', value: '2026-08-01 03:11:42' },
      { label: 'Last flush', value: 'Never', badge: { text: 'clean', variant: 'success' } },
    ],
  },
  {
    title: 'Runtime configuration',
    icon: 'fa-solid fa-sliders',
    entries: [
      { label: 'cache.arena_size', value: '4096 MiB' },
      { label: 'cache.key_slots', value: '262 144' },
      { label: 'cache.default_ttl', value: '3600 s' },
      { label: 'cache.eviction', value: 'least-recently-used' },
      { label: 'cache.serializer', value: 'msgpack' },
      { label: 'cache.compress_over', value: '32 KiB' },
    ],
  },
  {
    title: 'Memory detail',
    icon: 'fa-solid fa-memory',
    entries: [
      { label: 'Total', value: '4 GiB' },
      { label: 'In use', value: '2.5 GiB' },
      { label: 'Free', value: '1.5 GiB' },
      { label: 'Wasted', value: '92 MiB' },
      { label: 'Free blocks', value: '1 942' },
      { label: 'Largest free block', value: '412 MiB' },
    ],
  },
  {
    title: 'Replication',
    icon: 'fa-solid fa-code-branch',
    entries: [
      { label: 'Role', value: 'primary' },
      { label: 'Replicas', value: '2', badge: { text: 'in sync', variant: 'success' } },
      { label: 'Backlog', value: '1 MiB' },
      { label: 'Lag (p95)', value: '38 ms' },
      { label: 'Last handshake', value: '4 s ago' },
      { label: 'Failover', value: 'automatic, 10 s quorum' },
    ],
  },
];

/** The busiest keys the cache is holding — the tail of the report. */
export const objectCacheEntries: CacheEntry[] = [
  {
    key: 'catalogue:index:v7',
    kind: 'index',
    size: 41_943_040,
    hits: 4_120_884,
    ttl: '1 h',
    lastUsed: '2026-08-07T09:41:12Z',
  },
  {
    key: 'session:*:profile',
    kind: 'session',
    size: 18_874_368,
    hits: 3_884_201,
    ttl: '30 min',
    lastUsed: '2026-08-07T09:41:10Z',
  },
  {
    key: 'pricing:tiers:eu',
    kind: 'document',
    size: 2_097_152,
    hits: 1_942_004,
    ttl: '6 h',
    lastUsed: '2026-08-07T09:40:58Z',
  },
  {
    key: 'permissions:role-map',
    kind: 'document',
    size: 524_288,
    hits: 1_204_517,
    ttl: '24 h',
    lastUsed: '2026-08-07T09:41:04Z',
  },
  {
    key: 'search:suggest:trigrams',
    kind: 'index',
    size: 134_217_728,
    hits: 884_120,
    ttl: '12 h',
    lastUsed: '2026-08-07T09:39:47Z',
  },
  {
    key: 'render:template:invoice',
    kind: 'fragment',
    size: 262_144,
    hits: 612_003,
    ttl: 'no expiry',
    lastUsed: '2026-08-07T09:38:21Z',
  },
  {
    key: 'geo:regions:v3',
    kind: 'document',
    size: 1_048_576,
    hits: 402_884,
    ttl: '7 d',
    lastUsed: '2026-08-07T09:12:09Z',
  },
  {
    key: 'report:usage:daily',
    kind: 'aggregate',
    size: 8_388_608,
    hits: 91_442,
    ttl: '15 min',
    lastUsed: '2026-08-07T09:30:00Z',
  },
];

const CACHE_KIND_VARIANTS: Record<string, string> = {
  index: 'primary',
  session: 'info',
  document: 'secondary',
  fragment: 'warning',
  aggregate: 'success',
};

/** The busiest keys as a {@link TableListing}, ready for `entries`. */
export function objectCacheListing(rows: CacheEntry[] = objectCacheEntries): TableListing<CacheEntry> {
  return {
    id: 'object-cache-entries',
    rows,
    rowKey: (row) => row.key,
    noSearch: true,
    noColumnManager: true,
    sort: { field: 'hits', order: 'desc' },
    emptyTitle: 'The cache is cold',
    emptyMessage: 'Nothing has been stored since the last flush.',
    columns: [
      { key: 'key', label: 'Key', renderer: 'code', sortable: true },
      {
        key: 'kind',
        label: 'Kind',
        renderer: 'badge',
        render: (row) => ({
          text: row.kind,
          variant: CACHE_KIND_VARIANTS[row.kind] ?? 'secondary',
        }),
      },
      { key: 'size', label: 'Size', renderer: 'bytes', class: 'text-end', sortable: true },
      { key: 'hits', label: 'Hits', class: 'text-end', sortable: true },
      { key: 'ttl', label: 'TTL', class: 'text-end' },
      { key: 'lastUsed', label: 'Last used', renderer: 'datetime', class: 'text-end', sortable: true },
    ],
    rowActions: (row) => [
      {
        id: 'purge',
        icon: 'fa-solid fa-trash-can',
        title: `Purge ${row.key}`,
        variant: 'outline-secondary',
        confirm: {
          title: 'Purge entry',
          message: `${row.key} is rebuilt on the next request.`,
          confirmLabel: 'Purge',
          variant: 'warning',
        },
      },
    ],
  };
}

/** Everything the object-cache report needs, in one object. */
export const objectCacheReport = {
  gauges: objectCacheGauges,
  metrics: objectCacheMetrics,
  sections: objectCacheSections,
  entries: objectCacheEntries,
} as const;
