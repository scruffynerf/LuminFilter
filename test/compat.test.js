const assert = require("assert");
const { boot, row, listing } = require("./harness");
const ctx = el => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
const hidden = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden"));
const q = { lfUpdateToastsEnabled: false };

// 1. Another script's image-only link in the first cell must not be mistaken for the title
const withThumb = (html, id) => html.replace("<td>", `<td><a href="/torrents.php?id=${id}" target="_blank"><img src="x.png"></a>`);
let t = boot({ body: listing(withThumb(row(1, "Bad Phrase here", ["x"], "u"), 1), withThumb(row(2, "Fine", ["x"], "u"), 2)), seed: { ...q, lfBlacklistTitles: "bad phrase" } });
assert.deepStrictEqual(t.errors, []);
assert.deepStrictEqual(hidden(t), [true, false]);
assert.strictEqual(t.doc.querySelectorAll("tr.torrent a:has(img) .lfHiddenTitle").length, 0);

// 8. Whole-row spotlight (optional)
const body = listing(row(1, "A", ["fav.tag"], "u"), row(2, "B", ["other"], "u"));
t = boot({ body, seed: { ...q, lfHighlightTags: "fav.tag", lfSpotlightRowGlow: true } });
assert.deepStrictEqual([...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("lfSpotlightRow")), [true, false]);
t = boot({ body, seed: { ...q, lfHighlightTags: "fav.tag" } });
assert.strictEqual(t.doc.querySelectorAll(".lfSpotlightRow").length, 0);

// 7. "Hide only for <uploader>": only with conditional rules on, and writes a rule
const tagLink = d => d.querySelector("div.tags a");
t = boot({ body, seed: { ...q } });
ctx(tagLink(t.doc));
assert.strictEqual(t.doc.getElementById("lfRCMBoxUploaderRule"), null);
t = boot({ body, seed: { ...q, lfConditionalEnabled: true }, expose: ["saveData"] });
ctx(tagLink(t.doc));
const btn = t.doc.getElementById("lfRCMBoxUploaderRule");
assert.ok(btn && /Hide only for u/.test(btn.textContent));
btn.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
assert.strictEqual(JSON.parse(t.raw.lfConditionalRules), "HIDE: $UP{u} AND $TA{fav.tag}");
console.log("compat.test OK");
