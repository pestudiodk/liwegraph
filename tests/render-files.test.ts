// @ts-nocheck
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MaterialiseCommand, RenderCommand, ValidateCommand } from "../src/cli/liwegraph-cli.ts";

test("render script can skip layout validation and materialise a LIWE Graph as standalone SVG", async (): Promise<void> => {
  const directory: string = await mkdtemp(join(tmpdir(), "liwegraph-render-"));
  const inputPath: string = join(directory, "graph.liwegraph");
  const svgPath: string = join(directory, "graph.svg");
  const legendPath: string = join(directory, "graph-legend.svg");
  const materialisedPath: string = join(directory, "materialised.liwegraph");
  try {
    await writeFile(
      inputPath,
      JSON.stringify({
        kind: "liwegraph/v1",
        data: { groups: [], nodes: [{ id: "a", label: "Alpha" }], edges: [] },
        layout: null,
        appearance: {
          global: { background: "white", node: { fill: "white", stroke: "black", text: "black" }, legend: [{ type: "node", marker: "actor", label: "Actor" }] },
          groups: {}, nodes: {}, edges: {},
        },
      }),
    );
    await assert.rejects(() => new ValidateCommand().run(inputPath, false), /does not contain layout/);
    await new ValidateCommand().run(inputPath, true);
    await new MaterialiseCommand().run(inputPath, materialisedPath);
    assert.match(await readFile(materialisedPath, "utf8"), /\"layout\"/);
    await assert.rejects(() => new RenderCommand().run(inputPath, svgPath, {}), /does not contain layout/);
    await new RenderCommand().run(inputPath, svgPath, { skipLayout: true });
    const svg: string = await readFile(svgPath, "utf8");
    assert.match(svg, /^<svg/);
    assert.match(svg, /Alpha/);
    assert.doesNotMatch(svg, /<style/);
    assert.match(svg, /fill="white"/);
    assert.match(svg, /font-family="monospace"/);
    assert.doesNotMatch(svg, /liwegraph-export-legend/);
    await new RenderCommand().run(inputPath, legendPath, { legend: true, skipLayout: true });
    const legendSvg: string = await readFile(legendPath, "utf8");
    assert.match(legendSvg, /liwegraph-export-legend/);
    assert.match(legendSvg, />Actor<\/text>/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
