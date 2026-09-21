import type { LiweGraph, LiweGraphDataEdge, LiweGraphDataGroup, LiweGraphLayoutEdge, LiweGraphLayoutGroup, LiweGraphPoint } from "./liwegraph.js";

function invalid(message: string): never { throw new Error("Invalid LIWE Graph: " + message); }

function edgeKey(edge: Pick<LiweGraphDataEdge, "from" | "to" | "index">): string { return `${edge.from}\0${edge.to}\0${edge.index}`; }

interface GroupIndex { ids: Set<string>; parentByGroup: Map<string, string | null>; parentByNode: Map<string, string>; }
function indexGroups(groups: LiweGraphDataGroup[], nodeIds: Set<string>): GroupIndex {
  const index: GroupIndex = { ids: new Set(), parentByGroup: new Map(), parentByNode: new Map() };
  const byId = new Map<string, LiweGraphDataGroup>();
  for (const group of groups) {
    if (index.ids.has(group.id)) invalid(`duplicate group id ${group.id}`);
    index.ids.add(group.id); index.parentByGroup.set(group.id, null); byId.set(group.id, group);
    const localNodes = new Set<string>();
    for (const nodeId of group.nodes) {
      if (!nodeIds.has(nodeId)) invalid(`group ${group.id} references unknown node ${nodeId}`);
      if (localNodes.has(nodeId)) invalid(`group ${group.id} repeats node ${nodeId}`);
      localNodes.add(nodeId);
      if (index.parentByNode.has(nodeId)) invalid(`node ${nodeId} has more than one group parent`);
      index.parentByNode.set(nodeId, group.id);
    }
  }
  for (const group of groups) {
    const children = new Set<string>();
    for (const childId of group.groups) {
      if (!byId.has(childId)) invalid(`group ${group.id} references unknown group ${childId}`);
      if (children.has(childId)) invalid(`group ${group.id} repeats group ${childId}`);
      children.add(childId);
      if (index.parentByGroup.get(childId) !== null) invalid(`group ${childId} has more than one group parent`);
      index.parentByGroup.set(childId, group.id);
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) invalid(`group hierarchy contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id); for (const child of byId.get(id)?.groups ?? []) visit(child); visiting.delete(id); visited.add(id);
  };
  for (const id of index.ids) visit(id);
  return index;
}

function layoutGroupMap(groups: LiweGraphLayoutGroup[]): Map<string, LiweGraphLayoutGroup> {
  const result = new Map<string, LiweGraphLayoutGroup>();
  for (const group of groups) { if (result.has(group.id)) invalid(`duplicate layout group id ${group.id}`); result.set(group.id, group); }
  return result;
}
function contains(parent: LiweGraphLayoutGroup, child: LiweGraphLayoutGroup): boolean {
  return parent.x <= child.x && parent.y <= child.y && parent.x + parent.width >= child.x + child.width && parent.y + parent.height >= child.y + child.height;
}

function validateGraph(graph: LiweGraph, skipLayout: boolean = false): void {
  const nodeIds = new Set<string>();
  for (const node of graph.data.nodes) { if (nodeIds.has(node.id)) invalid(`duplicate node id ${node.id}`); nodeIds.add(node.id); }
  const groupIndex = indexGroups(graph.data.groups, nodeIds);
  const edgeIds = new Set<string>();
  for (const edge of graph.data.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) invalid("edge references an unknown node");
    const key = edgeKey(edge); if (edgeIds.has(key)) invalid(`duplicate edge identity ${edge.from} -> ${edge.to} #${edge.index}`); edgeIds.add(key);
  }
  if (graph.appearance) {
    for (const id of Object.keys(graph.appearance.nodes)) if (!nodeIds.has(id)) invalid(`appearance references unknown node ${id}`);
    for (const id of Object.keys(graph.appearance.groups)) if (!groupIndex.ids.has(id)) invalid(`appearance references unknown group ${id}`);
    for (const id of Object.keys(graph.appearance.edges)) if (!edgeIds.has(id)) invalid(`appearance references unknown edge ${id}`);
  }
  if (!skipLayout) validateLayout(graph, groupIndex, nodeIds, edgeIds);
}

export interface LiweGraphValidationOptions {
  skipLayout?: boolean;
}

export interface LiweGraphValidator {
  validate(graph: LiweGraph, options?: LiweGraphValidationOptions): void;
}

export class CanonicalLiweGraphValidator implements LiweGraphValidator {
  validate(graph: LiweGraph, options: LiweGraphValidationOptions = {}): void {
    validateGraph(graph, options.skipLayout === true);
  }
}

export const liweGraphValidator: LiweGraphValidator = new CanonicalLiweGraphValidator();

function validateLayout(graph: LiweGraph, groupIndex: GroupIndex, nodeIds: Set<string>, edgeIds: Set<string>): void {
  const layout = graph.layout;
  if (!layout) invalid("Graph does not contain layout data.");
  const layoutNodeIds = layout.nodes.map(node => node.id);
  if (layoutNodeIds.length !== nodeIds.size || new Set(layoutNodeIds).size !== nodeIds.size || [...nodeIds].some(id => !layoutNodeIds.includes(id))) invalid("Layout data is incomplete.");
  const layoutEdgeIds = layout.edges.map(edgeKey);
  if (layoutEdgeIds.length !== edgeIds.size || new Set(layoutEdgeIds).size !== edgeIds.size || [...edgeIds].some(id => !layoutEdgeIds.includes(id))) invalid("Layout data is incomplete.");
  for (const edge of layout.edges) {
    const hasPoints = Array.isArray(edge.points);
    const hasSegments = Array.isArray(edge.segments);
    if (hasPoints === hasSegments) invalid("Layout edge must contain points or segments.");
    if (hasPoints && edge.points!.length < 2) invalid("Layout edge points must contain at least two points.");
    if (hasSegments && (!edge.segments!.length || edge.segments!.some((segment: LiweGraphPoint[]) => segment.length < 2)))
      invalid("Every layout edge segment must contain at least two points.");
  }
  for (const edge of graph.data.edges) {
    const placed: LiweGraphLayoutEdge | undefined = layout.edges.find(candidate => edgeKey(candidate) === edgeKey(edge));
    if (Boolean(edge.label?.trim()) !== Boolean(placed?.label)) invalid("Layout data is incomplete.");
  }
  const layoutGroups = layoutGroupMap(layout.groups);
  if (layoutGroups.size !== groupIndex.ids.size || [...groupIndex.ids].some(id => !layoutGroups.has(id))) invalid("Layout data is incomplete.");
  for (const [id, parentId] of groupIndex.parentByGroup) {
    if (parentId) { const group = layoutGroups.get(id)!; const parent = layoutGroups.get(parentId); if (!parent || !contains(parent, group)) invalid(`layout group ${id} is outside its parent`); }
  }
  const layoutNodes = new Map(layout.nodes.map(node => [node.id, node]));
  for (const [nodeId, groupId] of groupIndex.parentByNode) {
    const node = layoutNodes.get(nodeId); const group = layoutGroups.get(groupId);
    if (!node || !group || !(group.x <= node.x && group.y <= node.y && group.x + group.width >= node.x + node.width && group.y + group.height >= node.y + node.height)) invalid(`layout node ${nodeId} is outside group ${groupId}`);
  }
}
