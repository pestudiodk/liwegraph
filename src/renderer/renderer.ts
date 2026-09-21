import { GraphCenter } from "./graph-center.js";
import { liweGraphPreviewParser } from "./preview.js";
import { liweGraphValidator } from "../model/liwegraph-validator.js";
import { liweGraphLayoutMaterialiser } from "../layout-materialisation/canonical-layout-materialiser.js";
import { appendEdgeLabel } from "./edge-label.js";
import { AppearanceStyle } from "./appearance-style.js";
import { liweGraphRendererCss } from "./renderer-css.js";
import type { LiweGraph, LiweGraphBox, LiweGraphDataNode, LiweGraphLegendEntry } from "../model/liwegraph.js";
import type {
  LiweGraphPreview,
  LiweGraphPreviewDiagram,
  LiweGraphPreviewEdge,
  LiweGraphPreviewNode,
} from "./preview.js";

interface GraphPoint {
  x: number;
  y: number;
}
interface PreviousTap {
  id: string;
  time: number;
}
interface GraphPosition extends LiweGraphPreviewNode {}
interface GraphEdge extends Omit<LiweGraphPreviewEdge, "points" | "segments"> {}
interface RouteEntry {
  key: string;
  points: GraphPoint[];
  segments: GraphPoint[][];
}
interface GraphLayout {
  width: number;
  height: number;
  groups: LiweGraphPreviewDiagram["groups"];
  nodes: LiweGraphDataNode[];
  positions: Map<string, GraphPosition>;
  edges: GraphEdge[];
  routeEntries: RouteEntry[];
  routeSegments: Map<string, GraphPoint[][]>;
}
interface GraphArchitecture {
  incoming: Map<string, Set<string>>;
  outgoing: Map<string, Set<string>>;
}
export interface LiweGraphMountContainer extends HTMLElement {
  onViewZoomChange?: (zoom: number) => void;
  setViewZoomAnchor?(element: SVGElement): void;
  setViewZoomBounds?(minimum: number, maximum: number, initial: number): void;
  setViewZoom?(zoom: number): void;
}
interface GraphSelectionOptions {
  notify?: boolean;
  center?: boolean;
  toggle?: boolean;
}
interface GraphSelection {
  select(id: string, options?: GraphSelectionOptions): void;
  clearSelection(notify?: boolean): void;
}
interface GraphSelectionContext {
  detail: HTMLDivElement;
  layout: GraphLayout;
  architecture: GraphArchitecture;
  nodeElements: Map<string, SVGElement>;
  edgeElements: SVGElement[];
  container: LiweGraphMountContainer;
  onSelect?: (node: LiweGraphDataNode | null) => void;
}
interface GraphInteractionContext extends GraphSelectionContext {
  svg: SVGElement;
  surface: HTMLDivElement;
  onActivate?: (node: LiweGraphDataNode) => void;
}
export interface RenderLiweGraphOptions {
  onSelect?: (node: LiweGraphDataNode | null) => void;
  onActivate?: (node: LiweGraphDataNode) => void;
  legend?: LiweGraphLegendEntry[];
  selectedPath?: string | null;
  preserveViewport?: boolean;
  minimumZoom?: number;
  skipLayout?: boolean;
  decorateLegendButton?: (button: HTMLButtonElement) => void;
}
export interface RenderedLiweGraph {
  layout: GraphLayout;
  select(id: string | null): void;
  activate(id: string): void;
  clearSelection(): void;
  setOnSelect(callback: ((node: LiweGraphDataNode | null) => void) | undefined): void;
  setOnActivate(callback: ((node: LiweGraphDataNode) => void) | undefined): void;
  destroy(): void;
}
interface GraphSvgElements {
  svg: SVGElement;
  edgeElements: SVGElement[];
  nodeElements: Map<string, SVGElement>;
}

const svgNamespace: "http://www.w3.org/2000/svg" = "http://www.w3.org/2000/svg";
const liweGraphMinimumReadableZoom: 0.1 = 0.1;
const liweGraphMaximumZoom: 2 = 2;
const liweGraphQuickTapWindow: 300 = 300;
const liweGraphStyleElementId: "liwegraph-renderer-style" = "liwegraph-renderer-style";

function ensureLiweGraphStyles(): void {
  if (document.getElementById(liweGraphStyleElementId)) return;
  const style: HTMLStyleElement = document.createElement("style");
  style.id = liweGraphStyleElementId;
  style.textContent = liweGraphRendererCss;
  (document.head ?? document.documentElement).append(style);
}

function isQuickRepeatedTap(previousTap: PreviousTap | null, id: string, time: number): boolean {
  return Boolean(previousTap && previousTap.id === id && time - previousTap.time <= liweGraphQuickTapWindow);
}

function svgElement(name: string, attributes: Record<string, string | number> = {}): SVGElement {
  const element: SVGElement = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function edgeKey(edge: Pick<GraphEdge, "from" | "to" | "index">): string {
  return `${edge.from}\0${edge.to}\0${edge.index ?? 1}`;
}

function createLiweGraphEdgePath(points: GraphPoint[]): string {
  if (!points.length) return "";
  let path: string = `M ${points[0].x} ${points[0].y}`;
  for (let segmentIndex: number = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start: GraphPoint = points[segmentIndex];
    const end: GraphPoint = points[segmentIndex + 1];
    if (start.y === end.y) path += ` H ${end.x}`;
    else if (start.x === end.x) path += ` V ${end.y}`;
    else path += ` L ${end.x} ${end.y}`;
  }
  return path;
}

function appendLiweGraphEdgeLabel(
  group: SVGElement,
  label: string | undefined,
  segments: GraphPoint[][],
  labelBox: LiweGraphBox | undefined,
  nodeBoxes: LiweGraphBox[],
): void {
  appendEdgeLabel<SVGElement>(group, label, segments, labelBox, svgElement, nodeBoxes);
}

function liweGraphFitWidthZoom(containerWidth: number, layoutWidth: number): number {
  return Math.min(
    liweGraphMaximumZoom,
    Math.max(liweGraphMinimumReadableZoom, (containerWidth - 20) / Math.max(1, layoutWidth)),
  );
}

function liweGraphCenteringPadding(containerWidth: number, containerHeight: number, zoom: number): string {
  return `${containerHeight / (zoom * 2)}px ${containerWidth / (zoom * 2)}px`;
}

function createLegendControl(
  entries: LiweGraphLegendEntry[] | undefined,
  buttonLabel: string = "Hold for LIWE Graph legend",
  decorateButton?: (button: HTMLButtonElement) => void,
): HTMLDivElement | null {
  const legendEntries: LiweGraphLegendEntry[] = (entries ?? []).filter((entry: LiweGraphLegendEntry): boolean =>
    Boolean(entry.marker.trim() && entry.label.trim()),
  );
  if (!legendEntries.length) return null;
  const wrapper: HTMLDivElement = document.createElement("div");
  wrapper.className = "liwegraph-legend-control";
  const button: HTMLButtonElement = document.createElement("button");
  button.type = "button";
  button.className = "icon-button liwegraph-help";
  button.setAttribute("aria-label", buttonLabel);
  button.title = buttonLabel;
  button.setAttribute("aria-expanded", "false");
  if (decorateButton) decorateButton(button);
  else button.textContent = "?";
  const legend: HTMLDivElement = document.createElement("div");
  legend.className = "liwegraph-legend";
  legend.hidden = true;
  for (const entry of legendEntries) {
    const row: HTMLDivElement = document.createElement("div");
    row.className = "liwegraph-legend-row";
    const marker: HTMLSpanElement = document.createElement("span");
    const markerType: LiweGraphLegendEntry["type"] = entry.type;
    marker.className = `liwegraph-legend-marker liwegraph-legend-${markerType}`;
    marker.dataset.legendType = markerType;
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(entry.marker.trim())) marker.classList.add(entry.marker.trim());
    AppearanceStyle.applyLegend(marker, entry.style);
    marker.setAttribute("aria-hidden", "true");
    const label: HTMLSpanElement = document.createElement("span");
    label.textContent = entry.label;
    row.append(marker, label);
    legend.append(row);
  }

  function show(visible: boolean): void {
    legend.hidden = !visible;
    button.setAttribute("aria-expanded", String(visible));
  }

  button.addEventListener("pointerdown", (event: PointerEvent): void => {
    event.preventDefault();
    show(true);
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener("pointerup", (): void => show(false));
  button.addEventListener("pointercancel", (): void => show(false));
  button.addEventListener("lostpointercapture", (): void => show(false));
  button.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (event.key === " " || event.key === "Enter") show(true);
  });
  button.addEventListener("keyup", (event: KeyboardEvent): void => {
    if (event.key === " " || event.key === "Enter") show(false);
  });
  button.addEventListener("blur", (): void => show(false));
  wrapper.append(button, legend);
  wrapper.addEventListener("touchstart", (event: TouchEvent): void => event.stopPropagation(), { passive: true });
  wrapper.addEventListener("touchmove", (event: TouchEvent): void => event.stopPropagation(), { passive: true });
  return wrapper;
}

function buildGraphLayout(result: LiweGraphPreview): GraphLayout {
  const graphNodes: LiweGraphPreviewNode[] = result.graph.nodes;
  const connections: LiweGraphPreviewEdge[] = result.graph.edges;
  const points: (values: number[]) => GraphPoint[] = (values: number[]): GraphPoint[] => {
    const resultPoints: GraphPoint[] = [];
    for (let index: number = 0; index < values.length; index += 2)
      resultPoints.push({ x: values[index], y: values[index + 1] });
    return resultPoints;
  };
  const entries: GraphPosition[] = graphNodes.map((entry: LiweGraphPreviewNode): GraphPosition => ({ ...entry }));
  const routeEntries: RouteEntry[] = connections.map((edge: LiweGraphPreviewEdge): RouteEntry => ({
    key: edgeKey(edge),
    points: points(edge.points ?? edge.segments?.[0] ?? []),
    segments: (edge.segments?.length ? edge.segments : edge.points ? [edge.points] : []).map(points),
  }));
  return {
    width: result.graph.width,
    height: result.graph.height,
    groups: result.graph.groups ?? [],
    nodes: entries.map(({ node }: GraphPosition): LiweGraphDataNode => node),
    positions: new Map(entries.map((entry: GraphPosition): [string, GraphPosition] => [entry.path, entry])),
    edges: connections.map(
      ({ points: _points, segments: _segments, ...edge }: LiweGraphPreviewEdge): GraphEdge => edge,
    ),
    routeEntries,
    routeSegments: new Map(
      routeEntries.map(({ key, segments }: RouteEntry): [string, GraphPoint[][]] => [key, segments]),
    ),
  };
}

function appendLiweGraphGroups(svg: SVGElement, groups: LiweGraphPreviewDiagram["groups"]): void {
  for (const item of groups) {
    if (![item.x, item.y, item.width, item.height].every(Number.isFinite)) continue;
    const group: SVGElement = svgElement("g", { class: "liwegraph-group" });
    AppearanceStyle.apply(group, item.style);
    group.append(svgElement("rect", { x: item.x, y: item.y, width: item.width, height: item.height, rx: 14 }));
    const title: SVGElement = svgElement("text", { class: "liwegraph-group-label", x: item.x + 12, y: item.y + 22 });
    title.textContent = item.label || item.id;
    group.append(title);
    svg.append(group);
  }
}

function graphLabelLines(label: unknown): string[] {
  return String(label ?? "").split(/\r?\n/);
}

function graphLabelFontSize(lines: string[], width: number, height: number): number {
  const characterCount: number = Math.max(1, ...lines.map((line: string): number => [...line].length));
  const lineCount: number = Math.max(1, lines.length);
  const lineHeight: number = Math.max(1, height - 16) / (lineCount * 1.25);
  return Math.round(Math.max(8, Math.min(34, lineHeight, width / (characterCount * 0.62))) * 10) / 10;
}

function fitGraphLabel(labelElement: SVGElement, line: string, fontSize: number, availableWidth: number): SVGElement {
  const estimatedWidth: number = [...line].length * fontSize * 0.62;
  if (estimatedWidth > availableWidth) {
    labelElement.setAttribute("textLength", String(availableWidth));
    labelElement.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
  return labelElement;
}

function centeredGraphLabels(label: unknown, x: number, y: number, width: number, height: number): SVGElement[] {
  const lines: string[] = graphLabelLines(label);
  const availableWidth: number = Math.max(1, width - 24);
  const fontSize: number = graphLabelFontSize(lines, availableWidth, Math.max(1, height - 24));
  const detailFontSize: number = Math.max(8, Math.round(fontSize * 0.72 * 10) / 10);
  const lineHeight: number = Math.min(fontSize * 1.25, Math.max(1, height - 16) / Math.max(1, lines.length));
  const firstLineY: number = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  return lines.map((line: string, index: number): SVGElement => {
    const item: SVGElement = svgElement("text", {
      class: index === 0 ? "liwegraph-name" : "liwegraph-label-detail",
      x: x + width / 2,
      y: firstLineY + index * lineHeight,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-size": `${index === 0 ? fontSize : detailFontSize}px`,
    });
    item.style.fontSize = `${index === 0 ? fontSize : detailFontSize}px`;
    item.textContent = line;
    return fitGraphLabel(item, line, index === 0 ? fontSize : detailFontSize, availableWidth);
  });
}

function graphDataSummary(data: unknown): string {
  if (data === undefined) return "";
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && !Array.isArray(data) && "$text" in data)
    return String((data as Record<string, unknown>).$text);
  const serialized: string | undefined = JSON.stringify(data);
  return serialized ?? "";
}

function createLiweGraphNode(id: string, position: GraphPosition): SVGElement {
  const { node, x, y, width, height }: GraphPosition = position;
  const label: string = node.label || id;
  const element: SVGElement = svgElement("g", {
    class: "liwegraph-node",
    role: "button",
    tabindex: 0,
    "aria-label": `${graphLabelLines(label).join(", ")}, ${id}`,
  });
  element.dataset.path = id;
  AppearanceStyle.apply(element, position.style);
  element.append(svgElement("rect", { x, y, width, height, rx: 10 }));
  const title: SVGElement = svgElement("title");
  title.textContent = id;
  element.append(title, ...centeredGraphLabels(label, x, y, width, height));
  return element;
}

function createLiweGraphSvg(layout: GraphLayout): GraphSvgElements {
  const svg: SVGElement = svgElement("svg", {
    class: "liwegraph-diagram",
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    width: layout.width,
    height: layout.height,
    role: "img",
    "aria-label": "LIWE Graph diagram",
  });
  const defs: SVGElement = svgElement("defs");
  for (const [arrow, shape] of [
    ["triangle", { tag: "path", attributes: { d: "M 0 0 L 10 5 L 0 10 z" } }],
    ["circle", { tag: "circle", attributes: { cx: 5, cy: 5, r: 3.5 } }],
    ["bar", { tag: "path", attributes: { d: "M 8 0 V 10" } }],
  ] satisfies Array<[string, { tag: string; attributes: Record<string, string | number> }]>) {
    const marker: SVGElement = svgElement("marker", {
      id: `liwegraph-arrow-${arrow}`,
      viewBox: "0 0 10 10",
      refX: arrow === "bar" ? 8 : 9,
      refY: 5,
      markerWidth: 9,
      markerHeight: 9,
      markerUnits: "userSpaceOnUse",
      orient: "auto",
    });
    marker.append(svgElement(shape.tag, shape.attributes));
    defs.append(marker);
  }
  svg.append(defs);
  appendLiweGraphGroups(svg, layout.groups);
  const nodeBoxes: LiweGraphBox[] = [...layout.positions.values()].map(
    ({ x, y, width, height }: GraphPosition): LiweGraphBox => ({ x, y, width, height }),
  );
  const edgeElements: SVGElement[] = layout.edges.map((edge: GraphEdge, index: number): SVGElement => {
    const group: SVGElement = svgElement("g", { class: "liwegraph-edge" });
    AppearanceStyle.apply(group, edge.style);
    group.dataset.from = edge.from;
    group.dataset.to = edge.to;
    const routeSegments: GraphPoint[][] =
      layout.routeEntries[index]?.segments ?? layout.routeSegments.get(edgeKey(edge)) ?? [];
    for (const segment of routeSegments) {
      const d: string = createLiweGraphEdgePath(segment);
      if (!d) continue;
      group.append(svgElement("path", { class: "liwegraph-edge-hit", d }), svgElement("path", { d }));
    }
    const arrow: NonNullable<"circle" | "none" | "triangle" | "bar" | undefined> = AppearanceStyle.arrow(
      edge.style,
      "triangle",
    );
    if (arrow !== "none") group.lastElementChild?.setAttribute("marker-end", `url(#liwegraph-arrow-${arrow})`);
    appendLiweGraphEdgeLabel(group, edge.label, routeSegments, edge.labelBox, nodeBoxes);
    svg.append(group);
    return group;
  });
  const nodeElements: Map<string, SVGElement> = new Map<string, SVGElement>();
  for (const [id, position] of layout.positions) {
    const element: SVGElement = createLiweGraphNode(id, position);
    nodeElements.set(id, element);
    svg.append(element);
  }
  return { svg, edgeElements, nodeElements };
}

function createGraphSelection({
  detail,
  layout,
  architecture,
  nodeElements,
  edgeElements,
  container,
  onSelect,
}: GraphSelectionContext): GraphSelection {
  let selectedId: string | null = null;
  const clearSelection: (notify?: boolean) => void = (notify: boolean = true): void => {
    selectedId = null;
    nodeElements.forEach((element: SVGElement): void => element.classList.remove("selected", "dimmed"));
    edgeElements.forEach((edge: SVGElement): void => edge.classList.remove("active", "dimmed", "incoming", "outgoing"));
    detail.hidden = true;
    detail.replaceChildren();
    if (notify) onSelect?.(null);
  };
  const select: GraphSelection["select"] = (
    id: string,
    { notify = true, center = true, toggle = true }: GraphSelectionOptions = {},
  ): void => {
    const selectedElement: SVGElement | undefined = nodeElements.get(id);
    if (selectedId === id) {
      if (toggle) clearSelection(notify);
      else if (center && selectedElement) GraphCenter.center(container, selectedElement);
      return;
    }
    selectedId = id;
    const node: LiweGraphDataNode | undefined = layout.positions.get(id)?.node;
    if (!node) return;
    if (center && selectedElement) GraphCenter.center(container, selectedElement);
    if (notify) onSelect?.(node);
    const related: Set<string> = new Set<string>([
      id,
      ...(architecture.outgoing.get(id) ?? []),
      ...(architecture.incoming.get(id) ?? []),
    ]);
    nodeElements.forEach((element: SVGElement, nodeId: string): void => {
      element.classList.toggle("selected", nodeId === id);
      element.classList.toggle("dimmed", !related.has(nodeId));
    });
    edgeElements.forEach((edge: SVGElement): void => {
      const active: boolean = edge.dataset.from === id || edge.dataset.to === id;
      edge.classList.toggle("active", active);
      edge.classList.toggle("incoming", edge.dataset.to === id);
      edge.classList.toggle("outgoing", edge.dataset.from === id);
      edge.classList.toggle("dimmed", !active);
    });
    const description: HTMLSpanElement = document.createElement("span");
    description.textContent = graphDataSummary(node.content);
    detail.replaceChildren(description);
    detail.hidden = false;
  };

  return { select, clearSelection };
}

interface GraphInteractionBinding extends GraphSelection {
  activate(id: string): void;
  setOnSelect(callback: ((node: LiweGraphDataNode | null) => void) | undefined): void;
  setOnActivate(callback: ((node: LiweGraphDataNode) => void) | undefined): void;
  destroy(): void;
}

function bindLiweGraphInteractions({
  svg,
  surface,
  detail,
  layout,
  architecture,
  nodeElements,
  edgeElements,
  container,
  onSelect,
  onActivate,
}: GraphInteractionContext): GraphInteractionBinding {
  let previousTap: PreviousTap | null = null;
  let currentOnSelect = onSelect;
  let currentOnActivate = onActivate;
  const AbortControllerConstructor = svg.ownerDocument.defaultView?.AbortController ?? globalThis.AbortController;
  const controller = new AbortControllerConstructor();
  const { select, clearSelection }: GraphSelection = createGraphSelection({
    detail,
    layout,
    architecture,
    nodeElements,
    edgeElements,
    container,
    onSelect: (node: LiweGraphDataNode | null): void => currentOnSelect?.(node),
  });
  svg.addEventListener("click", (event: Event): void => {
    const eventTarget: Element | null = event.target instanceof Element ? event.target : null;
    const target: SVGElement | null = eventTarget?.closest<SVGElement>(".liwegraph-edge") ?? null;
    if (target) {
      event.preventDefault();
      const from: string | undefined = target.dataset.from;
      if (from) select(from, { toggle: false });
    } else if (!eventTarget?.closest(".liwegraph-node")) clearSelection();
  }, { signal: controller.signal });
  nodeElements.forEach((element: SVGElement, id: string): void => {
    element.addEventListener("click", (event: Event): void => {
      const time: number = event.timeStamp || performance.now();
      if (isQuickRepeatedTap(previousTap, id, time)) {
        previousTap = null;
        const node: LiweGraphDataNode | undefined = layout.positions.get(id)?.node;
        if (node) currentOnActivate?.(node);
        return;
      }
      previousTap = { id, time };
      select(id);
    }, { signal: controller.signal });
    element.addEventListener("keydown", (event: Event): void => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(id);
      }
    }, { signal: controller.signal });
  });
  surface.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSelection();
    }
  }, { signal: controller.signal });

  return {
    select,
    clearSelection,
    activate: (id: string): void => {
      const node: LiweGraphDataNode | undefined = layout.positions.get(id)?.node;
      if (node) currentOnActivate?.(node);
    },
    setOnSelect: (callback): void => { currentOnSelect = callback; },
    setOnActivate: (callback): void => { currentOnActivate = callback; },
    destroy: (): void => controller.abort(),
  };
}

function initialGraphFocus(
  svg: SVGElement,
  nodeElements: Map<string, SVGElement>,
  edgeElements: SVGElement[],
): SVGElement {
  return nodeElements.values().next().value ?? edgeElements[0] ?? svg;
}

function scheduleGraphFit(container: LiweGraphMountContainer, svg: SVGElement, layout: GraphLayout): void {
  if (typeof requestAnimationFrame !== "function") return;
  const correctGraphFit: () => void = (): void => {
    const widthFit: number = liweGraphFitWidthZoom(container.clientWidth, layout.width);
    const heightFit: number = Math.min(
      liweGraphMaximumZoom,
      Math.max(liweGraphMinimumReadableZoom, (container.clientHeight - 20) / Math.max(1, layout.height)),
    );
    container.setViewZoom?.(Math.min(widthFit, heightFit));
    GraphCenter.center(container, svg);
  };
  requestAnimationFrame((): void => {
    requestAnimationFrame(correctGraphFit);
  });
}

function buildGraphArchitecture(layout: GraphLayout): GraphArchitecture {
  const architecture: GraphArchitecture = {
    incoming: new Map([...layout.positions.keys()].map((id: string): [string, Set<string>] => [id, new Set<string>()])),
    outgoing: new Map([...layout.positions.keys()].map((id: string): [string, Set<string>] => [id, new Set<string>()])),
  };
  for (const { from, to } of layout.edges) {
    architecture.outgoing.get(from)?.add(to);
    architecture.incoming.get(to)?.add(from);
  }
  return architecture;
}

async function mountLiweGraphDocument(
  document: LiweGraph,
  container: LiweGraphMountContainer,
  options: RenderLiweGraphOptions = {},
): Promise<RenderedLiweGraph> {
  liweGraphValidator.validate(document, { skipLayout: options.skipLayout === true });
  const graph: LiweGraph = options.skipLayout
    ? await liweGraphLayoutMaterialiser.materialiseLayout({ ...document, layout: null })
    : document;
  return renderLiweGraph(liweGraphPreviewParser.parse(JSON.stringify(graph)), container, options);
}

export interface LiweGraphMounter {
  mount(document: LiweGraph, container: LiweGraphMountContainer, options?: RenderLiweGraphOptions): Promise<RenderedLiweGraph>;
}

export class CanonicalLiweGraphMounter implements LiweGraphMounter {
  mount(document: LiweGraph, container: LiweGraphMountContainer, options: RenderLiweGraphOptions = {}): Promise<RenderedLiweGraph> {
    return mountLiweGraphDocument(document, container, options);
  }
}

export const liweGraphMounter: LiweGraphMounter = new CanonicalLiweGraphMounter();

function renderLiweGraph(
  result: LiweGraphPreview,
  container: LiweGraphMountContainer,
  options: RenderLiweGraphOptions = {},
): RenderedLiweGraph {
  ensureLiweGraphStyles();
  const { onSelect, onActivate }: RenderLiweGraphOptions = options;
  container.classList.add("liwegraph-host");
  const layout: GraphLayout = buildGraphLayout(result);
  const architecture: GraphArchitecture = buildGraphArchitecture(layout);
  const { svg, edgeElements, nodeElements }: GraphSvgElements = createLiweGraphSvg(layout);
  const surface: HTMLDivElement = document.createElement("div");
  surface.className = "liwegraph-surface";
  const detail: HTMLDivElement = document.createElement("div");
  detail.className = "liwegraph-detail";
  detail.hidden = true;
  const binding: GraphInteractionBinding = bindLiweGraphInteractions({
    svg,
    surface,
    detail,
    layout,
    architecture,
    nodeElements,
    edgeElements,
    container,
    onSelect,
    onActivate,
  });
  const { select, clearSelection }: GraphSelection = binding;
  surface.append(svg);
  const fitWidthZoom: number = liweGraphFitWidthZoom(container.clientWidth, layout.width);
  if (result.graph.background) container.style.backgroundColor = result.graph.background;
  const previewLegend: HTMLDivElement | null = createLegendControl(
    options.legend ?? result.appearance?.global.legend,
    "Hold for LIWE Graph legend",
    options.decorateLegendButton,
  );
  const detailHost: HTMLElement = container.parentElement ?? container;
  detailHost.querySelector(".liwegraph-detail")?.remove();
  detailHost.querySelector(".liwegraph-legend-control")?.remove();
  container.replaceChildren(surface);
  if (previewLegend) {
    previewLegend.classList.add("graph-preview-legend");
    const actionHost: Element | null = detailHost.querySelector(".content-actions");
    (actionHost ?? detailHost).append(previewLegend);
  }
  detailHost.append(detail);
  const updatePadding: (zoom: number) => void = (zoom: number): void => {
    surface.style.padding = liweGraphCenteringPadding(container.clientWidth, container.clientHeight, zoom);
  };
  container.onViewZoomChange = updatePadding;
  container.setViewZoomAnchor?.(svg);
  const fitHeightZoom: number = Math.min(
    liweGraphMaximumZoom,
    Math.max(liweGraphMinimumReadableZoom, (container.clientHeight - 20) / Math.max(1, layout.height)),
  );
  const fitZoom: number = Math.min(fitWidthZoom, fitHeightZoom);
  container.setViewZoomBounds?.(options.minimumZoom ?? 0.25, liweGraphMaximumZoom, fitZoom);
  if (!options.preserveViewport) container.setViewZoom?.(fitZoom);
  updatePadding(Number.parseFloat(container.style.getPropertyValue("--view-scale")) || 1);
  if (options.selectedPath && nodeElements.has(options.selectedPath))
    select(options.selectedPath, { notify: false, center: options.preserveViewport !== true });
  if (!options.preserveViewport) {
    GraphCenter.center(container, initialGraphFocus(svg, nodeElements, edgeElements));
    scheduleGraphFit(container, svg, layout);
  }
  let destroyed = false;
  return {
    layout,
    select: (id: string | null): void => { if (!destroyed) (id === null ? clearSelection() : select(id)); },
    activate: (id: string): void => {
      if (destroyed) return;
      binding.activate(id);
    },
    clearSelection: (): void => { if (!destroyed) clearSelection(); },
    setOnSelect: (callback): void => binding.setOnSelect(callback),
    setOnActivate: (callback): void => binding.setOnActivate(callback),
    destroy: (): void => {
      if (destroyed) return;
      destroyed = true;
      binding.destroy();
      container.onViewZoomChange = undefined;
      detail.remove();
      previewLegend?.remove();
      if (surface.parentNode === container) surface.remove();
    },
  };
}
