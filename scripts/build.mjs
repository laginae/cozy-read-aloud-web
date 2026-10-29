import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
await mkdir("dist/assets", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/app.js",
  minify: true,
  legalComments: "eof",
});
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
