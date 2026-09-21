import { liweGraphParser } from "../model/liwegraph-parser.js";
import { liweGraphValidator } from "../model/liwegraph-validator.js";
import type { LiweGraph, LiweGraphAppearance, LiweGraphBox, LiweGraphDataEdge, LiweGraphDataGroup, LiweGraphDataNode, LiweGraphLayoutGroup, LiweGraphStyle } from "../model/liwegraph.js";

interface PreviewError extends Error { code: "invalid-graph" | "missing-layout" | "incomplete-layout"; }
export interface LiweGraphPreviewNode { path: string; node: LiweGraphDataNode; style?: LiweGraphStyle; x: number; y: number; width: number; height: number; }
export interface LiweGraphPreviewEdge extends LiweGraphDataEdge { labelBox?: LiweGraphBox; style?: LiweGraphStyle; points: number[]; segments: number[][]; }
export interface LiweGraphPreviewGroup extends LiweGraphLayoutGroup { label?: string; style?: LiweGraphStyle; }
export interface LiweGraphPreviewDiagram { width: number; height: number; background?: string; groups: LiweGraphPreviewGroup[]; nodes: LiweGraphPreviewNode[]; edges: LiweGraphPreviewEdge[]; }
export interface LiweGraphPreview extends LiweGraph { graph: LiweGraphPreviewDiagram; }
type UnknownRecord = Record<string, unknown>;

function error(code: PreviewError["code"], message: string): PreviewError { const result = new Error(message) as PreviewError; result.code = code; return result; }
function parsedJson(content: string): UnknownRecord { try { const value = JSON.parse(content); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw error("invalid-graph", "Graph data is invalid."); } }
function edgeKey(edge: Pick<LiweGraphDataEdge, "from" | "to" | "index">): string { return `${edge.from}\0${edge.to}\0${edge.index}`; }
function flattenPoints(points: [number, number][]): number[] { return points.flatMap(([x, y]) => [x, y]); }
function merged(...styles: Array<LiweGraphStyle | undefined>): LiweGraphStyle | undefined { const value = Object.assign({}, ...styles.filter(Boolean)); return Object.keys(value).length ? value : undefined; }
function groupLabels(groups: LiweGraphDataGroup[]): Map<string, string> { return new Map(groups.map(group => [group.id, group.label ?? group.id])); }
function previewGroups(groups: LiweGraphLayoutGroup[], labels: Map<string, string>, appearance: LiweGraphAppearance | null): LiweGraphPreviewGroup[] {
  return groups.map(group => ({ ...group, label: labels.get(group.id), style: merged(appearance?.global.group, appearance?.groups[group.id]) }));
}

function createDiagram(graph: LiweGraph): LiweGraphPreviewDiagram {
  const layout = graph.layout; if (!layout) throw error("missing-layout", "Graph does not contain layout data.");
  const appearance = graph.appearance;
  const visualNodes = new Map(layout.nodes.map(node => [node.id, node]));
  const visualEdges = new Map(layout.edges.map(edge => [edgeKey(edge), edge]));
  const nodes = graph.data.nodes.map(node => { const visual = visualNodes.get(node.id)!; return { path: node.id, node, ...visual, style: merged(appearance?.global.node, node.kind ? appearance?.global.nodeStyles?.[node.kind] : undefined, appearance?.nodes[node.id]) }; });
  const edges = graph.data.edges.map(edge => {
    const visual = visualEdges.get(edgeKey(edge))!; const segments = visual.segments ?? (visual.points ? [visual.points] : []);
    return { ...edge, ...(visual.label ? { labelBox: visual.label } : {}), style: merged(appearance?.global.edge, edge.kind ? appearance?.global.edgeStyles?.[edge.kind] : undefined, appearance?.edges[edgeKey(edge)]), points: flattenPoints(visual.points ?? segments[0]), segments: segments.map(flattenPoints) };
  });
  return { width: layout.global.width, height: layout.global.height, ...(appearance?.global.background ? { background: appearance.global.background } : {}), groups: previewGroups(layout.groups, groupLabels(graph.data.groups), appearance), nodes, edges };
}
function parseLiweGraphPreviewSource(content: string): LiweGraphPreview {
  const document = parsedJson(content);
  try { liweGraphParser.parse(JSON.stringify({ ...document, layout: null })); } catch { throw error("invalid-graph", "Graph data is invalid."); }
  if (document.layout == null) throw error("missing-layout", "Graph does not contain layout data.");
  let graph: LiweGraph;
  try { graph = liweGraphParser.parse(content); liweGraphValidator.validate(graph); } catch { throw error("incomplete-layout", "Layout data is incomplete."); }
  return { ...graph, graph: createDiagram(graph) };
}

export interface LiweGraphPreviewParser {
  parse(content: string): LiweGraphPreview;
}

export class CanonicalLiweGraphPreviewParser implements LiweGraphPreviewParser {
  parse(content: string): LiweGraphPreview {
    return parseLiweGraphPreviewSource(content);
  }
}

export const liweGraphPreviewParser: LiweGraphPreviewParser = new CanonicalLiweGraphPreviewParser();
