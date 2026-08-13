/**
 * Demo pages — Forms.
 *
 * The data-driven form system. A form is a {@link FormDefinition}: named
 * sections of named fields. The kit renders the two-column Bootstrap layout,
 * owns the value model, validates it and reports through events — there is no
 * per-field wiring anywhere. The family also covers editing one value in
 * place, and the multi-step wizard with its stepper.
 *
 * Every form on these pages is live: submit one and the values it collected
 * appear underneath it as JSON.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type {
  AsyncRule,
  FieldRules,
  FormDefinition,
  FormErrors,
  FormField,
  FormSubmitDetail,
  FormValidatingDetail,
  FormValues,
  InlineSaveDetail,
  LiaForm,
  LiaWizard,
  OptionsLoader,
  SelectOption,
  StepDescriptor,
  WizardFinishDetail,
  WizardStepDetail,
} from '@liasoft/lit-ui';
import {
  DEFAULT_VALIDATION_MESSAGES,
  LiaElement,
  collectInitialValues,
  email,
  flattenFields,
  matches,
  minLength,
  required,
  requiredWithout,
  toast,
  validateForm,
} from '@liasoft/lit-ui';
import {
  capabilityOptions,
  changePasswordForm,
  changePasswordRules,
  createMemberForm,
  createMemberRules,
  deploymentSteps,
  everyFieldTypeForm,
  filterForm,
  inviteForm,
  memberFormErrors,
  memberFormValues,
  onboardingStepDescriptors,
  onboardingSteps,
  regionOptions,
  roleOptions,
  someUsers,
  userTeamOptions,
  type DemoUser,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const LAYOUT_FIELDS: Record<string, FormField> = {
  name: { type: 'text', label: 'Full name', value: 'Amara Okonkwo', mandatory: true },
  role: { type: 'select', label: 'Role', options: roleOptions, value: 'owner' },
  active: { type: 'switch', label: 'Account enabled', checked: true },
};

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * Every field type the kit declares, in one live form. Submitting it prints
 * the value model the kit derived.
 *
 * @example
 * ```ts
 * html`<demo-field-gallery></demo-field-gallery>`;
 * ```
 */
@customElement('demo-field-gallery')
export class DemoFieldGallery extends LiaElement {
  @state() private values?: FormValues;
  @state() private showHidden = false;
  @state() private disabled = false;
  @state() private floating = false;

  protected override render(): TemplateResult {
    const fields = flattenFields(everyFieldTypeForm);
    return html`
      ${tryIt(
        `All ${fields.length} fields below come from one object. Submit at the bottom to see the values the kit collected.`
      )}
      <div class="d-flex flex-wrap gap-3 mb-3">
        ${(
          [
            ['Show hidden fields', 'showHidden'],
            ['Disable everything', 'disabled'],
            ['Floating labels', 'floating'],
          ] as const
        ).map(
          ([label, key]) => html`<div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              role="switch"
              id="demo-gallery-${key}"
              .checked=${this[key]}
              @change=${(event: Event) => {
                this[key] = (event.target as HTMLInputElement).checked;
              }}
            />
            <label class="form-check-label small" for="demo-gallery-${key}">${label}</label>
          </div>`
        )}
      </div>

      <lia-form
        id-prefix="gallery"
        .definition=${everyFieldTypeForm}
        .showHidden=${this.showHidden}
        .disabled=${this.disabled}
        .floating=${this.floating}
        @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
          this.values = event.detail.values;
        }}
      ></lia-form>

      ${valueDump(this.values, {
        title: 'Collected values',
        empty: 'Press "Save" and the whole value model appears here.',
        maxHeight: '24rem',
      })}
    `;
  }
}

/** A realistic form with rules, a reset, a busy state and server-side errors. */
@customElement('demo-form')
export class DemoForm extends LiaElement {
  @state() private busy = false;
  @state() private errors: FormErrors = {};
  @state() private values?: FormValues;
  @state() private events: readonly LoggedEvent[] = [];

  @query('lia-form') private form?: LiaForm;

  private async onSubmit(event: CustomEvent<FormSubmitDetail>): Promise<void> {
    this.events = logEvent(this.events, 'lia-submit', { button: event.detail.button?.label });
    this.busy = true;
    this.errors = {};
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.busy = false;

    if (String(event.detail.values.loginname ?? '') === 'a.okonkwo') {
      this.errors = memberFormErrors;
      toast({ variant: 'danger', message: 'The server rejected three fields.' });
      return;
    }
    this.values = event.detail.values;
    toast({ variant: 'success', message: 'Saved.' });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Submit it empty — the rules fire and focus lands on the first offender. Then enter "a.okonkwo" as the sign-in name to get server-side errors back.'
      )}
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => this.form?.setValues(memberFormValues, false)}
        >
          <i class="fa-solid fa-wand-magic-sparkles me-2" aria-hidden="true"></i>Fill it in
        </button>
        <button class="btn btn-sm btn-outline-secondary" type="button" @click=${() => this.form?.reset()}>
          <i class="fa-solid fa-rotate-left me-2" aria-hidden="true"></i>reset()
        </button>
        <button class="btn btn-sm btn-outline-secondary" type="button" @click=${() => this.form?.submit()}>
          <i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>submit()
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => {
            this.values = this.form?.getValues();
          }}
        >
          <i class="fa-solid fa-eye me-2" aria-hidden="true"></i>getValues()
        </button>
      </div>

      <lia-form
        id-prefix="member"
        .definition=${createMemberForm}
        .rules=${createMemberRules}
        .errors=${this.errors}
        .busy=${this.busy}
        .hiddenFields=${{ organisation: 'acct_01J9ZK4M2QF3' }}
        @lia-submit=${this.onSubmit}
        @lia-invalid=${(event: CustomEvent<{ errors: FormErrors }>) => {
          this.events = logEvent(this.events, 'lia-invalid', {
            fields: Object.keys(event.detail.errors),
          });
        }}
        @lia-change=${(event: CustomEvent<{ name: string; value: unknown }>) => {
          this.events = logEvent(this.events, 'lia-change', {
            name: event.detail.name,
            value: event.detail.value,
          });
        }}
        @lia-form-reset=${() => {
          this.events = logEvent(this.events, 'lia-form-reset');
          this.errors = {};
          this.values = undefined;
        }}
        @lia-action=${(event: Event) => event.preventDefault()}
      ></lia-form>

      ${valueDump(this.values, { title: 'Values', empty: 'Nothing submitted yet.' })}
      ${eventLog(this.events)}
    `;
  }
}

/** Validation: the rule set, live results and the messages. */
@customElement('demo-validation')
export class DemoValidation extends LiaElement {
  @state() private values: FormValues = collectInitialValues(changePasswordForm);
  @state() private errors: FormErrors = {};
  @state() private submitted = false;

  private readonly rules: Record<string, FieldRules> = changePasswordRules;

  private revalidate(values: FormValues): void {
    this.values = values;
    if (!this.submitted) return;
    this.errors = validateForm(changePasswordForm, values, this.rules);
  }

  protected override render(): TemplateResult {
    const live = validateForm(changePasswordForm, this.values, this.rules);
    const failing = Object.keys(live);
    return html`
      ${tryIt(
        'Type in the form: the panel on the right is `validateForm()` running on every keystroke, whether or not the form shows the errors yet.'
      )}
      ${split(
        html`<lia-form
          id-prefix="pw"
          .definition=${changePasswordForm}
          .rules=${this.rules}
          .errors=${this.errors}
          @lia-change=${(event: CustomEvent<{ values: FormValues }>) => this.revalidate(event.detail.values)}
          @lia-invalid=${(event: CustomEvent<{ errors: FormErrors }>) => {
            this.submitted = true;
            this.errors = event.detail.errors;
          }}
          @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
            this.submitted = true;
            this.errors = {};
            toast({
              variant: 'success',
              message: `Password changed${
                event.detail.values.signOutOthers === true ? ', other sessions signed out' : ''
              }.`,
            });
          }}
        ></lia-form>`,
        html`<div class="card h-100">
          <div class="card-header bg-body-tertiary">
            <span class="fw-semibold">validateForm() right now</span>
          </div>
          <div class="card-body">
            ${failing.length === 0
              ? html`<p class="text-success mb-0">
                  <i class="fa-solid fa-circle-check me-2" aria-hidden="true"></i>No rule is
                  failing.
                </p>`
              : html`<dl class="mb-0 small">
                  ${failing.map(
                    (field) => html`<dt class="font-monospace">${field}</dt>
                      <dd class="text-danger">${live[field]}</dd>`
                  )}
                </dl>`}
          </div>
        </div>`
      )}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Conditional fields
 * ------------------------------------------------------------------ */

const DELIVERY_MODES = [
  { value: 'local', label: 'Deliver locally' },
  { value: 'relay', label: 'Hand off to a relay' },
  { value: 'discard', label: 'Discard silently' },
];

const CONDITIONAL_FORM: FormDefinition = {
  id: 'conditional-delivery',
  sections: {
    delivery: {
      title: 'Delivery',
      icon: 'fa-solid fa-paper-plane',
      fields: {
        mode: { type: 'select', label: 'Delivery', options: DELIVERY_MODES, value: 'local' },
        host: {
          type: 'text',
          label: 'Relay host',
          placeholder: 'smtp.example.org',
          showWhen: { field: 'mode', equals: 'relay' },
          requiredWhen: { field: 'mode', equals: 'relay' },
        },
        port: {
          type: 'number',
          label: 'Port',
          value: 587,
          min: 1,
          max: 65535,
          showWhen: { field: 'mode', equals: 'relay' },
        },
        authenticate: {
          type: 'switch',
          label: 'Authenticate',
          showWhen: { field: 'mode', equals: 'relay' },
        },
        username: {
          type: 'text',
          label: 'User name',
          showWhen: [
            { field: 'mode', equals: 'relay' },
            { field: 'authenticate', truthy: true },
          ],
          requiredWhen: [
            { field: 'mode', equals: 'relay' },
            { field: 'authenticate', truthy: true },
          ],
        },
        bounceTo: {
          type: 'email',
          label: 'Send bounces to',
          note: 'Nothing to bounce when the mail is discarded.',
          disabledWhen: { field: 'mode', equals: 'discard' },
        },
      },
    },
    filtering: {
      title: 'Filtering',
      icon: 'fa-solid fa-filter',
      description: 'Hidden entirely while the mailbox bypasses the filter.',
      hideWhen: { field: 'bypassFilter', truthy: true },
      fields: {
        tagLevel: { type: 'number', label: 'Tag at score', value: 4, step: 0.1 },
        killLevel: { type: 'number', label: 'Reject at score', value: 12, step: 0.1 },
        rewriteSubject: { type: 'switch', label: 'Rewrite the subject' },
      },
    },
    switches: {
      title: 'Mailbox',
      icon: 'fa-solid fa-inbox',
      fields: {
        bypassFilter: {
          type: 'switch',
          label: { title: 'Bypass the filter', description: 'Folds the whole Filtering card away.' },
        },
        quota: {
          type: 'textul',
          label: 'Quota (MiB)',
          value: 2048,
          maxlength: 9,
          readonlyWhen: { field: 'locked', truthy: true },
        },
        locked: {
          type: 'switch',
          label: { title: 'Lock the quota', description: 'Makes the quota box read-only.' },
        },
      },
    },
  },
};

/** A form that reshapes itself from `showWhen` / `hideWhen` / `requiredWhen`. */
@customElement('demo-conditional-form')
export class DemoConditionalForm extends LiaElement {
  @state() private values: FormValues = collectInitialValues(CONDITIONAL_FORM);
  @state() private saved?: FormValues;

  protected override render(): TemplateResult {
    const shown = flattenFields(CONDITIONAL_FORM, { values: this.values }).map(([name]) => name);
    return html`
      ${tryIt(
        'Switch the delivery mode, turn authentication on, tick “bypass the filter”, lock the quota. Nothing below the form is wired by hand — the panel just lists what `flattenFields()` currently considers visible.'
      )}
      ${split(
        html`<lia-form
          id-prefix="cond"
          .definition=${CONDITIONAL_FORM}
          .values=${this.values}
          @lia-change=${(event: CustomEvent<{ values: FormValues }>) => {
            this.values = event.detail.values;
          }}
          @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
            this.saved = event.detail.values;
            toast({ variant: 'success', message: 'Delivery settings saved.' });
          }}
        ></lia-form>`,
        html`<div class="card h-100">
          <div class="card-header bg-body-tertiary">
            <span class="fw-semibold">Fields on screen right now</span>
          </div>
          <ul class="list-group list-group-flush small font-monospace">
            ${shown.map((name) => html`<li class="list-group-item py-1">${name}</li>`)}
          </ul>
        </div>`
      )}
      ${valueDump(this.saved, {
        title: 'Submitted values',
        empty: 'Save to see the values — including the ones the conditions hid.',
      })}
    `;
  }
}

const EITHER_OR_FORM: FormDefinition = {
  id: 'either-or',
  sections: {
    who: {
      title: 'Who is this for?',
      icon: 'fa-solid fa-user-tag',
      description: 'A person, an organisation, or both — but not neither.',
      fields: {
        firstName: { type: 'text', label: 'Given name', requiredWhen: { field: 'organisation', empty: true } },
        lastName: { type: 'text', label: 'Family name', requiredWhen: { field: 'organisation', empty: true } },
        organisation: {
          type: 'text',
          label: 'Organisation',
          requiredWhen: { all: [{ field: 'firstName', empty: true }, { field: 'lastName', empty: true }] },
        },
      },
    },
  },
};

/** The "one of these, please" rule, as `requiredWithout`. */
@customElement('demo-conditional-rules')
export class DemoConditionalRules extends LiaElement {
  @state() private saved?: FormValues;

  protected override render(): TemplateResult {
    return html`
      <lia-form
        id-prefix="either"
        submit-label="Create"
        .definition=${EITHER_OR_FORM}
        .rules=${{
          lastName: requiredWithout(['organisation']),
          firstName: requiredWithout(['organisation']),
          organisation: requiredWithout(['lastName', 'firstName'], 'Give a person or an organisation.'),
        } as Record<string, FieldRules>}
        @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
          this.saved = event.detail.values;
          toast({ variant: 'success', message: 'Created.' });
        }}
      ></lia-form>
      ${valueDump(this.saved, { title: 'Created', empty: 'Submit it empty to see three failures at once.' })}
    `;
  }
}

/** A single `<lia-form-field>` in each of its three layouts. */
@customElement('demo-field-layouts')
export class DemoFieldLayouts extends LiaElement {
  @state() private values: FormValues = { name: 'Amara Okonkwo', role: 'owner', active: true };

  private onChange(event: CustomEvent<{ name: string; value: unknown }>): void {
    this.values = { ...this.values, [event.detail.name]: event.detail.value };
  }

  protected override render(): TemplateResult {
    const entries = Object.entries(LAYOUT_FIELDS);
    return html`
      <div class="row g-4" @lia-change=${this.onChange}>
        ${(['row', 'floating', 'plain'] as const).map(
          (layout) => html`<div class="col-12 col-lg-4">
            <p class="small text-body-secondary font-monospace mb-2">layout="${layout}"</p>
            <div class="border rounded-3 p-3">
              ${entries.map(
                ([name, field]) => html`<lia-form-field
                  id-prefix=${layout}
                  name=${name}
                  .field=${field}
                  .values=${this.values}
                  layout=${layout}
                ></lia-form-field>`
              )}
            </div>
          </div>`
        )}
      </div>
      ${valueDump(this.values, { title: 'Shared value model' })}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const DEFINITION_CODE = dedent`
  const definition: FormDefinition = {
    id: 'member-create',
    title: 'Add a member',
    icon: 'fa-solid fa-user-plus',
    description: 'They receive an invitation as soon as you save.',
    sections: {
      identity: {
        title: 'Identity',
        icon: 'fa-solid fa-id-card',
        fields: {
          name: { type: 'text', label: 'Full name', mandatory: true },
          loginname: {
            type: 'text',
            label: { title: 'Sign-in name', description: 'Lower case, no spaces.' },
            pattern: '[a-z0-9._\\-]+',
            mandatory: true,
          },
          email: { type: 'email', label: 'Email address', mandatory: true, autocomplete: 'email' },
        },
      },
      limits: {
        title: 'Limits',
        collapsible: true,
        collapsed: true,        // rendered behind a toggle
        fields: {
          quota: { type: 'textul', label: 'Storage quota', value: 10, note: 'In gibibytes.' },
          expires: { type: 'date', label: 'Access expires on' },
        },
      },
    },
    buttons: [
      { label: 'Create member', type: 'submit', variant: 'primary' },
      { label: 'Cancel', type: 'button', variant: 'outline-secondary', id: 'cancel' },
    ],
  };
`;

const FORM_CODE = dedent`
  html\`<lia-form
    id-prefix="member"
    .definition=\${definition}
    .rules=\${rules}                                   // client-side validation
    .errors=\${this.serverErrors}                      // FormErrors from the API
    .busy=\${this.saving}                              // disables the bar, spins the button
    .hiddenFields=\${{ organisation: accountId }}      // submitted, never rendered
    @lia-submit=\${(e: CustomEvent<FormSubmitDetail>) => this.save(e.detail.values)}
    @lia-invalid=\${(e: CustomEvent) => report(e.detail.errors)}
    @lia-change=\${(e: CustomEvent) => this.preview(e.detail.values)}
    @lia-form-reset=\${() => (this.serverErrors = {})}
  ></lia-form>\`;

  // Imperative escape hatches, when a host has to reach in:
  form.getValues();
  form.setValues(record, /* merge */ false);
  form.reset();
  form.submit();
  form.focusFirstInvalid();
`;

const RULES_CODE = dedent`
  import {
    custom, email, integer, matches, max, maxLength, min, minLength,
    numeric, pattern, required, unlessUnlimited, url, validateForm,
  } from '@liasoft/lit-ui';

  const rules: Record<string, FieldRules> = {
    current: required(),
    next: [required(), minLength(12, 'Use at least twelve characters.')],
    confirm: [required(), matches('next', 'The two passwords do not match.', 'New password')],
    quota: unlessUnlimited(min(1)),                    // skipped when "unlimited" is ticked
    slug: custom((value) => (taken.has(String(value)) ? 'Already in use.' : undefined)),
  };

  // The same engine, outside any element:
  const errors: FormErrors = validateForm(definition, values, rules);
`;

const FIELD_CODE = dedent`
  // One row, rendered on its own — for a bespoke layout the section grid cannot do.
  html\`<lia-form-field
    name="role"
    .field=\${{ type: 'select', label: 'Role', options: roleOptions }}
    .values=\${this.values}                 // the shared model; the field reads its own key
    layout="row"                           // 'row' | 'floating' | 'plain'
    .errors=\${this.errors}
    @lia-change=\${(e: CustomEvent) => (this.values = { ...this.values, [e.detail.name]: e.detail.value })}
  ></lia-form-field>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderFields(): TemplateResult {
  return html`
    ${section(
      'Every field type',
      'One definition containing all twenty-two `FieldType`s, grouped by what the control really is. If the form system regresses, it shows up here.',
      example('Live', html`<demo-field-gallery></demo-field-gallery>`, DEFINITION_CODE, {
        bodyClass: 'p-3 p-lg-4',
      })
    )}
    ${section('The catalogue', 'What each type renders, and which properties it reads.', [
      example(
        'Controls',
        propTable(
          [
            { name: 'text · password · email · url · tel', type: 'string', description: 'A single-line input. Reads `placeholder`, `maxlength`, `pattern`, `autocomplete`.' },
            { name: 'number', type: 'number', description: 'Reads `min`, `max`, `step`.' },
            { name: 'date · datetime-local · time', type: 'string', description: 'Native temporal inputs.' },
            { name: 'textarea', type: 'string', description: 'Reads `rows` and `cols`.' },
            { name: 'select', type: 'string | string[]', description: '`options`, grouped into `optgroup`s by `option.group`. `multiple` for a list box.' },
            { name: 'checkbox', type: 'string[] | boolean', description: 'A group when `values` is given, a single box when it is not.' },
            { name: 'radio', type: 'string', description: 'Always a group; reads `values`.' },
            { name: 'switch', type: 'boolean', description: 'A checkbox with `role="switch"`.' },
            { name: 'textul', type: 'number | -1', description: 'A number with an “unlimited” toggle that submits `-1`.' },
            { name: 'file · image', type: 'File', description: '`image` adds a preview and a delete toggle.' },
            { name: 'hidden', type: 'string', description: 'Submitted, never rendered — unless `show-hidden` is set.' },
            { name: 'label · infotext · link · itemlist · longtext', type: '—', description: 'Static rows: read-only text, a heading, a hyperlink, a list, and a copyable block.' },
            { name: 'custom', type: '—', description: 'Renders `field.render(field, id)` — anything Lit can draw.' },
          ],
          'FieldType'
        )
      ),
      example(
        'Composite rows',
        html`<lia-form
          id-prefix="composite"
          no-submit
          .definition=${{
            sections: {
              main: {
                fields: {
                  host: {
                    type: 'text',
                    label: { title: 'Endpoint', description: 'Host, port and protocol in one row.' },
                    value: 'ingest.example.net',
                    nextTo: {
                      port: { type: 'number', value: 8443, prefix: ':', class: 'flex-grow-0' },
                      tls: { type: 'select', value: 'strict', options: [
                        { value: 'strict', label: 'TLS, verified' },
                        { value: 'lenient', label: 'TLS, unverified' },
                        { value: 'off', label: 'Plain' },
                      ] },
                    },
                  },
                  retention: {
                    type: 'number',
                    label: 'Retention',
                    value: 30,
                    nextTo: { unit: { type: 'select', value: 'days', options: [
                      { value: 'hours', label: 'hours' },
                      { value: 'days', label: 'days' },
                      { value: 'months', label: 'months' },
                    ] } },
                  },
                  region: {
                    type: 'select',
                    label: { title: 'Home region', description: 'Rendered with <code>optgroup</code>s.' },
                    options: regionOptions,
                    value: 'eu-central',
                  },
                  reconf: {
                    type: 'switch',
                    label: 'Compress at rest',
                    checked: false,
                    requiresReconf: ['edge router', 'ingest workers'],
                  },
                },
              },
            },
          } as FormDefinition}
        ></lia-form>`,
        dedent`
          // \`nextTo\` puts extra fields in the same input group, to the right.
          host: {
            type: 'text',
            label: 'Endpoint',
            nextTo: {
              port: { type: 'number', value: 8443, prefix: ':' },
              tls: { type: 'select', options: tlsOptions },
            },
          },

          // \`requiresReconf\` warns that saving is not the end of the story.
          compress: { type: 'switch', label: 'Compress at rest', requiresReconf: ['edge router'] },
        `
      ),
      example(
        'Static rows',
        html`<lia-form
          id-prefix="static"
          no-submit
          .definition=${{
            sections: {
              main: {
                fields: {
                  intro: {
                    type: 'infotext',
                    label: 'Before you begin',
                    value:
                      'These values come from the host itself and cannot be edited here. They are shown so the form is self-contained.',
                  },
                  agent: { type: 'label', label: 'Agent version', value: '4.12.0 (linux/arm64)' },
                  docs: {
                    type: 'link',
                    label: 'Reference',
                    href: 'https://developer.mozilla.org/',
                    value: 'Open the endpoint reference',
                  },
                  related: {
                    type: 'itemlist',
                    label: 'Attached volumes',
                    items: [
                      { item: 'vol-eu-central-041', href: '#/table/listing' },
                      { item: 'vol-eu-central-058', href: '#/table/listing' },
                      { item: 'vol-eu-central-062 (detaching)', class: 'text-body-secondary' },
                    ],
                  },
                  signature: {
                    type: 'longtext',
                    label: 'Join token',
                    value:
                      'orbit_join_2f8c41d0a97b4e1583ae7241bc95d0f3e4a913c2b6f80153ae7241bc95d0f3',
                    note: 'Copy it once; it is not shown again.',
                  },
                },
              },
            },
          } as FormDefinition}
        ></lia-form>`,
        dedent`
          // Static types render no control at all, but keep the two-column rhythm.
          intro:     { type: 'infotext', label: 'Before you begin', value: '…' },
          agent:     { type: 'label', label: 'Agent version', value: '4.12.0' },
          docs:      { type: 'link', label: 'Reference', href: '…', value: 'Open the reference' },
          related:   { type: 'itemlist', label: 'Volumes', items: [{ item: 'vol-041', href: '…' }] },
          signature: { type: 'longtext', label: 'Join token', value: token };  // with a copy button
        `
      ),
      example(
        'Validation state, on the field',
        html`<lia-form
          id-prefix="state"
          no-submit
          .definition=${{
            sections: {
              main: {
                fields: {
                  ok: { type: 'text', label: 'Accepted', value: 'a.lovelace', valid: true },
                  bad: {
                    type: 'text',
                    label: 'Rejected',
                    value: 'A Lovelace',
                    valid: false,
                    error: 'Lower-case letters, digits, dots and underscores only.',
                  },
                  readonly: { type: 'text', label: 'Read only', value: 'acct_01J9ZK4M2QF3', readonly: true },
                  disabled: { type: 'text', label: 'Disabled', value: 'not editable', disabled: true },
                },
              },
            },
          } as FormDefinition}
        ></lia-form>`,
        dedent`
          // A field can carry its own state, independent of the rule engine —
          // which is how a server-side error is rendered on the right row.
          loginname: { type: 'text', valid: false, error: 'That sign-in name is already taken.' }
        `
      ),
    ])}
    ${section('One field at a time', 'The row element on its own, for a layout the section grid cannot produce.', [
      example('Three layouts', html`<demo-field-layouts></demo-field-layouts>`, FIELD_CODE),
    ])}
  `;
}

function renderForm(): TemplateResult {
  return html`
    ${section(
      'A working form',
      'Rules, a busy state, server-side errors and the imperative escape hatches — all on one definition.',
      example('Live', html`<demo-form></demo-form>`, FORM_CODE)
    )}
    ${section('Shapes', 'The same element with the chrome turned up or down.', [
      example(
        'In a modal — no sections, no buttons',
        html`<div class="border rounded-3 p-3" style="max-width: 34rem;">
          <lia-form
            id-prefix="invite"
            no-submit
            .definition=${inviteForm}
            .rules=${{ email: [required(), email()] }}
          ></lia-form>
          <div class="d-flex justify-content-end gap-2 mt-3">
            <button class="btn btn-outline-secondary" type="button">Cancel</button>
            <button class="btn btn-primary" type="button">Send invitation</button>
          </div>
        </div>`,
        dedent`
          // \`noSubmit\` drops the button bar so the modal footer owns the actions.
          html\`<lia-form no-submit .definition=\${inviteForm}></lia-form>\`;
        `
      ),
      example(
        'A filter form',
        html`<lia-form
          id-prefix="filter"
          floating
          .definition=${filterForm}
          @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
            toast({ variant: 'info', message: `Filtering by ${Object.keys(event.detail.values).length} fields.` });
          }}
        ></lia-form>`,
        dedent`
          // \`floating\` switches every row to Bootstrap's floating-label layout —
          // dense enough for a filter strip.
          html\`<lia-form floating .definition=\${filterForm}></lia-form>\`;
        `
      ),
      example(
        'Disabled and busy',
        split(
          html`<lia-form id-prefix="off" disabled .definition=${inviteForm} submit-label="Send"></lia-form>`,
          html`<lia-form id-prefix="busy" busy .definition=${inviteForm} submit-label="Send"></lia-form>`
        ),
        dedent`
          html\`<lia-form disabled .definition=\${definition}></lia-form>\`;  // read-only
          html\`<lia-form busy .definition=\${definition}></lia-form>\`;      // in flight
        `
      ),
      example(
        'Sections on their own',
        html`<lia-form-section
          section-id="access"
          id-prefix="section"
          .section=${{
            title: 'Access',
            icon: 'fa-solid fa-key',
            description: 'What this member may reach.',
            collapsible: true,
            fields: {
              role: { type: 'select', label: 'Role', options: roleOptions, value: 'developer' },
              capabilities: {
                type: 'checkbox',
                label: 'Capabilities',
                values: capabilityOptions,
                selected: ['read', 'deploy'],
              },
            },
          }}
          .values=${{ role: 'developer', capabilities: ['read', 'deploy'] }}
        ></lia-form-section>`,
        dedent`
          html\`<lia-form-section
            section-id="access"
            .section=\${{ title: 'Access', collapsible: true, fields }}
            .values=\${values}
            .errors=\${errors}
          ></lia-form-section>\`;
        `
      ),
    ])}
    ${section('The value model', 'What the kit derives from a definition before a single key is pressed.', [
      example(
        'collectInitialValues',
        html`<lia-code-block
          .code=${JSON.stringify(collectInitialValues(createMemberForm), null, 2)}
          language="json"
          filename="collectInitialValues(createMemberForm)"
          max-height="18rem"
        ></lia-code-block>`,
        dedent`
          import { collectInitialValues, flattenFields, hasMandatoryField } from '@liasoft/lit-ui';

          collectInitialValues(definition);   // → FormValues, the model before any input
          flattenFields(definition);          // → [name, field][] across every section
          hasMandatoryField(definition);      // → whether to print the "* mandatory" note
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderValidation(): TemplateResult {
  return html`
    ${section(
      'Rules',
      'A rule is a function from a value to a message or `undefined`. A field takes one or a list; the engine runs them in order and stops at the first failure.',
      example('Live', html`<demo-validation></demo-validation>`, RULES_CODE)
    )}
    ${section('The built-ins', 'Every rule the kit ships, and what it rejects.', [
      example(
        'Validators',
        propTable(
          [
            { name: 'required(msg?)', type: 'Validator', description: 'Empty string, null, undefined, empty array or an unticked box.' },
            { name: 'minLength(n) / maxLength(n)', type: 'Validator', description: 'String length bounds.' },
            { name: 'min(n) / max(n)', type: 'Validator', description: 'Numeric bounds.' },
            { name: 'pattern(re)', type: 'Validator', description: 'A regular expression, or a string that becomes one.' },
            { name: 'email() / url()', type: 'Validator', description: 'Shape checks, not deliverability checks.' },
            { name: 'numeric() / integer()', type: 'Validator', description: 'Parseable as a number, and as a whole number.' },
            { name: 'matches(other, msg?, label?)', type: 'Validator', description: 'Cross-field equality — the password-confirmation rule.' },
            { name: 'unlessUnlimited(rule)', type: 'Validator', description: 'Skip the wrapped rule when a `textul` field is set to unlimited.' },
            { name: 'custom(fn)', type: 'Validator', description: 'Anything else; receives the value and the whole model.' },
            { name: 'implicitRules(field)', type: 'Validator[]', description: 'What the field definition already implies — `mandatory`, `min`, `max`, `pattern`, `maxlength`, the input type.' },
          ],
          'Validators'
        )
      ),
      example(
        'Messages',
        html`<lia-code-block
          .code=${JSON.stringify(DEFAULT_VALIDATION_MESSAGES, null, 2)}
          language="json"
          filename="DEFAULT_VALIDATION_MESSAGES"
          max-height="16rem"
        ></lia-code-block>`,
        dedent`
          // Override globally per form; \`{label}\`, \`{min}\`, \`{max}\` and \`{other}\` are filled in.
          html\`<lia-form
            .messages=\${{
              required: '{label} muss ausgefüllt werden.',
              email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
            }}
          ></lia-form>\`;

          // Or per rule, which wins over both:
          required('Give the member a name.');
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Implicit rules — no rule object at all',
        html`<lia-form
          id-prefix="implicit"
          submit-label="Check"
          .definition=${{
            sections: {
              main: {
                fields: {
                  name: { type: 'text', label: 'Name', mandatory: true, maxlength: 12 },
                  age: { type: 'number', label: 'Age', min: 18, max: 120, mandatory: true },
                  site: { type: 'url', label: 'Website' },
                  slug: {
                    type: 'text',
                    label: 'Slug',
                    pattern: '[a-z0-9\\-]+',
                    note: 'Lower case, digits and hyphens.',
                  },
                },
              },
            },
          } as FormDefinition}
          @lia-submit=${() => toast({ variant: 'success', message: 'Everything passed.' })}
        ></lia-form>`,
        dedent`
          // \`mandatory\`, \`min\`, \`max\`, \`pattern\`, \`maxlength\` and the input type are
          // already rules. Only add a \`rules\` object for what the definition cannot say.
        `,
        { description: 'Submit it empty — the constraints on the fields are enough' }
      ),
      note(
        html`Errors handed in through <code>.errors</code> always win over the rule engine, so a
          server-side rejection is never overwritten by a client-side pass. They are cleared on the
          next change to that field.`,
        'info'
      ),
    ])}
    ${section('Server-side errors', 'What a rejected save looks like on the way back.', [
      example(
        'From the API',
        html`<lia-form
          id-prefix="server"
          .definition=${createMemberForm}
          .errors=${memberFormErrors}
          .rules=${createMemberRules}
          no-submit
        ></lia-form>`,
        dedent`
          const memberFormErrors: FormErrors = {
            loginname: 'That sign-in name is already taken.',
            email: 'This address is on the organisation’s block list.',
            quota: 'The remaining pool only allows 8 GiB.',
          };

          html\`<lia-form .errors=\${memberFormErrors}></lia-form>\`;
        `
      ),
      example(
        'Cross-field',
        html`<lia-form
          id-prefix="cross"
          submit-label="Change password"
          .definition=${changePasswordForm}
          .rules=${{
            current: required(),
            next: [required(), minLength(12)],
            confirm: [required(), matches('next', 'The two passwords do not match.', 'New password')],
          }}
          @lia-submit=${() => toast({ variant: 'success', message: 'Password changed.' })}
        ></lia-form>`,
        dedent`
          confirm: [required(), matches('next', 'The two passwords do not match.', 'New password')]
        `,
        { description: 'Type two different passwords and submit' }
      ),
    ])}
  `;
}

function renderConditional(): TemplateResult {
  return html`
    ${section(
      'Conditions in the definition',
      'A field or section carries showWhen, hideWhen, disabledWhen, readonlyWhen and requiredWhen. Each is resolved against the live value model on every keystroke, so the form reshapes itself with no code in the host at all.',
      [
        example('Live', html`<demo-conditional-form></demo-conditional-form>`, dedent`
          const definition: FormDefinition = {
            sections: {
              delivery: {
                title: 'Delivery',
                fields: {
                  mode: { type: 'select', label: 'Delivery', options: DELIVERY_MODES },
                  host: {
                    type: 'text',
                    label: 'Relay host',
                    // Only present in "relay" mode — and only demanded there.
                    showWhen: { field: 'mode', equals: 'relay' },
                    requiredWhen: { field: 'mode', equals: 'relay' },
                  },
                  port: {
                    type: 'number',
                    label: 'Port',
                    value: 587,
                    showWhen: { field: 'mode', equals: 'relay' },
                  },
                },
              },
              filtering: {
                title: 'Filtering',
                // The whole card folds away for a mailbox that bypasses the filter.
                hideWhen: { field: 'bypassFilter', truthy: true },
                fields: { /* … */ },
              },
            },
          };
        `, { description: 'Change the mode, then tick “bypass the filter”', openCode: false }),
        note(
          html`A field a condition hides is <strong>not validated</strong> and keeps its value, so
            an invisible <code>mandatory</code> can never block a submit and nothing is lost when
            the condition comes back. The same goes for a field
            <code>disabledWhen</code> has switched off.`,
          'info'
        ),
      ]
    )}
    ${section('The condition language', 'One clause, a boolean group, or a predicate — whichever reads best.', [
      example(
        'Clauses',
        propTable(
          [
            { name: 'field', type: 'string', description: 'Which value to look at. The only required key.' },
            { name: 'equals / notEquals', type: 'unknown', description: 'Compared as strings, so 1 matches "1".' },
            { name: 'in / notIn', type: 'unknown[]', description: 'Membership; a multi-value field matches if it contains one.' },
            { name: 'truthy', type: 'boolean', description: 'Checkbox conventions — "0", "" and "off" are all false.' },
            { name: 'empty', type: 'boolean', description: 'Empty string, empty array, null or false.' },
            { name: 'gt / gte / lt / lte', type: 'number', description: 'Numeric bounds; a non-numeric value fails.' },
            { name: 'matches', type: 'string | RegExp', description: 'A string is anchored, exactly like the pattern attribute.' },
          ],
          'FieldConditionClause'
        ),
        dedent`
          // A single clause.
          showWhen: { field: 'mode', equals: 'relay' }

          // An array is an AND.
          showWhen: [{ field: 'mode', equals: 'relay' }, { field: 'advanced', truthy: true }]

          // Groups compose.
          showWhen: { any: [{ field: 'a', truthy: true }, { field: 'b', gte: 10 }] }
          hideWhen: { not: { field: 'mode', in: ['relay', 'direct'] } }

          // And a predicate is always available.
          showWhen: (values) => String(values.host ?? '').endsWith('.internal')
        `
      ),
      example(
        'Conditional validators',
        html`<demo-conditional-rules></demo-conditional-rules>`,
        dedent`
          import { requiredIf, requiredUnless, requiredWithout, requiredOneOf } from '@liasoft/lit-ui';

          const rules = {
            // "Give us a person or an organisation" — each demands a value only
            // while the others are empty.
            lastName: requiredWithout(['organisation']),
            firstName: requiredWithout(['organisation']),
            organisation: requiredWithout(['lastName', 'firstName']),
          };
        `,
        { description: 'Fill in either side — the asterisks on the other side stand down' }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Async fields
 * ------------------------------------------------------------------ */

/**
 * Artificial latency of every fake endpoint on this page, in milliseconds.
 * Long enough that you can out-type it, which is the point.
 */
const FAKE_LATENCY = 600;

/** The "directory" the login check consults. Every other name is free. */
const TAKEN_LOGIN_NAMES = ['admin', 'amara', 'okonkwo', 'postmaster', 'root'];

/**
 * A cancellable `setTimeout` standing in for a request. It honours the signal
 * the kit hands it, so a superseded check really does stop.
 */
function fakeRequest<T>(result: () => T, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(result()), FAKE_LATENCY);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Superseded', 'AbortError'));
      },
      { once: true }
    );
  });
}

/** "Is this login name still free?" — debounced 400 ms, abortable. */
const LOGIN_FREE: AsyncRule = {
  id: 'login-free',
  debounce: 400,
  triggerOn: 'change',
  async validate(value, _values, signal) {
    const login = String(value ?? '')
      .trim()
      .toLowerCase();
    if (login === '') return null; // `mandatory` already speaks for empty
    const taken = await fakeRequest(() => TAKEN_LOGIN_NAMES.includes(login), signal);
    return taken ? `“${login}” is already taken.` : null;
  },
};

const ASYNC_CHECK_FORM: FormDefinition = {
  id: 'async-check',
  sections: {
    account: {
      title: 'New account',
      icon: 'fa-solid fa-user-check',
      description: 'The login name is checked against the directory while you type.',
      fields: {
        login: {
          type: 'text',
          label: {
            title: 'Login name',
            description: 'Taken in this demo: admin, amara, okonkwo, postmaster, root.',
          },
          placeholder: 'e.g. ada',
          mandatory: true,
          autocomplete: 'off',
          asyncRules: [LOGIN_FREE],
        },
        email: { type: 'email', label: 'Email', mandatory: true },
      },
    },
  },
};

/** A field checked against a fake "already taken" endpoint. */
@customElement('demo-async-check')
export class DemoAsyncCheck extends LiaElement {
  @state() private saved?: FormValues;
  @state() private pending: string[] = [];
  @state() private validating = false;

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        `Type “admin”. The check waits 400 ms for you to stop typing, then takes ${FAKE_LATENCY} ms — keep typing and the older request is cancelled, so the verdict on screen is always the one for what is in the box. While it runs the submit button disables itself and spins, and pressing Enter waits for the answer instead of racing it. A name nobody has taken comes back green.`
      )}
      ${split(
        html`<lia-form
          id-prefix="asynccheck"
          submit-label="Create the account"
          .definition=${ASYNC_CHECK_FORM}
          @lia-validating=${(event: CustomEvent<FormValidatingDetail>) => {
            this.validating = event.detail.validating;
            this.pending = event.detail.pendingFields;
          }}
          @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
            this.saved = event.detail.values;
            toast({ variant: 'success', message: 'Account created.' });
          }}
        ></lia-form>`,
        html`<div class="card h-100">
          <div class="card-header bg-body-tertiary d-flex align-items-center gap-2">
            <span class="fw-semibold flex-grow-1">In flight</span>
            ${
              this.validating
                ? html`<span class="spinner-border spinner-border-sm text-primary" role="status"
                    ><span class="visually-hidden">Checking</span></span
                  >`
                : html`<i class="fa-solid fa-check text-success" aria-hidden="true"></i>`
            }
          </div>
          <div class="card-body">
            <p class="small text-body-secondary mb-2">
              <code>.validating</code> is
              <code>${String(this.validating)}</code>, <code>.pendingFields</code>:
            </p>
            ${
              this.pending.length === 0
                ? html`<p class="small text-body-secondary mb-0">
                    Empty — nothing is holding the submit up.
                  </p>`
                : html`<ul class="list-unstyled font-monospace small mb-0">
                    ${this.pending.map((name) => html`<li>${name}</li>`)}
                  </ul>`
            }
          </div>
        </div>`
      )}
      ${valueDump(this.saved, {
        title: 'Submitted values',
        empty: 'Submit to see the values — the submit waits for every check to answer first.',
      })}
    `;
  }
}

const REGION_OPTIONS: SelectOption[] = [
  { value: '', label: 'Pick a region…' },
  { value: 'eu-central', label: 'Europe — Frankfurt' },
  { value: 'us-east', label: 'North America — Ashburn' },
  { value: 'ap-south', label: 'Asia Pacific — Singapore' },
];

/** What the fake endpoint knows, keyed by region. */
const ZONES_BY_REGION: Record<string, SelectOption[]> = {
  'eu-central': [
    { value: 'eu-central-1a', label: 'eu-central-1a' },
    { value: 'eu-central-1b', label: 'eu-central-1b' },
    { value: 'eu-central-1c', label: 'eu-central-1c — no capacity', disabled: true },
  ],
  'us-east': [
    { value: 'us-east-2a', label: 'us-east-2a' },
    { value: 'us-east-2b', label: 'us-east-2b' },
  ],
  'ap-south': [{ value: 'ap-south-1a', label: 'ap-south-1a' }],
};

/** Sizes are known up front, so they narrow synchronously. */
const SIZES_BY_REGION: Record<string, SelectOption[]> = {
  'eu-central': [
    { value: 's', label: 'Small — 2 vCPU' },
    { value: 'm', label: 'Medium — 4 vCPU' },
    { value: 'l', label: 'Large — 8 vCPU' },
  ],
  'us-east': [
    { value: 's', label: 'Small — 2 vCPU' },
    { value: 'm', label: 'Medium — 4 vCPU' },
    { value: 'l', label: 'Large — 8 vCPU' },
    { value: 'xl', label: 'Extra large — 16 vCPU' },
  ],
  'ap-south': [
    { value: 's', label: 'Small — 2 vCPU' },
    { value: 'm', label: 'Medium — 4 vCPU' },
  ],
};

/** The zone list of whichever region is selected. */
const loadZones: OptionsLoader = (values, signal) =>
  fakeRequest(() => ZONES_BY_REGION[String(values.region ?? '')] ?? [], signal);

const DEPENDENT_FORM: FormDefinition = {
  id: 'dependent-options',
  sections: {
    placement: {
      title: 'Placement',
      icon: 'fa-solid fa-earth-europe',
      description:
        'The zones are fetched for the selected region; the sizes are derived from it on the spot.',
      fields: {
        region: { type: 'select', label: 'Region', options: REGION_OPTIONS, mandatory: true },
        zone: {
          type: 'select',
          label: { title: 'Availability zone', description: 'Loaded from the region.' },
          mandatory: true,
          dependsOn: 'region',
          optionsLoader: loadZones,
        },
        size: {
          type: 'select',
          label: { title: 'Size', description: 'Derived from the region, no request needed.' },
          mandatory: true,
          dependsOn: 'region',
          optionsFor: (values) => SIZES_BY_REGION[String(values.region ?? '')] ?? [],
        },
      },
    },
  },
};

/** A region → zone pair where the zones arrive from a fake endpoint. */
@customElement('demo-dependent-options')
export class DemoDependentOptions extends LiaElement {
  @state() private saved?: FormValues;
  @state() private events: LoggedEvent[] = [];

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        `Pick a region and wait ${FAKE_LATENCY} ms for the zones. Choose one, then switch region: the zone that no longer exists is dropped and a lia-change says so — the stale id never reaches the submit. Switch twice in quick succession and only the last request's answer is used.`
      )}
      ${split(
        html`<lia-form
          id-prefix="dependent"
          submit-label="Create the instance"
          .definition=${DEPENDENT_FORM}
          @lia-change=${(event: CustomEvent<{ name: string; value: unknown }>) => {
            this.events = logEvent(this.events, 'lia-change', {
              name: event.detail.name,
              value: event.detail.value,
            });
          }}
          @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => {
            this.saved = event.detail.values;
            toast({ variant: 'success', message: 'Instance created.' });
          }}
        ></lia-form>`,
        html`<div class="card h-100">
          <div class="card-header bg-body-tertiary">
            <span class="fw-semibold">What the endpoint knows</span>
          </div>
          <ul class="list-group list-group-flush small">
            ${Object.entries(ZONES_BY_REGION).map(
              ([region, zones]) => html`<li class="list-group-item py-2">
                <span class="font-monospace">${region}</span>
                <span class="text-body-secondary"
                  >→ ${zones.map((zone) => zone.value).join(', ')}</span
                >
              </li>`
            )}
          </ul>
        </div>`
      )}
      ${eventLog(this.events, {
        title: 'What the form emitted',
        placeholder: 'Pick a zone, then change the region — the clear is announced here.',
      })}
      ${valueDump(this.saved, {
        title: 'Submitted values',
        empty: 'Submit to see the values. A cleared zone is mandatory, so it blocks the submit.',
      })}
    `;
  }
}

function renderAsync(): TemplateResult {
  return html`
    ${section(
      'Async validation',
      'A rule that has to go and ask somebody, declared in the field right next to mandatory and requiredWhen. The form debounces it, aborts the request behind a superseded keystroke, spins inside the control, marks a clean pass is-valid, and makes the submit wait instead of racing it.',
      [
        example(
          'A login name checked against a directory',
          html`<demo-async-check></demo-async-check>`,
          dedent`
            // ── the whole fake back end of this page ────────────────────────
            const FAKE_LATENCY = 600;  // ms of artificial latency on every request
            const TAKEN_LOGIN_NAMES = ['admin', 'amara', 'okonkwo', 'postmaster', 'root'];

            function fakeRequest<T>(result: () => T, signal: AbortSignal): Promise<T> {
              return new Promise((resolve, reject) => {
                const timer = setTimeout(() => resolve(result()), FAKE_LATENCY);
                signal.addEventListener('abort', () => {
                  clearTimeout(timer);
                  reject(new DOMException('Superseded', 'AbortError'));
                }, { once: true });
              });
            }
            // ───────────────────────────────────────────────────────────────

            const LOGIN_FREE: AsyncRule = {
              id: 'login-free',        // stable, unique within the field
              debounce: 400,           // quiet time before the request goes out
              triggerOn: 'change',     // 'blur' would wait until the control is left
              async validate(value, _values, signal) {
                const login = String(value ?? '').trim().toLowerCase();
                if (login === '') return null;          // let \`mandatory\` speak for empty
                const taken = await fakeRequest(() => TAKEN_LOGIN_NAMES.includes(login), signal);
                return taken ? \`“\${login}” is already taken.\` : null;
              },
            };

            // …and the field, which is the only place any of this is wired up.
            login: {
              type: 'text',
              label: 'Login name',
              mandatory: true,
              asyncRules: [LOGIN_FREE],
            }
          `,
          { openCode: true, description: 'Try “admin”, then keep typing past the spinner' }
        ),
        note(
          html`The race is the whole point. Every run carries its own
            <code>AbortController</code> and a monotonic id: when the value moves the request is
            aborted, and an answer that arrives anyway is discarded because its id is no longer
            current. A slow verdict for <code>ada</code> can never land on top of a fresh one for
            <code>adam</code>.`,
          'info'
        ),
        note(
          html`A rejected promise is read as <em>“could not tell”</em>, not as a failure: a flaky
            endpoint leaves the field unmarked rather than inventing an error nobody can act on.`,
          'secondary',
          'fa-solid fa-plug-circle-exclamation'
        ),
      ]
    )}
    ${section(
      'Dependent options',
      'A select whose choices come from another field — derived on the spot with optionsFor, or fetched with optionsLoader. Either way the form clears a selection the new list no longer contains, so the classic stale-id bug cannot happen.',
      [
        example(
          'Region → zone',
          html`<demo-dependent-options></demo-dependent-options>`,
          dedent`
            const ZONES_BY_REGION: Record<string, SelectOption[]> = {
              'eu-central': [{ value: 'eu-central-1a', label: 'eu-central-1a' }, /* … */],
              'us-east':    [{ value: 'us-east-2a',    label: 'us-east-2a'    }, /* … */],
              'ap-south':   [{ value: 'ap-south-1a',   label: 'ap-south-1a'   }],
            };

            // Same 600 ms fakeRequest() as above, same AbortSignal.
            const loadZones: OptionsLoader = (values, signal) =>
              fakeRequest(() => ZONES_BY_REGION[String(values.region ?? '')] ?? [], signal);

            const definition: FormDefinition = {
              sections: {
                placement: {
                  fields: {
                    region: { type: 'select', label: 'Region', options: REGION_OPTIONS },

                    // Fetched: the control disables itself and spins while it waits.
                    zone: {
                      type: 'select',
                      label: 'Availability zone',
                      mandatory: true,
                      dependsOn: 'region',
                      optionsLoader: loadZones,
                    },

                    // Derived: a pure function, recomputed when \`region\` moves.
                    size: {
                      type: 'select',
                      label: 'Size',
                      dependsOn: 'region',
                      optionsFor: (values) => SIZES_BY_REGION[String(values.region ?? '')] ?? [],
                    },
                  },
                },
              },
            };
          `,
          { openCode: true, description: 'Pick a zone, then change the region' }
        ),
        note(
          html`Clearing is not silent: the form emits <code>lia-change</code> for the field it
            reset, so a host mirroring the values stays in step. A multi-select keeps whichever
            entries survived instead of being emptied.`,
          'info'
        ),
      ]
    )}
    ${section('The contract', 'What a field declares, and what the form exposes back.', [
      example(
        'On the field',
        propTable(
          [
            {
              name: 'asyncRules',
              type: 'AsyncRule[]',
              description:
                'Checks that ask a server. Each has an id, a validate(value, values, signal), an optional debounce and triggerOn.',
            },
            {
              name: 'dependsOn',
              type: 'string | string[]',
              description:
                'The watch list. For optionsFor an optimisation; for optionsLoader the trigger — omit it and the loader runs once.',
            },
            {
              name: 'optionsFor',
              type: '(values) => SelectOption[]',
              description: 'Derive the choices synchronously. Wins over options and values.',
            },
            {
              name: 'optionsLoader',
              type: '(values, signal) => Promise<SelectOption[]>',
              description: 'Fetch the choices. Loading state on the control, superseded runs aborted.',
            },
          ],
          'Asynchronous FormField keys'
        ),
        dedent`
          // Both work on select, radio and check-box groups.
          zones: { type: 'checkbox', dependsOn: 'region', optionsLoader: loadZones }
        `
      ),
      example(
        'On <lia-form>',
        propTable(
          [
            {
              name: 'validating',
              type: 'boolean',
              default: 'false',
              description: 'A rule or a loader is queued or in flight. The submit button spins.',
            },
            {
              name: 'pendingFields',
              type: 'string[]',
              default: '[]',
              description: 'The names behind it, so a host can point at them.',
            },
            {
              name: 'validate()',
              type: 'Promise<FormErrors>',
              description:
                'Fires queued debounces at once, runs what has never run, awaits the lot, and resolves with sync and async failures merged.',
            },
            {
              name: 'isValid',
              type: 'boolean',
              description: 'No failures *and* nothing outstanding — an unfinished check is not a pass.',
            },
          ],
          'Pending state'
        ),
        dedent`
          html\`<lia-form
            .definition=\${definition}
            @lia-validating=\${(e: CustomEvent<FormValidatingDetail>) => {
              banner.hidden = !e.detail.validating;   // { validating, pendingFields }
            }}
          ></lia-form>\`;

          // Imperatively — note the await; a half-finished check must not read as a pass.
          const errors = await form.validate();
          if (Object.keys(errors).length === 0) save(form.getValues());
        `
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Inline edit
 * ------------------------------------------------------------------ */

/** Inline editing inside a table, saving into a local copy of the rows. */
@customElement('demo-inline-edit')
export class DemoInlineEdit extends LiaElement {
  @state() private rows: DemoUser[] = someUsers(5).map((row) => ({ ...row }));
  @state() private saving = '';
  @state() private errors: Record<string, string> = {};
  @state() private accepted = '';
  @state() private events: readonly LoggedEvent[] = [];

  private async save(event: CustomEvent<InlineSaveDetail>): Promise<void> {
    const { name, value } = event.detail;
    const [field, id] = name.split(':');
    this.events = logEvent(this.events, 'lia-inline-save', event.detail);
    this.saving = name;
    this.errors = { ...this.errors, [name]: '' };
    this.accepted = '';
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.saving = '';

    // A stand-in for a server that answers a debounced auto-save: anything
    // containing "nope" comes back rejected and the row keeps its old value.
    if (value.toLowerCase().includes('nope')) {
      this.errors = { ...this.errors, [name]: 'The server rejected that value.' };
      return;
    }

    this.rows = this.rows.map((row) =>
      String(row.id) === id ? { ...row, [field]: value } : row
    );
    this.accepted = name;
    toast({ variant: 'success', message: `Saved ${field} for #${id}.`, timeout: 2000 });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Click a value, change it, press Enter (or Escape to abandon it). Type a location containing “nope” to see the write come back rejected — the editor stays open and marks itself invalid.'
      )}
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <caption class="visually-hidden">Members with editable fields</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Team</th>
              <th scope="col">Location</th>
              <th scope="col" class="text-end">Open issues</th>
            </tr>
          </thead>
          <tbody
            @lia-inline-save=${this.save}
            @lia-inline-cancel=${(event: CustomEvent) => {
              this.events = logEvent(this.events, 'lia-inline-cancel', event.detail);
            }}
          >
            ${this.rows.map(
              (row) => html`<tr>
                <th scope="row" class="fw-normal">${row.name}</th>
                <td>
                  <lia-inline-edit
                    name="team:${row.id}"
                    type="select"
                    label="Team of ${row.name}"
                    .value=${row.team}
                    .options=${userTeamOptions}
                    .saving=${this.saving === `team:${row.id}`}
                    .error=${this.errors[`team:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `team:${row.id}`}
                  ></lia-inline-edit>
                </td>
                <td>
                  <lia-inline-edit
                    name="location:${row.id}"
                    label="Location of ${row.name}"
                    .value=${row.location}
                    required
                    maxlength="40"
                    auto-close="false"
                    .saving=${this.saving === `location:${row.id}`}
                    .error=${this.errors[`location:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `location:${row.id}`}
                  ></lia-inline-edit>
                </td>
                <td class="text-end">
                  <lia-inline-edit
                    name="openIssues:${row.id}"
                    type="number"
                    label="Open issues of ${row.name}"
                    .value=${String(row.openIssues)}
                    min="0"
                    max="99"
                    .saving=${this.saving === `openIssues:${row.id}`}
                    .error=${this.errors[`openIssues:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `openIssues:${row.id}`}
                  ></lia-inline-edit>
                </td>
              </tr>`
            )}
          </tbody>
        </table>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

function renderInline(): TemplateResult {
  return html`
    ${section('Inline edit', 'Change one value where it already is. The element owns nothing but the draft.', [
      example('In a table', html`<demo-inline-edit></demo-inline-edit>`, dedent`
        html\`<lia-inline-edit
          name="team:\${row.id}"
          type="select"                      // text | number | email | url | tel | textarea | select
          label="Team of \${row.name}"
          .value=\${row.team}
          .options=\${teamOptions}
          .saving=\${this.saving === \`team:\${row.id}\`}
          .error=\${this.errors[name] ?? ''}   // "is-invalid" plus a message
          .accepted=\${this.accepted === name} // "is-valid" after a write lands
          required
          @lia-inline-save=\${(e: CustomEvent<InlineSaveDetail>) => this.save(e.detail)}
          @lia-inline-cancel=\${…}
        ></lia-inline-edit>\`;

        // Enter commits, Escape abandons; \`commit-on-blur\` also commits on blur.
      `),
      example(
        'States',
        html`<div class="d-flex flex-wrap gap-4">
          ${[
            ['idle', html`<lia-inline-edit label="Nickname" value="Amara"></lia-inline-edit>`],
            ['empty', html`<lia-inline-edit label="Nickname" value=""></lia-inline-edit>`],
            [
              'custom display',
              html`<lia-inline-edit
                label="Quota"
                value="40"
                type="number"
                display="40 GiB"
              ></lia-inline-edit>`,
            ],
            ['saving', html`<lia-inline-edit label="Nickname" value="Amara" saving></lia-inline-edit>`],
            ['disabled', html`<lia-inline-edit label="Nickname" value="Amara" disabled></lia-inline-edit>`],
            [
              'open',
              html`<lia-inline-edit
                label="Nickname"
                value="Amara"
                editing
                auto-close="false"
              ></lia-inline-edit>`,
            ],
          ].map(
            ([label, content]) => html`<div>
              <p class="small text-body-secondary font-monospace mb-1">${label}</p>
              ${content}
            </div>`
          )}
        </div>`,
        undefined
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Wizard & stepper
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The form demos. */
export const formsRoutes: DemoRoute[] = [
  {
    path: '/forms/fields',
    title: 'Every field type',
    group: 'forms',
    icon: 'fa-solid fa-rectangle-list',
    description: 'All twenty-two field types, from one definition.',
    keywords: ['field', 'input', 'select', 'checkbox', 'switch', 'textul', 'file'],
    render: renderFields,
  },
  {
    path: '/forms/form',
    title: 'The form element',
    group: 'forms',
    icon: 'fa-solid fa-square-check',
    description: 'The value model, the button bar and the imperative API.',
    keywords: ['form', 'submit', 'values', 'reset', 'busy', 'sections'],
    render: renderForm,
  },
  {
    path: '/forms/validation',
    title: 'Validation',
    group: 'forms',
    icon: 'fa-solid fa-circle-check',
    description: 'The rule engine, the built-in validators and server-side errors.',
    keywords: ['validation', 'rules', 'required', 'pattern', 'errors', 'messages'],
    render: renderValidation,
  },
  {
    path: '/forms/conditional',
    title: 'Conditional fields',
    group: 'forms',
    icon: 'fa-solid fa-code-branch',
    description: 'showWhen, hideWhen, disabledWhen, readonlyWhen and requiredWhen.',
    keywords: ['conditional', 'showWhen', 'hideWhen', 'depends', 'toggle', 'requiredIf', 'dynamic'],
    render: renderConditional,
  },
  {
    path: '/forms/async',
    title: 'Async & dependent fields',
    group: 'forms',
    icon: 'fa-solid fa-satellite-dish',
    description: 'Server-side checks and option lists that follow another field.',
    keywords: [
      'async',
      'asyncRules',
      'debounce',
      'abort',
      'dependsOn',
      'optionsFor',
      'optionsLoader',
      'dependent',
      'pending',
      'validating',
    ],
    render: renderAsync,
  },
  {
    path: '/forms/inline',
    title: 'Inline edit',
    group: 'forms',
    icon: 'fa-solid fa-pen',
    description: 'Editing a value in place, without leaving the page.',
    keywords: ['inline', 'edit', 'in place', 'row', 'save'],
    render: renderInline,
  },
  {
    path: '/forms/wizard',
    title: 'Wizard & stepper',
    group: 'forms',
    icon: 'fa-solid fa-shoe-prints',
    description: 'A multi-step flow, gated by validation, plus the indicator alone.',
    keywords: ['wizard', 'stepper', 'steps', 'onboarding', 'multi-step'],
    render: renderWizard,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-field-gallery': DemoFieldGallery;
    'demo-form': DemoForm;
    'demo-validation': DemoValidation;
    'demo-field-layouts': DemoFieldLayouts;
    'demo-conditional-form': DemoConditionalForm;
    'demo-conditional-rules': DemoConditionalRules;
    'demo-async-check': DemoAsyncCheck;
    'demo-dependent-options': DemoDependentOptions;
    'demo-inline-edit': DemoInlineEdit;
    'demo-wizard': DemoWizard;
    'demo-stepper': DemoStepper;
  }
}
