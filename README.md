# LIWE Graph

LIWE Graph is a portable JSON graph format designed so LLMs can effectively create and modify semantic graph data while layout and appearance remain separate. This package owns the versioned format, TypeScript model, strict parser and validator, deterministic layout materialiser, and dependency-free browser renderer.

## Installation

```sh
npm install @pestudiodk/liwegraph
```

The package is an ESM package. The CLI and standalone SVG renderer require
Node.js 24 or newer. The browser renderer is bundled and does not require a
runtime dependency in the browser.

## Exports

The package intentionally exposes direct modules rather than a barrel export:

- `@pestudiodk/liwegraph`: canonical tool facade
- `@pestudiodk/liwegraph/model/liwegraph`: model and format constants
- `@pestudiodk/liwegraph/model/liwegraph-parser`: strict parser
- `@pestudiodk/liwegraph/model/liwegraph-validator`: validator
- `@pestudiodk/liwegraph/layout-materialisation/layout-materialiser`: materialiser contract
- `@pestudiodk/liwegraph/layout-materialisation/canonical-layout-materialiser`: canonical materialiser
- `@pestudiodk/liwegraph/renderer/renderer`: browser DOM/SVG renderer
- `@pestudiodk/liwegraph/renderer/preview`: validated preview parser
- `@pestudiodk/liwegraph/renderer/standalone-svg-renderer`: Node.js SVG renderer

```ts
import {
  CanonicalLiweGraphTool,
} from "@pestudiodk/liwegraph";

const tool = new CanonicalLiweGraphTool();
const graph = tool.parse(source);
tool.validate(graph, { skipLayout: true });
const materialised = await tool.materialiseLayout(graph);
tool.validate(materialised);
await tool.mount(materialised, document.querySelector("#graph"), {
  onActivate(node) {
    console.log(node.id, node.content);
  },
});
```

## CLI

Validate complete layout by default, or semantic data only explicitly:

```sh
liwegraph validate graph.liwegraph
liwegraph validate graph.liwegraph --skip-layout
```

Materialise deterministic layout, writing JSON to a file or stdout:

```sh
liwegraph materialise graph.liwegraph materialised.liwegraph
liwegraph materialise graph.liwegraph
```

Render the canonical standalone SVG:

```sh
liwegraph render graph.liwegraph graph.svg
liwegraph render graph.liwegraph graph-with-legend.svg --legend
liwegraph render graph.liwegraph graph-fresh.svg --skip-layout
```

The CLI accepts only `.liwegraph` input. Rendering requires complete layout by
default; `--skip-layout` validates data while preserving appearance, discards
existing layout, and generates fresh layout. From this repository, use:

```sh
npm run render:svg -- graph.liwegraph graph.svg
```

The renderer installs its canonical stylesheet once per document and marks its host with `liwegraph-host`. Applications can supply selection/open callbacks and their own zoom host behavior without coupling graph semantics to navigation.

The `.liwegraph` files in `examples/` and `docs/llm-user-iteration.liwegraph` include complete layout and can be validated or rendered directly. For a data-only graph with `layout: null`, use `materialise` first or `render --skip-layout`.

See [`docs/format.md`](docs/format.md) for the authoritative format contract and [`docs/canonical-tool.md`](docs/canonical-tool.md) for the canonical implementation and CLI.

## License

LIWE Graph is licensed under Apache-2.0. See [`NOTICE`](NOTICE) for required
bundled dependency attribution.

## Contribution status

External contributions are not being accepted yet. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the current policy and
[`SECURITY.md`](SECURITY.md) for private vulnerability reporting.
