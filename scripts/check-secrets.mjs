#!/usr/bin/env node
// Fails the build if a SERVICE_ROLE or POLAR_ secret name appears anywhere
// under src/ outside an allowed server-only file, or with a NEXT_PUBLIC_
// prefix (which would ship it to the browser). See CLAUDE.md §4.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const ALLOWED_FILE = join(SRC_DIR, "lib", "supabase", "admin.ts");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const SECRET_PATTERNS = [/SERVICE_ROLE/g, /POLAR_[A-Z0-9_]*/g];
const PUBLIC_PREFIX = "NEXT_PUBLIC_";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      files.push(full);
    }
  }
  return files;
}

function isServerOnlyFile(filePath, content) {
  if (filePath === ALLOWED_FILE) return true;
  return /import\s+["']server-only["']/.test(content);
}

const failures = [];

for (const file of walk(SRC_DIR)) {
  const content = readFileSync(file, "utf8");
  const serverOnly = isServerOnlyFile(file, content);
  const rel = relative(ROOT, file).split(sep).join("/");

  content.split("\n").forEach((line, lineIndex) => {
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line))) {
        const precedingStart = Math.max(0, match.index - PUBLIC_PREFIX.length);
        const isPublic = line.slice(precedingStart, match.index) === PUBLIC_PREFIX;
        if (isPublic) {
          failures.push(
            `${rel}:${lineIndex + 1}: "${PUBLIC_PREFIX}${match[0]}" — a secret must never be NEXT_PUBLIC_`,
          );
        } else if (!serverOnly) {
          failures.push(
            `${rel}:${lineIndex + 1}: "${match[0]}" found outside an allowed server-only file ` +
              `(add \`import "server-only"\` if this file is meant to hold it)`,
          );
        }
      }
    }
  });
}

if (failures.length > 0) {
  console.error("check:secrets failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log("check:secrets: no leaked secrets found under src/.");
