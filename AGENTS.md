This repository is the canonical home of the LIWE Graph format and some canonical typescript tools.

The public package is `@pestudiodk/liwegraph` and exposes direct model, parser, validator, renderer, layout-materialisation, and tool modules rather than a root barrel. ELK is used only internally to optimize LIWE Graph layout and must not appear in the public API, serialized format, or user-facing terminology; mention it publicly only where required for license attribution.

Do not use barrel files for public or internal exports. Consumers should import direct modules or package subpaths when they need parser, validator, renderer, materialiser, or tool functionality. Every source file must define one or more related classes or interfaces; executable functions belong inside classes or interfaces as methods. Do not add standalone top-level utility functions.

Treat `docs/format.md` as authoritative.

Any change to serialized fields, defaults, validation, export shape, rendering semantics, MIME/extension handling, or layout materialiser behavior must update relevant parts of the specification, examples, docs, changelog, and focused tests together.

The renderer must consume only validated graph data, layout, and appearance. Keep the default renderer usable with only its exported JavaScript; it installs its canonical stylesheet itself.

Do not add new dependencies without explicit permission.

Run `npm test` and `npm run build` before handoff. Do not commit or publish unless explicitly asked.
