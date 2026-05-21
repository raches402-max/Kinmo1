#!/usr/bin/env node
// Sweep server/routes/*.ts and server/routes.ts: rewrite
//   res.status(N).json({ message: EXPR })
// to
//   fail(res, N, EXPR)
//
// Handles nested parens/braces inside EXPR (template literals, safeError calls).
// Skips the 2 known multi-field cases (handled manually).
// Adds `import { fail } from "<relpath>/lib/responses"` to each modified file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const routesDir = path.join(root, "server", "routes");

const files = [
  path.join(root, "server", "routes.ts"),
  ...fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => path.join(routesDir, f)),
].filter((f) => fs.existsSync(f));

function importLineFor(filePath) {
  // Compute import path from filePath → server/lib/responses
  const fromDir = path.dirname(filePath);
  const target = path.join(root, "server", "lib", "responses");
  let rel = path.relative(fromDir, target);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `import { fail } from "${rel}";`;
}

// Walk source: find `res.status(N).json({ message: EXPR })` patterns and rewrite.
// EXPR ends at the matching `})` after `{ message:`. We track depth across
// parens (), braces {}, brackets [], and skip string/template contents.
function rewrite(src) {
  let out = "";
  let i = 0;
  let modified = 0;
  // Skip cases with extra fields after message — handled manually.
  // Detected by: after EXPR, the next non-whitespace is `,` not `}`.

  while (i < src.length) {
    // Look for "res.status("
    const start = src.indexOf("res.status(", i);
    if (start === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, start);

    // Parse status number
    let p = start + "res.status(".length;
    const numStart = p;
    while (p < src.length && /[0-9]/.test(src[p])) p++;
    if (p === numStart || src[p] !== ")") {
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }
    const status = src.slice(numStart, p);
    p++; // past ')'

    // Expect ".json({ message:" possibly with spaces
    const jsonMatch = src.slice(p).match(/^\.json\(\{ ?message: ?/);
    if (!jsonMatch) {
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }
    const exprStart = p + jsonMatch[0].length;

    // Walk EXPR with depth tracking until we hit ',' or '}' at depth 0
    let q = exprStart;
    let depth = 0;
    let stringChar = null;
    let template = false;
    let templateDepth = 0;
    let exprEnd = -1;
    let nextCharAfterExpr = null;

    while (q < src.length) {
      const c = src[q];
      const prev = src[q - 1];

      if (stringChar) {
        if (c === stringChar && prev !== "\\") stringChar = null;
        q++;
        continue;
      }
      if (template) {
        if (c === "`" && prev !== "\\") {
          template = false;
        } else if (c === "$" && src[q + 1] === "{") {
          templateDepth++;
          q += 2;
          continue;
        } else if (c === "}" && templateDepth > 0) {
          templateDepth--;
        }
        q++;
        continue;
      }

      if (c === '"' || c === "'") {
        stringChar = c;
        q++;
        continue;
      }
      if (c === "`") {
        template = true;
        q++;
        continue;
      }
      if (c === "(" || c === "{" || c === "[") {
        depth++;
        q++;
        continue;
      }
      if (c === ")" || c === "]") {
        depth--;
        q++;
        continue;
      }
      if (c === "}" && depth > 0) {
        depth--;
        q++;
        continue;
      }
      if (depth === 0 && (c === "," || c === "}")) {
        exprEnd = q;
        nextCharAfterExpr = c;
        break;
      }
      q++;
    }

    if (exprEnd === -1) {
      // Bail on this match
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }

    // If next char is ',', we have extra fields — bail, will handle manually.
    if (nextCharAfterExpr === ",") {
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }

    let expr = src.slice(exprStart, exprEnd).trimEnd();
    // Strip trailing space before })
    // Expect: "}" then ")" possibly with whitespace
    let r = exprEnd;
    if (src[r] !== "}") {
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }
    r++;
    // Skip optional whitespace
    while (r < src.length && /\s/.test(src[r])) r++;
    if (src[r] !== ")") {
      out += src.slice(start, start + 1);
      i = start + 1;
      continue;
    }
    r++; // past final ')'

    // Rewrite
    out += `fail(res, ${status}, ${expr})`;
    i = r;
    modified++;
  }

  return { code: out, modified };
}

let totalModified = 0;
const touchedFiles = [];

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const { code, modified } = rewrite(original);
  if (modified === 0) continue;

  // Add import if not present
  let withImport = code;
  if (!/from ["'][^"']*\/lib\/responses["']/.test(withImport)) {
    const importLine = importLineFor(file);
    // Insert after the last existing import statement at top
    const importMatch = withImport.match(/^((?:import .+?;\n)+)/m);
    if (importMatch) {
      withImport =
        withImport.slice(0, importMatch[0].length) +
        importLine +
        "\n" +
        withImport.slice(importMatch[0].length);
    } else {
      withImport = importLine + "\n" + withImport;
    }
  }

  fs.writeFileSync(file, withImport);
  totalModified += modified;
  touchedFiles.push({ file: path.relative(root, file), count: modified });
}

console.log(`Modified ${totalModified} callsites across ${touchedFiles.length} files:`);
for (const { file, count } of touchedFiles.sort((a, b) => b.count - a.count)) {
  console.log(`  ${count.toString().padStart(4)}  ${file}`);
}
