import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { CanonicalLiweGraphMounter } from "../src/renderer/renderer.ts";
import type { LiweGraph } from "../src/model/liwegraph.ts";
import { liweGraphRendererCss } from "../src/renderer/renderer-css.ts";

const graph: LiweGraph = {
  kind: "liwegraph/v1",
  data: {
    groups: [],
    nodes: [
      { id: "a", label: "Alpha", content: { $text: "Readable details", target: "docs/alpha.md#details" } },
      { id: "b", label: "Beta", content: "Plain details" },
    ],
    edges: [{ from: "a", to: "b", index: 1 }],
  },
  layout: {
      global: { width: 400, height: 200 },
      groups: [],
      nodes: [
        { id: "a", x: 20, y: 60, width: 120, height: 60 },
        { id: "b", x: 260, y: 60, width: 120, height: 60 },
      ],
      edges: [{ from: "a", to: "b", index: 1, points: [[140, 90], [260, 90]] }],
  },
  appearance: null,
};

test("root renderer installs its synchronized canonical stylesheet once", async (): Promise<void> => {
  assert.match(liweGraphRendererCss, /\.liwegraph-host/);
  assert.equal(
    liweGraphRendererCss,
    readFileSync(new URL("../src/renderer/renderer.css", import.meta.url), "utf8"),
  );
  const dom: JSDOM = new JSDOM('<main><div id="graph" class="liwegraph-host"></div></main>');
  const previousDocument: Document | undefined = globalThis.document;
  const previousElement: typeof Element | undefined = globalThis.Element;
  const previousKeyboardEvent: typeof KeyboardEvent | undefined = globalThis.KeyboardEvent;
  const previousRequestAnimationFrame: typeof requestAnimationFrame | undefined = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame: typeof cancelAnimationFrame | undefined = globalThis.cancelAnimationFrame;
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
    KeyboardEvent: dom.window.KeyboardEvent,
    requestAnimationFrame: (): number => 1,
    cancelAnimationFrame: (): void => undefined,
  });
  try {
    const host: HTMLElement = dom.window.document.querySelector<HTMLElement>("#graph")!;
    const selected: Array<string | null> = [];
    const activated: string[] = [];
    const rendered = await new CanonicalLiweGraphMounter().mount(graph, host, {
      onSelect: (node): void => {
        selected.push(node?.id ?? null);
      },
      onActivate: (node): void => {
        activated.push(node.id);
      },
    });
    assert.equal(host.querySelectorAll(".liwegraph-node").length, 2);
    assert.equal(host.querySelectorAll(".liwegraph-edge path:not(.liwegraph-edge-hit)").length, 1);
    const installedStyle: HTMLStyleElement | null = dom.window.document.querySelector("#liwegraph-renderer-style");
    assert.equal(installedStyle?.textContent, liweGraphRendererCss);
    rendered.select("a");
    assert.deepEqual(selected, ["a"]);
    assert.equal(host.parentElement?.querySelector(".liwegraph-detail")?.textContent, "Readable details");
    rendered.select("b");
    assert.equal(host.parentElement?.querySelector(".liwegraph-detail")?.textContent, "Plain details");
    rendered.activate("a");
    assert.deepEqual(activated, ["a"]);
    rendered.setOnActivate((node): void => { activated.push(`switched:${node.id}`); });
    rendered.activate("a");
    assert.deepEqual(activated, ["a", "switched:a"]);
    rendered.select(null);
    assert.deepEqual(selected, ["a", "b", null]);
    const node = host.querySelector<SVGElement>('[data-path="a"]')!;
    node.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    node.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(activated, ["a", "switched:a", "switched:a"]);
    const secondHost: HTMLDivElement = dom.window.document.createElement("div");
    dom.window.document.body.append(secondHost);
    await new CanonicalLiweGraphMounter().mount(graph, secondHost);
    assert.equal(dom.window.document.querySelectorAll("#liwegraph-renderer-style").length, 1);
    rendered.destroy();
    assert.equal(host.querySelector("svg"), null);
    rendered.activate("a");
    assert.deepEqual(activated, ["a", "switched:a", "switched:a"]);
  } finally {
    Object.assign(globalThis, {
      document: previousDocument,
      Element: previousElement,
      KeyboardEvent: previousKeyboardEvent,
      requestAnimationFrame: previousRequestAnimationFrame,
      cancelAnimationFrame: previousCancelAnimationFrame,
    });
    dom.window.close();
  }
});
