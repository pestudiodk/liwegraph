export class GraphCenter {
  static center(container: HTMLElement, element: Element, corrections: number = 3): void {
    if (corrections <= 0) return;
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const left = rect.left - containerRect.left + container.scrollLeft;
    const top = rect.top - containerRect.top + container.scrollTop;
    const containerWidth = container.clientWidth || containerRect.width;
    const containerHeight = container.clientHeight || containerRect.height;
    container.scrollLeft = Math.max(0, left - (containerWidth - rect.width) / 2);
    container.scrollTop = Math.max(0, top - (containerHeight - rect.height) / 2);
    if (corrections > 1 && typeof requestAnimationFrame === "function") requestAnimationFrame(() => GraphCenter.center(container, element, corrections - 1));
  }
}
