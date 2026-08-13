/**
 * Form definitions for the forms demos.
 *
 * {@link everyFieldTypeForm} is the exhaustive one: it contains **every**
 * `FieldType` the kit declares, so a regression in the form system shows up on
 * a single page. The rest are realistic forms of the kind an application
 * actually ships — a create dialog, an edit form with server-side errors, a
 * filter form and a compact modal form.
 */

import { html } from 'lit';
import type {
  FieldRules,
  FormDefinition,
  FormErrors,
  FormValues,
  SelectOption,
} from '@liasoft/lit-ui';
import { email, matches, minLength, pattern, required, unlessUnlimited, min } from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Shared option lists
 * ------------------------------------------------------------------ */

/** Roles, reused by several forms. */
export const roleOptions: SelectOption[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'operator', label: 'Operator' },
  { value: 'developer', label: 'Developer' },
  { value: 'auditor', label: 'Auditor (read only)' },
];

/** Options in two `<optgroup>`s, to exercise grouped selects. */
export const regionOptions: SelectOption[] = [
  { value: 'eu-west', label: 'Ireland', group: 'Europe' },
  { value: 'eu-central', label: 'Frankfurt', group: 'Europe' },
  { value: 'eu-north', label: 'Stockholm', group: 'Europe' },
  { value: 'us-east', label: 'Virginia', group: 'Americas' },
  { value: 'us-west', label: 'Oregon', group: 'Americas' },
  { value: 'sa-east', label: 'São Paulo', group: 'Americas' },
  { value: 'ap-south', label: 'Mumbai', group: 'Asia Pacific' },
  { value: 'ap-northeast', label: 'Osaka', group: 'Asia Pacific' },
  { value: 'ap-southeast', label: 'Singapore', group: 'Asia Pacific', disabled: true },
];

/** Capabilities, used for a multi-select and a checkbox group. */
export const capabilityOptions: SelectOption[] = [
  { value: 'read', label: 'Read resources' },
  { value: 'write', label: 'Create and change resources' },
  { value: 'deploy', label: 'Deploy releases' },
  { value: 'billing', label: 'See billing' },
  { value: 'audit', label: 'Read the audit trail' },
];

/** Notification channels, used for a radio group. */
export const channelOptions: SelectOption[] = [
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'none', label: 'Do not notify me' },
];

/* ------------------------------------------------------------------ *
 * Every field type
 * ------------------------------------------------------------------ */

/**
 * One definition containing every `FieldType`, grouped by what the control
 * actually is. Sections 5 and 6 cover the composite behaviour: `nextTo` input
 * groups, `requiresReconf` callouts, validation state and the static types
 * that render no control at all.
 *
 * @example
 * ```ts
 * html`<lia-form .definition=${everyFieldTypeForm}></lia-form>`;
 * ```
 */
export const everyFieldTypeForm: FormDefinition = {
  id: 'field-gallery',
  title: 'Every field type',
  icon: 'fa-solid fa-rectangle-list',
  description: 'One row per <code>FieldType</code>, in the order the type union declares them.',
  sections: {
    text: {
      title: 'Text-like inputs',
      icon: 'fa-solid fa-keyboard',
      description: 'The native input types, each with its own keyboard on touch devices.',
      fields: {
        text: {
          type: 'text',
          label: 'Display name',
          value: 'Amara Okonkwo',
          placeholder: 'How the account is shown to others',
          mandatory: true,
          maxlength: 64,
          note: 'Up to 64 characters.',
        },
        password: {
          type: 'password',
          label: { title: 'Password', description: 'Left empty, the current one is kept.' },
          autocomplete: 'new-password',
          placeholder: '••••••••••••',
        },
        number: {
          type: 'number',
          label: 'Concurrent sessions',
          value: 4,
          min: 1,
          max: 32,
          step: 1,
          note: 'Between 1 and 32.',
        },
        email: {
          type: 'email',
          label: 'Email address',
          value: 'amara.okonkwo@example.org',
          autocomplete: 'email',
          mandatory: true,
        },
        url: {
          type: 'url',
          label: 'Homepage',
          value: 'https://example.org/teams/platform',
          placeholder: 'https://',
        },
        tel: {
          type: 'tel',
          label: 'Phone',
          value: '+31 20 555 0142',
          autocomplete: 'tel',
        },
      },
    },

    temporal: {
      title: 'Dates, times and files',
      icon: 'fa-regular fa-calendar',
      fields: {
        date: { type: 'date', label: 'Start date', value: '2026-09-01' },
        'datetime-local': {
          type: 'datetime-local',
          label: 'Maintenance window',
          value: '2026-09-14T02:30',
          desc: 'Local time of the selected region.',
        },
        time: { type: 'time', label: 'Daily report at', value: '07:15' },
        file: {
          type: 'file',
          label: 'Attach a policy document',
          accept: '.pdf,.md,.txt',
          note: 'PDF, Markdown or plain text.',
        },
        image: {
          type: 'image',
          label: 'Avatar',
          accept: 'image/png,image/jpeg,image/svg+xml',
          value:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
                '<rect width="96" height="96" rx="12" fill="%230d6efd"/>' +
                '<text x="48" y="60" font-size="38" font-family="sans-serif" fill="white" text-anchor="middle">AO</text>' +
                '</svg>'
            ),
          note: 'Square images look best. Tick the switch to remove the current one.',
        },
        hidden: {
          type: 'hidden',
          label: 'Record revision',
          value: '7f3c19a2',
          note: 'Hidden fields carry a value without a control; this note is the only visible trace.',
        },
      },
    },

    choice: {
      title: 'Choices',
      icon: 'fa-solid fa-list-check',
      description: 'Single choice, grouped choice, multiple choice and toggles.',
      fields: {
        role: {
          type: 'select',
          label: 'Role',
          options: roleOptions,
          value: 'operator',
          mandatory: true,
        },
        region: {
          type: 'select',
          label: { title: 'Home region', description: 'Rendered with <code>optgroup</code>s.' },
          options: regionOptions,
          value: 'eu-central',
        },
        capabilities: {
          type: 'select',
          label: 'Capabilities',
          options: capabilityOptions,
          multiple: true,
          rows: 5,
          selected: ['read', 'deploy'],
          note: 'Hold ⌘/Ctrl to pick more than one.',
        },
        channel: {
          type: 'radio',
          label: 'Notify me by',
          values: channelOptions,
          value: 'email',
        },
        terms: {
          type: 'checkbox',
          label: 'Agreements',
          values: [
            { value: 'aup', label: 'I accept the acceptable-use policy' },
            { value: 'dpa', label: 'I accept the data-processing agreement' },
          ],
          selected: ['aup'],
        },
        maintenance: {
          type: 'switch',
          label: 'Maintenance mode',
          checked: false,
          desc: 'Blocks every non-administrative session.',
          requiresReconf: ['edge router', 'status page'],
        },
        telemetry: {
          type: 'switch',
          label: 'Usage telemetry',
          checked: true,
          note: 'Anonymous counters only; never request payloads.',
        },
      },
    },

    long: {
      title: 'Long values',
      icon: 'fa-solid fa-align-left',
      fields: {
        description: {
          type: 'textarea',
          label: 'Description',
          rows: 4,
          value:
            'Owns the shared platform services: build cache, incident console and the policy engine.',
          placeholder: 'What is this account for?',
        },
        quota: {
          type: 'textul',
          label: { title: 'Storage quota', description: 'Tick the box for no limit at all.' },
          value: 25,
          min: 0,
          note: 'In gibibytes.',
        },
        seats: {
          type: 'textul',
          label: 'Seats',
          value: -1,
          note: 'Currently unlimited — untick to set a number.',
        },
        joinToken: {
          type: 'longtext',
          label: { title: 'Join token', description: 'Copy it once; it is not shown again.' },
          value:
            'orbit_join_2f8c41d0a97b4e15b3d6c8e07a1f5920:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
            'eyJzY29wZSI6WyJyZWFkIiwiZGVwbG95Il0sImV4cCI6MTc5MDAwMDAwMH0',
        },
      },
    },

    composite: {
      title: 'Composite rows',
      icon: 'fa-solid fa-object-group',
      description: 'Several controls sharing one row through <code>nextTo</code>.',
      fields: {
        host: {
          type: 'text',
          label: 'Listen address',
          value: '10.0.4.18',
          nextTo: {
            port: {
              type: 'number',
              label: 'Port',
              value: 8443,
              min: 1,
              max: 65_535,
              prefix: 'port',
            },
            protocol: {
              type: 'select',
              label: 'Protocol',
              options: [
                { value: 'https', label: 'HTTPS' },
                { value: 'http', label: 'HTTP' },
                { value: 'grpc', label: 'gRPC' },
              ],
              value: 'https',
            },
          },
        },
        retention: {
          type: 'number',
          label: 'Log retention',
          value: 30,
          min: 1,
          nextTo: {
            retentionUnit: {
              type: 'select',
              label: 'Unit',
              options: [
                { value: 'days', label: 'days' },
                { value: 'weeks', label: 'weeks' },
                { value: 'months', label: 'months' },
              ],
              value: 'days',
            },
          },
        },
        rate: {
          type: 'number',
          label: 'Rate limit',
          value: 600,
          nextTo: {
            rateWindow: {
              type: 'number',
              label: 'Per seconds',
              value: 60,
              prefix: 'per',
            },
          },
          requiresReconf: ['edge router'],
        },
      },
    },

    static: {
      title: 'Static rows',
      icon: 'fa-solid fa-circle-info',
      description: 'Types that print something instead of collecting it.',
      fields: {
        intro: {
          type: 'infotext',
          label: 'About this section',
          value:
            'These rows never appear in the submitted values. They exist so a form can explain itself without breaking out of the two-column grid.',
        },
        accountId: {
          type: 'label',
          label: 'Account id',
          value: 'acct_01J9ZK4M2QF3',
        },
        docs: {
          type: 'link',
          label: 'Reference',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_components',
          value: 'Web components on MDN',
        },
        related: {
          type: 'itemlist',
          label: 'Attached resources',
          items: [
            { item: 'vol-eu-central-041', href: '#/orbit/volumes/041', label: 'Volume' },
            { item: 'svc-checkout', href: '#/orbit/services/checkout', label: 'Service' },
            { item: 'key_9f21c7', class: 'text-body-secondary' },
          ],
        },
        signature: {
          type: 'custom',
          label: 'Custom slot',
          render: () => html`
            <div class="d-flex align-items-center gap-2">
              <span class="badge text-bg-success">verified</span>
              <span class="text-body-secondary small"
                >Anything renderable can live here — this is a plain Lit template.</span
              >
            </div>
          `,
        },
      },
    },

    invalid: {
      title: 'Validation state',
      icon: 'fa-solid fa-triangle-exclamation',
      description: 'What a field looks like once the server has rejected it.',
      fields: {
        handle: {
          type: 'text',
          label: 'Handle',
          value: 'a okonkwo',
          valid: false,
          error: 'Handles may only contain letters, digits, dots and hyphens.',
          mandatory: true,
        },
        confirmEmail: {
          type: 'email',
          label: 'Repeat the email address',
          value: 'amara.okonkwo@exampel.org',
          valid: false,
          error: 'The two addresses do not match.',
        },
        disabledField: {
          type: 'text',
          label: 'Managed externally',
          value: 'Synchronised from the directory',
          disabled: true,
          note: 'Disabled fields are skipped by the value model.',
        },
        readonlyField: {
          type: 'text',
          label: 'Read only',
          value: 'orbit-eu-central-1',
          readonly: true,
        },
      },
    },
  },
  buttons: [
    { label: 'Save changes', type: 'submit', variant: 'primary' },
    { label: 'Reset', type: 'reset', variant: 'outline-secondary' },
  ],
};

/* ------------------------------------------------------------------ *
 * Realistic forms
 * ------------------------------------------------------------------ */

/**
 * The create form of the members CRUD demo — short, mandatory-heavy, with a
 * collapsible "advanced" section.
 */
export const createMemberForm: FormDefinition = {
  id: 'member-create',
  title: 'Add a member',
  icon: 'fa-solid fa-user-plus',
  description: 'They receive an invitation as soon as you save.',
  backUrl: '#/table/data-table',
  sections: {
    identity: {
      title: 'Identity',
      icon: 'fa-solid fa-id-card',
      fields: {
        name: { type: 'text', label: 'Full name', mandatory: true, placeholder: 'Ada Lovelace' },
        loginname: {
          type: 'text',
          label: { title: 'Sign-in name', description: 'Lower case, no spaces.' },
          mandatory: true,
          pattern: '[a-z0-9._\\-]+',
          placeholder: 'a.lovelace',
        },
        email: { type: 'email', label: 'Email address', mandatory: true, autocomplete: 'email' },
        team: {
          type: 'select',
          label: 'Team',
          options: [
            { value: 'platform', label: 'Platform' },
            { value: 'payments', label: 'Payments' },
            { value: 'identity', label: 'Identity' },
            { value: 'data', label: 'Data' },
            { value: 'edge', label: 'Edge' },
            { value: 'support', label: 'Support' },
            { value: 'security', label: 'Security' },
          ],
          value: 'platform',
        },
      },
    },
    access: {
      title: 'Access',
      icon: 'fa-solid fa-key',
      fields: {
        role: { type: 'select', label: 'Role', options: roleOptions, value: 'developer', mandatory: true },
        capabilities: {
          type: 'checkbox',
          label: 'Capabilities',
          values: capabilityOptions,
          selected: ['read'],
        },
        mfa: {
          type: 'switch',
          label: 'Require two-factor authentication',
          checked: true,
          desc: 'They must enrol before their first sign-in completes.',
        },
        enabled: { type: 'switch', label: 'Account enabled', checked: true },
      },
    },
    limits: {
      title: 'Limits',
      icon: 'fa-solid fa-gauge',
      collapsible: true,
      collapsed: true,
      fields: {
        quota: { type: 'textul', label: 'Storage quota', value: 10, note: 'In gibibytes.' },
        transfer: { type: 'textul', label: 'Monthly transfer', value: -1, note: 'In gibibytes.' },
        expires: { type: 'date', label: 'Access expires on' },
        notes: { type: 'textarea', label: 'Internal note', rows: 3 },
      },
    },
  },
  buttons: [
    { label: 'Create member', type: 'submit', variant: 'primary' },
    { label: 'Cancel', type: 'button', variant: 'outline-secondary', id: 'cancel' },
  ],
};

/** Validation rules for {@link createMemberForm}. */
export const createMemberRules: Record<string, FieldRules> = {
  name: [required('Give the member a name.'), minLength(2)],
  loginname: [
    required('A sign-in name is required.'),
    pattern(/^[a-z0-9._-]+$/, 'Lower-case letters, digits, dots, hyphens and underscores only.'),
  ],
  email: [required(), email()],
  quota: unlessUnlimited(min(1, 'The quota must be at least 1 GiB.')),
};

/** A short form for a modal — no section chrome, no cancel button. */
export const inviteForm: FormDefinition = {
  id: 'invite',
  noSubmit: true,
  sections: {
    main: {
      fields: {
        email: {
          type: 'email',
          label: 'Email address',
          mandatory: true,
          placeholder: 'name@example.org',
        },
        role: { type: 'select', label: 'Role', options: roleOptions, value: 'developer' },
        message: {
          type: 'textarea',
          label: 'Personal message',
          rows: 3,
          placeholder: 'Optional — included in the invitation email.',
        },
      },
    },
  },
};

/** A change-password form, to demonstrate cross-field validation. */
export const changePasswordForm: FormDefinition = {
  id: 'change-password',
  title: 'Change your password',
  icon: 'fa-solid fa-lock',
  sections: {
    main: {
      fields: {
        current: {
          type: 'password',
          label: 'Current password',
          mandatory: true,
          autocomplete: 'current-password',
        },
        next: {
          type: 'password',
          label: { title: 'New password', description: 'At least twelve characters.' },
          mandatory: true,
          autocomplete: 'new-password',
        },
        confirm: {
          type: 'password',
          label: 'Repeat the new password',
          mandatory: true,
          autocomplete: 'new-password',
        },
        signOutOthers: {
          type: 'switch',
          label: 'Sign out every other session',
          checked: true,
        },
      },
    },
  },
  buttons: [{ label: 'Change password', type: 'submit', variant: 'primary' }],
};

/** Validation rules for {@link changePasswordForm}. */
export const changePasswordRules: Record<string, FieldRules> = {
  current: required(),
  next: [required(), minLength(12, 'Use at least twelve characters.')],
  confirm: [required(), matches('next', 'The two passwords do not match.', 'New password')],
};

/** A filter form, rendered as a single horizontal section. */
export const filterForm: FormDefinition = {
  id: 'member-filter',
  sections: {
    main: {
      fields: {
        text: { type: 'text', label: 'Contains', placeholder: 'name, email, team…' },
        role: { type: 'select', label: 'Role', options: [{ value: '', label: 'Any role' }, ...roleOptions] },
        active: {
          type: 'select',
          label: 'State',
          options: [
            { value: '', label: 'Any state' },
            { value: 'yes', label: 'Enabled' },
            { value: 'no', label: 'Disabled' },
          ],
        },
        mfa: { type: 'switch', label: 'Two-factor only', checked: false },
      },
    },
  },
  buttons: [
    { label: 'Apply', type: 'submit', variant: 'primary' },
    { label: 'Clear', type: 'reset', variant: 'outline-secondary' },
  ],
};

/* ------------------------------------------------------------------ *
 * Server-side state
 * ------------------------------------------------------------------ */

/**
 * What a rejected submit looks like coming back from an API — hand this to
 * `<lia-form errors>` to see the messages rendered under the offending rows.
 */
export const memberFormErrors: FormErrors = {
  loginname: 'That sign-in name is already taken.',
  email: 'This address is on the organisation’s block list.',
  quota: 'The remaining pool only allows 8 GiB.',
};

/** A pre-filled value model, e.g. the response of a GET before an edit. */
export const memberFormValues: FormValues = {
  name: 'Amara Okonkwo',
  loginname: 'a.okonkwo',
  email: 'amara.okonkwo@example.org',
  team: 'platform',
  role: 'owner',
  capabilities: ['read', 'write', 'deploy', 'billing'],
  mfa: true,
  enabled: true,
  quota: 40,
  transfer: -1,
};
