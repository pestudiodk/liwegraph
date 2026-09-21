import ELK from "elkjs/lib/elk.bundled.js";
import type { ELK as ElkLayoutEngine, ElkNode } from "elkjs/lib/elk-api";
import { liweGraphParser } from "../model/liwegraph-parser.js";
import { liweGraphValidator } from "../model/liwegraph-validator.js";
import { liweGraphKind, type LiweGraph, type LiweGraphLayoutEdge, type LiweGraphLayoutGroup, type LiweGraphLayoutNode } from "../model/liwegraph.js";
import { authoredEdges, layoutFromElk } from "./elk-to-liwegraph.js";
import { createElkGraph, type LiweGraphElkModel } from "./liwegraph-to-elk.js";
import { type LiweGraphLayoutMaterialiser, type LiweGraphLayoutMaterialiserOptions, type LiweGraphRouting } from "./layout-materialiser.js";

const elk: ElkLayoutEngine = new ELK();
const routings = new Set<LiweGraphRouting>(["direct", "orthogonal", "mixed"]);
function routing(value: unknown = "orthogonal"): LiweGraphRouting { if (!routings.has(value as LiweGraphRouting)) throw new Error("routing must be direct, orthogonal, or mixed"); return value as LiweGraphRouting; }
function flattenGroups(groups: LiweGraphLayoutGroup[]): Map<string, LiweGraphLayoutGroup> { return new Map(groups.map(group => [group.id, group])); }
async function materialiseLayoutWithCanonicalEngine(document: LiweGraph, options: LiweGraphLayoutMaterialiserOptions | LiweGraphRouting = {}): Promise<LiweGraph> {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("LIWE Graph must be an object");
  const mode = routing(typeof options === "string" ? options : options.routing);
  const parsed = liweGraphParser.parse(JSON.stringify(document));
  liweGraphValidator.validate(parsed, { skipLayout: true });
  const existingNodes = new Map<string, LiweGraphLayoutNode>((parsed.layout?.nodes ?? []).map(node => [node.id, node]));
  flattenGroups(parsed.layout?.groups ?? []);
  const existingEdges: Map<string, LiweGraphLayoutEdge> = authoredEdges(parsed.layout);
  const model: LiweGraphElkModel = createElkGraph(parsed, mode, existingNodes);
  const elkLayout: ElkNode = await elk.layout(model.graph);
  return { kind: liweGraphKind, data: parsed.data, layout: layoutFromElk(parsed, mode, model, elkLayout, existingNodes, existingEdges), appearance: parsed.appearance };
}
export class CanonicalLiweGraphLayoutMaterialiser implements LiweGraphLayoutMaterialiser {
  readonly name = "canonical";
  materialiseLayout(document: LiweGraph, options: LiweGraphLayoutMaterialiserOptions | LiweGraphRouting = {}): Promise<LiweGraph> {
    return materialiseLayoutWithCanonicalEngine(document, options);
  }
}

export const liweGraphLayoutMaterialiser: LiweGraphLayoutMaterialiser = new CanonicalLiweGraphLayoutMaterialiser();
