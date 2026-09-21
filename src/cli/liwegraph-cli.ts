#!/usr/bin/env node
// @ts-nocheck
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CanonicalLiweGraphTool } from "../liwegraph-tool.js";
import { CanonicalLiweGraphSvgRenderer } from "../renderer/standalone-svg-renderer.js";

export class ValidateCommand {
  constructor(readonly tool = new CanonicalLiweGraphTool()) {}
  async run(inputPath, skipLayout) {
    const graph = this.tool.parse(await readFile(inputPath, "utf8"));
    this.tool.validate(graph, { skipLayout });
    process.stdout.write(skipLayout ? "Valid LIWE Graph data (layout skipped)\n" : "Valid LIWE Graph data and layout\n");
  }
}

export class MaterialiseCommand {
  constructor(readonly tool = new CanonicalLiweGraphTool()) {}
  async run(inputPath, outputPath) {
    const graph = this.tool.parse(await readFile(inputPath, "utf8"));
    this.tool.validate(graph, { skipLayout: true });
    const materialised = await this.tool.materialiseLayout(graph);
    const serialized = JSON.stringify(materialised, null, 2) + "\n";
    if (outputPath) {
      if (extname(outputPath).toLowerCase() !== ".liwegraph") throw new Error("Output must use the .liwegraph extension.");
      await writeFile(outputPath, serialized, "utf8");
      process.stdout.write(`${outputPath}\n`);
    } else process.stdout.write(serialized);
  }
}

export class RenderCommand {
  constructor(readonly tool = new CanonicalLiweGraphTool(), readonly renderer = new CanonicalLiweGraphSvgRenderer()) {}
  async run(inputPath, outputPath, options = {}) {
    if (extname(inputPath).toLowerCase() !== ".liwegraph") throw new Error("Input must use the .liwegraph extension.");
    if (extname(outputPath).toLowerCase() !== ".svg") throw new Error("Output must use the .svg extension.");
    let graph = this.tool.parse(await readFile(inputPath, "utf8"));
    if (options.skipLayout) {
      this.tool.validate(graph, { skipLayout: true });
      graph = await this.tool.materialiseLayout({ ...graph, layout: null });
    } else this.tool.validate(graph);
    await writeFile(outputPath, await this.renderer.render(graph, { legend: options.legend }), "utf8");
    process.stdout.write(`${outputPath}\n`);
  }
}

export class LiwegraphCli {
  constructor(
    readonly validateCommand = new ValidateCommand(),
    readonly materialiseCommand = new MaterialiseCommand(),
    readonly renderCommand = new RenderCommand(),
  ) {}

  async run(arguments_) {
    const command = arguments_.shift();
    const inputArgument = arguments_.shift();
    if (!command || !inputArgument) throw new Error("Usage: liwegraph <validate|materialise|render> <input.liwegraph> [options]");
    const inputPath = resolve(inputArgument);
    if (command === "validate") {
      const skipLayout = arguments_.includes("--skip-layout");
      const positional = arguments_.filter(argument => argument !== "--skip-layout");
      if (positional.length) throw new Error("Usage: liwegraph validate <input.liwegraph> [--skip-layout]");
      await this.validateCommand.run(inputPath, skipLayout);
      return;
    }
    if (command === "materialise") {
      if (arguments_.length > 1) throw new Error("Usage: liwegraph materialise <input.liwegraph> [output.liwegraph]");
      const outputArgument = arguments_.shift();
      await this.materialiseCommand.run(inputPath, outputArgument ? resolve(outputArgument) : undefined);
      return;
    }
    if (command !== "render") throw new Error("Command must be validate, materialise, or render.");
    const legend = arguments_.includes("--legend");
    const skipLayout = arguments_.includes("--skip-layout");
    const positional = arguments_.filter(argument => argument !== "--legend" && argument !== "--skip-layout");
    const outputArgument = positional.shift();
    if (positional.length) throw new Error("Usage: liwegraph render <input.liwegraph> [output.svg] [--legend] [--skip-layout]");
    await this.renderCommand.run(inputPath, resolve(outputArgument ?? inputPath.slice(0, -".liwegraph".length) + ".svg"), { legend, skipLayout });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  new LiwegraphCli().run(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const suffix = /Invalid LIWE Graph/.test(message) ? "\nSee docs/format.md for the format contract." : "";
    process.stderr.write(`${message}${suffix}\n`);
    process.exitCode = 1;
  });
}
