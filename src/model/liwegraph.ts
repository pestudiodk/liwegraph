export const liweGraphKind = "liwegraph/v1" as const;
export const liweGraphExtension = ".liwegraph" as const;
export const liweGraphMimeType = "application/vnd.pestudiodk.liwe.graph+json" as const;

export type LiweGraphPoint = [number, number];

export interface LiweGraphBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiweGraphStyle {
  fill?: string;
  stroke?: string;
  text?: string;
  strokeWidth?: number;
  opacity?: number;
  line?: "solid" | "dashed" | "dotted";
  arrow?: "none" | "triangle" | "circle" | "bar";
}

export interface LiweGraphDataNode {
  id: string;
  label?: string;
  kind?: string;
  content?: Record<string, unknown> | string | null;
}

export interface LiweGraphDataEdge {
  from: string;
  to: string;
  index: number;
  kind?: string;
  label?: string;
}

export interface LiweGraphDataGroup {
  id: string;
  label?: string;
  nodes: string[];
  groups: string[];
}

export interface LiweGraphData {
  groups: LiweGraphDataGroup[];
  nodes: LiweGraphDataNode[];
  edges: LiweGraphDataEdge[];
}

export interface LiweGraphLayoutGlobal {
  width: number;
  height: number;
}

export interface LiweGraphLayoutNode extends LiweGraphBox {
  id: string;
}

export interface LiweGraphLayoutEdge {
  from: string;
  to: string;
  index: number;
  label?: LiweGraphBox;
  points?: LiweGraphPoint[];
  segments?: LiweGraphPoint[][];
}

export interface LiweGraphLayoutGroup extends LiweGraphBox {
  id: string;
}

export interface LiweGraphLayout {
  global: LiweGraphLayoutGlobal;
  groups: LiweGraphLayoutGroup[];
  nodes: LiweGraphLayoutNode[];
  edges: LiweGraphLayoutEdge[];
}

export interface LiweGraphLegendEntry {
  type: "node" | "edge" | "group";
  marker: string;
  label: string;
  style?: LiweGraphStyle;
}

export interface LiweGraphAppearanceGlobal {
  background?: string;
  node?: LiweGraphStyle;
  nodeStyles?: Record<string, LiweGraphStyle>;
  edge?: LiweGraphStyle;
  group?: LiweGraphStyle;
  edgeStyles?: Record<string, LiweGraphStyle>;
  legend?: LiweGraphLegendEntry[];
}

export interface LiweGraphAppearance {
  global: LiweGraphAppearanceGlobal;
  groups: Record<string, LiweGraphStyle>;
  nodes: Record<string, LiweGraphStyle>;
  edges: Record<string, LiweGraphStyle>;
}

export interface LiweGraph {
  kind: "liwegraph/v1";
  data: LiweGraphData;
  layout: LiweGraphLayout | null;
  appearance: LiweGraphAppearance | null;
}
