const assert = require("assert");
const { boot, row, listing } = require("./harness");
// Tags match regardless of capitalization ("VR" on the page, "vr" in the list)
const body = listing(row(1, "A", ["VR"], "u"), row(2, "B", ["porn.music.video"], "u"), row(3, "C", ["fine"], "u"));
const t = boot({ body, seed: { lfUpdateToastsEnabled: false, lfTaglist: "vr;porn.music.video" } });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
assert.deepStrictEqual([...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden")), [true, true, false]);
console.log("tagkey.test OK");
