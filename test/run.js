// Runs every *.test.js in this folder; exits non-zero if any fail.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
let failed = 0;
for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith(".test.js")).sort()) {
    const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" });
    process.stdout.write(r.stdout || "");
    if (r.status !== 0) { failed++; process.stdout.write(`FAIL ${f}\n${r.stderr}\n`); }
}
process.exit(failed ? 1 : 0);
