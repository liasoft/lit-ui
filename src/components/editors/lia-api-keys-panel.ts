import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { uid } from '../../core/utils.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  FormDefinition,
  FormSubmitDetail,
  FormValues,
  IconName,
  TableColumn,
  TableListing,
} from '../../core/types.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import '../primitives/lia-copy-button.js';
import '../table/lia-table.js';
import '../form/form.js';
import type { LiaForm } from '../form/form.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** One issued credential, as the panel lists it. Never carries the secret. */
export interface CredentialEntry {
  /** Identity used for revocation. */
  id: string | number;
  /** Human-chosen name. Falls back to the identifier. */
  label?: string;
  /** The public half — a key id, client id or fingerprint. */
  identifier?: string;
  created?: string | number | Date;
  lastUsed?: string | number | Date;
  expires?: string | number | Date;
  /** Networks or hosts the credential may be presented from. */
  allowedFrom?: string;
  /** What the credential is allowed to do. */
  scopes?: string[];
  /** Shown muted; still revocable. */
  disabled?: boolean;
}

/**
 * A freshly minted credential. Assign it to {@link LiaApiKeysPanel.secret} to
 * show the one-time reveal box, and clear it when `lia-credential-dismiss`
 * fires — the panel never keeps a copy.
 */
export interface NewCredential {
  id?: string | number;
  label?: string;
  /** The public half, if there is one. */
  identifier?: string;
  /** The secret. Shown once and never again. */
  secret: string;
  /** Extra line under the warning, e.g. where to paste it. */
  note?: string;
}

/** Every string `<lia-api-keys-panel>` renders on its own behalf. */
export interface CredentialsPanelLabels {
  title: string;
  description: string;
  create: string;
  createTitle: string;
  cancel: string;
  revoke: string;
  revokeTitle: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmAccept: string;
  confirmCancel: string;
  columnLabel: string;
  columnIdentifier: string;
  columnCreated: string;
  columnLastUsed: string;
  columnExpires: string;
  columnAllowedFrom: string;
  columnScopes: string;
  never: string;
  disabled: string;
  emptyTitle: string;
  empty: string;
  /** `{max}` is replaced. */
  limitReached: string;
  secretTitle: string;
  secretWarning: string;
  secretLabel: string;
  reveal: string;
  hide: string;
  copy: string;
  copied: string;
  acknowledge: string;
  labelPlaceholder: string;
  allowedFromHint: string;
}

/** The defaults behind {@link LiaApiKeysPanel.labels}. */
export const DEFAULT_CREDENTIALS_PANEL_LABELS: Readonly<CredentialsPanelLabels> = Object.freeze({
  title: 'Access credentials',
  description:
    'Credentials let other programs act on your behalf. Revoke anything you no longer use.',
  create: 'Create credential',
  createTitle: 'New credential',
  cancel: 'Cancel',
  revoke: 'Revoke',
  revokeTitle: 'Revoke this credential',
  confirmTitle: 'Revoke credential',
  confirmMessage:
    'Anything still using this credential will stop working immediately. This cannot be undone.',
  confirmAccept: 'Revoke',
  confirmCancel: 'Keep',
  columnLabel: 'Name',
  columnIdentifier: 'Identifier',
  columnCreated: 'Created',
  columnLastUsed: 'Last used',
  columnExpires: 'Expires',
  columnAllowedFrom: 'Allowed from',
  columnScopes: 'Scopes',
  never: 'Never',
  disabled: 'Disabled',
  emptyTitle: 'No credentials yet',
  empty: 'Create one when a program needs to act on your behalf.',
  limitReached: 'The maximum of {max} credentials has been reached.',
  secretTitle: 'Copy this secret now',
  secretWarning:
    'This is the only time it is shown. Once you leave this page it cannot be recovered.',
  secretLabel: 'Secret',
  reveal: 'Show the secret',
  hide: 'Hide the secret',
  copy: 'Copy the secret',
  copied: 'Copied',
  acknowledge: 'I have stored it',
  labelPlaceholder: 'e.g. deployment pipeline',
  allowedFromHint: 'Comma-separated addresses or ranges. Leave empty to allow any.',
});

/** Detail of `lia-credential-create`. */
export interface CredentialCreateDetail {
  values: FormValues;
}

/** Detail of `lia-credential-revoke`. */
export interface CredentialRevokeDetail {
  id: string | number;
  credential: CredentialEntry;
}

/** Detail of `lia-credential-dismiss`. */
export interface CredentialDismissDetail {
  id?: string | number;
}

declare global {
  interface HTMLElementEventMap {
    'lia-credential-create': CustomEvent<CredentialCreateDetail>;
    'lia-credential-revoke': CustomEvent<CredentialRevokeDetail>;
    'lia-credential-dismiss': CustomEvent<CredentialDismissDetail>;
  }
}

const REVOKE_ACTION = 'lia-credential-revoke-action';

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * A credentials management panel: the list of issued credentials, a create
 * flow, and the one-time reveal of a newly minted secret.
 *
 * The interaction that matters is the reveal: a secret exists in the UI
 * exactly once, so the box that shows it says so plainly, offers a copy button
 * that works without unmasking, and requires an explicit acknowledgement
 * before it disappears. Revocation always asks first, because it breaks
 * whatever is still using the credential.
 *
 * The table only shows columns the data actually fills, so a panel with
 * nothing but names and creation dates does not carry five empty columns.
 * Nothing here is API-key specific — it is equally a panel for deploy tokens,
 * webhook signing secrets or device certificates.
 *
 * @example
 * ```ts
 * html`<lia-api-keys-panel
 *   .credentials=${keys}
 *   .secret=${justCreated}
 *   ?creating=${pending}
 *   @lia-credential-create=${(e: CustomEvent) => create(e.detail.values)}
 *   @lia-credential-revoke=${(e: CustomEvent) => revoke(e.detail.id)}
 *   @lia-credential-dismiss=${() => (justCreated = undefined)}
 * ></lia-api-keys-panel>`;
 * ```
 *
 * @example
 * ```html
 * <lia-api-keys-panel max-credentials="5" can-create="false"></lia-api-keys-panel>
 * ```
 */
@customElement('lia-api-keys-panel')
export class LiaApiKeysPanel extends LiaElement {
  /** The credentials to list. */
  @property({ attribute: false }) credentials: CredentialEntry[] = [];

  /** A freshly created credential to reveal once. Clear it on dismissal. */
  @property({ attribute: false }) secret?: NewCredential;

  /** Heading of the panel. */
  @property({ type: String }) override title = '';

  /** Icon next to the heading. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-key';

  /** Muted line under the heading. Set to an empty string to drop it. */
  @property({ type: String }) description = '';

  /** The list is being fetched. */
  @property({ type: Boolean }) loading = false;

  /** A creation is in flight. */
  @property({ type: Boolean }) creating = false;

  /** Offer the create flow. */
  @property({ converter: flag, attribute: 'can-create' }) canCreate = true;

  /** Offer per-row revocation. */
  @property({ converter: flag, attribute: 'can-revoke' }) canRevoke = true;

  /** Upper bound on the number of credentials. `0` means no limit. */
  @property({ type: Number, attribute: 'max-credentials' }) maxCredentials = 0;

  /** Start the reveal box masked. Copying works either way. */
  @property({ type: Boolean }) masked = false;

  /** Replace the built-in create form with one of your own. */
  @property({ attribute: false }) createForm?: FormDefinition;

  /** Extra per-row actions, appended after revoke. */
  @property({ attribute: false }) rowActions?: (credential: CredentialEntry) => ActionDescriptor[];

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<CredentialsPanelLabels> = {};

  @state() private formOpen = false;
  @state() private revealed = true;

  private readonly instanceId = uid('lia-credentials');

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('masked')) this.revealed = !this.masked;
    // A secret arriving means the creation went through: close the form.
    if (changed.has('secret') && this.secret) this.formOpen = false;
  }

  /** Whether the create form is on screen. */
  get createOpen(): boolean {
    return this.formOpen;
  }

  /** Open or close the create form. */
  setCreateOpen(open: boolean): void {
    this.formOpen = open;
  }

  /** Ask the create form to validate and submit itself. */
  submitCreate(): void {
    this.querySelector<LiaForm>('lia-form')?.submit();
  }

  private get strings(): CredentialsPanelLabels {
    return { ...DEFAULT_CREDENTIALS_PANEL_LABELS, ...this.labels };
  }

  private get limitReached(): boolean {
    return this.maxCredentials > 0 && this.credentials.length >= this.maxCredentials;
  }

  private get definition(): FormDefinition {
    if (this.createForm) return this.createForm;
    const strings = this.strings;
    return {
      id: `${this.instanceId}-form`,
      sections: {
        main: {
          fields: {
            label: {
              type: 'text',
              label: strings.columnLabel,
              mandatory: true,
              placeholder: strings.labelPlaceholder,
            },
            allowedFrom: {
              type: 'text',
              label: strings.columnAllowedFrom,
              note: strings.allowedFromHint,
            },
            expires: { type: 'date', label: strings.columnExpires },
          },
        },
      },
    };
  }

  /** Only offer a column some credential actually fills. */
  private used(pick: (credential: CredentialEntry) => unknown): boolean {
    return this.credentials.some((credential) => {
      const value = pick(credential);
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
  }

  private buildListing(): TableListing<CredentialEntry> {
    const strings = this.strings;
    const columns: TableColumn<CredentialEntry>[] = [{ key: 'label', label: strings.columnLabel }];
    if (this.used((entry) => entry.identifier)) {
      columns.push({
        key: 'identifier',
        label: strings.columnIdentifier,
        renderer: 'code',
      });
    }
    if (this.used((entry) => entry.created)) {
      columns.push({
        key: 'created',
        label: strings.columnCreated,
        renderer: 'datetime',
      });
    }
    if (this.used((entry) => entry.lastUsed)) {
      columns.push({
        key: 'lastUsed',
        label: strings.columnLastUsed,
        renderer: 'datetime',
      });
    }
    if (this.used((entry) => entry.expires)) {
      columns.push({
        key: 'expires',
        label: strings.columnExpires,
        renderer: 'datetime',
      });
    }
    if (this.used((entry) => entry.allowedFrom)) {
      columns.push({ key: 'allowedFrom', label: strings.columnAllowedFrom });
    }
    if (this.used((entry) => entry.scopes)) {
      columns.push({
        key: 'scopes',
        label: strings.columnScopes,
        renderer: 'custom',
        render: (row) =>
          html`${(row.scopes ?? []).map(
            (scope) => html`<span class="badge text-bg-secondary me-1">${scope}</span>`,
          )}`,
      });
    }

    const rows = this.credentials.map((entry) => ({
      ...entry,
      label: entry.label ?? String(entry.identifier ?? entry.id),
    }));

    return {
      id: `${this.instanceId}-list`,
      columns,
      rows,
      noSearch: true,
      noColumnManager: true,
      rowKey: (row) => row.id,
      rowClass: (row) => (row.disabled ? 'deactivated text-body-secondary' : undefined),
      emptyTitle: strings.emptyTitle,
      emptyMessage: strings.empty,
      rowActions: (row) => {
        const actions: ActionDescriptor[] = [];
        if (this.canRevoke) {
          actions.push({
            id: REVOKE_ACTION,
            icon: 'fa-solid fa-trash',
            title: strings.revokeTitle,
            variant: 'outline-danger',
            size: 'sm',
            confirm: {
              title: strings.confirmTitle,
              message: strings.confirmMessage,
              confirmLabel: strings.confirmAccept,
              cancelLabel: strings.confirmCancel,
              variant: 'danger',
            },
            data: { credentialId: row.id },
          });
        }
        return [...actions, ...(this.rowActions?.(row) ?? [])];
      },
    };
  }

  private onAction(event: CustomEvent<ActionEventDetail<CredentialEntry>>): void {
    const { action, row } = event.detail;
    if (action.id !== REVOKE_ACTION || !row) return;
    this.emit<CredentialRevokeDetail>('lia-credential-revoke', {
      id: row.id,
      credential: row,
    });
  }

  private onSubmit(event: CustomEvent<FormSubmitDetail>): void {
    event.stopPropagation();
    this.emit<CredentialCreateDetail>('lia-credential-create', {
      values: event.detail.values,
    });
  }

  private dismissSecret(): void {
    this.emit<CredentialDismissDetail>('lia-credential-dismiss', {
      id: this.secret?.id,
    });
  }

  private renderSecret(): TemplateResult | typeof nothing {
    const secret = this.secret;
    if (!secret) return nothing;
    const strings = this.strings;
    const fieldId = `${this.instanceId}-secret`;
    return html`<div class="alert alert-warning" role="alert">
      <h3 class="alert-heading h6 d-flex align-items-center gap-2">
        ${renderIcon('fa-solid fa-triangle-exclamation')}<span>${strings.secretTitle}</span>
      </h3>
      <p class="mb-2">${strings.secretWarning}</p>
      ${
        secret.label || secret.identifier
          ? html`<p class="small mb-2">
              ${secret.label ? html`<strong>${secret.label}</strong>` : nothing}
              ${secret.identifier ? html`<code class="ms-1">${secret.identifier}</code>` : nothing}
            </p>`
          : nothing
      }
      <label class="form-label small" for=${fieldId}>${strings.secretLabel}</label>
      <div class="input-group">
        <input
          id=${fieldId}
          class="form-control lia-secret-value"
          type=${this.revealed ? 'text' : 'password'}
          .value=${secret.secret}
          readonly
          spellcheck="false"
          autocomplete="off"
          @focus=${(event: Event) => (event.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          aria-pressed=${this.revealed ? 'true' : 'false'}
          title=${this.revealed ? strings.hide : strings.reveal}
          @click=${() => {
            this.revealed = !this.revealed;
          }}
        >
          ${renderIcon(this.revealed ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye', {
            label: this.revealed ? strings.hide : strings.reveal,
          })}
        </button>
        <lia-copy-button
          .text=${secret.secret}
          title=${strings.copy}
          copied-title=${strings.copied}
        ></lia-copy-button>
      </div>
      ${secret.note ? html`<p class="small mt-2 mb-0">${secret.note}</p>` : nothing}
      <div class="text-end mt-3">
        <button type="button" class="btn btn-sm btn-warning" @click=${() => this.dismissSecret()}>
          ${strings.acknowledge}
        </button>
      </div>
    </div>`;
  }

  private renderCreate(): TemplateResult | typeof nothing {
    if (!this.canCreate) return nothing;
    const strings = this.strings;
    if (!this.formOpen) {
      return html`<div class="mb-3 d-flex flex-wrap align-items-center gap-2">
        <button
          type="button"
          class="btn btn-primary"
          ?disabled=${this.limitReached || this.creating}
          @click=${() => this.setCreateOpen(true)}
        >
          ${renderIcon('fa-solid fa-plus', { class: 'me-1' })}${strings.create}
        </button>
        ${
          this.limitReached
            ? html`<span class="small text-body-secondary"
                >${strings.limitReached.replace('{max}', String(this.maxCredentials))}</span
              >`
            : nothing
        }
      </div>`;
    }

    return html`<div class="card mb-3">
      <div class="card-header">${strings.createTitle}</div>
      <lia-form
        no-submit
        ?busy=${this.creating}
        .definition=${this.definition}
        @lia-submit=${(event: CustomEvent<FormSubmitDetail>) => this.onSubmit(event)}
      ></lia-form>
      <div class="card-footer d-flex justify-content-end gap-2">
        <button
          type="button"
          class="btn btn-outline-secondary"
          ?disabled=${this.creating}
          @click=${() => this.setCreateOpen(false)}
        >
          ${strings.cancel}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          ?disabled=${this.creating}
          @click=${() => this.submitCreate()}
        >
          ${strings.create}
        </button>
      </div>
    </div>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    return html`<div
      class="lia-api-keys-panel"
      @lia-action=${(event: CustomEvent<ActionEventDetail<CredentialEntry>>) =>
        this.onAction(event)}
    >
      ${
        this.title
          ? html`<div class="mb-2">
              <h2 class="h5 mb-1 d-flex align-items-center gap-1">
                ${renderIcon(this.icon)}<span>${this.title}</span>
              </h2>
              ${
                this.description
                  ? html`<p class="text-body-secondary small mb-0">${this.description}</p>`
                  : nothing
              }
            </div>`
          : this.description
            ? html`<p class="text-body-secondary small">${this.description}</p>`
            : nothing
      }
      ${this.renderSecret()}${this.renderCreate()}
      <lia-table
        ?loading=${this.loading}
        caption=${strings.title}
        empty-icon="fa-solid fa-key"
        .listing=${this.buildListing()}
        .format=${{ neverText: strings.never }}
      ></lia-table>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-api-keys-panel': LiaApiKeysPanel;
  }
}
