import type { ElkEdgeSection, ElkExtendedEdge, ElkNode, ElkPoint } from "elkjs/lib/elk-api";
import type {
  LiweGraph,
  LiweGraphBox,
  LiweGraphDataEdge,
  LiweGraphPoint,
  LiweGraphDataGroup,
  LiweGraphLayout,
  LiweGraphLayoutEdge,
  LiweGraphLayoutGroup,
  LiweGraphLayoutNode,
} from "../model/liwegraph.js";
import type { LiweGraphElkModel } from "./liwegraph-to-elk.js";
import type { LiweGraphRouting } from "./layout-materialiser.js";

const canvasPadding: number = 24;

interface Offset {
  x: number;
  y: number;
}

type CompleteLayout = LiweGraphLayout;

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function center(box: LiweGraphBox): Offset {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function boundary(box: LiweGraphBox, toward: Offset): LiweGraphPoint {
  const origin: Offset = center(box);
  const dx: number = toward.x - origin.x;
  const dy: number = toward.y - origin.y;
  const scale: number = 1 / Math.max(Math.abs(dx) / (box.width / 2), Math.abs(dy) / (box.height / 2), 1);
  return [rounded(origin.x + dx * scale), rounded(origin.y + dy * scale)];
}

function directPoints(from: LiweGraphBox, to: LiweGraphBox): LiweGraphPoint[] {
  const fromCenter: Offset = center(from);
  const toCenter: Offset = center(to);
  return [boundary(from, toCenter), boundary(to, fromCenter)];
}

function segmentIntersectsBox(start: LiweGraphPoint, end: LiweGraphPoint, box: LiweGraphBox): boolean {
  let minimum: number = 0;
  let maximum: number = 1;
  const dimensions: Array<[number, number, number, number]> = [
    [start[0], end[0] - start[0], box.x, box.x + box.width],
    [start[1], end[1] - start[1], box.y, box.y + box.height],
  ];
  for (const [origin, delta, low, high] of dimensions) {
    if (Math.abs(delta) < 0.01) {
      if (origin < low || origin > high) return false;
      continue;
    }
    const first: number = (low - origin) / delta;
    const second: number = (high - origin) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return maximum - minimum > 0.01;
}

function directRouteIsClear(
  points: LiweGraphPoint[],
  edge: LiweGraphElkModel["normalizedEdges"][number],
  nodePositions: Map<string, LiweGraphBox>,
): boolean {
  return [...nodePositions].every(
    ([id, box]: [string, LiweGraphBox]): boolean =>
      id === edge.__fromElkId || id === edge.__toElkId || !segmentIntersectsBox(points[0], points[1], box),
  );
}

function sectionPoints(section: ElkEdgeSection, offset: Offset): LiweGraphPoint[] {
  const points: ElkPoint[] = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
  return points.map(({ x, y }: ElkPoint): LiweGraphPoint => [rounded(x + offset.x), rounded(y + offset.y)]);
}

export function authoredEdges(layout: LiweGraphLayout | null): Map<string, LiweGraphLayoutEdge> {
  const result: Map<string, LiweGraphLayoutEdge> = new Map<string, LiweGraphLayoutEdge>();
  for (const edge of layout?.edges ?? []) result.set(`${edge.from}\0${edge.to}\0${edge.index}`, edge);
  return result;
}

function collectGeometry(
  graph: ElkNode,
  parentOffset: Offset,
  nodes: Map<string, LiweGraphBox>,
  groups: Map<string, LiweGraphBox>,
  containerOffsets: Map<string, Offset>,
  groupByElkId: Map<string, string>,
): void {
  containerOffsets.set(graph.id, parentOffset);
  for (const child of graph.children ?? []) {
    const x: number = parentOffset.x + (child.x ?? 0);
    const y: number = parentOffset.y + (child.y ?? 0);
    const geometry: LiweGraphBox = { x, y, width: child.width ?? 0, height: child.height ?? 0 };
    const group: string | undefined = groupByElkId.get(child.id);
    if (group) {
      groups.set(group, geometry);
      collectGeometry(child, { x, y }, nodes, groups, containerOffsets, groupByElkId);
    } else nodes.set(child.id, geometry);
  }
}

function edgeLabelBox(edge: LiweGraphDataEdge, elkEdge: ElkExtendedEdge | undefined, offset: Offset): LiweGraphBox {
  const label: ElkExtendedEdge["labels"] extends Array<infer Label> | undefined ? Label | undefined : never =
    elkEdge?.labels?.[0];
  if (
    !label ||
    !Number.isFinite(label.x) ||
    !Number.isFinite(label.y) ||
    !Number.isFinite(label.width) ||
    !Number.isFinite(label.height) ||
    (label.width ?? 0) <= 0 ||
    (label.height ?? 0) <= 0
  )
    throw new Error(`Layout engine did not return usable label geometry for ${edge.from} -> ${edge.to} #${edge.index}`);
  return {
    x: rounded((label.x ?? 0) + offset.x),
    y: rounded((label.y ?? 0) + offset.y),
    width: rounded(label.width ?? 0),
    height: rounded(label.height ?? 0),
  };
}

function outputEdge(
  edge: LiweGraphElkModel["normalizedEdges"][number],
  elkEdge: ElkExtendedEdge | undefined,
  nodePositions: Map<string, LiweGraphBox>,
  containerOffsets: Map<string, Offset>,
  existing: LiweGraphLayoutEdge | undefined,
  routing: LiweGraphRouting,
): LiweGraphLayoutEdge {
  const offset: Offset = containerOffsets.get(elkEdge?.container ?? "") ?? { x: 0, y: 0 };
  const sections: LiweGraphPoint[][] = (elkEdge?.sections ?? []).map((section: ElkEdgeSection): LiweGraphPoint[] =>
    sectionPoints(section, offset),
  );
  const from: LiweGraphBox | undefined = nodePositions.get(edge.__fromElkId);
  const to: LiweGraphBox | undefined = nodePositions.get(edge.__toElkId);
  if (!from || !to) throw new Error(`Layout engine omitted endpoint geometry for ${edge.from} -> ${edge.to} #${edge.index}`);
  const direct: LiweGraphPoint[] | null = edge.from !== edge.to ? directPoints(from, to) : null;
  const useDirect: boolean = Boolean(
    direct && (routing === "direct" || (routing === "mixed" && directRouteIsClear(direct, edge, nodePositions))),
  );
  const routes: LiweGraphPoint[][] = useDirect && direct ? [direct] : sections;
  if (!routes.length) routes.push(directPoints(from, to));
  const output: LiweGraphLayoutEdge = { ...(existing ?? {}), from: edge.from, to: edge.to, index: edge.index };
  delete output.points;
  delete output.segments;
  if (routes.length === 1) output.points = routes[0];
  else output.segments = routes;
  if (typeof edge.label === "string" && edge.label.trim()) output.label = edgeLabelBox(edge, elkEdge, offset);
  else delete output.label;
  return output;
}

function mapGroups(groups: LiweGraphDataGroup[], geometry: Map<string, LiweGraphBox>): LiweGraphLayoutGroup[] {
  return groups.map(group => { const box = geometry.get(group.id); if (!box) throw new Error(`Layout engine omitted geometry for group ${group.id}`); return { id: group.id, ...box }; });
}
function flattenGroups(groups: LiweGraphLayoutGroup[]): LiweGraphLayoutGroup[] { return groups; }
function collectEdges(graph: ElkNode, result = new Map<string, ElkExtendedEdge>()): Map<string, ElkExtendedEdge> { for (const edge of graph.edges ?? []) result.set(edge.id, edge); for (const child of graph.children ?? []) collectEdges(child, result); return result; }
function moveLayout(value: CompleteLayout, dx: number, dy: number): CompleteLayout {
  const movePoint = ([x, y]: LiweGraphPoint): LiweGraphPoint => [rounded(x + dx), rounded(y + dy)];
  const moveBox = <Box extends LiweGraphBox>(box: Box): Box => ({ ...box, x: rounded(box.x + dx), y: rounded(box.y + dy) });
  const moveGroups = (groups: LiweGraphLayoutGroup[]): LiweGraphLayoutGroup[] => groups.map(group => moveBox(group));
  return { ...value, groups: moveGroups(value.groups), nodes: value.nodes.map(moveBox), edges: value.edges.map(edge => ({ ...edge, ...(edge.points ? { points: edge.points.map(movePoint) } : {}), ...(edge.segments ? { segments: edge.segments.map(segment => segment.map(movePoint)) } : {}), ...(edge.label ? { label: moveBox(edge.label) } : {}) })) };
}
function normalizeLayout(value: CompleteLayout, elk: ElkNode): CompleteLayout {
  const boxes: LiweGraphBox[] = [...value.nodes, ...flattenGroups(value.groups), ...value.edges.flatMap(edge => edge.label ? [edge.label] : [])];
  const points = value.edges.flatMap(edge => (edge.segments?.length ? edge.segments : edge.points ? [edge.points] : []).flat());
  const left = Math.min(...boxes.map(box => box.x), ...points.map(([x]) => x), canvasPadding), top = Math.min(...boxes.map(box => box.y), ...points.map(([, y]) => y), canvasPadding);
  const moved = moveLayout(value, left < canvasPadding ? canvasPadding - left : 0, top < canvasPadding ? canvasPadding - top : 0);
  const movedBoxes: LiweGraphBox[] = [...moved.nodes, ...flattenGroups(moved.groups), ...moved.edges.flatMap(edge => edge.label ? [edge.label] : [])];
  const movedPoints = moved.edges.flatMap(edge => (edge.segments?.length ? edge.segments : edge.points ? [edge.points] : []).flat());
  return { ...moved, global: { width: rounded(Math.max(320, elk.width ?? 0, ...movedBoxes.map(box => box.x + box.width), ...movedPoints.map(([x]) => x)) + canvasPadding), height: rounded(Math.max(240, elk.height ?? 0, ...movedBoxes.map(box => box.y + box.height), ...movedPoints.map(([, y]) => y)) + canvasPadding) } };
}

export function layoutFromElk(parsed: LiweGraph, routing: LiweGraphRouting, model: LiweGraphElkModel, layout: ElkNode, existingNodes: Map<string, LiweGraphLayoutNode>, existingEdges: Map<string, LiweGraphLayoutEdge>): LiweGraphLayout {
  const elkNodes = new Map<string, LiweGraphBox>(), groupGeometry = new Map<string, LiweGraphBox>(), offsets = new Map<string, Offset>();
  collectGeometry(layout, { x: 0, y: 0 }, elkNodes, groupGeometry, offsets, model.groupByElkId);
  const nodePositions = new Map<string, LiweGraphBox>(); for (const [elkId, box] of elkNodes) { const node = model.nodeByElkId.get(elkId); if (node) nodePositions.set(node.id, box); }
  const elkEdges = collectEdges(layout);
  const edges = model.normalizedEdges.map(edge => outputEdge(edge, elkEdges.get(edge.__elkId), elkNodes, offsets, existingEdges.get(edge.key), routing));
  const nodes = parsed.data.nodes.map(node => { const box = nodePositions.get(node.id); if (!box) throw new Error(`Layout engine omitted geometry for node ${node.id}`); return { ...(existingNodes.get(node.id) ?? { id: node.id }), id: node.id, ...box }; });
  return normalizeLayout({ global: { width: 1, height: 1 }, groups: mapGroups(parsed.data.groups, groupGeometry), nodes, edges }, layout);
}
