import assert from "node:assert/strict";
import test from "node:test";
import { GraphCenter } from "../src/renderer/graph-center.ts";

test("graph centering corrects delayed mobile layout and scroll restoration", (): void => {
  const previousAnimationFrame: (callback: FrameRequestCallback) => number = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame: (handle: number) => void = globalThis.cancelAnimationFrame;
  const frames: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    frames.push(callback);
    return frames.length;
  };
  globalThis.cancelAnimationFrame = (): void => {};
  const container: {
    scrollLeft: number;
    scrollTop: number;
    getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  } = {
    scrollLeft: 0,
    scrollTop: 0,
    getBoundingClientRect: (): { left: number; top: number; width: number; height: number } => ({
      left: 0,
      top: 0,
      width: 400,
      height: 800,
    }),
  };
  let layoutShift: number = 0;
  const element: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number } } = {
    getBoundingClientRect: (): { left: number; top: number; width: number; height: number } => ({
      left: 900 + layoutShift - container.scrollLeft,
      top: 1200 + layoutShift - container.scrollTop,
      width: 200,
      height: 100,
    }),
  };

  try {
    GraphCenter.center(container as unknown as HTMLElement, element as unknown as HTMLElement);
    frames.shift()?.(0);
    assert.deepEqual([container.scrollLeft, container.scrollTop], [800, 850]);

    layoutShift = 120;
    container.scrollLeft = 20;
    container.scrollTop = 30;
    frames.shift()?.(16);
    frames.shift()?.(32);
    assert.deepEqual([container.scrollLeft, container.scrollTop], [920, 970]);
  } finally {
    globalThis.requestAnimationFrame = previousAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
  }
});
