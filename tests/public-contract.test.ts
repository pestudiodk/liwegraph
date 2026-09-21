import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CanonicalLiweGraphLayoutMaterialiser } from "../src/layout-materialisation/elk-layout-materialiser.ts";
import { CanonicalLiweGraphMounter } from "../src/renderer/renderer.ts";
import { CanonicalLiweGraphParser } from "../src/model/liwegraph-parser.ts";
import { CanonicalLiweGraphValidator } from "../src/model/liwegraph-validator.ts";

test("canonical public implementations remain unbranded", (): void => {
  assert.equal(new CanonicalLiweGraphLayoutMaterialiser().name, "canonical");
  assert.ok(new CanonicalLiweGraphMounter());
  assert.ok(new CanonicalLiweGraphParser());
  assert.ok(new CanonicalLiweGraphValidator());
  for (const relativePath of ["../README.md", "../docs/format.md", "../CHANGELOG.md"]) {
    const content: string = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(content, /\belk(?:js)?\b/i, `${relativePath} exposes the internal layout engine`);
  }
});
