import type { ElkExtendedEdge, ElkLabel, ElkNode } from "elkjs/lib/elk-api";
import type { LiweGraph, LiweGraphDataEdge, LiweGraphDataGroup, LiweGraphDataNode, LiweGraphLayoutNode } from "../model/liwegraph.js";
import type { LiweGraphRouting } from "./layout-materialiser.js";

const minimumNodeWidth = 128, maximumNodeWidth = 260, minimumNodeHeight = 58, padding = 24, groupHeader = 40;
interface NormalizedElkEdge extends LiweGraphDataEdge { key: string; __elkId: string; __fromElkId: string; __toElkId: string; }
export interface LiweGraphElkModel {
  elkIdByNodeId: Map<string, string>; nodeByElkId: Map<string, LiweGraphDataNode>; groupByElkId: Map<string, string>;
  normalizedEdges: NormalizedElkEdge[]; edges: ElkExtendedEdge[]; graph: ElkNode;
}
function metrics(node: LiweGraphDataNode): { width: number; height: number } { const lines = String(node.label ?? node.id).split(/\r?\n/); const longest = Math.max(1, ...lines.map(line => [...line].length)); return { width: Math.max(minimumNodeWidth, Math.min(maximumNodeWidth, 32 + longest * 7.2)), height: Math.max(minimumNodeHeight, 28 + lines.length * 20) }; }
function labelMetrics(label: string): Pick<ElkLabel, "width" | "height"> { const lines = label.split(/\r?\n/); return { width: Math.max(24, Math.max(...lines.map(line => [...line].length), 1) * 6.2 + 10), height: lines.length * 12 + 10 }; }
function elkPadding(top = padding): string { return `[top=${top},left=${padding},bottom=${padding},right=${padding}]`; }

export function createElkGraph(parsed: LiweGraph, routing: LiweGraphRouting, existingNodes: Map<string, LiweGraphLayoutNode>): LiweGraphElkModel {
  const elkIdByNodeId = new Map<string, string>(), nodeByElkId = new Map<string, LiweGraphDataNode>(), nodeElk = new Map<string, ElkNode>();
  parsed.data.nodes.forEach((node, index) => { const elkId = `node:${index}`; const authored = existingNodes.get(node.id); const size = metrics(node); elkIdByNodeId.set(node.id, elkId); nodeByElkId.set(elkId, node); nodeElk.set(node.id, { id: elkId, width: authored?.width ?? size.width, height: authored?.height ?? size.height }); });
  const groupedNodes = new Set<string>(), childGroups = new Set<string>(), groupByElkId = new Map<string, string>(); let groupIndex = 0;
  const groupsById = new Map(parsed.data.groups.map(group => [group.id, group]));
  for (const group of parsed.data.groups) for (const child of group.groups) childGroups.add(child);
  const groupNode = (group: LiweGraphDataGroup): ElkNode => { const elkId = `group:${groupIndex++}`; groupByElkId.set(elkId, group.id); const children = [...group.nodes.map(id => { groupedNodes.add(id); return nodeElk.get(id)!; }), ...group.groups.map(id => groupNode(groupsById.get(id)!))]; return { id: elkId, children, layoutOptions: { "elk.padding": elkPadding(groupHeader), "elk.nodeSize.constraints": "[MINIMUM_SIZE]", "elk.nodeSize.minimum": "(180,120)", "elk.algorithm": "layered", "elk.direction": "DOWN" } }; };
  const children = [...parsed.data.groups.filter(group => !childGroups.has(group.id)).map(groupNode), ...parsed.data.nodes.filter(node => !groupedNodes.has(node.id)).map(node => nodeElk.get(node.id)!)];
  const normalizedEdges: NormalizedElkEdge[] = parsed.data.edges.map((edge, index) => ({ ...edge, key: `${edge.from}\0${edge.to}\0${edge.index}`, __elkId: `edge:${index}`, __fromElkId: elkIdByNodeId.get(edge.from)!, __toElkId: elkIdByNodeId.get(edge.to)! }));
  const edges: ElkExtendedEdge[] = normalizedEdges.map(edge => ({ id: edge.__elkId, sources: [edge.__fromElkId], targets: [edge.__toElkId], ...(edge.label?.trim() ? { labels: [{ id: `${edge.__elkId}:label`, text: edge.label, ...labelMetrics(edge.label) }] } : {}) }));
  const graph: ElkNode = { id: "root", children, edges, layoutOptions: { "elk.algorithm": "layered", "elk.direction": "UNDEFINED", "elk.edgeRouting": routing === "direct" ? "POLYLINE" : "ORTHOGONAL", "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.padding": elkPadding(), "elk.spacing.nodeNode": "32", "elk.layered.spacing.nodeNodeBetweenLayers": "48", "elk.spacing.edgeNode": "16", "elk.spacing.edgeEdge": "10", "elk.spacing.edgeLabel": "10", "elk.spacing.labelLabel": "14", "elk.spacing.labelNode": "14", "elk.edgeLabels.placement": "CENTER", "elk.edgeLabels.inline": "false", "elk.layered.edgeLabels.sideSelection": "SMART_DOWN", "elk.layered.nodePlacement.favorStraightEdges": "true", "elk.layered.unnecessaryBendpoints": "false", "elk.aspectRatio": "1.35", "elk.separateConnectedComponents": "true", "elk.componentCompaction.componentLayoutAlgorithm": "org.eclipse.elk.box" } };
  return { elkIdByNodeId, nodeByElkId, groupByElkId, normalizedEdges, edges, graph };
}
