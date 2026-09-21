// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { liweGraphExtension, liweGraphKind, liweGraphMimeType, type LiweGraph, type LiweGraphLayoutGroup } from "../src/model/liwegraph.ts";
import { CanonicalLiweGraphParser } from "../src/model/liwegraph-parser.ts";
import { CanonicalLiweGraphValidator } from "../src/model/liwegraph-validator.ts";
import { liweGraphLayoutMaterialiser } from "../src/layout-materialisation/elk-layout-materialiser.ts";

const parser = new CanonicalLiweGraphParser();
const validator = new CanonicalLiweGraphValidator();
const rawGraph: LiweGraph = {
  kind: "liwegraph/v1",
  data: {
    groups: [{ id: "platform", label: "Platform", nodes: ["gateway"], groups: ["runtime"] }, { id: "runtime", label: "Runtime", nodes: ["client", "api"], groups: [] }],
    nodes: [{ id: "gateway", label: "Gateway", kind: "actor", content: { $text: "Gateway details", target: "docs/platform.md#gateway" } }, { id: "client", label: "Client" }, { id: "api", label: "API" }],
    edges: [{ from: "client", to: "api", index: 1, kind: "call", label: "calls" }, { from: "gateway", to: "api", index: 1 }],
  },
  layout: null,
  appearance: null,
};

function nested(groups: LiweGraphLayoutGroup[], id: string): LiweGraphLayoutGroup {
  const group = groups.find(candidate => candidate.id === id); if (!group) throw new Error(`Missing group ${id}`); return group;
}
function contains(parent: {x:number;y:number;width:number;height:number}, child: {x:number;y:number;width:number;height:number}): boolean {
  return parent.x <= child.x && parent.y <= child.y && parent.x + parent.width >= child.x + child.width && parent.y + parent.height >= child.y + child.height;
}

test("v1 exposes one flattened recursive shape", (): void => {
  assert.equal(liweGraphKind, "liwegraph/v1"); assert.equal(liweGraphExtension, ".liwegraph"); assert.equal(liweGraphMimeType, "application/vnd.pestudiodk.liwe.graph+json");
  const parsed = parser.parse(JSON.stringify(rawGraph));
  assert.deepEqual(Object.keys(parsed), ["kind", "data", "layout", "appearance"]);
  assert.deepEqual(Object.keys(parsed.data), ["groups", "nodes", "edges"]);
  assert.equal(parsed.data.groups[0].groups[0], "runtime");
  assert.equal(parsed.data.nodes[0].kind, "actor");
  assert.deepEqual(parsed.data.nodes[0].content, { $text: "Gateway details", target: "docs/platform.md#gateway" });
  assert.doesNotThrow(() => validator.validate(parsed, { skipLayout: true }));
  assert.throws(() => validator.validate(parsed), /does not contain layout/);
});

test("groups and nodes have at most one group parent and IDs are globally unique", (): void => {
  const duplicateGroup = structuredClone(rawGraph); duplicateGroup.data.groups.push({ id: "platform", nodes: [], groups: [] });
  assert.throws(() => parser.parse(JSON.stringify(duplicateGroup)), /duplicate group id/);
  const duplicateNode = structuredClone(rawGraph); duplicateNode.data.groups[1].nodes.push("gateway");
  assert.throws(() => parser.parse(JSON.stringify(duplicateNode)), /more than one group parent/);
  const unknownNode = structuredClone(rawGraph); unknownNode.data.groups[0].nodes.push("missing");
  assert.throws(() => parser.parse(JSON.stringify(unknownNode)), /unknown node/);
  const unknownGroup = structuredClone(rawGraph); unknownGroup.data.groups[0].groups.push("missing");
  assert.throws(() => parser.parse(JSON.stringify(unknownGroup)), /unknown group/);
  const secondParent = structuredClone(rawGraph); secondParent.data.groups.push({ id: "other", nodes: [], groups: ["runtime"] });
  assert.throws(() => parser.parse(JSON.stringify(secondParent)), /more than one group parent/);
  const cycle = structuredClone(rawGraph); cycle.data.groups[1].groups.push("platform");
  assert.throws(() => parser.parse(JSON.stringify(cycle)), /cycle/);
});

test("content reserves a string $text field for canonical detail rendering", (): void => {
  const invalid = structuredClone(rawGraph); invalid.data.nodes[0].content.$text = { nested: true };
  assert.throws(() => parser.parse(JSON.stringify(invalid)), /content\.\$text must be a string/);
});

test("edges connect nodes only and retain indexed identity", (): void => {
  const invalid = structuredClone(rawGraph); invalid.data.edges.push({ from: "platform", to: "api", index: 1 });
  assert.throws(() => parser.parse(JSON.stringify(invalid)), /unknown node/);
  const duplicate = structuredClone(rawGraph); duplicate.data.edges.push({ ...duplicate.data.edges[0] });
  assert.throws(() => parser.parse(JSON.stringify(duplicate)), /duplicate edge identity/);
});

test("layout materialiser recursively contains child groups and direct child nodes", async (): Promise<void> => {
  const materialised = await liweGraphLayoutMaterialiser.materialiseLayout(rawGraph);
  validator.validate(materialised);
  assert.deepEqual(materialised.data, rawGraph.data);
  const platform = nested(materialised.layout!.groups, "platform");
  const runtime = nested(materialised.layout!.groups, "runtime");
  const gateway = materialised.layout!.nodes.find(node => node.id === "gateway")!;
  const client = materialised.layout!.nodes.find(node => node.id === "client")!;
  assert.ok(contains(platform, runtime)); assert.ok(contains(platform, gateway)); assert.ok(contains(runtime, client));
  assert.ok(materialised.layout!.global.width > 0); assert.ok(materialised.layout!.global.height > 0);
  assert.equal(materialised.layout!.edges[0].label !== undefined, true);
});

test("materialiser preserves appearance and supports routing modes", async (): Promise<void> => {
  const graph: LiweGraph = { ...rawGraph, appearance: { global: { background: "white", node: { fill: "white", stroke: "black", text: "black" }, edge: { stroke: "black", text: "black" }, group: { fill: "white", stroke: "black", text: "black" } }, groups: {}, nodes: {}, edges: {} } };
  const materialised = await liweGraphLayoutMaterialiser.materialiseLayout(graph, "direct");
  assert.deepEqual(materialised.appearance, graph.appearance);
  assert.ok(materialised.layout!.edges.every(edge => edge.points?.length === 2));
});

test("complete layout requires exactly one node and edge entry", async (): Promise<void> => {
  const materialised = await liweGraphLayoutMaterialiser.materialiseLayout(rawGraph);
  materialised.layout!.nodes.push({ ...materialised.layout!.nodes[0] });
  assert.throws(() => validator.validate(materialised), /incomplete/);
});

test("edge routes use either a bendable polyline or multiple segments", async (): Promise<void> => {
  const materialised = await liweGraphLayoutMaterialiser.materialiseLayout(rawGraph);
  const edge = materialised.layout!.edges[0];
  const route = edge.points ?? edge.segments![0];
  edge.points = route;
  edge.segments = [route];
  assert.throws(() => validator.validate(materialised), /points or segments/);
  assert.throws(() => parser.parse(JSON.stringify(materialised)), /points or segments, not both/);
});
