# LIWE Graph

LIWE Graph is a portable JSON graph format designed for effective creation and
modification by LLMs. Semantic data, geometry, and visual appearance are
separate: `data` defines meaning, `layout` defines placement, and `appearance`
defines styling.

- Extension: `.liwegraph`
- MIME type: `application/vnd.pestudiodk.liwe.graph+json`
- Format identifier: `liwe-graph`
- Kind: `liwegraph/v1`

## Root document

The root contains exactly four fields:

```json
{
  "kind": "liwegraph/v1",
  "data": { "groups": [], "nodes": [], "edges": [] },
  "layout": {
    "global": { "width": 320, "height": 240 },
    "groups": [],
    "nodes": [],
    "edges": []
  },
  "appearance": {
    "global": {},
    "groups": {},
    "nodes": {},
    "edges": {}
  }
}
```

`layout` and `appearance` may independently be `null`. A data-only graph is
valid but cannot be rendered until it has complete layout.

## Data

`data` contains exactly `groups`, `nodes`, and `edges`.

### Nodes

A node has a unique non-empty `id` and optional `label`, opaque `kind`, and
`content`. Nodes do not store group membership.

`kind` is an opaque application-defined classification key. LIWE Graph preserves
it but assigns it no built-in meaning. Producers may use values such as
`storage`, `note`, or `actor`. Appearance may use the exact value through
`appearance.global.nodeStyles[kind]`, and custom layout materialisers may use it
as domain input. The canonical layout materialiser does not interpret it.

`content` is an object, string, or `null`. Apart from the reserved `$text` key,
LIWE Graph preserves content as opaque domain data and never uses it to determine
layout, appearance, grouping, or relationships. The canonical renderer displays
a string directly, serializes an ordinary object or `null` as JSON, and displays
`content.$text` instead when an object contains that key:

```json
{
  "content": {
    "$text": "Readable detail shown when this node is selected",
    "target": "docs/design.md#runtime"
  }
}
```

`$text` is reserved by the format and, when present, must be a string. Other
object fields remain available to host code for custom behavior such as
navigation on activation.

### Groups

Groups form a flat identity-based list. Each group contains node IDs and child
group IDs:

```json
[
  {
    "id": "platform",
    "label": "Platform",
    "nodes": ["gateway"],
    "groups": ["runtime"]
  },
  {
    "id": "runtime",
    "label": "Runtime",
    "nodes": ["api", "worker"],
    "groups": []
  }
]
```

Group IDs are globally unique. Every child group reference must resolve, groups
cannot form cycles, and a group has at most one parent. A node may occur in at
most one group's `nodes` array. A group may contain nodes and child groups at
the same time. Nodes and groups without parents are top-level.

### Edges

Edges connect nodes only. They have required `from`, `to`, and positive
one-based `index`, plus optional `kind` and `label`. Both endpoints must identify
nodes. The complete edge identity is `(from, to, index)`, allowing parallel
directed edges.

`kind` is an opaque application-defined relationship key. LIWE Graph stores and
preserves it but assigns it no behavior or meaning. Producers may use values
such as `depends-on`, `required-by`, `calls`, or any other domain-specific
relationship. A renderer may use the exact value to select an optional
`appearance.global.edgeStyles` entry; it must not otherwise interpret it.

## Layout

`layout` contains exactly `global`, `groups`, `nodes`, and `edges`:

```json
{
  "global": { "width": 800, "height": 600 },
  "groups": [
    { "id": "platform", "x": 20, "y": 20, "width": 760, "height": 560 },
    { "id": "runtime", "x": 80, "y": 100, "width": 500, "height": 300 }
  ],
  "nodes": [],
  "edges": []
}
```

All coordinates are absolute canvas coordinates. Every box has finite `x` and
`y` and positive finite `width` and `height`.

An edge route uses exactly one of these representations:

- `points` is one continuous polyline. Consecutive points are connected in
  order, and every intermediate point is a bend. For example,
  `[[20, 40], [100, 40], [100, 160], [220, 160]]` has two orthogonal bends.
- `segments` is an array of separately visible polylines for routes that the layout engine
  returns in multiple sections. Every segment may itself contain multiple bends.

Every polyline contains at least two finite `[x, y]` points. `points` and
`segments` are mutually exclusive.

A complete layout requires:

- positive finite global width and height;
- exactly one layout node for every data node;
- exactly one layout edge for every data edge;
- exactly one layout group for every data group;
- every directly contained node and referenced child group geometrically inside its parent;
- one valid `points` polyline or one or more valid `segments` for every edge;
- exactly one label box for every labeled edge and none for an unlabeled edge.

Layout repeats identities only to associate geometry with semantic data. It does
not redefine labels, membership, kinds, or other meaning.

## Appearance

`appearance` contains exactly `global`, `groups`, `nodes`, and `edges`:

```json
{
  "global": {
    "background": "white",
    "node": { "fill": "white", "stroke": "black", "text": "black" },
    "nodeStyles": { "storage": { "fill": "#eef2ff" } },
    "edge": { "fill": "white", "stroke": "black", "text": "black" },
    "group": { "fill": "white", "stroke": "black", "text": "black" },
    "edgeStyles": {},
    "legend": []
  },
  "groups": {},
  "nodes": {},
  "edges": {}
}
```

Global node, edge, and group styles apply to every matching item. Node kind
styles in `global.nodeStyles[kind]` and edge kind styles in
`global.edgeStyles[kind]` provide optional domain-defined layers. Specific
styles are sparse overrides keyed by node ID, group ID, or the exact edge
identity `(from, to, index)`.

Style precedence is property-by-property:

```text
renderer fallback
-> appearance.global node/edge/group style
-> appearance.global.nodeStyles[node.kind] or edgeStyles[edge.kind]
-> specific appearance nodes/edges/groups style
```

A style may contain `fill`, `stroke`, `text`, non-negative `strokeWidth`,
`opacity` from 0 to 1, `line` (`solid`, `dashed`, or `dotted`), and `arrow`
(`none`, `triangle`, `circle`, or `bar`). Interaction states such as selected
and dimmed remain renderer behavior.

A legend entry has `type` (`node`, `edge`, or `group`), a non-empty `marker`, a
non-empty `label`, and an optional style.

### Appearance validation

When `appearance` is non-null, it must be an object with exactly `global`,
`groups`, `nodes`, and `edges` members. Each of `groups`, `nodes`, and `edges`
must be an object whose values are styles. `global` must be an object and may
contain only `background`, `nodeStyles`, `node`, `edgeStyles`, `edge`, `group`,
and `legend`. If present, `background` must be a non-empty string; `node`,
`edge`, and `group` must be style objects; `nodeStyles` and `edgeStyles` must be
style maps; and `legend` must be an array of legend entries.

`nodeStyles` and `edgeStyles` are arbitrary application-defined kind maps.
Their keys are not required to match kinds present in the graph; this allows a
producer to define reusable styles before adding matching data. In contrast:

- `appearance.nodes` keys must identify existing data node IDs;
- `appearance.groups` keys must identify existing data group IDs;
- `appearance.edges` keys must be exact serialized edge identities in the form
  `(from, to, index)`.

Every style object may contain only:

- `fill`, `stroke`, and `text`: non-empty strings;
- `strokeWidth`: a finite number greater than or equal to zero;
- `opacity`: a finite number from `0` through `1`;
- `line`: `solid`, `dashed`, or `dotted`;
- `arrow`: `none`, `triangle`, `circle`, or `bar`.

Every legend entry must be an object with exactly `type`, `marker`, `label`, and
optional `style`; its `type` must be `node`, `edge`, or `group`, and its marker
and label must be non-empty strings. Appearance validation rejects unknown keys,
invalid style values, unknown specific node/group/edge references, and malformed
legend entries. Appearance validation never changes or interprets semantic data.

## Validation

A graph is fully valid when its semantic data and complete layout are valid.
Skip-layout validation checks semantic data and appearance while allowing layout
to be absent or incomplete. Full validation is required for rendering; skip-layout
validation is the minimum required before layout materialisation.

## Canonical implementation

The canonical implementation, API usage, layout materialisation process,
interactive mounting behavior, and CLI commands are documented separately in
[`canonical-tool.md`](canonical-tool.md).
