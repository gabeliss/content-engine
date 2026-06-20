import { rm, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const entryArg = process.argv[2];
if (!entryArg) {
  throw new Error("Usage: node tests/support/runBundledTest.mjs <test-entry.ts>");
}

const entry = resolve(root, entryArg);
const outdir = resolve(root, "node_modules/.cache/content-engine-tests");
const outfile = resolve(outdir, `${basename(entry, ".ts")}.mjs`);

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [entry],
  external: ["convex/*"],
  format: "esm",
  outfile,
  platform: "node",
  sourcemap: "inline",
  target: "node20",
});

await import(pathToFileURL(outfile).href);
