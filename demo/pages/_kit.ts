/**
 * The demo's own presentation helpers.
 *
 * Every page module in `demo/pages/` is written with these three functions, so
 * the whole gallery reads the same way:
 *
 * ```ts
 * import { example, section } from './_kit.js';
 *
 * export const tableRoutes: DemoRoute[] = [
 *   {
 *     path: '/table/listing',
 *     title: 'Listing',
 *     group: 'table',
 *     icon: 'fa-solid fa-table',
 *     description: 'A TableListing rendered by <lia-table>.',
 *     render: () => section(
 *       'Listing',
 *       'One object in, a sortable, paged table out.',
 *       example(
 *         'Basic listing',
 *         html`<lia-table .listing=${userListing()}></lia-table>`,
 *         dedent`
 *           html\`<lia-table .listing=\${listing}></lia-table>\`
 *         `,
 *       ),
 *     ),
 *   },
 * ];
 * ```
 *
 * ### What the page does *not* have to render
 *
 * The application shell and the page heading come from `demo/app.ts`, built
 * from the route's `title`, `icon` and `description`. A page's `render()`
 * returns the **body** only — normally one or more {@link section}s.
 *
 * ### Layout contract
 *
 * - {@link section} — a titled block with a description and a vertical stack of
 *   examples. Anchored by an auto-generated id so it can be deep-linked.
 * - {@link example} — one live sample in a card, with an optional collapsible
 *   source snippet rendered by `<lia-code-block>`.
 * - {@link stack} / {@link cluster} / {@link split} — the three arrangements an
 *   example body ever needs.
 *
 * Supporting bits: {@link dedent} for readable snippets, {@link note} for a
 * short aside, {@link propTable} for a quick property reference and
 * {@link slug} for stable anchors.
 */

import { html, nothing, type TemplateResult } from 'lit';
import type { IconName, Variant } from '@liasoft/lit-ui';
import '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Text helpers
 * ------------------------------------------------------------------ */

/**
 * A URL-safe anchor fragment for a heading.
 *
 * @example
 * ```ts
 * slug('Cell renderers & formats'); // → 'cell-renderers-formats'
 * ```
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strip the common leading indentation from a template literal, so a snippet
 * can be written at the indentation level of the code around it.
 *
 * Usable as a tagged template (`` dedent`…` ``) or as a plain function.
 *
 * @example
 * ```ts
 * const code = dedent`
 *   html\`<lia-badge text="new" variant="success"></lia-badge>\`
 * `;
 * ```
 */
export function dedent(input: TemplateStringsArray | string, ...values: unknown[]): string {
  const raw =
    typeof input === 'string'
      ? input
      : input.reduce((acc, part, index) => acc + part + (index < values.length ? String(values[index]) : ''), '');

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  let indent = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.trim() === '') continue;
    indent = Math.min(indent, line.length - line.trimStart().length);
  }
  if (!Number.isFinite(indent)) indent = 0;

  return lines.map((line) => line.slice(indent)).join('\n');
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

/** Options of {@link section}. */
export interface SectionOptions {
  /** Anchor id. Defaults to the slugified title. */
  id?: string;
  /** Icon before the heading. */
  icon?: IconName;
  /** Heading level. Defaults to `2` — the page heading is the `h1`. */
  level?: 2 | 3;
  /** Bootstrap gap step between the children. Defaults to `4`. */
  gap?: number;
}

/**
 * A titled block of a demo page: a heading, a line of prose, and the examples
 * stacked underneath.
 *
 * `content` may be a single template, an array of them, or anything else Lit
 * can render — the usual shape is an array of {@link example} results.
 *
 * @example
 * ```ts
 * section('Variants', 'Every Bootstrap contextual colour.', [
 *   example('Solid', html`<lia-badge text="Active" variant="success"></lia-badge>`),
 *   example('Outline', html`<lia-badge text="Draft" variant="secondary" outline></lia-badge>`),
 * ]);
 * ```
 */
export function section(
  title: string,
  description: string,
  content: unknown,
  options: SectionOptions = {}
): TemplateResult {
  const id = options.id ?? slug(title);
  const gap = options.gap ?? 4;
  const heading = html`${options.icon
    ? html`<i class="${options.icon} text-body-secondary me-2" aria-hidden="true"></i>`
    : nothing}${title}`;

  return html`
    <section class="demo-section mb-5" id=${id} aria-labelledby="${id}-title">
      <div class="demo-section-head mb-3">
        ${options.level === 3
          ? html`<h3 class="h5 mb-1" id="${id}-title">${heading}</h3>`
          : html`<h2 class="h4 mb-1" id="${id}-title">${heading}</h2>`}
        ${description
          ? html`<p class="text-body-secondary mb-0 demo-section-lead">${description}</p>`
          : nothing}
      </div>
      <div class="vstack gap-${gap}">${content}</div>
    </section>
  `;
}

/* ------------------------------------------------------------------ *
 * Examples
 * ------------------------------------------------------------------ */

/** Options of {@link example}. */
export interface ExampleOptions {
  /** A line under the example's title. */
  description?: string;
  /** Language tag of the snippet. Defaults to `ts`. */
  language?: string;
  /** File name shown on the snippet's header. */
  filename?: string;
  /** Start with the snippet expanded. */
  openCode?: boolean;
  /** Label of the disclosure. Defaults to `Source`. */
  codeLabel?: string;
  /** Extra classes on the card body — `p-0` for a full-bleed sample. */
  bodyClass?: string;
  /** Contextual tint of the card border and header. */
  variant?: Variant;
  /** Anchor id. Defaults to the slugified title. */
  id?: string;
}

/**
 * One live sample: a card with a header, the rendered component, and — when a
 * snippet is supplied — a collapsed `<details>` holding the source.
 *
 * The disclosure is a native `<details>`/`<summary>` pair on purpose: it is
 * keyboard-operable and findable by the browser's in-page search without a
 * single line of JavaScript. The snippet itself is a `<lia-code-block>`, so it
 * arrives with a copy button, a line gutter and a wrap toggle.
 *
 * @example
 * ```ts
 * example(
 *   'Dismissible',
 *   html`<lia-alert variant="warning" message="Disk is nearly full." dismissible></lia-alert>`,
 *   dedent`
 *     html\`<lia-alert variant="warning" message="Disk is nearly full." dismissible></lia-alert>\`
 *   `,
 * );
 * ```
 *
 * @example
 * ```ts
 * // A sample that brings its own padding (a table, a shell, a full page).
 * example('Listing', html`<lia-table .listing=${listing}></lia-table>`, undefined, {
 *   bodyClass: 'p-0',
 * });
 * ```
 */
export function example(
  title: string,
  content: unknown,
  code?: string,
  options: ExampleOptions = {}
): TemplateResult {
  const id = options.id ?? (title ? `example-${slug(title)}` : undefined);
  const border = options.variant ? `border-${options.variant}` : '';
  const bodyClass = options.bodyClass ?? 'p-3 p-lg-4';

  return html`
    <article class="card demo-example ${border}" id=${id ?? nothing}>
      ${title
        ? html`<header class="card-header bg-body-tertiary d-flex flex-wrap align-items-baseline gap-2">
            <h3 class="h6 mb-0 flex-grow-1">${title}</h3>
            ${options.description
              ? html`<span class="small text-body-secondary">${options.description}</span>`
              : nothing}
          </header>`
        : nothing}
      <div class="card-body demo-example-body ${bodyClass}">${content}</div>
      ${code
        ? html`<details class="demo-example-code border-top" ?open=${options.openCode === true}>
            <summary class="px-3 py-2 small text-body-secondary">
              <i class="fa-solid fa-code me-2" aria-hidden="true"></i
              >${options.codeLabel ?? 'Source'}
            </summary>
            <div class="px-3 pb-3">
              <lia-code-block
                .code=${code}
                language=${options.language ?? 'ts'}
                filename=${options.filename ?? ''}
                label="${title || 'Example'} source"
                max-height="30rem"
                wrap-toggle
              ></lia-code-block>
            </div>
          </details>`
        : nothing}
    </article>
  `;
}

/* ------------------------------------------------------------------ *
 * Arrangement
 * ------------------------------------------------------------------ */

/**
 * A vertical stack — the default arrangement inside an example body.
 *
 * @example
 * ```ts
 * example('Sizes', stack(html`<lia-spinner size="sm"></lia-spinner>`, html`<lia-spinner></lia-spinner>`));
 * ```
 */
export function stack(...children: unknown[]): TemplateResult {
  return html`<div class="vstack gap-3">${children}</div>`;
}

/**
 * A wrapping horizontal row — for rows of buttons, badges and chips.
 *
 * @example
 * ```ts
 * cluster(...variants.map((v) => html`<lia-button label=${v} variant=${v}></lia-button>`));
 * ```
 */
export function cluster(...children: unknown[]): TemplateResult {
  return html`<div class="d-flex flex-wrap align-items-center gap-2">${children}</div>`;
}

/**
 * Two equal columns that stack below `md` — for before/after comparisons.
 *
 * @example
 * ```ts
 * split(html`<lia-card title="Light"></lia-card>`, html`<lia-card title="Dark"></lia-card>`);
 * ```
 */
export function split(left: unknown, right: unknown): TemplateResult {
  return html`<div class="row g-3">
    <div class="col-12 col-md-6">${left}</div>
    <div class="col-12 col-md-6">${right}</div>
  </div>`;
}

/**
 * A responsive grid of equal cells.
 *
 * @example
 * ```ts
 * grid(3, cards.map((card) => html`<lia-stat-card .data=${card}></lia-stat-card>`));
 * ```
 *
 * @param columns cells per row from the `lg` breakpoint up (1–6).
 */
export function grid(columns: number, children: unknown): TemplateResult {
  const lg = Math.min(6, Math.max(1, Math.round(columns)));
  const md = lg > 2 ? 2 : lg;
  return html`<div class="row row-cols-1 row-cols-md-${md} row-cols-lg-${lg} g-3">
    ${children}
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Prose
 * ------------------------------------------------------------------ */

/**
 * A short aside inside a page — a caveat, a pointer, a design note.
 *
 * @example
 * ```ts
 * note('Light DOM only: the kit never uses shadow roots.', 'info');
 * ```
 */
export function note(
  content: unknown,
  variant: Variant = 'info',
  icon: IconName = 'fa-solid fa-circle-info'
): TemplateResult {
  return html`<div class="alert alert-${variant} d-flex gap-2 align-items-baseline" role="note">
    <i class="${icon} flex-shrink-0" aria-hidden="true"></i>
    <div>${content}</div>
  </div>`;
}

/** One row of a {@link propTable}. */
export interface PropRow {
  /** Property or attribute name. */
  name: string;
  /** TypeScript type, rendered as code. */
  type?: string;
  /** Default value, rendered as code. */
  default?: string;
  /** What it does. */
  description: string;
}

/**
 * A compact property reference for the element an example demonstrates.
 *
 * @example
 * ```ts
 * propTable([
 *   { name: 'variant', type: 'Variant', default: "'primary'", description: 'Contextual colour.' },
 *   { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction.' },
 * ]);
 * ```
 */
export function propTable(rows: readonly PropRow[], caption = 'Properties'): TemplateResult {
  return html`<div class="table-responsive">
    <table class="table table-sm align-middle mb-0 demo-prop-table">
      <caption class="visually-hidden">${caption}</caption>
      <thead>
        <tr>
          <th scope="col">Property</th>
          <th scope="col">Type</th>
          <th scope="col">Default</th>
          <th scope="col">Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (row) => html`<tr>
            <th scope="row" class="fw-semibold text-nowrap"><code>${row.name}</code></th>
            <td class="text-body-secondary">
              ${row.type ? html`<code>${row.type}</code>` : html`&mdash;`}
            </td>
            <td class="text-body-secondary">
              ${row.default ? html`<code>${row.default}</code>` : html`&mdash;`}
            </td>
            <td>${row.description}</td>
          </tr>`
        )}
      </tbody>
    </table>
  </div>`;
}

/**
 * The list of events an element emits — the second half of a property table.
 *
 * @example
 * ```ts
 * eventList([['lia-action', 'A toolbar button was pressed.']]);
 * ```
 */
export function eventList(events: ReadonlyArray<readonly [string, string]>): TemplateResult {
  return html`<dl class="row mb-0 small">
    ${events.map(
      ([name, description]) => html`
        <dt class="col-sm-4 col-lg-3 text-truncate"><code>${name}</code></dt>
        <dd class="col-sm-8 col-lg-9 mb-2">${description}</dd>
      `
    )}
  </dl>`;
}
