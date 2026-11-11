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

// Personal freeleech: its own kind, shown in the "Freeleech" view but not "Sitewide"
const personal = '<span class="icon" title="Personal Freeleech for 17 hours and 24 mins"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons personal_leech  bonus icon_torrent_bonus"></i></div></div></span>';
t = boot({ body: listing(withIcon(row(1, "personal", ["a"], "u"), personal), row(2, "plain", ["a"], "u")), seed: { ...q, lfFreeleechView: "any" } });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
assert.deepStrictEqual(shown(t), [true, false]);
assert.strictEqual(t.doc.querySelectorAll(".lfPersonalFL").length, 1);
t = boot({ body: listing(withIcon(row(1, "personal", ["a"], "u"), personal), row(2, "plain", ["a"], "u")), seed: { ...q, lfFreeleechView: "sitewide" } });
assert.deepStrictEqual(shown(t), [true, false]);
console.log("freeleech personal OK");

// Seeded button on a listing: switches "Hide unseeded uploads" live (counted as hidden, whitelists win)
const noSeed = '<td class="r00">0</td>', seeds = "<td>3</td>";
const seedRows = () => listing(
    row(1, "no seeds", ["a"], "u", noSeed),
    row(2, "seeds", ["a"], "u", seeds),
    row(3, "no seeds, whitelisted uploader", ["a"], "friend", noSeed),
    row(4, "no seeds, blacklisted tag", ["bad"], "u", noSeed));
const isHid = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => r.getAttribute("isLFHidden") === "1");
const hdrText = t => t.doc.getElementById("lfHeaderText").textContent;
const clk = el => el.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));
const sbase = { ...q, lfTaglist: "bad", lfWhitelistUploaders: "friend" };
t = boot({ body: seedRows(), seed: sbase });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
const sb = () => t.doc.getElementById("lfSeededButton");
assert.ok(sb() && /Seeded/.test(sb().textContent) && !sb().classList.contains("lfToggleOn"));
assert.deepStrictEqual(isHid(t), [false, false, false, true]);
assert.ok(/1 hidden/.test(hdrText(t)));
clk(sb());
assert.deepStrictEqual(isHid(t), [true, false, false, true]);          // whitelisted friend stays shown
assert.ok(sb().classList.contains("lfToggleOn") && /2 hidden/.test(hdrText(t)));
assert.strictEqual(JSON.parse(t.raw.lfHideUnseededEnabled), true);
const cls = () => [...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden"));
assert.deepStrictEqual(cls(), [true, false, false, true]);
clk(sb());
assert.deepStrictEqual(isHid(t), [false, false, false, true]);         // blacklisted-tag row is still hidden for its own reason
assert.deepStrictEqual(cls(), [false, false, false, true]);
assert.ok(/1 hidden/.test(hdrText(t)) && !sb().classList.contains("lfToggleOn"));
// While "show hidden" is on, newly hidden rows follow that view
clk(t.doc.getElementById("lfHeaderText"));
clk(sb());
assert.deepStrictEqual(cls(), [false, true, true, false]);
// The setting at load time still works, and the checkbox stays in step
t = boot({ body: seedRows(), seed: { ...sbase, lfHideUnseededEnabled: true } });
assert.deepStrictEqual(isHid(t), [true, false, false, true]);
assert.ok(t.doc.getElementById("lfSeededButton").classList.contains("lfToggleOn"));
clk(t.doc.getElementById("lfSeededButton"));
assert.strictEqual(t.doc.getElementById("lfCheckHideUnseeded").checked, false);
assert.deepStrictEqual(isHid(t), [false, false, false, true]);
t = boot({ body: seedRows(), seed: { ...q, lfSeededButtonEnabled: false } });
assert.strictEqual(t.doc.getElementById("lfSeededButton"), null);

// Bookmarks has no filtering: the button is a plain remembered view there
const bm = () => listing(row(1, "no seeds", ["a"], "u", noSeed), row(2, "seeds", ["a"], "u", seeds));
const bmShown = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => !r.classList.contains("lfNoSeedsHidden"));
t = boot({ path: "/bookmarks.php", body: bm(), seed: { ...q } });
assert.deepStrictEqual(bmShown(t), [true, true]);
clk(t.doc.getElementById("lfSeededButton"));
assert.deepStrictEqual(bmShown(t), [false, true]);
assert.strictEqual(JSON.parse(t.raw.lfSeededOnlyBookmarks), true);
t = boot({ path: "/bookmarks.php", body: bm(), seed: { ...q, lfSeededOnlyBookmarks: true } });
assert.deepStrictEqual(bmShown(t), [false, true]);
console.log("freeleech seeded OK");
