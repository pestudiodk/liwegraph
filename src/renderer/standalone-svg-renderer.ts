// @ts-nocheck
import { JSDOM } from "jsdom";
import { CanonicalLiweGraphMounter } from "./renderer.js";

export interface LiweGraphStandaloneSvgOptions {
  legend?: boolean;
}

export class CanonicalLiweGraphSvgRenderer {
  static readonly svgNamespace = "http://www.w3.org/2000/svg";
  static readonly scale = 2;
  readonly mounter = new CanonicalLiweGraphMounter();

  graphStyle(element, property, fallback) {
    return element.style.getPropertyValue(property).trim() || fallback;
  }

  setAttributes(element, attributes) {
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  }

  mergedStyle(base, override) {
    return { ...(base ?? {}), ...(override ?? {}) };
  }

  appendLegend(svg, graph) {
    const entries = graph.appearance?.global.legend ?? [];
    if (!entries.length || !graph.layout) return;
    const width = graph.layout.global.width;
    const originalHeight = graph.layout.global.height;
    const rowHeight = 30;
    const legendHeight = 36 + entries.length * rowHeight;
    const background = graph.appearance?.global.background ?? "#030712";
    const group = svg.ownerDocument.createElementNS(CanonicalLiweGraphSvgRenderer.svgNamespace, "g");
    group.setAttribute("class", "liwegraph-export-legend");
    const panel = svg.ownerDocument.createElementNS(CanonicalLiweGraphSvgRenderer.svgNamespace, "rect");
    this.setAttributes(panel, { x: 12, y: originalHeight + 12, width: Math.max(1, width - 24), height: legendHeight - 12, rx: 8, fill: background, stroke: "#64748b" });
    group.append(panel);
    entries.forEach((entry, index) => {
      const defaults = entry.type === "node" ? graph.appearance?.global.node : entry.type === "group" ? graph.appearance?.global.group : graph.appearance?.global.edge;
      const style = this.mergedStyle(defaults, entry.style);
      const y = originalHeight + 34 + index * rowHeight;
      const marker = svg.ownerDocument.createElementNS(CanonicalLiweGraphSvgRenderer.svgNamespace, entry.type === "edge" ? "line" : "rect");
      if (entry.type === "edge") this.setAttributes(marker, { x1: 28, y1: y, x2: 54, y2: y, stroke: style.stroke ?? "#64748b", "stroke-width": style.strokeWidth ?? 2, "stroke-dasharray": style.line === "dashed" ? "8 5" : style.line === "dotted" ? "2 4" : "none" });
      else this.setAttributes(marker, { x: 30, y: y - 9, width: 22, height: 18, rx: entry.type === "node" ? 5 : 2, fill: style.fill ?? "#1f2937", stroke: style.stroke ?? "#64748b", "stroke-width": style.strokeWidth ?? 2, "stroke-dasharray": style.line === "dashed" ? "8 5" : style.line === "dotted" ? "2 4" : "none" });
      group.append(marker);
      const label = svg.ownerDocument.createElementNS(CanonicalLiweGraphSvgRenderer.svgNamespace, "text");
      this.setAttributes(label, { x: 66, y, fill: style.text ?? "#e2e8f0", "font-size": 12, "dominant-baseline": "middle" });
      label.textContent = entry.label;
      group.append(label);
    });
    svg.append(group);
    svg.setAttribute("viewBox", `0 0 ${width} ${originalHeight + legendHeight}`);
    svg.setAttribute("height", String(originalHeight + legendHeight));
  }

  inlineStyles(svg) {
    svg.setAttribute("font-family", "monospace");
    for (const group of svg.querySelectorAll(".liwegraph-group")) {
      const rectangle = group.querySelector("rect");
      if (!rectangle) continue;
      this.setAttributes(rectangle, { fill: this.graphStyle(group, "--graph-fill", "rgba(30, 41, 59, 0.28)"), stroke: this.graphStyle(group, "--graph-stroke", "rgba(148, 163, 184, 0.42)"), "stroke-width": this.graphStyle(group, "--graph-stroke-width", "2"), "stroke-dasharray": this.graphStyle(group, "--graph-line", "8 6"), opacity: this.graphStyle(group, "--graph-opacity", "1") });
      const label = group.querySelector(".liwegraph-group-label");
      if (label) this.setAttributes(label, { fill: this.graphStyle(group, "--graph-text", "#cbd5e1"), "font-size": "14", "font-weight": "normal" });
    }
    for (const node of svg.querySelectorAll(".liwegraph-node")) {
      const rectangle = node.querySelector("rect");
      if (!rectangle) continue;
      this.setAttributes(rectangle, { fill: this.graphStyle(node, "--graph-fill", "#1f2937"), stroke: this.graphStyle(node, "--graph-stroke", "#64748b"), "stroke-width": this.graphStyle(node, "--graph-stroke-width", "1"), "stroke-dasharray": this.graphStyle(node, "--graph-line", "none"), opacity: this.graphStyle(node, "--graph-opacity", "1") });
      for (const label of node.querySelectorAll(".liwegraph-name")) this.setAttributes(label, { fill: this.graphStyle(node, "--graph-text", "#f3f4f6"), "font-weight": "normal" });
      for (const detail of node.querySelectorAll(".liwegraph-label-detail")) this.setAttributes(detail, { fill: this.graphStyle(node, "--graph-text", "#cbd5e1"), "font-size": "9" });
    }
    for (const [edgeIndex, edge] of [...svg.querySelectorAll(".liwegraph-edge")].entries()) {
      const stroke = this.graphStyle(edge, "--graph-stroke", "#64748b");
      edge.setAttribute("color", stroke);
      const paths = edge.querySelectorAll(":scope > path:not(.liwegraph-edge-hit)");
      for (const path of paths) this.setAttributes(path, { fill: "none", stroke, "stroke-width": this.graphStyle(edge, "--graph-stroke-width", "1.6"), "stroke-dasharray": this.graphStyle(edge, "--graph-line", "none"), opacity: this.graphStyle(edge, "--graph-opacity", "0.48") });
      for (const hit of edge.querySelectorAll(":scope > .liwegraph-edge-hit")) this.setAttributes(hit, { stroke: "transparent", "stroke-width": "20", fill: "none" });
      for (const leader of edge.querySelectorAll(".liwegraph-edge-label-leader")) this.setAttributes(leader, { stroke, "stroke-width": "1.2", opacity: "0.85" });
      for (const background of edge.querySelectorAll(".liwegraph-edge-label-background")) { const fill = this.graphStyle(edge, "--graph-fill", "#020617"); this.setAttributes(background, { fill, stroke: fill, "stroke-width": "2", opacity: "0.94" }); }
      for (const label of edge.querySelectorAll(".liwegraph-edge-label")) this.setAttributes(label, { fill: this.graphStyle(edge, "--graph-text", "#e2e8f0"), stroke: this.graphStyle(edge, "--graph-fill", "#020617"), "stroke-width": "4", "paint-order": "stroke", "font-size": "10", "font-weight": "normal" });
      const lastPath = paths.item(paths.length - 1);
      const markerReference = lastPath?.getAttribute("marker-end")?.match(/^url\(#(.+)\)$/);
      const marker = markerReference ? svg.querySelector(`[id="${markerReference[1]}"]`) : null;
      if (lastPath && marker) { const rasterMarker = marker.cloneNode(true); const markerId = `${markerReference[1]}-raster-${edgeIndex}`; rasterMarker.setAttribute("id", markerId); rasterMarker.setAttribute("orient", "auto"); for (const shape of rasterMarker.children) { shape.setAttribute("fill", stroke); if (markerReference[1].endsWith("-bar")) this.setAttributes(shape, { stroke, "stroke-width": "1.5" }); else shape.removeAttribute("stroke"); } marker.parentElement?.append(rasterMarker); lastPath.setAttribute("marker-end", `url(#${markerId})`); }
    }
  }

  async render(graph, options = {}) {
    const dom = new JSDOM('<main><div id="graph"></div></main>');
    const previousGlobals = { document: globalThis.document, Element: globalThis.Element, KeyboardEvent: globalThis.KeyboardEvent, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
    Object.assign(globalThis, { document: dom.window.document, Element: dom.window.Element, KeyboardEvent: dom.window.KeyboardEvent, requestAnimationFrame: undefined, cancelAnimationFrame: undefined });
    try {
      const host = dom.window.document.querySelector("#graph");
      const mounted = await this.mounter.mount(graph, host, { preserveViewport: true });
      const svg = host.querySelector("svg");
      if (!svg) throw new Error("Renderer did not produce an SVG diagram.");
      if (options.legend) this.appendLegend(svg, graph);
      this.inlineStyles(svg);
      const width = Number.parseFloat(svg.getAttribute("width") ?? "");
      const height = Number.parseFloat(svg.getAttribute("height") ?? "");
      if (Number.isFinite(width) && Number.isFinite(height)) { svg.setAttribute("width", String(width * CanonicalLiweGraphSvgRenderer.scale)); svg.setAttribute("height", String(height * CanonicalLiweGraphSvgRenderer.scale)); }
      const background = dom.window.document.createElementNS(CanonicalLiweGraphSvgRenderer.svgNamespace, "rect");
      this.setAttributes(background, { width: "100%", height: "100%", fill: graph.appearance?.global.background ?? "#030712" });
      svg.prepend(background);
      mounted.destroy();
      return new dom.window.XMLSerializer().serializeToString(svg);
    } finally { Object.assign(globalThis, previousGlobals); dom.window.close(); }
  }
}
