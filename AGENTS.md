# Project guidance for Codex

Read `README.md` for the project architecture and usage. This is a TypeScript/Lit
Bootstrap 5 component library; components render into light DOM and use global
styles. Prefer the existing data descriptors and `lia-*` event contracts.

Before component or demo work, read
`plugins/lit-ui/skills/overview/SKILL.md`, then the relevant family skill under
`plugins/lit-ui/skills/<family>/SKILL.md`. Families are primitives, layout,
feedback, table, form, dashboard, settings, auth, and editors. These plugin files
are the shared knowledge source for Claude and Codex. Repository skills under
`.agents/skills/lit-ui-<family>/` (including `lit-ui-overview`) are thin adapters;
update the shared sources when component guidance changes. Resolve references
relative to the source document, not its adapter.

Library code lives in `src/`, demo pages and data in `demo/`, and styles in
`src/styles/`. Keep public exports in `src/index.ts` and the component-family
barrels consistent with API changes. Follow `tsconfig.json`'s strict TypeScript
and existing decorator conventions.

Use Node.js 22 as in CI and install dependencies with `npm ci`. For code changes,
run `npm run typecheck`, `npm run build:lib`, and `npm run build:demo` as CI does.
For UI changes, also inspect affected demo routes with `npm run dev` (port 5180).
There is no automated test script. Documentation-only changes need path and
format validation rather than application builds.

Preserve the Claude plugin and marketplace configuration. Before editing a
subdirectory, read any nested agent guidance and applicable scoped rules.
