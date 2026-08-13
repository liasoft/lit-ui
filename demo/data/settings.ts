/**
 * Data for the settings and wizard demos:
 *
 * - {@link settingsGroups} — grouped settings for `<lia-settings-page>`,
 * - {@link onboardingSteps} — a four-step flow for `<lia-wizard>`.
 */

import { html } from 'lit';
import type {
  SettingsGroup,
  StepDescriptor,
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
