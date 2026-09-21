import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm(new URL("../build/", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../build/", import.meta.url), { recursive: true });
await Promise.all([
  build({ entryPoints: [new URL("../src/liwegraph-tool.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", target: "es2022", outfile: new URL("../build/liwegraph-tool.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/model/liwegraph.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", target: "es2022", outfile: new URL("../build/model/liwegraph.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/model/liwegraph-parser.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", target: "es2022", outfile: new URL("../build/model/liwegraph-parser.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/model/liwegraph-validator.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", target: "es2022", outfile: new URL("../build/model/liwegraph-validator.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/renderer/renderer.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "browser", target: "es2020", outfile: new URL("../build/renderer/renderer.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/renderer/preview.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "browser", target: "es2020", outfile: new URL("../build/renderer/preview.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/renderer/standalone-svg-renderer.ts", import.meta.url).pathname], bundle: false, format: "esm", platform: "node", target: "node24", outfile: new URL("../build/renderer/standalone-svg-renderer.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/layout-materialisation/layout-materialiser.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", target: "node20", outfile: new URL("../build/layout-materialisation/layout-materialiser.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/layout-materialisation/canonical-layout-materialiser.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", target: "node20", outfile: new URL("../build/layout-materialisation/canonical-layout-materialiser.js", import.meta.url).pathname }),
  build({ entryPoints: [new URL("../src/cli/liwegraph-cli.ts", import.meta.url).pathname], bundle: false, format: "esm", platform: "node", target: "node24", outfile: new URL("../build/cli/liwegraph-cli.js", import.meta.url).pathname }),
]);
