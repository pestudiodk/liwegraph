import { CanonicalLiweGraphLayoutMaterialiser } from "./layout-materialisation/canonical-layout-materialiser.js";
import type { LiweGraphLayoutMaterialiserOptions, LiweGraphRouting } from "./layout-materialisation/layout-materialiser.js";
import {
  CanonicalLiweGraphMounter,
  type LiweGraphMountContainer,
  type RenderLiweGraphOptions,
  type RenderedLiweGraph,
} from "./renderer/renderer.js";
import { CanonicalLiweGraphParser } from "./model/liwegraph-parser.js";
import { CanonicalLiweGraphValidator } from "./model/liwegraph-validator.js";
import type { LiweGraph } from "./model/liwegraph.js";
import type { LiweGraphValidationOptions } from "./model/liwegraph-validator.js";

export interface LiweGraphTool {
  parse(content: string): LiweGraph;
  validate(graph: LiweGraph, options?: LiweGraphValidationOptions): void;
  materialiseLayout(
    graph: LiweGraph,
    options?: LiweGraphLayoutMaterialiserOptions | LiweGraphRouting,
  ): LiweGraph | Promise<LiweGraph>;
  mount(
    graph: LiweGraph,
    container: LiweGraphMountContainer,
    options?: RenderLiweGraphOptions,
  ): Promise<RenderedLiweGraph>;
}

export class CanonicalLiweGraphTool implements LiweGraphTool {
  readonly parser = new CanonicalLiweGraphParser();
  readonly validator = new CanonicalLiweGraphValidator();
  readonly layoutMaterialiser = new CanonicalLiweGraphLayoutMaterialiser();
  readonly mounter = new CanonicalLiweGraphMounter();

  parse(content: string): LiweGraph {
    return this.parser.parse(content);
  }

  validate(graph: LiweGraph, options: LiweGraphValidationOptions = {}): void {
    this.validator.validate(graph, options);
  }

  materialiseLayout(
    graph: LiweGraph,
    options: LiweGraphLayoutMaterialiserOptions | LiweGraphRouting = {},
  ): LiweGraph | Promise<LiweGraph> {
    return this.layoutMaterialiser.materialiseLayout(graph, options);
  }

  mount(
    graph: LiweGraph,
    container: LiweGraphMountContainer,
    options: RenderLiweGraphOptions = {},
  ): Promise<RenderedLiweGraph> {
    return this.mounter.mount(graph, container, options);
  }
}

export const liweGraphTool: LiweGraphTool = new CanonicalLiweGraphTool();
