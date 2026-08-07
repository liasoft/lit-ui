import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { renderActions } from '../primitives/render-action.js';
import '../primitives/lia-popover.js';
import '../primitives/lia-key-value.js';
import '../primitives/lia-copy-button.js';

/** Where an update check currently stands. */
export type UpdateState = 'unknown' | 'checking' | 'current' | 'available' | 'error';

/** Detail of `lia-update-check`, fired when the reader asks for a re-check. */
export interface UpdateCheckDetail {
  /** `true` when the reader explicitly asked to bypass any cached answer. */
  force: boolean;
}

declare global {
  interface HTMLElementEventMap {
    'lia-update-check': CustomEvent<UpdateCheckDetail>;
  }
}

/** Overridable strings of `<lia-update-panel>`. */
export interface UpdateLabels {
  unknown: string;
  checking: string;
  current: string;
  available: string;
  error: string;
}

/** English defaults for {@link UpdateLabels}. */
export const DEFAULT_UPDATE_LABELS: UpdateLabels = {
  unknown: 'Not checked yet',
  checking: 'Checking…',
  current: 'Up to date',
  available: 'Update available',
  error: 'Check failed',
};

const STATE_VARIANTS: Record<UpdateState, Variant> = {
  unknown: 'secondary',
  checking: 'secondary',
  current: 'success',
  available: 'warning',
  error: 'danger',
};

const STATE_ICONS: Record<UpdateState, IconName> = {
  unknown: 'fa-solid fa-circle-question',
  checking: 'fa-solid fa-arrows-rotate fa-spin',
  current: 'fa-solid fa-circle-check',
  available: 'fa-solid fa-circle-arrow-up',
  error: 'fa-solid fa-triangle-exclamation',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The "is this installation current?" widget: the running version, the version
 * available upstream, a state chip, the release notes behind a popover, and a
 * button that starts the update.
 *
 * Two shapes. `card` is the panel a settings or dashboard page shows; `inline`
 * is the compact version indicator that belongs in the top bar — an icon plus
 * the version number, with everything else in a popover, exactly like the
 * reference panel's navbar entry. Feed it to `<lia-app-shell>` through
 * `navExtra`.
 *
 * The component never checks anything itself: it renders the state you give it
 * and emits `lia-update-check` when the reader asks for a fresh look. Set
 * `state="checking"` while your request is in flight.
 *
 * @example
 * ```ts
 * html`<lia-update-panel
 *   state=${state}
 *   current-version="2.4.1"
 *   latest-version="2.5.0"
 *   channel="stable"
 *   last-checked="2026-08-07 09:12"
 *   message="Version 2.5.0 is available."
 *   .changelog=${'<ul><li>Faster startup</li></ul>'}
 *   action-label="Open the updater"
 *   action-href="/updater"
 *   @lia-update-check=${() => recheck()}
 * ></lia-update-panel>`
 * ```
 *
 * @example
 * ```html
 * <lia-update-panel layout="inline" state="current" current-version="2.4.1"></lia-update-panel>
 * ```
 */
@customElement('lia-update-panel')
export class LiaUpdatePanel extends LiaElement {
  /** Where the check stands. */
  @property({ type: String }) state: UpdateState = 'unknown';

  /** `card` for a panel, `inline` for the compact top-bar indicator. */
  @property({ type: String }) layout: 'card' | 'inline' = 'card';

  /** The version that is running. */
  @property({ type: String, attribute: 'current-version' }) currentVersion = '';

  /** The newest version available upstream. */
  @property({ type: String, attribute: 'latest-version' }) latestVersion = '';

  /** Release channel, e.g. `stable` or `testing`. */
  @property({ type: String }) channel = '';

  /** Schema/database revision, when it is tracked separately. */
  @property({ type: String, attribute: 'database-version' }) databaseVersion = '';

  /** When the last check ran, already formatted for display. */
  @property({ type: String, attribute: 'last-checked' }) lastChecked = '';

  /** One-line summary; defaults to the state's own label. */
  @property({ type: String }) message = '';

  /** Release notes shown in the popover. Trusted HTML. */
  @property({ type: String }) changelog = '';

  /** Link to the full release notes. */
  @property({ type: String, attribute: 'changelog-url' }) changelogUrl = '';

  /** Label of the primary action; empty hides the button. */
  @property({ type: String, attribute: 'action-label' }) actionLabel = '';

  /** Target of the primary action. Without it the action emits `lia-action`. */
  @property({ type: String, attribute: 'action-href' }) actionHref = '';

  /** Icon of the primary action. */
  @property({ type: String, attribute: 'action-icon' }) actionIcon: IconName =
    'fa-solid fa-download';

  /**
   * A shell command offered instead of (or beside) the action button, for
   * installations that update from a terminal.
   */
  @property({ type: String }) command = '';

  /** Heading of the card. */
  @property({ type: String }) heading = 'Version';

  /** Hide the "check again" button. */
  @property({ type: Boolean, attribute: 'no-recheck' }) noRecheck = false;

  /** Overridable state labels. */
  @property({ attribute: false }) labels: UpdateLabels = DEFAULT_UPDATE_LABELS;

  @property({ type: String, attribute: 'version-label' }) versionLabel = 'Installed version';

  @property({ type: String, attribute: 'latest-label' }) latestLabel = 'Latest version';

  @property({ type: String, attribute: 'channel-label' }) channelLabel = 'Channel';

  @property({ type: String, attribute: 'database-label' }) databaseLabel = 'Database revision';

  @property({ type: String, attribute: 'last-checked-label' }) lastCheckedLabel = 'Last checked';

  @property({ type: String, attribute: 'recheck-label' }) recheckLabel = 'Check again';

  @property({ type: String, attribute: 'changelog-label' }) changelogLabel = "What's new";

  @property({ type: String, attribute: 'command-label' }) commandLabel =
    'Run this command to update:';

  @property({ type: String, attribute: 'copy-label' }) copyLabel = 'Copy the command';

  /** Bootstrap contextual colour of the current state. */
  get variant(): Variant {
    return STATE_VARIANTS[this.state];
  }

  /** Icon of the current state. */
  get icon(): IconName {
    return STATE_ICONS[this.state];
  }

  /** The state's label, or the caller's `message` when there is one. */
  get statusText(): string {
    return this.labels[this.state];
  }

  /** Ask the host for a fresh check. */
  check(force = true): void {
    this.emit<UpdateCheckDetail>('lia-update-check', { force });
  }

  private get primaryAction(): ActionDescriptor | undefined {
    if (!this.actionLabel) return undefined;
    return {
      id: 'update',
      label: this.actionLabel,
      icon: this.actionIcon,
      href: this.actionHref || undefined,
      variant: this.state === 'available' ? 'warning' : 'outline-secondary',
    };
  }

  private renderRecheck(): TemplateResult | typeof nothing {
    if (this.noRecheck) return nothing;
    return html`<button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      title=${this.recheckLabel}
      aria-label=${this.recheckLabel}
      ?disabled=${this.state === 'checking'}
      @click=${() => this.check(true)}
    >
      <i
        class=${cx('fa-solid fa-arrows-rotate', this.state === 'checking' && 'fa-spin')}
        aria-hidden="true"
      ></i>
    </button>`;
  }

  private renderChangelogButton(): TemplateResult | typeof nothing {
    if (!this.changelog && !this.changelogUrl) return nothing;
    const button = html`<button type="button" class="btn btn-sm btn-outline-secondary">
      <i class="fa-solid fa-list-ul me-1" aria-hidden="true"></i>${this.changelogLabel}
    </button>`;
    if (!this.changelog) {
      return html`<a
        class="btn btn-sm btn-outline-secondary"
        href=${this.changelogUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <i class="fa-solid fa-list-ul me-1" aria-hidden="true"></i>${this.changelogLabel}
      </a>`;
    }
    return html`<lia-popover
      heading=${this.changelogLabel}
      trigger="focus click"
      placement="bottom"
      html
      .content=${this.changelog}
      >${button}</lia-popover
    >`;
  }

  /** The detail rows of the card, skipping the ones that were not supplied. */
  private get details(): Array<[string, string]> {
    const rows: Array<[string, string]> = [];
    if (this.currentVersion) rows.push([this.versionLabel, this.currentVersion]);
    if (this.latestVersion) rows.push([this.latestLabel, this.latestVersion]);
    if (this.channel) rows.push([this.channelLabel, this.channel]);
    if (this.databaseVersion) rows.push([this.databaseLabel, this.databaseVersion]);
    if (this.lastChecked) rows.push([this.lastCheckedLabel, this.lastChecked]);
    return rows;
  }

  /** The popover body of the inline layout, as trusted HTML. */
  get popoverContent(): string {
    const rows = this.details
      .map(
        ([label, value]) =>
          `<div class="d-flex justify-content-between gap-3"><div class="fw-semibold">${escapeHtml(
            label
          )}</div><div>${escapeHtml(value)}</div></div>`
      )
      .join('');
    const message = this.message
      ? `<p class="mb-2">${escapeHtml(this.message)}</p>`
      : `<p class="mb-2">${escapeHtml(this.statusText)}</p>`;
    const changelog = this.changelog ? `<hr>${this.changelog}` : '';
    const action =
      this.actionLabel && this.actionHref
        ? `<a class="btn btn-sm btn-${this.variant} d-block mt-2" href="${escapeHtml(
            this.actionHref
          )}">${escapeHtml(this.actionLabel)}</a>`
        : '';
    const command = this.command
      ? `<p class="mb-1 mt-2">${escapeHtml(this.commandLabel)}</p><code>${escapeHtml(
          this.command
        )}</code>`
      : '';
    return `${message}${rows}${changelog}${command}${action}`;
  }

  private renderInline(): TemplateResult {
    return html`<lia-popover
      heading=${this.heading}
      trigger="hover focus click"
      placement="bottom"
      container="body"
      html
      .content=${this.popoverContent}
    >
      <span
        class=${cx('nav-link', 'd-inline-flex', 'align-items-center', 'gap-1', `text-${this.variant}`)}
        role="button"
        tabindex="0"
        aria-label=${`${this.heading}: ${this.statusText}`}
      >
        <i class=${this.icon} aria-hidden="true"></i>
        <span class="d-none d-xl-inline">${this.currentVersion}</span>
      </span>
    </lia-popover>`;
  }

  private renderCard(): TemplateResult {
    const details = this.details;
    const action = this.primaryAction;
    return html`<div class=${cx('card', 'lia-update-panel', `border-${this.variant}`)}>
      <div class="card-body d-flex align-items-start gap-3">
        <i class=${cx(this.icon, 'fa-2x', `text-${this.variant}`)} aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-items-center flex-wrap gap-2">
            <span class="fw-semibold">${this.heading}</span>
            <span class=${cx('badge', `text-bg-${this.variant}`)} role="status"
              >${this.statusText}</span
            >
          </div>
          ${this.message
            ? html`<p class="text-body-secondary mb-0">${renderRich(this.message)}</p>`
            : nothing}
        </div>
        <div class="d-flex flex-wrap gap-2 flex-shrink-0">
          ${this.renderChangelogButton()}
          ${action
            ? renderActions([action], { host: this, size: 'sm' })
            : nothing}${this.renderRecheck()}
        </div>
      </div>
      ${details.length
        ? html`<ul class="list-group list-group-flush">
            ${details.map(
              ([label, value]) =>
                html`<lia-key-value .label=${label} .value=${value}></lia-key-value>`
            )}
          </ul>`
        : nothing}
      ${this.command
        ? html`<div class="card-body border-top">
            <p class="mb-1 small text-body-secondary">${this.commandLabel}</p>
            <div class="d-flex align-items-start gap-2">
              <code class="lia-update-command flex-grow-1 p-2">${this.command}</code>
              <lia-copy-button .text=${this.command} .title=${this.copyLabel}></lia-copy-button>
            </div>
          </div>`
        : nothing}
    </div>`;
  }

  protected override render(): unknown {
    return this.layout === 'inline' ? this.renderInline() : this.renderCard();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-update-panel': LiaUpdatePanel;
  }
}
