import type {
  LiweGraph,
  LiweGraphAppearance,
  LiweGraphAppearanceGlobal,
  LiweGraphBox,
  LiweGraphDataEdge,
  LiweGraphDataGroup,
  LiweGraphDataNode,
  LiweGraphLayout,
  LiweGraphLayoutEdge,
  LiweGraphLayoutGroup,
  LiweGraphLayoutNode,
  LiweGraphStyle,
} from "./liwegraph.js";
import { liweGraphKind } from "./liwegraph.js";
import { liweGraphValidator } from "./liwegraph-validator.js";

type UnknownRecord = Record<string, unknown>;

function invalid(message: string): never {
  throw new Error("Invalid LIWE Graph: " + message);
}
function object(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object`);
  return value as UnknownRecord;
}
function keys(record: UnknownRecord, allowed: string[], label: string): void {
  for (const key of Object.keys(record)) if (!allowed.includes(key)) invalid(`${label}.${key} is not supported`);
}
function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(`${label} must be a non-empty string`);
  return value;
}
function optionalString(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") invalid(`${label} must be a string`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(`${label} must be a finite number`);
  return value;
}
function positive(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result <= 0) invalid(`${label} must be positive`);
  return result;
}
function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) invalid(`${label} must be a positive integer`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array`);
  return value;
}
function box(value: unknown, label: string): LiweGraphBox {
  const record = object(value, label);
  keys(record, ["x", "y", "width", "height"], label);
  return { x: finite(record.x, `${label}.x`), y: finite(record.y, `${label}.y`), width: positive(record.width, `${label}.width`), height: positive(record.height, `${label}.height`) };
}

function parseNode(value: unknown, index: number): LiweGraphDataNode {
  const label = `data.nodes[${index}]`;
  const record = object(value, label);
  keys(record, ["id", "label", "kind", "content"], label);
  if (record.content !== undefined && record.content !== null && typeof record.content !== "string" && (typeof record.content !== "object" || Array.isArray(record.content)))
    invalid(`${label}.content must be an object, string, or null`);
  if (record.content && typeof record.content === "object" && "$text" in record.content && typeof (record.content as UnknownRecord).$text !== "string")
    invalid(`${label}.content.$text must be a string`);
  const nodeLabel = optionalString(record.label, `${label}.label`);
  const kind = optionalString(record.kind, `${label}.kind`);
  return { id: id(record.id, `${label}.id`), ...(nodeLabel === undefined ? {} : { label: nodeLabel }), ...(kind === undefined ? {} : { kind }), ...(Object.prototype.hasOwnProperty.call(record, "content") ? { content: record.content as Record<string, unknown> | string | null } : {}) };
}

function parseEdge(value: unknown, index: number): LiweGraphDataEdge {
  const label = `data.edges[${index}]`;
  const record = object(value, label);
  keys(record, ["from", "to", "index", "kind", "label"], label);
  const kind = optionalString(record.kind, `${label}.kind`);
  const edgeLabel = optionalString(record.label, `${label}.label`);
  return { from: id(record.from, `${label}.from`), to: id(record.to, `${label}.to`), index: positiveInteger(record.index, `${label}.index`), ...(kind === undefined ? {} : { kind }), ...(edgeLabel === undefined ? {} : { label: edgeLabel }) };
}

function parseDataGroup(value: unknown, label: string): LiweGraphDataGroup {
  const record = object(value, label);
  keys(record, ["id", "label", "nodes", "groups"], label);
  const groupLabel = optionalString(record.label, `${label}.label`);
  return {
    id: id(record.id, `${label}.id`),
    ...(groupLabel === undefined ? {} : { label: groupLabel }),
    nodes: array(record.nodes, `${label}.nodes`).map((node, index) => id(node, `${label}.nodes[${index}]`)),
    groups: array(record.groups, `${label}.groups`).map((group, index) => id(group, `${label}.groups[${index}]`)),
  };
}

function parseLayoutNode(value: unknown, label: string): LiweGraphLayoutNode {
  const record = object(value, label);
  keys(record, ["id", "x", "y", "width", "height"], label);
  return { id: id(record.id, `${label}.id`), ...box({ x: record.x, y: record.y, width: record.width, height: record.height }, label) };
}
function points(value: unknown, label: string): [number, number][] {
  return array(value, label).map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) invalid(`${label}[${index}] must be [x, y]`);
    return [finite(point[0], `${label}[${index}][0]`), finite(point[1], `${label}[${index}][1]`)];
  });
}
function parseLayoutEdge(value: unknown, label: string): LiweGraphLayoutEdge {
  const record = object(value, label);
  keys(record, ["from", "to", "index", "label", "points", "segments"], label);
  if (record.points != null && record.segments != null) invalid(`${label} must use points or segments, not both`);
  return {
    from: id(record.from, `${label}.from`), to: id(record.to, `${label}.to`), index: positiveInteger(record.index, `${label}.index`),
    ...(record.label == null ? {} : { label: box(record.label, `${label}.label`) }),
    ...(record.points == null ? {} : { points: points(record.points, `${label}.points`) }),
    ...(record.segments == null ? {} : { segments: array(record.segments, `${label}.segments`).map((segment, index) => points(segment, `${label}.segments[${index}]`)) }),
  };
}
function parseLayoutGroup(value: unknown, label: string): LiweGraphLayoutGroup {
  const record = object(value, label);
  keys(record, ["id", "x", "y", "width", "height"], label);
  return { id: id(record.id, `${label}.id`), ...box({ x: record.x, y: record.y, width: record.width, height: record.height }, label) };
}
function parseLayout(value: unknown): LiweGraphLayout | null {
  if (value == null) return null;
  const record = object(value, "layout");
  keys(record, ["global", "groups", "nodes", "edges"], "layout");
  const global = object(record.global, "layout.global");
  keys(global, ["width", "height"], "layout.global");
  return {
    global: { width: positive(global.width, "layout.global.width"), height: positive(global.height, "layout.global.height") },
    groups: array(record.groups, "layout.groups").map((group, index) => parseLayoutGroup(group, `layout.groups[${index}]`)),
    nodes: array(record.nodes, "layout.nodes").map((node, index) => parseLayoutNode(node, `layout.nodes[${index}]`)),
    edges: array(record.edges, "layout.edges").map((edge, index) => parseLayoutEdge(edge, `layout.edges[${index}]`)),
  };
}

const styleKeys = ["fill", "stroke", "text", "strokeWidth", "opacity", "line", "arrow"];
function parseStyle(value: unknown, label: string): LiweGraphStyle {
  const record = object(value, label); keys(record, styleKeys, label);
  const result: LiweGraphStyle = {};
  for (const key of ["fill", "stroke", "text"] as const) if (record[key] != null) result[key] = id(record[key], `${label}.${key}`);
  if (record.strokeWidth != null) { const width = finite(record.strokeWidth, `${label}.strokeWidth`); if (width < 0) invalid(`${label}.strokeWidth must be non-negative`); result.strokeWidth = width; }
  if (record.opacity != null) { const opacity = finite(record.opacity, `${label}.opacity`); if (opacity < 0 || opacity > 1) invalid(`${label}.opacity must be between 0 and 1`); result.opacity = opacity; }
  if (record.line != null) { if (!["solid", "dashed", "dotted"].includes(String(record.line))) invalid(`${label}.line is invalid`); result.line = record.line as LiweGraphStyle["line"]; }
  if (record.arrow != null) { if (!["none", "triangle", "circle", "bar"].includes(String(record.arrow))) invalid(`${label}.arrow is invalid`); result.arrow = record.arrow as LiweGraphStyle["arrow"]; }
  return result;
}
function styleMap(value: unknown, label: string): Record<string, LiweGraphStyle> {
  const record = object(value, label); return Object.fromEntries(Object.entries(record).map(([key, style]) => [key, parseStyle(style, `${label}.${key}`)]));
}
function parseAppearance(value: unknown): LiweGraphAppearance | null {
  if (value == null) return null;
  const record = object(value, "appearance"); keys(record, ["global", "groups", "nodes", "edges"], "appearance");
  const globalRecord = object(record.global, "appearance.global");
  keys(globalRecord, ["background", "node", "nodeStyles", "edge", "group", "edgeStyles", "legend"], "appearance.global");
  const global: LiweGraphAppearanceGlobal = {};
  if (globalRecord.background != null) global.background = id(globalRecord.background, "appearance.global.background");
  for (const key of ["node", "edge", "group"] as const) if (globalRecord[key] != null) global[key] = parseStyle(globalRecord[key], `appearance.global.${key}`);
  if (globalRecord.nodeStyles != null) global.nodeStyles = styleMap(globalRecord.nodeStyles, "appearance.global.nodeStyles");
  if (globalRecord.edgeStyles != null) global.edgeStyles = styleMap(globalRecord.edgeStyles, "appearance.global.edgeStyles");
  if (globalRecord.legend != null) {
    global.legend = array(globalRecord.legend, "appearance.global.legend").map((entry, index) => {
      const label = `appearance.global.legend[${index}]`; const item = object(entry, label); keys(item, ["type", "marker", "label", "style"], label);
      if (!["node", "edge", "group"].includes(String(item.type))) invalid(`${label}.type is invalid`);
      return { type: item.type as "node" | "edge" | "group", marker: id(item.marker, `${label}.marker`), label: id(item.label, `${label}.label`), ...(item.style == null ? {} : { style: parseStyle(item.style, `${label}.style`) }) };
    });
  }
  return { global, groups: styleMap(record.groups, "appearance.groups"), nodes: styleMap(record.nodes, "appearance.nodes"), edges: styleMap(record.edges, "appearance.edges") };
}

function parseLiweGraphSource(content: string): LiweGraph {
  let value: unknown;
  try { value = JSON.parse(content); } catch { invalid("file must contain JSON"); }
  const root = object(value, "root");
  keys(root, ["kind", "data", "layout", "appearance"], "root");
  if (root.kind !== liweGraphKind) invalid(`kind must be ${liweGraphKind}`);
  const data = object(root.data, "data"); keys(data, ["groups", "nodes", "edges"], "data");
  const graph: LiweGraph = {
    kind: liweGraphKind,
    data: {
      groups: array(data.groups, "data.groups").map((group, index) => parseDataGroup(group, `data.groups[${index}]`)),
      nodes: array(data.nodes, "data.nodes").map(parseNode), edges: array(data.edges, "data.edges").map(parseEdge),
    },
    layout: parseLayout(root.layout), appearance: parseAppearance(root.appearance),
  };
  liweGraphValidator.validate(graph, { skipLayout: true });
  return graph;
}

export interface LiweGraphParser {
  parse(content: string): LiweGraph;
}

export class CanonicalLiweGraphParser implements LiweGraphParser {
  parse(content: string): LiweGraph {
    return parseLiweGraphSource(content);
  }
}

export const liweGraphParser: LiweGraphParser = new CanonicalLiweGraphParser();
