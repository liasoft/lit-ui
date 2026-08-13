/**
 * Demo pages — Primitives.
 *
 * The small building blocks: buttons and action bars, badges, icons, spinners
 * and meters, cards and empty states, and the three Bootstrap-plugin wrappers
 * (tooltip, popover, copy button).
 *
 * Everything here is deliberately shown twice where it matters: as an element
 * (`<lia-badge>`), and as the inline render helper (`renderBadge()`) a hot path
 * such as a table cell should use instead of instantiating a custom element per
 * row.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  InfoEntry,
  LiaTooltip,
  Size,
  Variant,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  formatBytes,
  renderAction,
  renderActions,
  renderBadge,
  renderIcon,
  renderSpinner,
  usagePercent,
  usageVariant,
} from '@liasoft/lit-ui';
import { accountInfo, byteSamples } from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { cluster, dedent, example, note, propTable, section, split } from './_kit.js';
import { VARIANTS, eventLog, labelled, logEvent, tryIt, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const SIZES: readonly Size[] = ['sm', 'md', 'lg'];

const TOOLBAR: ActionDescriptor[] = [
  { id: 'refresh', label: 'Refresh', icon: 'fa-solid fa-arrows-rotate' },
  { id: 'export', label: 'Export', icon: 'fa-solid fa-file-arrow-down' },
  {
    id: 'docs',
    label: 'Documentation',
    icon: 'fa-solid fa-book',
    href: 'https://developer.mozilla.org/',
    target: '_blank',
  },
  { id: 'disabled', label: 'Not available', icon: 'fa-solid fa-ban', disabled: true },
  { id: 'hidden', label: 'Never rendered', visible: false },
  {
    id: 'purge',
    label: 'Purge cache',
    icon: 'fa-solid fa-broom',
    variant: 'outline-danger',
    confirm: {
      title: 'Purge the edge cache?',
      message: 'Every region refills from origin. Expect a brief latency spike.',
      confirmLabel: 'Purge it',
      cancelLabel: 'Leave it',
      variant: 'danger',
    },
  },
];

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/** Buttons, action bars and the `lia-action` event they all raise. */
@customElement('demo-actions')
export class DemoActions extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];
  @state() private busy = false;

  private onAction(event: CustomEvent<ActionEventDetail>): void {
    this.events = logEvent(this.events, 'lia-action', {
      id: event.detail?.id,
      label: event.detail?.action?.label,
      data: event.detail?.action?.data,
    });
  }

  private async runSave(): Promise<void> {
    this.busy = true;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    this.busy = false;
    this.events = logEvent(this.events, 'save finished');
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Every control below reports through one event. "Purge cache" carries a confirm descriptor, so it asks first.'
      )}
      <div class="vstack gap-3" @lia-action=${this.onAction}>
        <lia-action-bar
          .actions=${TOOLBAR}
          align="start"
          size="sm"
          variant="outline-secondary"
          label="Cache toolbar"
        ></lia-action-bar>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <lia-button
            action-id="save"
            label="Save changes"
            icon="fa-solid fa-check"
            variant="primary"
            .loading=${this.busy}
            @click=${this.runSave}
          ></lia-button>
          <lia-button
            action-id="cancel"
            label="Cancel"
            variant="outline-secondary"
          ></lia-button>
          <lia-button
            action-id="delete"
            label="Delete"
            icon="fa-solid fa-trash-can"
            variant="danger"
            .confirm=${{
              message: 'This removes the record for everyone.',
              confirmLabel: 'Delete',
              variant: 'danger',
            }}
            .data=${{ id: 42 }}
          ></lia-button>
          <lia-button
            action-id="disabled"
            label="Disabled"
            variant="secondary"
            disabled
          ></lia-button>
        </div>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** A meter driven by a range input, so the thresholds can be seen changing. */
@customElement('demo-progress')
export class DemoProgress extends LiaElement {
  @state() private used = 62;

  private readonly total = 100;

  protected override render(): TemplateResult {
    const percent = usagePercent(this.used, this.total);
    const variant = usageVariant(percent);
    return html`
      ${tryIt('Drag past 75% and 90% — the bar picks up the warning and danger colours itself.')}
      <label class="form-label small" for="demo-progress-range"
        >Used: <strong>${this.used} GiB</strong> of ${this.total} GiB</label
      >
      <input
        id="demo-progress-range"
        class="form-range mb-3"
        type="range"
        min="0"
        max="100"
        .value=${String(this.used)}
        @input=${(event: Event) => {
          this.used = Number((event.target as HTMLInputElement).value);
        }}
      />
      <lia-progress
        percent=${percent}
        variant=${variant}
        label="Volume usage"
        text="${this.used} GiB / ${this.total} GiB"
        infotext=${percent >= 90 ? 'Above the soft limit — writes start failing soon.' : ''}
      ></lia-progress>
      <p class="small text-body-secondary mt-2 mb-0">
        <code>usagePercent(${this.used}, ${this.total})</code> →
        <code>${percent}</code> · <code>usageVariant(${percent})</code> →
        <code>${variant === '' ? "''" : variant}</code>
      </p>
    `;
  }
}

/** The two overlay wrappers, shown with every trigger mode. */
@customElement('demo-overlays')
export class DemoOverlays extends LiaElement {
  @state() private manualOpen = false;

  private toggleManual(): void {
    const tip = this.querySelector<LiaTooltip>('lia-tooltip[trigger="manual"]');
    if (!tip) return;
    this.manualOpen = !this.manualOpen;
    if (this.manualOpen) tip.show();
    else tip.hide();
  }

  protected override render(): TemplateResult {
    return html`
      <div class="d-flex flex-wrap gap-3 align-items-center">
        <lia-tooltip content="Rebuild the search index (about 40 s)">
          <button class="btn btn-outline-secondary" type="button">Hover or focus me</button>
        </lia-tooltip>

        <lia-tooltip content="Bottom placement" placement="bottom" trigger="click">
          <button class="btn btn-outline-secondary" type="button">Click me</button>
        </lia-tooltip>

        <lia-tooltip content="<strong>Trusted</strong> markup" html placement="right">
          <button class="btn btn-outline-secondary" type="button">HTML content</button>
        </lia-tooltip>

        <lia-tooltip content="Shown only by code" trigger="manual">
          <button class="btn btn-outline-secondary" type="button" @click=${this.toggleManual}>
            ${this.manualOpen ? 'Hide' : 'Show'} manually
          </button>
        </lia-tooltip>

        <lia-tooltip content="Never appears" disabled>
          <button class="btn btn-outline-secondary" type="button" disabled>Disabled overlay</button>
        </lia-tooltip>
      </div>

      <hr class="my-4" />

      <div class="d-flex flex-wrap gap-3 align-items-center">
        <lia-popover
          heading="Retention"
          content="Snapshots older than 30 days are removed automatically. Pinned snapshots are never removed."
          placement="right"
          trigger="click"
        >
          <button class="btn btn-primary" type="button">
            <i class="fa-solid fa-circle-info me-2" aria-hidden="true"></i>What happens to old
            snapshots?
          </button>
        </lia-popover>

        <lia-popover
          heading="Scopes"
          content="<ul class='mb-0 ps-3'><li><code>read</code></li><li><code>write</code></li><li><code>deploy</code></li></ul>"
          html
          placement="top"
        >
          <button class="btn btn-outline-secondary" type="button">Rich content, on hover</button>
        </lia-popover>
      </div>
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const ACTION_DESCRIPTOR = dedent`
  // One shape describes every button in the kit — toolbars, table rows, alerts,
  // empty states, modal footers. Give it an \`href\` and it renders an anchor.
  const actions: ActionDescriptor[] = [
    { id: 'refresh', label: 'Refresh', icon: 'fa-solid fa-arrows-rotate' },
    { id: 'docs', label: 'Docs', href: 'https://example.org', target: '_blank' },
    { id: 'off', label: 'Not available', disabled: true },
    { id: 'gone', label: 'Never rendered', visible: false },
    {
      id: 'purge',
      label: 'Purge cache',
      variant: 'outline-danger',
      confirm: { message: 'Every region refills from origin.', variant: 'danger' },
      data: { region: 'eu-central' },   // echoed back in the event
    },
  ];

  html\`<lia-action-bar
    .actions=\${actions}
    align="end"
    size="sm"
    @lia-action=\${(e: CustomEvent<ActionEventDetail>) => run(e.detail.id, e.detail.action.data)}
  ></lia-action-bar>\`;
`;

const RENDER_HELPERS = dedent`
  // Inside a table cell, a custom element per row is wasteful. Every primitive
  // ships a pure function that emits the same Bootstrap markup:
  import { renderAction, renderBadge, renderIcon, renderSpinner } from '@liasoft/lit-ui';

  renderIcon('fa-solid fa-user', { fixedWidth: true, variant: 'primary' });
  renderBadge('active', { variant: 'success', pill: true, icon: 'fa-solid fa-check' });
  renderSpinner('Loading members…', { size: 'sm' });
  renderActions(rowActions(row), { host: this, row, index, size: 'sm' });
`;

const CARD_CODE = dedent`
  html\`<lia-card
    title="Edge cache"
    subtitle="12 points of presence"
    icon="fa-solid fa-bolt"
    variant="success"
    .headerActions=\${[{ id: 'purge', icon: 'fa-solid fa-broom', title: 'Purge' }]}
    .footerActions=\${[{ id: 'open', label: 'Open', variant: 'primary' }]}
    .content=\${html\`<p class="mb-0">Anything Lit can render.</p>\`}
  ></lia-card>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderButtons(): TemplateResult {
  return html`
    ${section(
      'Actions in practice',
      'One descriptor shape, one event. A button never takes a callback — it announces what happened and someone up the tree decides what that means.',
      example('Live toolbar', html`<demo-actions></demo-actions>`, ACTION_DESCRIPTOR)
    )}
    ${section('Button', 'Every Bootstrap variant, in solid and outline, at three sizes.', [
      example(
        'Variants',
        html`<div class="vstack gap-3">
          ${cluster(
            ...VARIANTS.map(
              (variant) =>
                html`<lia-button label=${variant} variant=${variant} action-id=${variant}></lia-button>`
            )
          )}
          ${cluster(
            ...VARIANTS.map(
              (variant) =>
                html`<lia-button
                  label="outline-${variant}"
                  variant="outline-${variant as Variant}"
                  action-id=${variant}
                ></lia-button>`
            )
          )}
        </div>`,
        dedent`
          html\`<lia-button label="Save" variant="primary"></lia-button>\`;
          html\`<lia-button label="Cancel" variant="outline-secondary"></lia-button>\`;
        `
      ),
      example(
        'Sizes, icons and states',
        html`<div class="vstack gap-3">
          ${cluster(
            ...SIZES.map(
              (size) =>
                html`<lia-button
                  label="size=${size}"
                  size=${size}
                  icon="fa-solid fa-rocket"
                  variant="outline-primary"
                ></lia-button>`
            )
          )}
          ${cluster(
            labelled('icon only', html`<lia-button icon="fa-solid fa-gear" title="Settings"></lia-button>`),
            labelled('loading', html`<lia-button label="Saving" loading variant="primary"></lia-button>`),
            labelled('disabled', html`<lia-button label="Disabled" disabled></lia-button>`),
            labelled(
              'href',
              html`<lia-button
                label="Documentation"
                icon="fa-solid fa-book"
                href="https://developer.mozilla.org/"
                target="_blank"
                variant="link"
              ></lia-button>`
            ),
            labelled(
              'label-responsive',
              html`<lia-button
                label="Hidden below lg"
                icon="fa-solid fa-eye"
                label-responsive
                variant="outline-secondary"
              ></lia-button>`
            )
          )}
          <lia-button label="block" block variant="secondary"></lia-button>
        </div>`,
        dedent`
          html\`<lia-button label="Saving" loading variant="primary"></lia-button>\`;
          html\`<lia-button icon="fa-solid fa-gear" title="Settings"></lia-button>\`;
          html\`<lia-button label="Docs" href="https://…" target="_blank" variant="link"></lia-button>\`;
        `
      ),
      example(
        'Driven by a descriptor',
        cluster(
          html`<lia-button
            .action=${{
              id: 'restart',
              label: 'Restart service',
              icon: 'fa-solid fa-power-off',
              variant: 'warning',
              confirm: { message: 'The service is unavailable for about 20 seconds.' },
            } as ActionDescriptor}
          ></lia-button>`,
          html`<lia-button
            .action=${{
              id: 'invite',
              label: 'Invite',
              icon: 'fa-solid fa-envelope',
              modal: { id: 'demo-invite-modal', title: 'Invite a member' },
            } as ActionDescriptor}
          ></lia-button>`
        ),
        dedent`
          // Same object the toolbars, tables and alerts take.
          html\`<lia-button .action=\${action}></lia-button>\`;
        `,
        { description: 'The second button targets a modal by id instead of emitting' }
      ),
    ])}
    ${section('Action bar', 'A row of descriptors with shared defaults — the toolbar of a heading, a card or a table.', [
      example(
        'Alignment',
        html`<div class="vstack gap-3">
          ${(['start', 'center', 'end', 'between'] as const).map(
            (align) => html`<div class="border rounded p-2">
              <span class="small text-body-secondary d-block mb-2 font-monospace">align=${align}</span>
              <lia-action-bar
                align=${align}
                size="sm"
                .actions=${TOOLBAR.slice(0, 3)}
                @lia-action=${(event: Event) => event.preventDefault()}
              ></lia-action-bar>
            </div>`
          )}
        </div>`,
        dedent`
          html\`<lia-action-bar align="end" size="sm" gap="2" .actions=\${actions}></lia-action-bar>\`;
        `
      ),
    ])}
    ${section('Render helpers', 'The same markup as a pure function, for cells and other hot paths.', [
      example(
        'Inline',
        html`<div class="vstack gap-2">
          <div>${renderIcon('fa-solid fa-user', { fixedWidth: true, variant: 'primary' })} renderIcon</div>
          <div>${renderBadge('active', { variant: 'success', pill: true })} renderBadge</div>
          <div>${renderSpinner('Loading…', { size: 'sm' })} renderSpinner</div>
          <div class="d-flex gap-2">
            ${renderActions(TOOLBAR.slice(0, 2), { size: 'sm', variant: 'outline-secondary' })}
            <span class="align-self-center">renderActions</span>
          </div>
          <div class="d-flex gap-2">
            ${renderAction(
              { id: 'one', label: 'renderAction', icon: 'fa-solid fa-bolt' },
              { size: 'sm', variant: 'outline-primary' }
            )}
          </div>
        </div>`,
        RENDER_HELPERS
      ),
      note(
        html`The helpers dispatch the same <code>lia-action</code> event, so a listener cannot tell
          whether a button came from an element or a function. Pass <code>host: this</code> when you
          want the event to appear to originate from your component.`,
        'info'
      ),
    ])}
  `;
}

function renderBadges(): TemplateResult {
  return html`
    ${section('Badge', 'A chip: solid, subtle or pill, with an optional icon.', [
      example(
        'Variants',
        html`<div class="vstack gap-3">
          ${cluster(...VARIANTS.map((variant) => html`<lia-badge text=${variant} variant=${variant}></lia-badge>`))}
          ${cluster(
            ...VARIANTS.map(
              (variant) => html`<lia-badge text=${variant} variant=${variant} subtle></lia-badge>`
            )
          )}
          ${cluster(
            ...VARIANTS.map(
              (variant) => html`<lia-badge text=${variant} variant=${variant} pill></lia-badge>`
            )
          )}
        </div>`,
        dedent`
          html\`<lia-badge text="Active" variant="success"></lia-badge>\`;
          html\`<lia-badge text="Draft" variant="secondary" subtle></lia-badge>\`;
          html\`<lia-badge text="12" variant="primary" pill></lia-badge>\`;
        `
      ),
      example(
        'With an icon, and from a cell value',
        cluster(
          html`<lia-badge text="on-call" variant="warning" icon="fa-solid fa-pager"></lia-badge>`,
          html`<lia-badge text="verified" variant="success" icon="fa-solid fa-check" pill></lia-badge>`,
          html`<lia-badge
            .value=${{ text: 'Owner', variant: 'primary', icon: 'fa-solid fa-crown' }}
          ></lia-badge>`,
          html`<lia-badge text="42" variant="danger" pill title="Open incidents"></lia-badge>`
        ),
        dedent`
          // \`.value\` takes the same BadgeCellValue a table's \`badge\` renderer uses.
          html\`<lia-badge .value=\${{ text: 'Owner', variant: 'primary', icon: 'fa-solid fa-crown' }}></lia-badge>\`;
        `
      ),
    ])}
    ${section('Icon', 'A thin wrapper over the icon font: fixed width, spin, size and colour.', [
      example(
        'Options',
        cluster(
          labelled('plain', html`<lia-icon name="fa-solid fa-database"></lia-icon>`),
          labelled('fixed-width', html`<lia-icon name="fa-solid fa-i" fixed-width></lia-icon>`),
          labelled('spin', html`<lia-icon name="fa-solid fa-arrows-rotate" spin></lia-icon>`),
          labelled('pulse', html`<lia-icon name="fa-solid fa-spinner" pulse></lia-icon>`),
          labelled('size="2x"', html`<lia-icon name="fa-solid fa-server" size="2x"></lia-icon>`),
          labelled('variant', html`<lia-icon name="fa-solid fa-fire" variant="danger"></lia-icon>`),
          labelled(
            'labelled',
            html`<lia-icon name="fa-solid fa-lock" label="Encrypted at rest"></lia-icon>`
          )
        ),
        dedent`
          html\`<lia-icon name="fa-solid fa-fire" variant="danger" size="2x"></lia-icon>\`;
          // A decorative icon is aria-hidden; give it a \`label\` and it becomes role="img".
          html\`<lia-icon name="fa-solid fa-lock" label="Encrypted at rest"></lia-icon>\`;
        `
      ),
    ])}
    ${section('Spinner', 'Border and grow, three sizes, with an optional visible label.', [
      example(
        'All of them',
        html`<div class="vstack gap-3">
          ${cluster(...SIZES.map((size) => html`<lia-spinner size=${size}></lia-spinner>`))}
          ${cluster(...SIZES.map((size) => html`<lia-spinner grow size=${size}></lia-spinner>`))}
          ${cluster(
            html`<lia-spinner variant="primary" label-visible label="Loading members…"></lia-spinner>`,
            html`<lia-spinner variant="danger" grow label-visible label="Retrying…"></lia-spinner>`
          )}
        </div>`,
        dedent`
          html\`<lia-spinner size="sm"></lia-spinner>\`;
          html\`<lia-spinner grow variant="primary" label-visible label="Loading…"></lia-spinner>\`;
        `
      ),
    ])}
    ${section('Progress', 'A meter with a caption, a second bar for "already allocated", and an info popover.', [
      example('Interactive', html`<demo-progress></demo-progress>`, dedent`
        import { usagePercent, usageVariant } from '@liasoft/lit-ui';

        const percent = usagePercent(used, total);        // clamped 0–100
        html\`<lia-progress
          percent=\${percent}
          variant=\${usageVariant(percent)}                // '' | bg-warning | bg-danger
          label="Volume usage"
          text="\${formatBytes(used)} / \${formatBytes(total)}"
          infotext="Above the soft limit."
        ></lia-progress>\`;
      `),
      example(
        'Shapes',
        html`<div class="vstack gap-3">
          ${labelled('plain', html`<lia-progress percent="42" label="Requests"></lia-progress>`)}
          ${labelled(
            'thin',
            html`<lia-progress percent="42" thin label="Requests" variant="info"></lia-progress>`
          )}
          ${labelled(
            'striped + animated',
            html`<lia-progress
              percent="68"
              striped
              animated
              variant="primary"
              label="Rebuilding"
              bar-label="68%"
            ></lia-progress>`
          )}
          ${labelled(
            'two bars (used / allocated)',
            html`<lia-progress
              percent="60"
              secondary-percent="90"
              secondary-variant="secondary"
              secondary-label="allocated to sub-accounts"
              label="Capacity"
              text="60% used · 90% allocated"
            ></lia-progress>`
          )}
          ${labelled(
            'thresholds',
            html`<div class="vstack gap-2">
              <lia-progress percent="35" variant=${usageVariant(35)} text="35%"></lia-progress>
              <lia-progress percent="80" variant=${usageVariant(80)} text="80% — warning"></lia-progress>
              <lia-progress percent="96" variant=${usageVariant(96)} text="96% — danger"></lia-progress>
            </div>`
          )}
        </div>`,
        undefined
      ),
    ])}
    ${section('Byte formatting', '`formatBytes()` is what every `bytes` cell, quota meter and usage figure goes through.', [
      example(
        'Samples',
        html`<div class="table-responsive">
          <table class="table table-sm mb-0 font-monospace">
            <caption class="visually-hidden">formatBytes samples</caption>
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col">formatBytes(n)</th>
                <th scope="col">formatBytes(n, 0)</th>
              </tr>
            </thead>
            <tbody>
              ${byteSamples.map(
                (value) => html`<tr>
                  <td>${value}</td>
                  <td>${formatBytes(value)}</td>
                  <td>${formatBytes(value, 0)}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`,
        dedent`
          formatBytes(1610612736);   // → '1.5 GiB'
          formatBytes(-1);           // → '∞'   (negative means unlimited)
          formatBytes(null);         // → '-'
        `
      ),
    ])}
  `;
}

function renderSurfaces(): TemplateResult {
  return html`
    ${section('Card', 'A Bootstrap card with a header, header actions, projected content and a footer.', [
      example(
        'Full',
        split(
          html`<lia-card
            title="Edge cache"
            subtitle="12 points of presence"
            icon="fa-solid fa-bolt"
            variant="success"
            .headerActions=${[
              { id: 'purge', icon: 'fa-solid fa-broom', title: 'Purge', variant: 'outline-secondary', size: 'sm' },
            ] as ActionDescriptor[]}
            .footerActions=${[
              { id: 'open', label: 'Open', variant: 'primary', size: 'sm' },
              { id: 'metrics', label: 'Metrics', variant: 'outline-secondary', size: 'sm' },
            ] as ActionDescriptor[]}
            .content=${html`<p class="mb-0">
              Hit rate <strong>97.4%</strong> over the last hour, 0 evictions.
            </p>`}
            @lia-action=${(event: Event) => event.preventDefault()}
          ></lia-card>`,
          html`<lia-card title="Deactivated" subtitle="Kept for the audit trail" deactivated>
            <p class="mb-0">
              <code>deactivated</code> dims the whole card without removing it — the same treatment
              a disabled table row gets.
            </p>
          </lia-card>`
        ),
        CARD_CODE
      ),
      example(
        'Body-less and plain',
        split(
          html`<lia-card title="Full-bleed body" no-body>
            <ul class="list-group list-group-flush">
              <li class="list-group-item">A list that must touch the card edges</li>
              <li class="list-group-item">…needs <code>no-body</code></li>
            </ul>
          </lia-card>`,
          html`<lia-card>
            <p class="mb-0">
              No title, no icon, no actions — just a surface. The card header disappears entirely.
            </p>
          </lia-card>`
        ),
        dedent`
          html\`<lia-card title="Rows" no-body>
            <ul class="list-group list-group-flush">…</ul>
          </lia-card>\`;
        `
      ),
    ])}
    ${section('Key/value', 'A single labelled fact. The building block of every info panel in the kit.', [
      example(
        'Rows',
        html`<div class="border rounded-3 p-3">
          ${accountInfo.map((entry: InfoEntry) => html`<lia-key-value .entry=${entry}></lia-key-value>`)}
        </div>`,
        dedent`
          const entries: InfoEntry[] = [
            { label: 'Plan', value: 'Scale', badge: { text: 'annual', variant: 'info' } },
            { label: 'Contact', value: 'a@example.org', href: 'mailto:a@example.org' },
            { label: 'Runtime', html: 'Node <code>22.14.0</code>' },
          ];

          html\`\${entries.map((entry) => html\`<lia-key-value .entry=\${entry}></lia-key-value>\`)}\`;
        `
      ),
      example(
        'Attributes instead of an object',
        html`<div class="border rounded-3 p-3">
          <lia-key-value label="Region" value="eu-central" icon="fa-solid fa-earth-europe"></lia-key-value>
          <lia-key-value label="State" value="degraded" variant="warning"></lia-key-value>
          <lia-key-value label="Bare row" value="no separator" bare></lia-key-value>
        </div>`,
        undefined
      ),
    ])}
    ${section('Empty state', 'What a listing, a panel or a search result shows when there is nothing.', [
      example(
        'Shapes',
        html`<div class="vstack gap-3">
          <lia-empty-state
            icon="fa-solid fa-inbox"
            title="No members yet"
            message="Invite someone and they will appear here."
            .actions=${[
              { id: 'invite', label: 'Invite a member', icon: 'fa-solid fa-envelope', variant: 'primary' },
            ] as ActionDescriptor[]}
            @lia-action=${(event: Event) => event.preventDefault()}
          ></lia-empty-state>
          <lia-empty-state
            centered
            variant="warning"
            icon="fa-solid fa-magnifying-glass"
            title="Nothing matches “vol-99”"
            message="Try a shorter term, or clear the filters."
          ></lia-empty-state>
          <lia-empty-state
            variant="danger"
            icon="fa-solid fa-plug-circle-xmark"
            title="Could not reach the control plane"
            message="The request timed out after 10 s. <code>orbitctl status</code> may tell you more."
            html
          ></lia-empty-state>
        </div>`,
        dedent`
          html\`<lia-empty-state
            icon="fa-solid fa-inbox"
            title="No members yet"
            message="Invite someone and they will appear here."
            .actions=\${[{ id: 'invite', label: 'Invite a member', variant: 'primary' }]}
          ></lia-empty-state>\`;
        `
      ),
    ])}
  `;
}

function renderOverlaysPage(): TemplateResult {
  return html`
    ${section(
      'Tooltip & popover',
      'Declarative wrappers over the Bootstrap plugins. The element keeps your markup and attaches the plugin to its first child; the instance is disposed on disconnect, so no listener outlives the element.',
      [
        example('Every trigger', html`<demo-overlays></demo-overlays>`, dedent`
          html\`<lia-tooltip content="Rebuild the index" placement="top">
            <button class="btn btn-outline-secondary">Hover or focus me</button>
          </lia-tooltip>\`;

          html\`<lia-popover
            heading="Retention"
            content="Snapshots older than 30 days are removed."
            trigger="click"
            placement="right"
          >
            <button class="btn btn-primary">What happens to old snapshots?</button>
          </lia-popover>\`;

          // Imperative control, for \`trigger="manual"\`:
          this.querySelector('lia-tooltip')?.show();
        `),
        example(
          'Options',
          propTable(
            [
              { name: 'content', type: 'string', description: 'The body. Empty content disables the overlay.' },
              { name: 'heading', type: 'string', description: 'Popover only — the title bar of the bubble.' },
              { name: 'placement', type: "'auto' | 'top' | 'bottom' | 'left' | 'right'", default: "'top'", description: 'Preferred side. Popper flips it when there is no room.' },
              { name: 'trigger', type: "'hover focus' | 'click' | 'manual' | …", default: "'hover focus'", description: 'Space-separated list. `manual` means code only.' },
              { name: 'html', type: 'boolean', default: 'false', description: 'Render the content as markup. Bootstrap still sanitises it.' },
              { name: 'delay', type: 'number', default: '0', description: 'Show/hide delay in milliseconds.' },
              { name: 'container', type: 'string', description: 'Selector the overlay is appended to — `body` escapes `overflow: hidden`.' },
              { name: 'disabled', type: 'boolean', default: 'false', description: 'Suppress the overlay without removing the element.' },
            ],
            'Overlay properties'
          )
        ),
      ]
    )}
    ${section('Copy button', 'Clipboard access with the fallback, the confirmation state and the announcement all handled.', [
      example(
        'Working',
        html`<div class="vstack gap-3">
          ${cluster(
            html`<lia-copy-button text="orbit_sk_e4a9139d47c2b6f80153ae7241bc95d0"></lia-copy-button>`,
            html`<lia-copy-button
              text="systemctl restart orbit-agent"
              label="Copy the command"
              variant="outline-primary"
            ></lia-copy-button>`,
            html`<lia-copy-button
              text="Copied from a large button"
              label="Copy"
              size="lg"
              variant="primary"
              icon="fa-solid fa-clipboard"
            ></lia-copy-button>`,
            html`<lia-copy-button text="nothing" label="Disabled" disabled></lia-copy-button>`
          )}
          <div class="input-group" style="max-width: 34rem;">
            <input
              id="demo-copy-source"
              class="form-control font-monospace"
              value="https://console.example.org/invite/2f8c41d0a97b"
              readonly
            />
            <lia-copy-button source-id="demo-copy-source" label="Copy link"></lia-copy-button>
          </div>
        </div>`,
        dedent`
          html\`<lia-copy-button text=\${secret}></lia-copy-button>\`;

          // Or copy whatever is in another element, by id:
          html\`<input id="link" value=\${url} readonly />
            <lia-copy-button source-id="link" label="Copy link"></lia-copy-button>\`;

          // It reports the outcome, so a host can toast on failure:
          // @lia-copy=\${(e: CustomEvent<CopyEventDetail>) => …}
        `,
        { description: 'These really copy — try one' }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The primitives demos. */
export const primitivesRoutes: DemoRoute[] = [
  {
    path: '/primitives/buttons',
    title: 'Buttons & actions',
    group: 'primitives',
    icon: 'fa-solid fa-hand-pointer',
    description: 'The ActionDescriptor shape, the button, the bar and the render helpers.',
    keywords: ['button', 'action', 'toolbar', 'confirm', 'descriptor'],
    render: renderButtons,
  },
  {
    path: '/primitives/badges',
    title: 'Badges, icons & meters',
    group: 'primitives',
    icon: 'fa-solid fa-tag',
    description: 'Chips, the icon wrapper, spinners and the progress meter.',
    keywords: ['badge', 'chip', 'icon', 'spinner', 'progress', 'bytes', 'usage'],
    render: renderBadges,
  },
  {
    path: '/primitives/surfaces',
    title: 'Cards & empty states',
    group: 'primitives',
    icon: 'fa-solid fa-square',
    description: 'Cards, key/value rows and the "there is nothing here" panel.',
    keywords: ['card', 'panel', 'empty', 'placeholder', 'key value'],
    render: renderSurfaces,
  },
  {
    path: '/primitives/overlays',
    title: 'Overlays & clipboard',
    group: 'primitives',
    icon: 'fa-solid fa-comment',
    description: 'Tooltips, popovers and a copy button that really copies.',
    keywords: ['tooltip', 'popover', 'copy', 'clipboard', 'bootstrap plugin'],
    render: renderOverlaysPage,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-actions': DemoActions;
    'demo-progress': DemoProgress;
    'demo-overlays': DemoOverlays;
  }
}
