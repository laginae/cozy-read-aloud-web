import { build } from "esbuild";
import { cp, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import buildOcrResources from './ocr-resources.cjs';
await mkdir("dist/assets", { recursive: true });
const ocrResources = buildOcrResources(process.cwd(), path.resolve('dist/ocr-assets/resources.json'));
const chunks = path.resolve("dist/chunks");
if (!chunks.startsWith(path.resolve("dist") + path.sep)) throw new Error("Invalid build path");
await mkdir(chunks, { recursive: true });
for (const entry of await readdir(chunks, { withFileTypes: true })) {
  if (entry.isFile() && /^[\w-]+\.js$/.test(entry.name)) await unlink(path.join(chunks, entry.name));
}
const result = await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outdir: "dist",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  metafile: true,
  minify: true,
  legalComments: "eof",
  define: { __COZY_OCR_HASH__: JSON.stringify(ocrResources.sha256) },
});
await mkdir("output", { recursive: true });
await writeFile("output/build-meta.json", JSON.stringify(result.metafile, null, 2));
for (const file of [
  "index.html",
  "styles.css",
  "pdf-text-layer.css",
  "manifest.webmanifest",
])
  await cp(`public/${file}`, `dist/${file}`);
await cp("public/assets", "dist/assets", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "dist/pdf.worker.mjs",
);
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${dir}`, `dist/${dir}`, {
    recursive: true,
  });
console.log("Built browser-local prototype in dist/.");
await import("./check-build.mjs");
