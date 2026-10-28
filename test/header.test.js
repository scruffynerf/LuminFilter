const assert = require("assert");
const { boot, row, listing } = require("./harness");
// The header toggle shows whether hidden torrents are currently shown
const t = boot({ body: listing(row(1, "a", ["bad"], "u"), row(2, "b", ["ok"], "u")), seed: { lfTaglist: "bad", lfUpdateToastsEnabled: false }, expose: ["toggleTorrents"] });
const h = t.doc.getElementById("lfHeaderText");
assert.ok(/1 hidden/.test(h.textContent) && h.classList.contains("lfNiceButton") && !h.classList.contains("lfToggleOn"));
h.click();
assert.ok(/1 shown/.test(h.textContent) && h.classList.contains("lfToggleOn"));
h.click();
assert.ok(/1 hidden/.test(h.textContent) && !h.classList.contains("lfToggleOn"));
console.log("header.test OK");
