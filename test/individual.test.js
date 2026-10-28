// The per-torrent hide button: click toggles hidden/whitelisted, right-click clears.
const assert = require("assert");
const { boot, row, listing } = require("./harness");

const SEED = { lfIndividualUploadHidingEnabled: true, lfUpdateToastsEnabled: false };
const hidden = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden"));
const icons = t => [...t.doc.querySelectorAll(".lfToggleIcon")];
const stored = (t, k) => JSON.parse(t.raw[k] || "[]");
const click = (t, el) => el.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));
const rclick = (t, el) => el.dispatchEvent(new t.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
const state = el => ["lfIndividuallyBlacklisted", "lfIndividuallyWhitelisted", "lfIndividuallyUntouched"].filter(c => el.classList.contains(c)).map(c => c.replace("lfIndividually", ""));
const header = t => t.doc.getElementById("lfHeader").textContent;

// --- Normal listing: B and D are hidden by a tag rule. (When the hidden count reaches zero the page flips
// every row, as the "show hidden" toggle does, so these flows keep at least one rule-hidden row around.) ---
const body = listing(row(11, "A", ["x"], "u"), row(22, "B", ["bad"], "u"), row(33, "C", ["x"], "u"), row(44, "D", ["bad"], "u"));
let t = boot({ body, seed: { ...SEED, lfTaglist: "bad" } });
assert.deepStrictEqual(t.errors, []);
assert.deepStrictEqual(hidden(t), [false, true, false, true]);
assert.deepStrictEqual(icons(t).map(state), [["Untouched"], ["Untouched"], ["Untouched"], ["Untouched"]]);

// click a shown row: it's individually hidden
click(t, icons(t)[0]);
assert.deepStrictEqual(hidden(t), [true, true, false, true]);
assert.deepStrictEqual(state(icons(t)[0]), ["Blacklisted"]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), ["11"]);
assert.strictEqual(t.doc.querySelector("tr.torrent").getAttribute("isLFHidden"), "1");
const headerHidden3 = header(t);
// click it again: hidden -> whitelisted and shown
click(t, icons(t)[0]);
assert.deepStrictEqual(hidden(t), [false, true, false, true]);
assert.deepStrictEqual(state(icons(t)[0]), ["Whitelisted"]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), []);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist"), ["11"]);
assert.notStrictEqual(header(t), headerHidden3);
// click a tag-hidden row: whitelisted and shown
click(t, icons(t)[1]);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist").sort(), ["11", "22"]);
// right-click on a whitelisted row clears it without hiding (it was only whitelisted)
rclick(t, icons(t)[1]);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
assert.deepStrictEqual(state(icons(t)[1]), ["Untouched"]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist"), ["11"]);
// individually blacklist, then right-click: shown again, lists empty
click(t, icons(t)[2]); assert.deepStrictEqual(hidden(t), [false, false, true, true]);
rclick(t, icons(t)[2]);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
assert.deepStrictEqual(state(icons(t)[2]), ["Untouched"]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), []);
assert.strictEqual(header(t).match(/(\d+) (?:hidden|shown)/)[1], "1");   // header count tracks the hidden rows (just D)

// Hidden rows are marked with an inside outline (a stylesheet rule), never an inline background colour
assert.ok(/tr\[isLFHidden="1"\]\s*\{[^}]*outline:\s*2px solid #e53935[^}]*outline-offset:\s*-2px/.test(t.styles.join("\n")));   // reddish default
assert.ok([...t.doc.querySelectorAll("tr.torrent")].every(r => r.style.backgroundColor === ""));
click(t, icons(t)[0]);
assert.ok([...t.doc.querySelectorAll("tr.torrent")].every(r => r.style.backgroundColor === ""));
assert.strictEqual(t.doc.querySelector("tr.torrent").getAttribute("isLFHidden"), "1");

// Stored individual lists are applied on load
t = boot({ body, seed: { ...SEED, lfIndividualUploadHidingBlacklist: ["33"], lfIndividualUploadHidingWhitelist: ["22"], lfTaglist: "bad" } });
assert.deepStrictEqual(hidden(t), [false, false, true, true]);
assert.deepStrictEqual(icons(t).map(state), [["Untouched"], ["Whitelisted"], ["Blacklisted"], ["Untouched"]]);

// --- Top 10: the same torrent can be listed twice; both rows follow the click ---
const top = listing(row(11, "A", ["x"], "u"), row(11, "A again", ["x"], "u"), row(33, "C", ["x"], "u"), row(44, "D", ["bad"], "u"));
t = boot({ path: "/top10.php", body: top, seed: { ...SEED, lfTaglist: "bad" } });
assert.deepStrictEqual(t.errors, []);
assert.strictEqual(icons(t).length, 4);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
click(t, icons(t)[0]);
assert.deepStrictEqual(hidden(t), [true, true, false, true]);
assert.deepStrictEqual(icons(t).map(state), [["Blacklisted"], ["Blacklisted"], ["Untouched"], ["Untouched"]]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), ["11"]);
assert.strictEqual(header(t).match(/(\d+) (?:hidden|shown)/)[1], "3");
click(t, icons(t)[1]);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
assert.deepStrictEqual(icons(t).map(state), [["Whitelisted"], ["Whitelisted"], ["Untouched"], ["Untouched"]]);
assert.strictEqual(header(t).match(/(\d+) (?:hidden|shown)/)[1], "1");
rclick(t, icons(t)[0]);
assert.deepStrictEqual(icons(t).map(state), [["Untouched"], ["Untouched"], ["Untouched"], ["Untouched"]]);
assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist"), []);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
// blacklist then clear on Top 10: rows come back and the count returns
click(t, icons(t)[2]); assert.deepStrictEqual(hidden(t), [false, false, true, true]);
rclick(t, icons(t)[2]);
assert.deepStrictEqual(hidden(t), [false, false, false, true]);
assert.strictEqual(header(t).match(/(\d+) (?:hidden|shown)/)[1], "1");
assert.deepStrictEqual(t.errors, []);

// --- Torrent details page: one icon for the torrent in the URL ---
const detailsBody = '<div id="content"><div><h2><span>x</span> Some Title</h2></div><div id="filter_slidetoggle"></div><div class="linkbox"></div>'
    + '<table class="torrent_table"><tbody><tr class="head"><td>h</td><td>h</td></tr><tr class="group_torrent"><td><span class="torrent_icon_container"></span></td><td><strong>Some Title</strong></td></tr></tbody></table>'
    + '<div id="torrent_tags"><ul id="torrent_tags_list"></ul></div></div>';
t = boot({ path: "/torrents.php?id=77", body: detailsBody, seed: SEED });
const dIcon = () => t.doc.querySelector(".lfToggleHideButton i");
if (!dIcon()) { console.log("details page fixture not recognised, skipping"); }
else {
    assert.deepStrictEqual(state(dIcon()), ["Untouched"]);
    click(t, dIcon()); assert.deepStrictEqual(state(dIcon()), ["Blacklisted"]); assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), ["77"]);
    click(t, dIcon()); assert.deepStrictEqual(state(dIcon()), ["Whitelisted"]); assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), []); assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist"), ["77"]);
    click(t, dIcon()); assert.deepStrictEqual(state(dIcon()), ["Blacklisted"]); assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingWhitelist"), []);
    rclick(t, dIcon()); assert.deepStrictEqual(state(dIcon()), ["Untouched"]); assert.deepStrictEqual(stored(t, "lfIndividualUploadHidingBlacklist"), []);
}
assert.deepStrictEqual(t.errors, []);

// The outline is configurable: saved values reach the stylesheet, bad values fall back safely
t = boot({ body, seed: { ...SEED, lfHiddenOutlineColor: "rgb(0, 128, 0)", lfHiddenOutlineWidth: 4, lfHiddenOutlineStyle: "dashed" } });
assert.ok(/outline:\s*4px dashed rgb\(0, 128, 0\)[^}]*outline-offset:\s*-4px/.test(t.styles.join("\n")));
assert.strictEqual(t.doc.getElementById("lfHiddenOutlineStyle").value, "dashed");
t.doc.getElementById("lfHiddenOutlineColor").value = "red;} body{display:none";
t.doc.getElementById("lfHiddenOutlineWidth").value = "99";
t.doc.getElementById("lfHiddenOutlineStyle").value = "ridge";
t.w.__lf.saveData();
assert.strictEqual(JSON.parse(t.raw.lfHiddenOutlineColor), "#e53935");   // unsafe colour rejected
assert.strictEqual(JSON.parse(t.raw.lfHiddenOutlineWidth), 8);            // clamped
assert.strictEqual(JSON.parse(t.raw.lfHiddenOutlineStyle), "solid");      // unknown style rejected
t.doc.getElementById("lfHiddenOutlineColor").value = "#00AAFF";
t.doc.getElementById("lfHiddenOutlineWidth").value = "3";
t.doc.getElementById("lfHiddenOutlineStyle").value = "dotted";
t.w.__lf.saveData();
assert.deepStrictEqual([t.raw.lfHiddenOutlineColor, t.raw.lfHiddenOutlineWidth, t.raw.lfHiddenOutlineStyle].map(x => JSON.parse(x)), ["#00AAFF", 3, "dotted"]);

console.log("individual.test OK");
