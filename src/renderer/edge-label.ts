import type { LiweGraphBox } from "../model/liwegraph.js";

interface GraphPoint {
  x: number;
  y: number;
}
interface GraphSegment {
  start: GraphPoint;
  end: GraphPoint;
}
interface GraphElement<ElementType> {
  append(...nodes: ElementType[]): void;
  textContent: string | null;
}
interface LabelPlacement {
  anchor: GraphPoint;
  box: LiweGraphBox;
  length: number;
}
interface VisibleAnchor {
  anchor: GraphPoint;
  boundary: GraphPoint;
  distance: number;
}

const geometryTolerance: number = 0.01;
const fallbackLabelGap: number = 14;
const labelCharacterWidth: number = 6.2;
const labelLineHeight: number = 12;
const labelPadding: number = 5;

function routeSegments(segments: GraphPoint[][]): GraphSegment[] {
  return segments.flatMap((segment: GraphPoint[]): GraphSegment[] =>
    segment.slice(1).map((end: GraphPoint, index: number): GraphSegment => ({ start: segment[index], end })),
  );
}

function labelSize(label: string): Pick<LiweGraphBox, "width" | "height"> {
  const lines: string[] = label.split(/\r?\n/);
  return {
    width: Math.max(
      24,
      Math.max(...lines.map((line: string): number => [...line].length), 1) * labelCharacterWidth + labelPadding * 2,
    ),
    height: lines.length * labelLineHeight + labelPadding * 2,
  };
}

function labelBoundaryPoint(center: GraphPoint, target: GraphPoint, size: LiweGraphBox): GraphPoint {
  const dx: number = target.x - center.x;
  const dy: number = target.y - center.y;
  const scale: number = 1 / Math.max(Math.abs(dx) / (size.width / 2), Math.abs(dy) / (size.height / 2), 1);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function distanceSquared(first: GraphPoint, second: GraphPoint): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function closestPointOnSegment(point: GraphPoint, start: GraphPoint, end: GraphPoint): GraphPoint {
  const dx: number = end.x - start.x;
  const dy: number = end.y - start.y;
  const lengthSquared: number = dx * dx + dy * dy;
  if (lengthSquared <= geometryTolerance) return start;
  const amount: number = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return { x: start.x + dx * amount, y: start.y + dy * amount };
}

function closestRoutePoint(point: GraphPoint, segments: GraphPoint[][]): GraphPoint {
  let closest: { point: GraphPoint; distance: number } | null = null;
  for (const { start, end } of routeSegments(segments)) {
    const candidate: GraphPoint = closestPointOnSegment(point, start, end);
    const distance: number = distanceSquared(point, candidate);
    if (!closest || distance < closest.distance) closest = { point: candidate, distance };
  }
  return closest?.point ?? point;
}

function segmentIntersectsBoxInterior(start: GraphPoint, end: GraphPoint, box: LiweGraphBox): boolean {
  const left: number = box.x + geometryTolerance;
  const right: number = box.x + box.width - geometryTolerance;
  const top: number = box.y + geometryTolerance;
  const bottom: number = box.y + box.height - geometryTolerance;
  if (left >= right || top >= bottom) return false;
  let minimum: number = 0;
  let maximum: number = 1;
  const dimensions: Array<[number, number, number, number]> = [
    [start.x, end.x - start.x, left, right],
    [start.y, end.y - start.y, top, bottom],
  ];
  for (const [origin, delta, low, high] of dimensions) {
    if (Math.abs(delta) <= geometryTolerance) {
      if (origin <= low || origin >= high) return false;
      continue;
    }
    const first: number = (low - origin) / delta;
    const second: number = (high - origin) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return maximum - minimum > geometryTolerance;
}

function visibleRouteAnchor(
  center: GraphPoint,
  box: LiweGraphBox,
  segments: GraphPoint[][],
  nodeBoxes: LiweGraphBox[],
): VisibleAnchor | undefined {
  const candidates: GraphPoint[] = [];
  for (const { start, end } of routeSegments(segments)) {
    candidates.push(closestPointOnSegment(center, start, end));
    for (let index: number = 0; index <= 20; index += 1) {
      const fraction: number = index / 20;
      candidates.push({ x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction });
    }
  }
  return candidates
    .map((anchor: GraphPoint): VisibleAnchor => {
      const boundary: GraphPoint = labelBoundaryPoint(center, anchor, box);
      return { anchor, boundary, distance: distanceSquared(boundary, anchor) };
    })
    .filter(({ anchor, boundary }: VisibleAnchor): boolean =>
      nodeBoxes.every((node: LiweGraphBox): boolean => !segmentIntersectsBoxInterior(boundary, anchor, node)),
    )
    .sort((first: VisibleAnchor, second: VisibleAnchor): number => first.distance - second.distance)[0];
}

function fallbackLabelPlacement(label: string, segments: GraphPoint[][]): LabelPlacement | null {
  let longest: LabelPlacement | null = null;
  for (const { start, end } of routeSegments(segments)) {
    const dx: number = end.x - start.x;
    const dy: number = end.y - start.y;
    const length: number = Math.hypot(dx, dy);
    if (length <= (longest?.length ?? 0)) continue;
    const normal: GraphPoint = { x: -dy / length, y: dx / length };
    const anchor: GraphPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const size: Pick<LiweGraphBox, "width" | "height"> = labelSize(label);
    const center: GraphPoint = { x: anchor.x + normal.x * fallbackLabelGap, y: anchor.y + normal.y * fallbackLabelGap };
    longest = { anchor, box: { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size }, length };
  }
  return longest;
}

export function appendEdgeLabel<ElementType extends GraphElement<ElementType>>(
  group: GraphElement<ElementType>,
  label: string | undefined,
  segments: GraphPoint[][],
  labelBox: LiweGraphBox | undefined,
  createElement: (name: string, attributes?: Record<string, string | number>) => ElementType,
  nodeBoxes: LiweGraphBox[] = [],
): void {
  if (typeof label !== "string" || !label.trim()) return;
  const fallback: LabelPlacement | null = fallbackLabelPlacement(label, segments);
  const explicit: LiweGraphBox | null = labelBox && labelBox.width > 0 && labelBox.height > 0 ? labelBox : null;
  const box: LiweGraphBox | undefined = explicit ?? fallback?.box;
  if (!box) return;
  const center: GraphPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const visible: VisibleAnchor | undefined = explicit
    ? visibleRouteAnchor(center, box, segments, nodeBoxes)
    : undefined;
  const anchor: GraphPoint =
    visible?.anchor ?? (explicit ? closestRoutePoint(center, segments) : (fallback?.anchor ?? center));
  const boundary: GraphPoint = visible?.boundary ?? labelBoundaryPoint(center, anchor, box);
  if (distanceSquared(center, anchor) > 4) {
    group.append(
      createElement("line", {
        class: "liwegraph-edge-label-leader",
        x1: anchor.x,
        y1: anchor.y,
        x2: boundary.x,
        y2: boundary.y,
      }),
    );
  }
  group.append(
    createElement("rect", {
      class: "liwegraph-edge-label-background",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 3,
    }),
  );
  const lines: string[] = label.split(/\r?\n/);
  const availableWidth: number = Math.max(1, box.width - labelPadding * 2);
  const availableHeight: number = Math.max(1, box.height - labelPadding * 2);
  const fontSize: number = Math.max(1, Math.min(10, availableHeight / Math.max(1, lines.length)));
  const lineHeight: number = Math.min(fontSize * 1.2, availableHeight / Math.max(1, lines.length));
  const text: ElementType = createElement("text", {
    class: "liwegraph-edge-label",
    x: center.x,
    y: center.y,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    "font-size": `${fontSize}px`,
  });
  lines.forEach((line: string, index: number): void => {
    const estimatedWidth: number = [...line].length * fontSize * 0.62;
    const tspan: ElementType = createElement("tspan", {
      x: center.x,
      y: center.y + (index - (lines.length - 1) / 2) * lineHeight,
      ...(line ? { textLength: Math.min(availableWidth, estimatedWidth), lengthAdjust: "spacingAndGlyphs" } : {}),
    });
    tspan.textContent = line;
    text.append(tspan);
  });
  group.append(text);
}
