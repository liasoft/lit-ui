/**
 * The route registry.
 *
 * One module per component family, each exporting a `DemoRoute[]`. Adding a
 * page means adding an entry to its family's array — the sidebar, the global
 * search and the breadcrumb all derive from this list, so there is nothing
 * else to register.
 *
 * The order below is the order of the sidebar groups.
 */

import type { DemoRoute } from '../router.js';

import { gettingStartedRoutes } from './getting-started.js';
import { layoutRoutes } from './layout.js';
import { primitivesRoutes } from './primitives.js';
import { feedbackRoutes } from './feedback.js';
import { tableRoutes } from './table.js';
import { formsRoutes } from './forms.js';
import { dashboardRoutes } from './dashboard.js';
import { settingsRoutes } from './settings.js';
import { authRoutes } from './auth.js';
import { editorsRoutes } from './editors.js';
import { fullPageRoutes } from './full-pages.js';

/** Every demo page, flattened in sidebar order. */
export const demoRoutes: DemoRoute[] = [
  ...gettingStartedRoutes,
  ...layoutRoutes,
  ...primitivesRoutes,
  ...feedbackRoutes,
  ...tableRoutes,
  ...formsRoutes,
  ...dashboardRoutes,
  ...settingsRoutes,
  ...authRoutes,
  ...editorsRoutes,
  ...fullPageRoutes,
];

export {
  gettingStartedRoutes,
  layoutRoutes,
  primitivesRoutes,
  feedbackRoutes,
  tableRoutes,
  formsRoutes,
  dashboardRoutes,
  settingsRoutes,
  authRoutes,
  editorsRoutes,
  fullPageRoutes,
};
