/**
 * @liasoft/lit-ui — a Bootstrap 5 web-components UI kit.
 *
 * Importing this module registers every custom element. Load the stylesheet
 * once, globally, and call `initTheme()` at start-up:
 *
 * ```ts
 * import '@liasoft/lit-ui/styles.css';
 * import { initTheme } from '@liasoft/lit-ui';
 *
 * initTheme();
 * ```
 *
 * Elements are grouped into families; each family also has its own entry point
 * (`@liasoft/lit-ui/components/table`) if you prefer to import a subset.
 */

// Core
export * from './core/base-element.js';
export * from './core/data-element.js';
export * from './core/types.js';
export * from './core/utils.js';
export * from './core/theme.js';

// Component families
export * from './components/primitives/index.js';
export * from './components/layout/index.js';
export * from './components/feedback/index.js';
export * from './components/table/index.js';
export * from './components/form/index.js';
export * from './components/dashboard/index.js';
export * from './components/settings/index.js';
export * from './components/auth/index.js';
export * from './components/editors/index.js';
