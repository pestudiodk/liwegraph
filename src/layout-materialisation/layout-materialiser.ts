import type { LiweGraph } from "../model/liwegraph.js";

export type LiweGraphRouting = "direct" | "orthogonal" | "mixed";
export type { LiweGraph } from "../model/liwegraph.js";
export interface LiweGraphLayoutMaterialiserOptions { routing?: LiweGraphRouting; }
export interface LiweGraphLayoutMaterialiser {
  readonly name: string;
  materialiseLayout(document: LiweGraph, options?: LiweGraphLayoutMaterialiserOptions | LiweGraphRouting): LiweGraph | Promise<LiweGraph>;
}
