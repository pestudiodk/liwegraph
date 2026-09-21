import type { LiweGraphStyle } from "../model/liwegraph.js";

export class AppearanceStyle {
  static apply(element: HTMLElement | SVGElement, style: LiweGraphStyle | null | undefined): void {
    if (!style) return;
    if (style.fill != null) element.style.setProperty("--graph-fill", style.fill);
    if (style.text != null) element.style.setProperty("--graph-text", style.text);
    if (style.stroke != null) {
      element.style.setProperty("--graph-stroke", style.stroke);
      element.style.setProperty("color", style.stroke);
    }
    if (style.strokeWidth != null) element.style.setProperty("--graph-stroke-width", String(style.strokeWidth));
    if (style.opacity != null) element.style.setProperty("--graph-opacity", String(style.opacity));
    if (style.line != null) element.style.setProperty("--graph-line", style.line === "dashed" ? "8 5" : style.line === "dotted" ? "2 4" : "none");
    if (style.arrow != null) element.dataset.arrow = style.arrow;
  }

  static arrow(style: LiweGraphStyle | null | undefined, fallback: NonNullable<LiweGraphStyle["arrow"]> = "triangle"): NonNullable<LiweGraphStyle["arrow"]> {
    return style && typeof style.arrow === "string" ? style.arrow : fallback;
  }

  static applyLegend(element: HTMLElement, style: LiweGraphStyle | null | undefined): void {
    if (!style) return;
    if (style.fill != null) element.style.backgroundColor = style.fill;
    if (style.stroke != null) { element.style.borderColor = style.stroke; element.style.color = style.stroke; }
    if (style.strokeWidth != null) element.style.borderWidth = `${style.strokeWidth}px`;
    if (style.line != null && style.line !== "solid") element.style.borderStyle = style.line;
    if (style.opacity != null) element.style.opacity = String(style.opacity);
    if (style.arrow != null) element.dataset.arrow = style.arrow;
  }
}
