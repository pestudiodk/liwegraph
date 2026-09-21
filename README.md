# LIWE Graph

LIWE Graph is a portable JSON graph format designed so LLMs can effectively create and modify semantic graph data while layout and appearance remain separate. This package owns the versioned format, TypeScript model, strict parser and validator, deterministic layout materialiser, and dependency-free browser renderer.

## Exports

- `@pestudiodk/liwegraph`: model, parser, validator, layout materialiser, DOM mounter, preview parser, and self-styled interactive DOM/SVG renderer

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

See [`docs/format.md`](docs/format.md) for the authoritative format contract and [`docs/canonical-tool.md`](docs/canonical-tool.md) for the canonical implementation and CLI.
