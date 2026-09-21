import { access, constants } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

export class RepositorySemgrep {
  readonly repositoryRoot: string;
  readonly maximumScanMilliseconds = 120_000;
  readonly ruleset: string;

  constructor(
    repositoryRoot: string = join(dirname(fileURLToPath(import.meta.url)), ".."),
    ruleset: string = join(repositoryRoot, "security/semgrep/p-default.yml"),
  ) {
    this.repositoryRoot = repositoryRoot;
    this.ruleset = ruleset;
  }

  async run(): Promise<void> {
    const executable: string | undefined = await this.findExecutable();
    if (!executable)
      throw new Error(
        "Semgrep is required for npm run lint:security. Install it with the official local CLI instructions: https://semgrep.dev/docs/getting-started/",
      );
    const outputDirectory: string = await mkdtemp(join(tmpdir(), "liwegraph-semgrep-"));
    const outputPath: string = join(outputDirectory, "results.json");
    try {
      await this.scan(executable, outputPath);
      const output: string = await readFile(outputPath, "utf8");
      process.stdout.write(`${output}\n`);
      const result: { results?: unknown[] } = JSON.parse(output) as { results?: unknown[] };
      if ((result.results?.length ?? 0) > 0)
        throw new Error(`Semgrep found ${result.results?.length ?? 0} blocking finding(s).`);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }

  private async findExecutable(): Promise<string | undefined> {
    const candidates: string[] = ["/opt/homebrew/bin/semgrep", "/usr/local/bin/semgrep", "/usr/bin/semgrep"];
    for (const candidate of candidates) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Continue checking the other conventional installation locations.
      }
    }
    return new Promise<string | undefined>((resolve): void => {
      const probe: ChildProcess = spawn("sh", ["-c", "command -v semgrep"], { stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      probe.stdout?.on("data", (chunk: Buffer): void => { output += chunk.toString(); });
      probe.once("error", (): void => resolve(undefined));
      probe.once("exit", (code: number | null): void => resolve(code === 0 ? output.trim() || undefined : undefined));
    });
  }

  private scan(executable: string, outputPath: string): Promise<void> {
    const arguments_: string[] = [
      "scan",
      "--config",
      this.ruleset,
      "--json-output",
      outputPath,
      "--quiet",
      "--error",
      "--metrics",
      "off",
      "--jobs",
      "1",
      "--timeout",
      "5",
      "--max-target-bytes",
      "1000000",
      "--exclude",
      "build",
      "--exclude",
      "node_modules/**",
      "--exclude",
      ".git/**",
      "--exclude",
      ".liwe/**",
      "src",
      "scripts",
      "eslint.config.js",
    ];
    return new Promise<void>((resolve, reject): void => {
      const childProcess: ChildProcess = spawn(executable, arguments_, { cwd: this.repositoryRoot, stdio: "inherit" });
      let settled = false;
      let resultAvailable = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearInterval(resultPoll);
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      const resultPoll: ReturnType<typeof setInterval> = setInterval((): void => {
        readFile(outputPath, "utf8")
          .then((output: string): void => {
            JSON.parse(output);
            resultAvailable = true;
            childProcess.kill("SIGTERM");
            finish();
          })
          .catch((): void => {
            // Semgrep may still be writing the result file.
          });
      }, 250);
      const timeout: ReturnType<typeof setTimeout> = setTimeout((): void => {
        childProcess.kill("SIGTERM");
        finish(new Error(`Semgrep exceeded the ${this.maximumScanMilliseconds / 1000}-second scan limit.`));
      }, this.maximumScanMilliseconds);
      childProcess.once("error", (error: Error): void => finish(error));
      childProcess.once("exit", (code: number | null): void => {
        if (code === 0 || resultAvailable) finish();
        else finish(new Error(`Semgrep exited with status ${code ?? "unknown"}.`));
      });
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  new RepositorySemgrep().run().catch((error: unknown): void => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
