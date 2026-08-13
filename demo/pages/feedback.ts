/**
 * Demo pages — Feedback.
 *
 * Everything the interface uses to talk back: inline alerts, full-bleed
 * banners, modals, the promise-returning confirmation flow, the delete
 * confirmation, toasts, the diagnostic hint panel and the error boundary.
 *
 * All of it is live. The toasts really appear in the corner of the window, the
 * confirmation really resolves a promise, and the error boundary really catches
 * a thrown error.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  AlertMessage,
  DeleteEventDetail,
  ToastPlacement,
  Variant,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  clearToasts,
  confirmActionWithOptions,
  confirmDelete,
  toast,
  type ConfirmResult,
  type HintStep,
} from '@liasoft/lit-ui';
import { demoStackTrace } from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { cluster, dedent, example, note, propTable, section, split } from './_kit.js';
import { VARIANTS, eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const STACK_MESSAGES: AlertMessage[] = [
  {
    id: 'deploy',
    variant: 'success',
    icon: 'fa-solid fa-rocket',
    title: 'Released',
    message: 'checkout v2.31.0 reached 100% of production.',
    dismissible: true,
  },
  {
    id: 'quota',
    variant: 'warning',
    message: 'Storage is at <strong>93%</strong> of the plan limit.',
    html: true,
    dismissible: true,
    actions: [
      { id: 'upgrade', label: 'Increase the limit', variant: 'light', size: 'sm' },
      { id: 'usage', label: 'See usage', variant: 'light', size: 'sm' },
    ],
  },
  {
    id: 'cert',
    variant: 'danger',
    icon: 'fa-solid fa-certificate',
    title: 'Certificate renewal failed',
    message: 'The ACME challenge for svc.example.net timed out three times.',
    dismissible: true,
  },
  {
    id: 'tip',
    variant: 'info',
    message: 'Press ⌘K anywhere to open the console search.',
    dismissible: true,
  },
];

const REMEDIATION: HintStep[] = [
  { title: 'Check the DNS record', text: 'The challenge needs an A record pointing at the edge.' },
  { title: 'Re-run the challenge', code: 'orbitctl cert renew svc.example.net --force' },
  {
    title: 'Still failing?',
    html: 'Collect a support bundle with <code>orbitctl support bundle</code> and attach it to a report.',
  },
];

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/** A stack of alerts whose dismissals really remove the message. */
@customElement('demo-alert-stack')
export class DemoAlertStack extends LiaElement {
  @state() private messages: AlertMessage[] = STACK_MESSAGES;
  @state() private events: readonly LoggedEvent[] = [];

  private onDismiss(event: CustomEvent<{ id?: string }>): void {
    const id = event.detail?.id;
    this.events = logEvent(this.events, 'lia-dismiss', event.detail);
    this.messages = this.messages.filter((message) => message.id !== id);
  }

  private onAction(event: CustomEvent<{ id?: string }>): void {
    this.events = logEvent(this.events, 'lia-action', event.detail);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Close one — the stack shrinks and reports which id went away.')}
      <lia-alert-stack
        .messages=${this.messages}
        empty-message="Every message has been dealt with."
        @lia-dismiss=${this.onDismiss}
        @lia-action=${this.onAction}
      ></lia-alert-stack>
      ${this.messages.length < STACK_MESSAGES.length
        ? html`<button
            class="btn btn-sm btn-outline-secondary mt-3"
            type="button"
            @click=${() => {
              this.messages = STACK_MESSAGES;
            }}
          >
            <i class="fa-solid fa-rotate-left me-2" aria-hidden="true"></i>Restore the stack
          </button>`
        : ''}
      ${eventLog(this.events)}
    `;
  }
}

/** Modals: sizes, static backdrop, footer actions and a projected form. */
@customElement('demo-modals')
export class DemoModals extends LiaElement {
  @state() private open = '';
  @state() private events: readonly LoggedEvent[] = [];

  private show(id: string): void {
    this.open = id;
  }

  private onToggle(event: CustomEvent<{ open?: boolean }>): void {
    this.events = logEvent(this.events, event.type, event.detail);
    if (event.type === 'lia-modal-hide') this.open = '';
  }

  protected override render(): TemplateResult {
    return html`
      ${cluster(
        html`<button class="btn btn-primary" type="button" @click=${() => this.show('basic')}>
          Basic
        </button>`,
        html`<button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => this.show('large')}
        >
          Large &amp; scrollable
        </button>`,
        html`<button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => this.show('form')}
        >
          With a form
        </button>`,
        html`<button
          class="btn btn-outline-warning"
          type="button"
          @click=${() => this.show('static')}
        >
          Static backdrop
        </button>`,
        html`<button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => this.show('bare')}
        >
          No header, no footer
        </button>`
      )}

      <lia-modal
        modal-id="demo-modal-basic"
        heading="Restart the scheduler?"
        .open=${this.open === 'basic'}
        .footerActions=${[
          { id: 'cancel', label: 'Cancel', variant: 'outline-secondary' },
          { id: 'restart', label: 'Restart', variant: 'primary', icon: 'fa-solid fa-power-off' },
        ] as ActionDescriptor[]}
        @lia-modal-show=${this.onToggle}
        @lia-modal-hide=${this.onToggle}
        @lia-action=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-action', event.detail);
          this.open = '';
        }}
      >
        <p class="mb-0">
          Queued jobs keep their place; running jobs are restarted from the beginning. Expect about
          20 seconds of downtime.
        </p>
      </lia-modal>

      <lia-modal
        modal-id="demo-modal-large"
        heading="Release notes — 4.12.1"
        size="modal-lg"
        scrollable
        centered
        .open=${this.open === 'large'}
        @lia-modal-hide=${this.onToggle}
      >
        <div style="max-height: 40vh;">
          ${Array.from(
            { length: 12 },
            (_unused, index) => html`<p>
              <strong>Change ${index + 1}.</strong> A scrollable body keeps the header and the
              footer pinned while the content moves — that is what <code>scrollable</code> does.
            </p>`
          )}
        </div>
      </lia-modal>

      <lia-modal
        modal-id="demo-modal-form"
        heading="Invite a member"
        .open=${this.open === 'form'}
        .footerActions=${[
          { id: 'cancel', label: 'Cancel', variant: 'outline-secondary' },
          { id: 'send', label: 'Send invitation', variant: 'primary', icon: 'fa-solid fa-paper-plane' },
        ] as ActionDescriptor[]}
        @lia-modal-hide=${this.onToggle}
        @lia-action=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-action', event.detail);
          this.open = '';
        }}
      >
        <div class="mb-3">
          <label class="form-label" for="demo-modal-email">Email address</label>
          <input class="form-control" id="demo-modal-email" type="email" placeholder="name@example.org" />
        </div>
        <div>
          <label class="form-label" for="demo-modal-role">Role</label>
          <select class="form-select" id="demo-modal-role">
            <option>Developer</option>
            <option>Operator</option>
            <option>Auditor</option>
          </select>
        </div>
      </lia-modal>

      <lia-modal
        modal-id="demo-modal-static"
        heading="Finish this first"
        static-backdrop
        .open=${this.open === 'static'}
        .footerActions=${[{ id: 'ok', label: 'Understood', variant: 'primary' }] as ActionDescriptor[]}
        @lia-modal-hide=${this.onToggle}
        @lia-action=${() => {
          this.open = '';
        }}
      >
        <p class="mb-0">
          Clicking the backdrop or pressing <kbd>Esc</kbd> will not close this one — only the
          buttons will.
        </p>
      </lia-modal>

      <lia-modal
        modal-id="demo-modal-bare"
        hide-header
        hide-footer
        centered
        .open=${this.open === 'bare'}
        @lia-modal-hide=${this.onToggle}
      >
        <div class="text-center py-3">
          <i class="fa-solid fa-circle-check fa-3x text-success mb-3" aria-hidden="true"></i>
          <h2 class="h5">All done</h2>
          <p class="text-body-secondary mb-3">The migration finished without errors.</p>
          <button class="btn btn-primary" type="button" @click=${() => (this.open = '')}>
            Close
          </button>
        </div>
      </lia-modal>

      ${eventLog(this.events)}
    `;
  }
}

/** The promise-returning confirmation flow, with its options and its result. */
@customElement('demo-confirm')
export class DemoConfirm extends LiaElement {
  @state() private result?: ConfirmResult;

  private async ask(request: Parameters<typeof confirmActionWithOptions>[0]): Promise<void> {
    this.result = await confirmActionWithOptions(request);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Each button awaits a promise. The resolved value appears underneath.')}
      ${cluster(
        html`<button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => this.ask({ message: 'Rebuild the search index now?' })}
        >
          Plain question
        </button>`,
        html`<button
          class="btn btn-outline-danger"
          type="button"
          @click=${() =>
            this.ask({
              title: 'Remove three members?',
              message: 'They lose access immediately. Their audit history is kept.',
              confirmLabel: 'Remove them',
              cancelLabel: 'Keep them',
              variant: 'danger',
            })}
        >
          Destructive
        </button>`,
        html`<button
          class="btn btn-outline-warning"
          type="button"
          @click=${() =>
            this.ask({
              title: 'Delete this volume?',
              message: 'The volume <code>vol-eu-central-041</code> is attached to ingest-04.',
              html: true,
              variant: 'warning',
              confirmLabel: 'Delete',
              options: [
                { name: 'snapshot', label: 'Take a final snapshot first', checked: true },
                { name: 'detach', label: 'Detach it from ingest-04' },
                { name: 'audit', label: 'Notify the audit channel', disabled: true, checked: true },
              ],
              data: { volume: 'vol-eu-central-041' },
            })}
        >
          With opt-ins
        </button>`
      )}
      ${valueDump(this.result, {
        title: 'ConfirmResult',
        empty: 'Ask something above and the resolved ConfirmResult appears here.',
      })}
    `;
  }
}

/** The delete affordance, in every shape it ships with. */
@customElement('demo-delete-confirm')
export class DemoDeleteConfirm extends LiaElement {
  @state() private removed: string[] = [];
  @state() private events: readonly LoggedEvent[] = [];
  @state() private busy = '';

  private async onDelete(event: CustomEvent<DeleteEventDetail>): Promise<void> {
    const detail = event.detail;
    this.events = logEvent(this.events, 'lia-delete', detail);
    this.busy = detail.entity;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.busy = '';
    this.removed = [...this.removed, detail.entity];
  }

  private async askDirectly(): Promise<void> {
    const result = await confirmDelete({
      entity: 'vol-eu-central-041',
      entityType: 'volume',
      options: [{ name: 'snapshot', label: 'Take a final snapshot first', checked: true }],
    });
    this.events = logEvent(this.events, 'confirmDelete()', result);
  }

  protected override render(): TemplateResult {
    return html`
      <div
        class="vstack gap-3"
        @lia-delete=${this.onDelete}
        @lia-delete-cancel=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-delete-cancel', event.detail);
        }}
      >
        <div class="d-flex flex-wrap align-items-center gap-3">
          <lia-delete-confirm
            entity="Amara Okonkwo"
            entity-type="member"
            .busy=${this.busy === 'Amara Okonkwo'}
            .data=${{ id: 1000 }}
          ></lia-delete-confirm>
          <lia-delete-confirm
            entity="Payments"
            entity-type="team"
            label="Delete the team"
            .busy=${this.busy === 'Payments'}
          ></lia-delete-confirm>
          <lia-delete-confirm
            entity="key_9f21c7"
            entity-type="access key"
            label="Revoke"
            icon="fa-solid fa-ban"
            variant="outline-warning"
            size="md"
            .options=${[
              { name: 'audit', label: 'Write an entry to the audit trail', checked: true },
              { name: 'notify', label: 'Notify the key owner' },
            ]}
            .busy=${this.busy === 'key_9f21c7'}
          ></lia-delete-confirm>
          <lia-delete-confirm entity="Locked" entity-type="record" disabled></lia-delete-confirm>
        </div>
        <div>
          <button class="btn btn-outline-danger" type="button" @click=${this.askDirectly}>
            <i class="fa-solid fa-code me-2" aria-hidden="true"></i>confirmDelete() — no element at
            all
          </button>
        </div>
      </div>
      ${this.removed.length > 0
        ? html`<p class="mt-3 mb-0 small">
            <span class="badge text-bg-danger me-2">removed</span>
            ${this.removed.join(', ')}
          </p>`
        : ''}
      ${eventLog(this.events)}
    `;
  }
}

/** Toasts: every variant, every placement, with and without actions. */
@customElement('demo-toasts')
export class DemoToasts extends LiaElement {
  @state() private placement: ToastPlacement = 'top-end';

  private fire(variant: Variant): void {
    toast({
      variant,
      title: variant === 'danger' ? 'Deployment failed' : undefined,
      message:
        variant === 'danger'
          ? 'ledger v1.9.2 was rolled back after 4 failed health checks.'
          : `A ${variant} toast, dismissed automatically after five seconds.`,
      icon: variant === 'success' ? 'fa-solid fa-rocket' : undefined,
    });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Toasts appear in the corner of the window, not inside this card.')}
      <div class="vstack gap-3">
        ${cluster(
          ...VARIANTS.map(
            (variant) => html`<button
              class="btn btn-${variant} btn-sm"
              type="button"
              @click=${() => this.fire(variant)}
            >
              ${variant}
            </button>`
          )
        )}
        ${cluster(
          html`<button
            class="btn btn-outline-primary btn-sm"
            type="button"
            @click=${() =>
              toast({
                variant: 'warning',
                title: 'Certificate expires in 6 days',
                message: 'svc.example.net · issued by Let’s Encrypt',
                icon: 'fa-solid fa-certificate',
                timeout: 0,
                actions: [
                  { id: 'renew', label: 'Renew now', variant: 'light', size: 'sm' },
                  { id: 'snooze', label: 'Remind me', variant: 'light', size: 'sm' },
                ],
              })}
          >
            With actions, no timeout
          </button>`,
          html`<button
            class="btn btn-outline-primary btn-sm"
            type="button"
            @click=${() =>
              toast({
                variant: 'info',
                message: 'Copied <code>key_e4a913…9d47</code> to the clipboard.',
                html: true,
                timeout: 2500,
              })}
          >
            Trusted HTML, 2.5 s
          </button>`,
          html`<button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            @click=${() => {
              for (let index = 1; index <= 8; index += 1) {
                toast({ variant: 'secondary', message: `Queued job ${index} of 8` });
              }
            }}
          >
            Eight at once (capped at six)
          </button>`,
          html`<button class="btn btn-outline-danger btn-sm" type="button" @click=${clearToasts}>
            Clear them all
          </button>`
        )}
        <div class="d-flex flex-wrap align-items-center gap-2">
          <label class="form-label mb-0 small" for="demo-toast-placement">Placement</label>
          <select
            id="demo-toast-placement"
            class="form-select form-select-sm"
            style="width: auto;"
            .value=${this.placement}
            @change=${(event: Event) => {
              this.placement = (event.target as HTMLSelectElement).value as ToastPlacement;
            }}
          >
            ${(
              [
                'top-start',
                'top-center',
                'top-end',
                'middle-center',
                'bottom-start',
                'bottom-center',
                'bottom-end',
              ] as ToastPlacement[]
            ).map((value) => html`<option value=${value}>${value}</option>`)}
          </select>
          <lia-toast-container
            placement=${this.placement}
            region-label="Demo notifications"
          ></lia-toast-container>
          <span class="small text-body-secondary"
            >This page hosts its own container; the singleton <code>toast()</code> uses
            <code>top-end</code>.</span
          >
        </div>
      </div>
    `;
  }
}

/** An error boundary with a child that can be made to fail on demand. */
@customElement('demo-error-boundary')
export class DemoErrorBoundary extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];

  private boom(): void {
    // `lia-error` is the contract a child uses to hand a failure to the
    // nearest boundary — the same event a fetch wrapper would raise.
    this.dispatchEvent(
      new CustomEvent('lia-error', {
        bubbles: true,
        composed: true,
        detail: { error: new Error('upstream 10.0.4.18:8443 returned 502') },
      })
    );
  }

  protected override render(): TemplateResult {
    return html`
      <lia-error-boundary
        heading="This panel could not be loaded"
        message="The metrics service did not answer in time."
        show-details
        retry-label="Load it again"
        .actions=${[
          { id: 'status', label: 'Service status', variant: 'outline-secondary', href: '#/dashboard/activity' },
        ] as ActionDescriptor[]}
        @lia-error-reset=${() => {
          this.events = logEvent(this.events, 'lia-error-reset');
        }}
      >
        <div class="d-flex flex-wrap align-items-center gap-3 border rounded-3 p-3">
          <div class="flex-grow-1">
            <p class="fw-semibold mb-1">Requests per second</p>
            <p class="text-body-secondary mb-0 small">
              A perfectly healthy widget — until you press the button.
            </p>
          </div>
          <button class="btn btn-outline-danger" type="button" @click=${this.boom}>
            <i class="fa-solid fa-bomb me-2" aria-hidden="true"></i>Make it fail
          </button>
        </div>
      </lia-error-boundary>
      ${eventLog(this.events, { placeholder: 'Break the panel, then press "Load it again".' })}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const ALERT_CODE = dedent`
  const message: AlertMessage = {
    id: 'quota',
    variant: 'warning',
    title: 'Storage is nearly full',
    message: 'Storage is at <strong>93%</strong> of the plan limit.',
    html: true,                 // trusted markup
    icon: 'fa-solid fa-hard-drive',
    dismissible: true,
    actions: [{ id: 'upgrade', label: 'Increase the limit', variant: 'light', size: 'sm' }],
  };

  html\`<lia-alert .alert=\${message} @lia-dismiss=\${drop} @lia-action=\${run}></lia-alert>\`;

  // …or a whole list of them:
  html\`<lia-alert-stack .messages=\${messages} @lia-dismiss=\${drop}></lia-alert-stack>\`;
`;

const CONFIRM_CODE = dedent`
  import { confirmActionWithOptions, installConfirmHandler } from '@liasoft/lit-ui';

  // Once, at start-up: every ActionDescriptor carrying \`confirm\` now opens the
  // real dialog instead of window.confirm().
  installConfirmHandler();

  // Or ask directly, and await the answer:
  const result = await confirmActionWithOptions({
    title: 'Delete this volume?',
    message: 'The volume is attached to <code>ingest-04</code>.',
    html: true,
    variant: 'danger',
    confirmLabel: 'Delete',
    options: [{ name: 'snapshot', label: 'Take a final snapshot first', checked: true }],
  });

  // → { confirmed: true, options: { snapshot: true }, data: undefined }
`;

const TOAST_CODE = dedent`
  import { toast, dismissToast, clearToasts } from '@liasoft/lit-ui';

  const id = toast({
    variant: 'warning',
    title: 'Certificate expires in 6 days',
    message: 'svc.example.net',
    icon: 'fa-solid fa-certificate',
    timeout: 0,                                     // 0 = stays until dismissed
    actions: [{ id: 'renew', label: 'Renew now', variant: 'light', size: 'sm' }],
  });

  dismissToast(id);
  clearToasts();

  // The container is created on first use. Place your own to move it:
  html\`<lia-toast-container placement="bottom-start" max="3"></lia-toast-container>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderAlerts(): TemplateResult {
  return html`
    ${section('Alert', 'One `AlertMessage`, rendered inline. Icon, title, body, actions and dismissal are all optional.', [
      example(
        'Variants',
        html`<div class="vstack gap-2">
          ${VARIANTS.map(
            (variant) => html`<lia-alert
              variant=${variant}
              message="A ${variant} alert. The icon is chosen from the variant unless you set one."
            ></lia-alert>`
          )}
        </div>`,
        dedent`
          html\`<lia-alert variant="warning" message="Disk is nearly full."></lia-alert>\`;
        `
      ),
      example(
        'Everything switched on',
        html`<lia-alert
          variant="danger"
          heading="Certificate renewal failed"
          message="The ACME challenge for <code>svc.example.net</code> timed out three times."
          trusted-html
          icon="fa-solid fa-certificate"
          dismissible
          details=${demoStackTrace}
          .actions=${[
            { id: 'retry', label: 'Try again', variant: 'light', size: 'sm', icon: 'fa-solid fa-rotate-right' },
            { id: 'docs', label: 'Troubleshooting', variant: 'light', size: 'sm', href: '#/feedback/hints' },
          ] as ActionDescriptor[]}
          @lia-action=${(event: Event) => event.preventDefault()}
        ></lia-alert>`,
        ALERT_CODE
      ),
      example(
        'Without an icon, and auto-dismissing',
        html`<div class="vstack gap-2">
          <lia-alert variant="secondary" no-icon message="No icon — just the text."></lia-alert>
          <lia-alert
            variant="success"
            message="This one disappears on its own after eight seconds."
            timeout="8000"
            dismissible
          ></lia-alert>
        </div>`,
        undefined
      ),
    ])}
    ${section('Alert stack', 'A list of messages with per-item dismissal and an empty state.', [
      example('Live', html`<demo-alert-stack></demo-alert-stack>`, dedent`
        html\`<lia-alert-stack
          .messages=\${this.messages}
          gap="3"
          empty-message="Every message has been dealt with."
          @lia-dismiss=\${(e: CustomEvent) => this.drop(e.detail.id)}
        ></lia-alert-stack>\`;
      `),
    ])}
    ${section('Banner', 'The full-bleed strip that docks above the navbar — for maintenance windows, trial notices and impersonation warnings.', [
      example(
        'Variants',
        html`<div class="vstack gap-2">
          <lia-banner
            variant="warning"
            icon="fa-solid fa-screwdriver-wrench"
            heading="Maintenance window"
            message="Saturday 02:00–04:00 UTC. Deployments are paused."
            dismissible
            .actions=${[{ id: 'details', label: 'Details', variant: 'light', size: 'sm' }] as ActionDescriptor[]}
          ></lia-banner>
          <lia-banner
            variant="danger"
            icon="fa-solid fa-user-secret"
            message="You are signed in as <strong>j.lindqvist</strong>."
            trusted-html
            .actions=${[{ id: 'stop', label: 'Return to your account', variant: 'light', size: 'sm' }] as ActionDescriptor[]}
          ></lia-banner>
          <lia-banner
            variant="info"
            message="Your trial ends in 9 days."
            dismissible
          ></lia-banner>
        </div>`,
        dedent`
          // Usually you never place one by hand — the shell renders them:
          html\`<lia-app-shell .banners=\${banners}></lia-app-shell>\`;

          html\`<lia-banner
            variant="warning"
            heading="Maintenance window"
            message="Saturday 02:00–04:00 UTC."
            dismissible
          ></lia-banner>\`;
        `,
        { bodyClass: 'p-0' }
      ),
    ])}
  `;
}

function renderModals(): TemplateResult {
  return html`
    ${section('Modal', 'A property-driven Bootstrap modal: `open` is the whole API. Backdrop, focus trap and body scroll locking come from the plugin.', [
      example('Every shape', html`<demo-modals></demo-modals>`, dedent`
        html\`<lia-modal
          modal-id="restart"
          heading="Restart the scheduler?"
          size="modal-lg"          // modal-sm | modal-lg | modal-xl | modal-fullscreen
          centered
          scrollable
          static-backdrop
          .open=\${this.open}
          .footerActions=\${[
            { id: 'cancel', label: 'Cancel', variant: 'outline-secondary' },
            { id: 'restart', label: 'Restart', variant: 'primary' },
          ]}
          @lia-modal-show=\${…}
          @lia-modal-hide=\${() => (this.open = false)}
          @lia-action=\${(e: CustomEvent) => run(e.detail.id)}
        >
          …body markup, or .content=\${template}, or body-html="…"…
        </lia-modal>\`;
      `),
      example(
        'Properties',
        propTable(
          [
            { name: 'open', type: 'boolean', default: 'false', description: 'Reflected. Setting it shows or hides the dialog.' },
            { name: 'descriptor', type: 'ModalDescriptor', description: 'id, title, body, size and centred/scrollable in one object — what `ActionDescriptor.modal` carries.' },
            { name: 'size', type: "'modal-sm' | 'modal-lg' | 'modal-xl' | 'modal-fullscreen'", description: 'Bootstrap dialog size class.' },
            { name: 'staticBackdrop', type: 'boolean', default: 'false', description: 'Backdrop clicks and Esc no longer close it.' },
            { name: 'footerActions', type: 'ActionDescriptor[]', description: 'The button row. Omit it (or set `hide-footer`) for a bare dialog.' },
            { name: 'content / bodyHtml', type: 'unknown / string', description: 'Body as a Lit template or as trusted markup, instead of children.' },
          ],
          'lia-modal properties'
        )
      ),
    ])}
    ${section('Confirmation', 'The "are you sure?" flow, as a promise. One dialog instance is shared by the whole document.', [
      example('Live', html`<demo-confirm></demo-confirm>`, CONFIRM_CODE),
      note(
        html`Because <code>installConfirmHandler()</code> runs at start-up in this demo, every
          <code>ActionDescriptor</code> that carries a <code>confirm</code> descriptor — in a
          toolbar, a table row, an alert — goes through the same dialog. Nothing has to opt in.`,
        'info'
      ),
    ])}
    ${section('Delete confirmation', 'The one button that must never fire on the first click.', [
      example('Live', html`<demo-delete-confirm></demo-delete-confirm>`, dedent`
        html\`<lia-delete-confirm
          entity="Amara Okonkwo"
          entity-type="member"
          .options=\${[{ name: 'audit', label: 'Write an entry to the audit trail', checked: true }]}
          .data=\${{ id: 1000 }}
          .busy=\${this.busy}
          @lia-delete=\${(e: CustomEvent<DeleteEventDetail>) => this.remove(e.detail)}
          @lia-delete-cancel=\${…}
        ></lia-delete-confirm>\`;

        // The same prompt without any element:
        const result = await confirmDelete({ entity: 'vol-041', entityType: 'volume' });

        // Or as a descriptor, for a toolbar or a table row:
        const action: ActionDescriptor = { id: 'delete', confirm: deletePrompt({ entity: name }) };
      `),
      note(
        html`Only <code>lia-delete</code> means "go ahead". A dismissed dialog raises
          <code>lia-delete-cancel</code> instead, so a host can never mistake a cancel for a
          confirmation.`,
        'warning'
      ),
    ])}
  `;
}

function renderToasts(): TemplateResult {
  return html`
    ${section('Toast', 'Transient notifications in a fixed, stacking region. `toast()` needs no element in your markup at all.', [
      example('Fire some', html`<demo-toasts></demo-toasts>`, TOAST_CODE),
      example(
        'A single toast, in place',
        split(
          html`<lia-toast
            variant="success"
            heading="Backup finished"
            text="1.61 TiB written in 12 min 40 s."
            icon="fa-solid fa-database"
            caption="02:27"
            timeout="0"
          ></lia-toast>`,
          html`<lia-toast
            variant="danger"
            heading="Deployment failed"
            text="ledger v1.9.2 was rolled back."
            timeout="0"
            .actions=${[
              { id: 'logs', label: 'Open the log', variant: 'light', size: 'sm' },
            ] as ActionDescriptor[]}
          ></lia-toast>`
        ),
        dedent`
          // The element on its own, when you want the toast look inside a page.
          html\`<lia-toast variant="success" heading="Backup finished" text="…" timeout="0"></lia-toast>\`;
        `,
        { description: '`timeout="0"` keeps them on screen' }
      ),
      example(
        'Placement',
        propTable(
          [
            { name: 'placement', type: 'ToastPlacement', default: "'top-end'", description: 'One of the nine corner/edge positions.' },
            { name: 'max', type: 'number', default: '6', description: 'Oldest toasts beyond this count are dropped. `0` disables the cap.' },
            { name: 'defaultTimeout', type: 'number', default: '5000', description: 'Applied to messages that carry no `timeout` of their own.' },
            { name: 'regionLabel', type: 'string', default: "'Notifications'", description: 'Accessible name of the live region.' },
          ],
          'lia-toast-container properties'
        )
      ),
    ])}
  `;
}

function renderHints(): TemplateResult {
  return html`
    ${section('Hint', 'The diagnostic panel: what went wrong, what to do about it, and the command that does it.', [
      example(
        'Remediation',
        html`<lia-hint
          variant="warning"
          heading="The certificate could not be renewed"
          lead="Three ACME challenges in a row timed out. Nothing is broken yet — the current certificate is valid for another six days."
          .steps=${REMEDIATION}
          details=${demoStackTrace}
          details-label="Last attempt"
          footnote="Renewal is retried automatically every six hours."
          .actions=${[
            { id: 'retry', label: 'Retry now', icon: 'fa-solid fa-rotate-right', variant: 'primary' },
            { id: 'report', label: 'Report a problem', variant: 'outline-secondary', href: '#/editors/report' },
          ] as ActionDescriptor[]}
          @lia-action=${(event: Event) => event.preventDefault()}
        ></lia-hint>`,
        dedent`
          html\`<lia-hint
            variant="warning"
            heading="The certificate could not be renewed"
            lead="Three ACME challenges in a row timed out."
            .steps=\${[
              { title: 'Check the DNS record', text: 'The challenge needs an A record.' },
              { title: 'Re-run', code: 'orbitctl cert renew svc.example.net --force' },
            ]}
            details=\${stackTrace}
            .actions=\${[{ id: 'retry', label: 'Retry now', variant: 'primary' }]}
          ></lia-hint>\`;
        `
      ),
      example(
        'Appearances',
        html`<div class="vstack gap-3">
          <lia-hint
            appearance="alert"
            variant="info"
            heading="Read-only mode"
            .body=${'A maintenance window is in progress; changes are rejected until it ends.'}
          ></lia-hint>
          <lia-hint
            appearance="plain"
            variant="secondary"
            heading="Nothing to configure"
            .body=${['This host has no managed services.', 'Add one to see configuration steps.']}
            no-icon
          ></lia-hint>
          <lia-hint
            appearance="card"
            variant="danger"
            solid
            heading="Control plane unreachable"
            lead="The console cannot talk to eu-central."
            code="orbitctl status --region eu-central"
          ></lia-hint>
        </div>`,
        dedent`
          html\`<lia-hint appearance="alert" variant="info" heading="Read-only mode" .body=\${text}></lia-hint>\`;
          html\`<lia-hint appearance="plain" .body=\${[line1, line2]} no-icon></lia-hint>\`;
          html\`<lia-hint solid variant="danger" code="orbitctl status"></lia-hint>\`;
        `
      ),
      example(
        'As a whole page',
        html`<div class="border rounded-3 bg-body-tertiary">
          <lia-hint
            page
            variant="danger"
            icon="fa-solid fa-lock"
            heading="You do not have access to this area"
            lead="Ask an owner to grant you the “operator” role, or switch to an account that has it."
            .actions=${[
              { id: 'back', label: 'Back to the overview', variant: 'primary', href: '#/' },
            ] as ActionDescriptor[]}
          ></lia-hint>
        </div>`,
        dedent`
          // \`page\` centres the hint in the available space — a 403 or 404 screen.
          html\`<lia-hint page variant="danger" heading="You do not have access"></lia-hint>\`;
        `,
        { bodyClass: 'p-0' }
      ),
    ])}
    ${section('Error boundary', 'One broken widget should not take the page with it.', [
      example('Break it', html`<demo-error-boundary></demo-error-boundary>`, dedent`
        html\`<lia-error-boundary
          heading="This panel could not be loaded"
          show-details
          .onError=\${(error) => telemetry.report(error)}
          @lia-error-reset=\${() => this.reload()}
        >
          <metrics-panel></metrics-panel>
        </lia-error-boundary>\`;

        // A child hands the boundary a failure with a bubbling event:
        this.dispatchEvent(
          new CustomEvent('lia-error', { bubbles: true, composed: true, detail: { error } })
        );

        // A single top-level boundary should also adopt window errors:
        html\`<lia-error-boundary global>\${this.app}</lia-error-boundary>\`;
      `),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The feedback demos. */
export const feedbackRoutes: DemoRoute[] = [
  {
    path: '/feedback/alerts',
    title: 'Alerts & banners',
    group: 'feedback',
    icon: 'fa-solid fa-circle-exclamation',
    description: 'Inline messages, message stacks and the full-bleed strip.',
    keywords: ['alert', 'banner', 'message', 'dismiss', 'notice'],
    render: renderAlerts,
  },
  {
    path: '/feedback/modals',
    title: 'Modals & confirmation',
    group: 'feedback',
    icon: 'fa-solid fa-window-restore',
    description: 'Dialogs, the promise-returning "are you sure?" flow and the delete button.',
    keywords: ['modal', 'dialog', 'confirm', 'prompt', 'backdrop', 'delete'],
    render: renderModals,
  },
  {
    path: '/feedback/toasts',
    title: 'Toasts',
    group: 'feedback',
    icon: 'fa-solid fa-bell',
    description: 'Transient notifications, from anywhere, without markup.',
    keywords: ['toast', 'notification', 'snackbar', 'transient'],
    render: renderToasts,
  },
  {
    path: '/feedback/hints',
    title: 'Hints & error boundary',
    group: 'feedback',
    icon: 'fa-solid fa-life-ring',
    description: 'Diagnostics with remediation steps, and containment when a widget fails.',
    keywords: ['hint', 'error', 'boundary', 'diagnostic', '404', 'remediation'],
    render: renderHints,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-alert-stack': DemoAlertStack;
    'demo-modals': DemoModals;
    'demo-confirm': DemoConfirm;
    'demo-delete-confirm': DemoDeleteConfirm;
    'demo-toasts': DemoToasts;
    'demo-error-boundary': DemoErrorBoundary;
  }
}
