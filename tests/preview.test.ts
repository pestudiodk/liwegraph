import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalLiweGraphPreviewParser } from "../src/renderer/preview.ts";
import type { LiweGraph } from "../src/model/liwegraph.ts";

const previewParser = new CanonicalLiweGraphPreviewParser();
const document: LiweGraph = {
  kind: "liwegraph/v1",
  data: { groups: [{ id: "outer", label: "Outer", nodes: ["a"], groups: ["inner"] }, { id: "inner", label: "Inner", nodes: ["b"], groups: [] }], nodes: [{ id: "a", label: "Alpha", kind: "actor", content: { $text: "Alpha details", target: "docs/api.md#source-line-4" } }, { id: "b", label: "Beta" }], edges: [{ from: "a", to: "b", index: 1, kind: "call", label: "calls" }] },
  layout: { global: { width: 500, height: 300 }, groups: [{ id: "outer", x: 5, y: 5, width: 480, height: 280 }, { id: "inner", x: 240, y: 40, width: 220, height: 180 }], nodes: [{ id: "a", x: 30, y: 80, width: 120, height: 60 }, { id: "b", x: 280, y: 90, width: 120, height: 60 }], edges: [{ from: "a", to: "b", index: 1, points: [[150,110],[200,110],[200,120],[280,120]], label: { x: 170, y: 80, width: 70, height: 20 } }] },
  appearance: { global: { background: "white", node: { fill: "white", stroke: "black", text: "black" }, nodeStyles: { actor: { strokeWidth: 3 } }, edge: { stroke: "black" }, group: { fill: "white", stroke: "black", text: "black" }, edgeStyles: { call: { line: "dashed" } } }, nodes: { a: { fill: "red" } }, edges: {}, groups: {} },
};
function hasCode(error: unknown, code: string): boolean { return error instanceof Error && "code" in error && error.code === code; }

test("a graph without layout cannot be previewed", (): void => {
  assert.throws(() => previewParser.parse(JSON.stringify({ ...document, layout: null })), error => hasCode(error, "missing-layout"));
});
test("preview flattens semantic data and cascades appearance", (): void => {
  const result = previewParser.parse(JSON.stringify(document));
  assert.equal(result.graph.background, "white"); assert.equal(result.graph.groups[1].id, "inner");
  assert.deepEqual(result.graph.nodes[0].style, { fill: "red", stroke: "black", text: "black", strokeWidth: 3 });
  assert.deepEqual(result.graph.nodes[1].style, { fill: "white", stroke: "black", text: "black" });
  assert.deepEqual(result.graph.edges[0].points, [150, 110, 200, 110, 200, 120, 280, 120]);
  assert.equal(result.graph.edges[0].style?.stroke, "black"); assert.equal(result.graph.edges[0].style?.line, "dashed");
  const withoutKind = structuredClone(document); delete withoutKind.data.edges[0].kind;
  withoutKind.appearance!.global.edgeStyles!.dependency = { line: "dotted" };
  assert.equal(previewParser.parse(JSON.stringify(withoutKind)).graph.edges[0].style?.line, undefined);
});
test("incomplete recursive layout is rejected", (): void => {
  assert.throws(() => previewParser.parse(JSON.stringify({ ...document, layout: { ...document.layout!, nodes: document.layout!.nodes.slice(0,1) } })), error => hasCode(error, "incomplete-layout"));
});
