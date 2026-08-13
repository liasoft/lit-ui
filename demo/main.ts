/**
 * Entry point of the demo application.
 *
 * Three things happen here and nowhere else:
 *
 * 1. the kit's stylesheet is loaded **once**, globally — mandatory, because the
 *    components render into the light DOM,
 * 2. the kit itself is imported, which registers every custom element, and
 * 3. the two document-level services are installed: the colour-scheme system
 *    (`initTheme`) and the confirmation-dialog handler
 *    (`installConfirmHandler`), which upgrades every `confirm` on an
 *    `ActionDescriptor` from `window.confirm()` to the real dialog.
 *
 * Then `<demo-app>` is mounted and the router takes over.
 */

import '../src/styles/app.scss';
import './styles.scss';

import { initTheme, installConfirmHandler } from '@liasoft/lit-ui';

import './app.js';

initTheme();
installConfirmHandler();

const mount = document.getElementById('app');
if (mount) {
  mount.replaceChildren(document.createElement('demo-app'));
} else {
  console.error('[demo] #app is missing from index.html');
}
