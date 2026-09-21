# Canonical LIWE Graph tool

This document describes the canonical implementation of the LIWE Graph format.
The serialized format itself is specified in [`format.md`](format.md).

## Tool facade

The package root exposes the canonical tool class:

```ts
import { CanonicalLiweGraphTool } from "@pestudiodk/liwegraph";

const tool = new CanonicalLiweGraphTool();
const graph = tool.parse(source);
tool.validate(graph, { skipLayout: true });
const materialised = await tool.materialiseLayout(graph);
tool.validate(materialised);
await tool.mount(materialised, container, {
  onSelect: (node) => console.log(node),
  onActivate: (node) => console.log(node.content),
});
```

The tool delegates to canonical parser, validator, layout-materialiser, and DOM
mounter implementations. The mounted controller supports:

```ts
mounted.select("node-id");
mounted.activate("node-id");
mounted.clearSelection();
mounted.setOnSelect(callback);
mounted.setOnActivate(callback);
mounted.destroy();
```

`destroy()` removes event listeners and mounted DOM. The serialized graph remains
free of callbacks and runtime state.

## Validation

```ts
tool.validate(graph);                       // full data and layout validation
tool.validate(graph, { skipLayout: true }); // skip layout validation
```

The default requires complete renderable layout. `skipLayout: true` is intended
for graphs that are about to be materialised or rendered with layout skipped.

## Layout materialisation

```ts
const materialised = await tool.materialiseLayout(graph);
```

Materialisation first requires `tool.validate(graph, { skipLayout: true })`.
It preserves semantic data and appearance and produces deterministic layout.
Existing layout may be replaced; callers that need fresh layout should provide a
graph with `layout: null`.

The layout engine materialises flat group references from the inside out:
completed child groups act as nodes while their parent is laid out. This creates
nested group bounds containing direct nodes and child groups.

## DOM mounting

```ts
const mounted = await tool.mount(graph, container, options);
```

Without `skipLayout`, mounting requires full validation. With
`skipLayout: true`, mounting validates semantic data, discards existing layout,
preserves appearance, materialises fresh layout, and mounts the result.

The canonical renderer installs its stylesheet once per document. It renders
SVG groups, nodes, edges, labels, and legends; node selection and activation are
runtime behavior.

## CLI

The packaged executable is built from `src/cli/liwegraph-cli.ts`:

```sh
liwegraph validate graph.liwegraph
liwegraph validate graph.liwegraph --skip-layout
liwegraph materialise graph.liwegraph materialised.liwegraph
liwegraph materialise graph.liwegraph
liwegraph render graph.liwegraph graph.svg
liwegraph render graph.liwegraph graph.svg --skip-layout
liwegraph render graph.liwegraph graph-with-legend.svg --legend
```

- `validate` requires complete layout by default; `--skip-layout` skips layout
  validation.
- `materialise` requires skip-layout-valid input and writes a new graph with
  deterministic layout.
- `render` requires complete layout by default; `--skip-layout` explicitly
  discards existing layout, materialises fresh layout, and renders SVG.
- Validation failures retain their diagnostics and point to `docs/format.md`.
