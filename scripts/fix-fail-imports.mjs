#!/usr/bin/env node
// Strip any misplaced `import { fail } from "../lib/responses";` substrings
// and re-insert exactly one properly after the last top-level import.

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
  const fromDir = path.dirname(filePath);
  const target = path.join(root, "server", "lib", "responses");
  let rel = path.relative(fromDir, target);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `import { fail } from "${rel}";`;
}

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("fail(res,") && !/fail\(res,/.test(src)) {
    // File doesn't use fail() — skip
    continue;
  }

  // Remove ALL existing fail-import substrings (possibly malformed)
  src = src.replace(/import \{ fail \} from "[^"]+\/lib\/responses";\s*/g, "");

  // Find last top-level import line and insert after it
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s.+from\s+["'][^"']+["'];?\s*$/.test(lines[i])) {
      lastImportIdx = i;
    } else if (lastImportIdx !== -1 && lines[i].trim() === "") {
      // Allow blank lines within import block
      continue;
    } else if (lastImportIdx !== -1 && !/^import\s/.test(lines[i]) && lines[i].trim() !== "") {
      break;
    }
  }

  const importLine = importLineFor(file);
  if (lastImportIdx === -1) {
    lines.unshift(importLine);
  } else {
    lines.splice(lastImportIdx + 1, 0, importLine);
  }

  fs.writeFileSync(file, lines.join("\n"));
  console.log(`fixed: ${path.relative(root, file)}`);
}
