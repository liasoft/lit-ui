import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName, Variant } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { renderIcon } from '../primitives/lia-icon.js';
import '../primitives/lia-copy-button.js';

/** What a single step of a generated configuration asks the operator to do. */
export type ConfigStepType = 'command' | 'file' | 'note';

/** One step of a generated configuration. */
export interface ConfigStep {
  /** Stable key; falls back to the position in the list. */
  id?: string;
  type: ConfigStepType;
  /** Heading of the step. Defaults to the type's generic label. */
  title?: string;
  /** Absolute path of the file a `file` step writes. */
  path?: string;
  /** The command line, the file body, or the note's text. */
  content: string;
  /** Explanation under the header. Trusted HTML. */
  description?: string;
  /** Language hint shown as a chip, e.g. `nginx`, `ini`, `bash`. */
  language?: string;
  /** Contextual colour of a `note`. Defaults to `info`. */
  variant?: Variant;
}

/** Options for {@link configStepsToText}. */
export interface ConfigTextOptions {
  /** Prefix of the generated comment lines. Defaults to `#`. */
  comment?: string;
  /** Include `note` steps as comments. Defaults to `true`. */
  includeNotes?: boolean;
}

const STEP_ICONS: Record<ConfigStepType, IconName> = {
  command: 'fa-solid fa-terminal',
  file: 'fa-regular fa-file-code',
  note: 'fa-solid fa-circle-info',
};

/**
 * Flatten a list of steps into one copyable block: commands verbatim, files
 * preceded by a comment naming their path, notes as comments.
 *
 * @example
 * ```ts
 * const script = configStepsToText(steps);
 * ```
 */
export function configStepsToText(
  steps: readonly ConfigStep[],
  options: ConfigTextOptions = {}
): string {
  const comment = options.comment ?? '#';
  const parts: string[] = [];
  for (const step of steps) {
    if (step.type === 'note') {
      if (options.includeNotes === false) continue;
      parts.push(
        step.content
          .split('\n')
          .map((line) => `${comment} ${line}`.trimEnd())
          .join('\n')
      );
      continue;
    }
    if (step.type === 'file') {
      parts.push(`${comment} ${step.path ?? step.title ?? 'file'}\n${step.content}`);
      continue;
    }
    parts.push(step.content);
  }
  return parts.join('\n\n');
}

/**
 * The output half of a configuration generator: an ordered list of steps, each
 * one either a shell command to run, a file to create, or a note to read.
 *
 * Every step can be copied on its own, and the header offers a "copy
 * everything" button that produces a single pasteable script — commands
 * verbatim, file bodies preceded by a comment naming their path.
 *
 * File steps show the path as a monospace header plus an optional "open it
 * with" hint (`editor="nano"` renders `nano /etc/…`), then the body in a
 * scrollable, syntax-neutral `<pre>`. Nothing here knows or cares what the
 * configured software is.
 *
 * @example
 * ```ts
 * html`<lia-config-viewer
 *   title="Apply this configuration"
 *   description="Run every step as <strong>root</strong>, in order."
 *   editor="nano"
 *   .steps=${[
 *     { type: 'note', content: 'Stop the service before you start.' },
 *     { type: 'command', content: 'systemctl stop example' },
 *     {
 *       type: 'file',
 *       path: '/etc/example/example.conf',
 *       language: 'ini',
 *       content: '[core]\nlisten = 0.0.0.0:8080\n',
 *     },
 *     { type: 'command', title: 'Reload', content: 'systemctl start example' },
 *   ]}
 * ></lia-config-viewer>`
 * ```
 */
@customElement('lia-config-viewer')
export class LiaConfigViewer extends LiaElement {
  /** The steps to show, in the order they must be performed. */
  @property({ attribute: false }) steps: ConfigStep[] = [];

  /**
   * Heading above the list.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = '';

  /** Line under the heading. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Drop the step numbers — for a list whose order does not matter. */
  @property({ type: Boolean, attribute: 'no-numbers' }) noNumbers = false;

  /** Hide the "copy everything" button. */
  @property({ type: Boolean, attribute: 'no-copy-all' }) noCopyAll = false;

  /**
   * Editor suggested in a file step's hint, e.g. `nano`. Empty renders the
   * generic hint instead.
   */
  @property({ type: String }) editor = '';

  /** Maximum height of a content block, as a CSS length. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '24rem';

  /** Comment marker used by the "copy everything" text. */
  @property({ type: String, attribute: 'comment-marker' }) commentMarker = '#';

  /* -- overridable strings ---------------------------------------------- */

  @property({ type: String, attribute: 'copy-all-label' }) copyAllLabel = 'Copy everything';

  @property({ type: String, attribute: 'copy-label' }) copyLabel = 'Copy to clipboard';

  @property({ type: String, attribute: 'copied-label' }) copiedLabel = 'Copied';

  /** Default heading of a `command` step. */
  @property({ type: String, attribute: 'command-label' }) commandLabel = 'Run this command';

  /** Hint under a command step. Empty removes it. */
  @property({ type: String, attribute: 'command-hint' }) commandHint =
    'Run this on the target host, as an administrator.';

  /** Default heading of a `file` step. */
  @property({ type: String, attribute: 'file-label' }) fileLabel = 'Create this file';

  /** Hint under a file step when no {@link editor} is configured. */
  @property({ type: String, attribute: 'file-hint' }) fileHint =
    'Create the file with exactly this content.';

  /** Default heading of a `note` step. */
  @property({ type: String, attribute: 'note-label' }) noteLabel = 'Note';

  /** Accessible name of the step list. */
  @property({ type: String, attribute: 'list-label' }) listLabel = 'Configuration steps';

  @property({ type: String, attribute: 'empty-message' }) emptyMessage =
    'There is nothing to configure.';

  private readonly instanceId = uid('lia-config');

  /** Everything in one pasteable block — what "copy everything" puts on the clipboard. */
  get fullText(): string {
    return configStepsToText(this.steps, { comment: this.commentMarker });
  }

  private stepHeading(step: ConfigStep): string {
    if (step.title) return step.title;
    if (step.type === 'command') return this.commandLabel;
    if (step.type === 'file') return this.fileLabel;
    return this.noteLabel;
  }

  private stepHint(step: ConfigStep): string {
    if (step.type === 'command') return this.commandHint;
    if (step.type !== 'file') return '';
    if (this.editor && step.path) return `${this.editor} ${step.path}`;
    return this.fileHint;
  }

  private renderContent(step: ConfigStep, index: number): TemplateResult {
    const id = `${this.stepKey(step, index)}-content`;
    return html`<pre
      id=${id}
      class="lia-config-content mb-0 p-3"
      style=${this.maxHeight ? `max-height:${this.maxHeight}` : nothing}
      tabindex="0"
    ><code class=${cx(step.language && `language-${step.language}`)}>${step.content}</code></pre>`;
  }

  /** DOM id of a step's content block — stable enough to deep-link to. */
  stepKey(step: ConfigStep, index: number): string {
    return `${this.instanceId}-${step.id ?? index + 1}`;
  }

  private renderStep(step: ConfigStep, index: number): TemplateResult {
    const heading = this.stepHeading(step);
    const hint = this.stepHint(step);

    if (step.type === 'note') {
      return html`<li class="lia-config-step mb-3">
        <div class="alert alert-${step.variant ?? 'info'} mb-0" role="note">
          <span class="fw-semibold d-block">
            ${renderIcon(STEP_ICONS.note, { class: 'me-1' })}${heading}
          </span>
          <span>${renderRich(step.content)}</span>
        </div>
      </li>`;
    }

    return html`<li class="lia-config-step card mb-3">
      <div class="card-header d-flex align-items-center gap-2 flex-wrap">
        ${this.noNumbers
          ? nothing
          : html`<span class="lia-config-step-number badge rounded-pill text-bg-secondary"
              >${index + 1}</span
            >`}
        ${renderIcon(STEP_ICONS[step.type], { class: 'text-body-secondary' })}
        <span class="fw-semibold">${heading}</span>
        ${step.path
          ? html`<code class="lia-config-path text-body-emphasis">${step.path}</code>`
          : nothing}
        ${step.language
          ? html`<span class="badge text-bg-light text-uppercase">${step.language}</span>`
          : nothing}
        <span class="ms-auto">
          <lia-copy-button
            .text=${step.content}
            .title=${this.copyLabel}
            .copiedTitle=${this.copiedLabel}
          ></lia-copy-button>
        </span>
      </div>
      ${step.description || hint
        ? html`<div class="card-body py-2">
            ${step.description
              ? html`<p class="mb-0 text-body-secondary">${renderRich(step.description)}</p>`
              : nothing}
            ${hint ? html`<p class="mb-0 small text-body-secondary">${hint}</p>` : nothing}
          </div>`
        : nothing}
      ${this.renderContent(step, index)}
    </li>`;
  }

  protected override render(): unknown {
    const steps = this.steps;
    const hasHeader = Boolean(this.title || this.description || (!this.noCopyAll && steps.length));

    return html`<div class="lia-config-viewer">
      ${hasHeader
        ? html`<div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              ${this.title ? html`<h2 class="h5 mb-1">${this.title}</h2>` : nothing}
              ${this.description
                ? html`<p class="text-body-secondary mb-0">${renderRich(this.description)}</p>`
                : nothing}
            </div>
            ${this.noCopyAll || steps.length === 0
              ? nothing
              : html`<lia-copy-button
                  class="flex-shrink-0"
                  .text=${this.fullText}
                  .label=${this.copyAllLabel}
                  .title=${this.copyAllLabel}
                  .copiedTitle=${this.copiedLabel}
                  variant="outline-primary"
                  icon="fa-solid fa-clipboard-list"
                ></lia-copy-button>`}
          </div>`
        : nothing}
      ${steps.length === 0
        ? html`<p class="text-body-secondary fst-italic mb-0">${this.emptyMessage}</p>`
        : html`<ol class="lia-config-steps list-unstyled mb-0" aria-label=${this.listLabel}>
            ${steps.map((step, index) => this.renderStep(step, index))}
          </ol>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-config-viewer': LiaConfigViewer;
  }
}
