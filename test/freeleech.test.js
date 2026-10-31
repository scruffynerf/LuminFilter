const assert = require("assert");
const { boot, row, listing } = require("./harness");
const q = { lfUpdateToastsEnabled: false };
// Row variants: Luminance icon markup (EMP/Kufirc), HappyFappy gif markup, and a plain row
const emp = (kind, title) => `<span class="icon" title="${title}"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons ${kind}_leech bonus icon_torrent_bonus"></i></div></div></span>`;
const withIcon = (html, icon) => html.replace("</td><td class=\"user\">", `${icon}</td><td class="user">`);
const rows = () => listing(
    withIcon(row(1, "sitewide", ["a"], "u"), emp("sitewide", "Sitewide Freeleech for 12 hours and 46 mins")),
    withIcon(row(2, "unlimited", ["a"], "u"), emp("unlimited", "Unlimited Freeleech")),
    withIcon(row(3, "hf sitewide", ["a"], "u"), '<img src="/static/common/symbols/freedownload.gif" alt="Freeleech" title="Sitewide Freeleech for 1 day, 13 hours"><img src="d.gif" title="Sitewide Doubleseed for 1 day">'),
    withIcon(row(4, "hf unlimited", ["a"], "u"), '<img src="/static/common/symbols/freedownload.gif" alt="Freeleech" title="Unlimited Freeleech">'),
    row(5, "plain", ["a"], "u"));
const shown = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => !r.classList.contains("lfFreeleechHidden"));
const click = t => t.doc.getElementById("lfFreeleechButton").dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));

let t = boot({ body: rows(), seed: { ...q } });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
const btn = () => t.doc.getElementById("lfFreeleechButton");
assert.ok(/All/.test(btn().textContent));
assert.deepStrictEqual(shown(t), [true, true, true, true, true]);
// Highlights: sitewide vs unlimited icons
assert.strictEqual(t.doc.querySelectorAll(".lfSitewideFL").length, 2);
assert.strictEqual(t.doc.querySelectorAll(".lfUnlimitedFL").length, 2);
// Cycle: All -> Freeleech (any) -> Sitewide -> All
click(t);
assert.ok(/Freeleech/.test(btn().textContent) && btn().classList.contains("lfToggleOn"));
assert.deepStrictEqual(shown(t), [true, true, true, true, false]);
click(t);
assert.ok(/Sitewide/.test(btn().textContent));
assert.deepStrictEqual(shown(t), [true, false, true, false, false]);
assert.strictEqual(JSON.parse(t.raw.lfFreeleechView), "sitewide");
click(t);
assert.deepStrictEqual(shown(t), [true, true, true, true, true]);
assert.ok(!btn().classList.contains("lfToggleOn"));

// The chosen view is remembered, and the view is separate from the hidden-torrents toggle
t = boot({ body: rows(), seed: { ...q, lfFreeleechView: "sitewide" } });
assert.deepStrictEqual(shown(t), [true, false, true, false, false]);

// Options: button off, highlight off
t = boot({ body: rows(), seed: { ...q, lfFreeleechButtonEnabled: false, lfFreeleechHighlightEnabled: false } });
assert.strictEqual(t.doc.getElementById("lfFreeleechButton"), null);
assert.strictEqual(t.doc.querySelectorAll(".lfSitewideFL, .lfUnlimitedFL").length, 0);

// Bookmarks page: header + freeleech view only, none of the filter lists
t = boot({ path: "/bookmarks.php", body: listing(...[
    withIcon(row(1, "bad one", ["bad"], "u"), emp("sitewide", "Sitewide Freeleech for 1 hour")),
    withIcon(row(2, "unl", ["fine"], "u"), emp("unlimited", "Unlimited Freeleech"))]), seed: { ...q, lfTaglist: "bad" } });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
assert.strictEqual([...t.doc.querySelectorAll("tr.torrent")].filter(r => r.classList.contains("hidden")).length, 0);   // blacklist not applied
click(t); click(t);   // -> Sitewide
assert.deepStrictEqual(shown(t), [true, false]);
assert.strictEqual(JSON.parse(t.raw.lfFreeleechViewBookmarks), "sitewide");
assert.strictEqual(t.raw.lfFreeleechView, undefined);   // bookmarks keep their own setting
console.log("freeleech.test OK");
