/**
 * Primitives — the small building blocks every other family composes.
 *
 * Importing this module registers all primitive elements. Each element also
 * ships an inline `render*` helper (`renderIcon`, `renderBadge`,
 * `renderAction`, `renderSpinner`) so hot paths such as table cells can emit
 * plain Bootstrap markup instead of instantiating hundreds of elements.
 *
 * ```ts
 * import '@liasoft/lit-ui/components/primitives';
 * ```
 */

export * from './light-slot.js';
export * from './lia-icon.js';
export * from './render-action.js';
export * from './lia-button.js';
export * from './lia-action-bar.js';
export * from './lia-badge.js';
export * from './lia-progress.js';
export * from './lia-card.js';
export * from './lia-empty-state.js';
export * from './lia-spinner.js';
export * from './lia-copy-button.js';
export * from './overlay-base.js';
export * from './lia-tooltip.js';
export * from './lia-popover.js';
export * from './lia-key-value.js';
