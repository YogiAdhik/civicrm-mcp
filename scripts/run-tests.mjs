// Portable test runner: enumerate compiled test files and hand them to `node --test`.
// Needed because `node --test <glob>` is only supported on Node ≥22; on Node 18/20
// the glob must be pre-expanded for us.
import { readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const dir = resolve("dist/__tests__");
let files;
try {
  files = readdirSync(dir)
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => join(dir, f));
} catch (err) {
  console.error(`Cannot read ${dir}: ${err.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No *.test.js files in ${dir}`);
  process.exit(1);
}

for (const f of files) {
  if (!statSync(f).isFile()) {
    console.error(`Skipping non-file: ${f}`);
  }
}

const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
