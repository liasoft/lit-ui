import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, uid } from '../../core/utils.js';
import type { IconName, Variant } from '../../core/types.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** One node of the tree. */
export interface TreeNode {
  /** Identity — must be unique across the whole tree. */
  id: string;
  label: string;
  /** Icon-font class. Falls back to the folder/file icons of the element. */
  icon?: IconName;
  children?: TreeNode[];
  /** Trailing muted text — a size, a count, a status. */
  meta?: string;
  /** Badge shown after the label. */
  badge?: { text: string | number; variant?: Variant };
  /** Not selectable. */
  disabled?: boolean;
  /**
   * Show the expand affordance even though `children` is empty — for trees
   * whose branches are fetched when they are first opened.
   */
  expandable?: boolean;
}

/** Every string `<lia-file-tree>` renders on its own behalf. */
export interface FileTreeLabels {
  tree: string;
  expand: string;
  collapse: string;
  filter: string;
  filterPlaceholder: string;
  clearFilter: string;
  empty: string;
  noMatches: string;
}

/** The defaults behind {@link LiaFileTree.labels}. */
export const DEFAULT_FILE_TREE_LABELS: Readonly<FileTreeLabels> = Object.freeze({
  tree: 'Tree',
  expand: 'Expand',
  collapse: 'Collapse',
  filter: 'Filter the tree',
  filterPlaceholder: 'Filter…',
  clearFilter: 'Clear the filter',
  empty: 'Nothing to show.',
  noMatches: 'No entry matches the filter.',
});

/** Detail of `lia-tree-select`. */
export interface TreeSelectDetail {
  id: string;
  node: TreeNode;
}

/** Detail of `lia-tree-toggle`. */
export interface TreeToggleDetail {
  id: string;
  node: TreeNode;
  expanded: boolean;
}

declare global {
  interface HTMLElementEventMap {
    'lia-tree-select': CustomEvent<TreeSelectDetail>;
    'lia-tree-toggle': CustomEvent<TreeToggleDetail>;
  }
}

/** A node flattened into the list the keyboard walks. */
interface TreeRow {
  node: TreeNode;
  /** 1-based, as `aria-level` wants it. */
  level: number;
  parentId?: string;
  hasChildren: boolean;
  /** Position among its siblings, 1-based. */
  position: number;
  siblings: number;
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * A collapsible tree for hierarchical data — file systems, configuration
 * sections, zones, org units, anything nested.
 *
 * It follows the ARIA tree pattern properly: one tab stop for the whole tree,
 * a roving focus inside it, and full keyboard operation — arrows to move,
 * <kbd>→</kbd>/<kbd>←</kbd> to open and close a branch or hop to its parent,
 * <kbd>Home</kbd>/<kbd>End</kbd> for the ends, <kbd>Enter</kbd> or
 * <kbd>Space</kbd> to select.
 *
 * Expansion can be left to the element or driven from outside through
 * `expandedIds`; `expandable` marks a branch whose children arrive later, so
 * `lia-tree-toggle` is the hook for lazy loading.
 *
 * @example
 * ```ts
 * html`<lia-file-tree
 *   .nodes=${[
 *     { id: 'etc', label: 'etc', children: [{ id: 'etc/app.conf', label: 'app.conf', meta: '2 KiB' }] },
 *     { id: 'var', label: 'var', expandable: true },
 *   ]}
 *   .expandedIds=${['etc']}
 *   selected-id="etc/app.conf"
 *   filterable
 *   @lia-tree-select=${(e: CustomEvent) => open(e.detail.node)}
 *   @lia-tree-toggle=${(e: CustomEvent) => e.detail.expanded && load(e.detail.id)}
 * ></lia-file-tree>`;
 * ```
 *
 * @example
 * ```html
 * <lia-file-tree label="Configuration" max-height="24rem"></lia-file-tree>
 * ```
 */
@customElement('lia-file-tree')
export class LiaFileTree extends LiaElement {
  /** The roots of the tree. */
  @property({ attribute: false }) nodes: TreeNode[] = [];

  /** The selected node. */
  @property({ type: String, attribute: 'selected-id' }) selectedId = '';

  /**
   * Expanded branches. Leave unset to let the element own expansion; set it to
   * drive expansion from outside (it is then never mutated internally).
   */
  @property({ attribute: false }) expandedIds?: string[];

  /** Accessible name of the tree. */
  @property({ type: String }) label = '';

  /** Show a filter box above the tree. */
  @property({ type: Boolean }) filterable = false;

  /** The filter text. Seeds the box; the element owns it afterwards. */
  @property({ type: String }) filter = '';

  /** Icon for a closed branch. */
  @property({ type: String, attribute: 'folder-icon' }) folderIcon: IconName = 'fa-solid fa-folder';

  /** Icon for an open branch. */
  @property({ type: String, attribute: 'folder-open-icon' })
  folderOpenIcon: IconName = 'fa-solid fa-folder-open';

  /** Icon for a leaf. */
  @property({ type: String, attribute: 'leaf-icon' }) leafIcon: IconName = 'fa-regular fa-file';

  /** Show the type icons at all. */
  @property({ converter: flag, attribute: 'show-icons' }) showIcons = true;

  /** Maximum height of the scroll area. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '';

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<FileTreeLabels> = {};

  @state() private openIds: string[] = [];
  @state() private query = '';
  @state() private focusedId = '';

  private readonly instanceId = uid('lia-tree');
  private focusAfterUpdate = false;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('filter')) this.query = this.filter;
  }

  override updated(): void {
    if (!this.focusAfterUpdate) return;
    this.focusAfterUpdate = false;
    this.querySelector<HTMLElement>(`#${CSS.escape(this.rowId(this.focusedId))}`)?.focus();
  }

  /** Ids of the branches currently open. */
  get expanded(): string[] {
    return [...(this.expandedIds ?? this.openIds)];
  }

  /** Open or close a branch by id. */
  toggle(id: string): void {
    const node = this.findNode(id);
    if (!node) return;
    const open = this.isExpanded(id);
    if (!this.expandedIds) {
      this.openIds = open ? this.openIds.filter((entry) => entry !== id) : [...this.openIds, id];
    }
    this.emit<TreeToggleDetail>('lia-tree-toggle', {
      id,
      node,
      expanded: !open,
    });
  }

  /** Select a node by id. */
  select(id: string): void {
    const node = this.findNode(id);
    if (!node || node.disabled) return;
    this.selectedId = id;
    this.emit<TreeSelectDetail>('lia-tree-select', { id, node });
  }

  /** Find a node anywhere in the tree. */
  findNode(id: string, nodes: readonly TreeNode[] = this.nodes): TreeNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      const hit = node.children ? this.findNode(id, node.children) : undefined;
      if (hit) return hit;
    }
    return undefined;
  }

  private get strings(): FileTreeLabels {
    return { ...DEFAULT_FILE_TREE_LABELS, ...this.labels };
  }

  private rowId(nodeId: string): string {
    return `${this.instanceId}-${nodeId}`;
  }

  private isExpanded(id: string): boolean {
    // While filtering, every surviving branch is open — otherwise the matches
    // the filter found would still be hidden behind a closed parent.
    if (this.query !== '') return true;
    return this.expanded.includes(id);
  }

  /** Keep matches and their ancestors; drop everything else. */
  private prune(nodes: readonly TreeNode[], needle: string): TreeNode[] {
    const out: TreeNode[] = [];
    for (const node of nodes) {
      if (node.label.toLowerCase().includes(needle)) {
        out.push(node);
        continue;
      }
      const children = node.children ? this.prune(node.children, needle) : [];
      if (children.length > 0) out.push({ ...node, children });
    }
    return out;
  }

  private get roots(): TreeNode[] {
    if (this.query === '') return this.nodes;
    return this.prune(this.nodes, this.query.toLowerCase());
  }

  /** Every node the reader can currently see, in visual order. */
  private rows(): TreeRow[] {
    const rows: TreeRow[] = [];
    const walk = (nodes: readonly TreeNode[], level: number, parentId?: string): void => {
      nodes.forEach((node, index) => {
        const children = node.children ?? [];
        const hasChildren = children.length > 0 || node.expandable === true;
        rows.push({
          node,
          level,
          parentId,
          hasChildren,
          position: index + 1,
          siblings: nodes.length,
        });
        if (children.length > 0 && this.isExpanded(node.id)) walk(children, level + 1, node.id);
      });
    };
    walk(this.roots, 1);
    return rows;
  }

  private moveFocus(rows: TreeRow[], id: string): void {
    if (!rows.some((row) => row.node.id === id)) return;
    this.focusedId = id;
    this.focusAfterUpdate = true;
    this.requestUpdate();
  }

  private onKeydown(event: KeyboardEvent, rows: TreeRow[]): void {
    const currentId = this.focusedId || rows[0]?.node.id || '';
    const index = rows.findIndex((row) => row.node.id === currentId);
    if (index === -1) return;
    const row = rows[index];

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (rows[index + 1]) this.moveFocus(rows, rows[index + 1].node.id);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (rows[index - 1]) this.moveFocus(rows, rows[index - 1].node.id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (row.hasChildren && !this.isExpanded(row.node.id)) this.toggle(row.node.id);
        else if (rows[index + 1]?.parentId === row.node.id)
          this.moveFocus(rows, rows[index + 1].node.id);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (row.hasChildren && this.isExpanded(row.node.id)) this.toggle(row.node.id);
        else if (row.parentId) this.moveFocus(rows, row.parentId);
        break;
      case 'Home':
        event.preventDefault();
        if (rows[0]) this.moveFocus(rows, rows[0].node.id);
        break;
      case 'End':
        event.preventDefault();
        if (rows[rows.length - 1]) this.moveFocus(rows, rows[rows.length - 1].node.id);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.select(row.node.id);
        break;
      default:
        break;
    }
  }

  private iconFor(node: TreeNode, hasChildren: boolean, open: boolean): IconName {
    if (node.icon) return node.icon;
    if (!hasChildren) return this.leafIcon;
    return open ? this.folderOpenIcon : this.folderIcon;
  }

  private renderNode(
    node: TreeNode,
    level: number,
    position: number,
    siblings: number,
    activeId: string,
  ): TemplateResult {
    const strings = this.strings;
    const children = node.children ?? [];
    const hasChildren = children.length > 0 || node.expandable === true;
    const open = hasChildren && this.isExpanded(node.id);
    const selected = this.selectedId === node.id;
    const focusable = node.id === activeId;

    return html`<li
      class="lia-tree-item"
      id=${this.rowId(node.id)}
      role="treeitem"
      aria-level=${level}
      aria-posinset=${position}
      aria-setsize=${siblings}
      aria-selected=${selected ? 'true' : 'false'}
      aria-expanded=${hasChildren ? (open ? 'true' : 'false') : nothing}
      aria-disabled=${node.disabled ? 'true' : nothing}
      tabindex=${focusable ? 0 : -1}
      @focus=${() => {
        this.focusedId = node.id;
      }}
    >
      <div
        class="lia-tree-row"
        @click=${(event: Event) => {
          event.stopPropagation();
          this.focusedId = node.id;
          this.select(node.id);
        }}
      >
        ${
          hasChildren
            ? html`<span
                class="lia-tree-toggle"
                aria-hidden="true"
                title=${open ? strings.collapse : strings.expand}
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.toggle(node.id);
                }}
                >${renderIcon(open ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right', {
                  size: 'xs',
                })}</span
              >`
            : html`<span class="lia-tree-toggle" aria-hidden="true"></span>`
        }
        ${
          this.showIcons
            ? renderIcon(this.iconFor(node, hasChildren, open), {
                fixedWidth: true,
                class: 'text-body-secondary',
              })
            : nothing
        }
        <span class="text-truncate">${node.label}</span>
        ${
          node.badge
            ? html`<span class="badge text-bg-${node.badge.variant ?? 'secondary'} ms-1"
                >${node.badge.text}</span
              >`
            : nothing
        }
        ${
          node.meta
            ? html`<span class="ms-auto ps-2 small text-body-secondary">${node.meta}</span>`
            : nothing
        }
      </div>
      ${
        open && children.length > 0
          ? html`<ul role="group">
              ${children.map((child, index) =>
                this.renderNode(child, level + 1, index + 1, children.length, activeId),
              )}
            </ul>`
          : nothing
      }
    </li>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    const roots = this.roots;
    const rows = this.rows();
    // Exactly one node carries `tabindex="0"`: the tree is a single tab stop.
    const activeId =
      this.focusedId && rows.some((row) => row.node.id === this.focusedId)
        ? this.focusedId
        : (rows[0]?.node.id ?? '');

    return html`<div class="lia-file-tree-wrapper">
      ${
        this.filterable
          ? html`<div class="input-group input-group-sm mb-2">
              <span class="input-group-text" id="${this.instanceId}-filter-icon">
                ${renderIcon('fa-solid fa-magnifying-glass')}
              </span>
              <input
                type="search"
                class="form-control"
                .value=${this.query}
                placeholder=${strings.filterPlaceholder}
                aria-label=${strings.filter}
                aria-describedby="${this.instanceId}-filter-icon"
                @input=${(event: Event) => {
                  this.query = (event.target as HTMLInputElement).value;
                }}
              />
              ${
                this.query
                  ? html`<button
                      type="button"
                      class="btn btn-outline-secondary"
                      title=${strings.clearFilter}
                      @click=${() => {
                        this.query = '';
                      }}
                    >
                      ${renderIcon('fa-solid fa-xmark', { label: strings.clearFilter })}
                    </button>`
                  : nothing
              }
            </div>`
          : nothing
      }

      <div
        class=${cx(this.maxHeight && 'overflow-auto')}
        style=${this.maxHeight ? `max-height:${this.maxHeight}` : ''}
      >
        ${
          roots.length === 0
            ? html`<p class="small text-body-secondary mb-0" role="status">
                ${this.nodes.length === 0 ? strings.empty : strings.noMatches}
              </p>`
            : html`<ul
                class="lia-file-tree"
                role="tree"
                aria-label=${this.label || strings.tree}
                @keydown=${(event: KeyboardEvent) => this.onKeydown(event, rows)}
              >
                ${roots.map((node, index) =>
                  this.renderNode(node, 1, index + 1, roots.length, activeId),
                )}
              </ul>`
        }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-file-tree': LiaFileTree;
  }
}
