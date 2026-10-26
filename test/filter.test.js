const assert = require("assert");
const { boot, row, listing: rows } = require("./harness");
const hidden = t => [...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden"));
const seed = () => ({ lfTaglist: "bad.tag;@happyfappy/hf.only;@kufirc/other.only", lfUpdateToastsEnabled: false });
const body = rows(row(1, "keep", ["fine"], "alice"), row(2, "hide", ["bad.tag"], "alice"), row(3, "hf", ["hf.only"], "alice"));

// Loads under JSON-only storage; scoped entries apply only on their site
let t = boot({ body, seed: seed(), expose: ["lfBlacklistTags"] });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
assert.ok(t.doc.body.innerHTML.includes("Userscript manager: <b>Violentmonkey 2.31.0</b>"));
assert.deepStrictEqual(hidden(t), [false, true, true]);
t = boot({ host: "kufirc.com", body, seed: seed() });
assert.deepStrictEqual(hidden(t), [false, true, false]);

// Save keeps scoped entries of other sites and stays site-filtered in memory
t = boot({ body, seed: seed(), expose: ["lfBlacklistTags"] });
t.doc.getElementById("lfBlacklistTaglistArea").value = "bad.tag;@happyfappy/hf.only;@kufirc/other.only;New.Tag";
t.w.__lf.saveData();
assert.deepStrictEqual(t.bad, []);
assert.strictEqual(JSON.parse(t.raw.lfTaglist), "@happyfappy/hf.only;@kufirc/other.only;bad.tag;new.tag");
assert.strictEqual(JSON.stringify(Array.from(t.w.__lf.lfBlacklistTags).sort()), JSON.stringify(["bad.tag", "hf.only", "new.tag"]));
t.doc.getElementById("lfBlacklistTaglistArea").value = "bad.tag;@happyfappy,kufirc/shared.tag";
t.w.__lf.removeItemFromList("lfBlacklistTaglistArea", "shared.tag");
assert.strictEqual(t.doc.getElementById("lfBlacklistTaglistArea").value, "bad.tag;@kufirc/shared.tag");

// Open all: manager API when present, popup fallback otherwise
t = boot({ body, seed: seed() });
t.doc.getElementById("lfOpenAllButton").click();
assert.deepStrictEqual(t.opened.map(o => o[0]), ["https://www.happyfappy.net/torrents.php?id=1"]);
t = boot({ body, seed: seed(), withOpenInTab: false });
t.doc.getElementById("lfOpenAllButton").click();
assert.deepStrictEqual(t.popups, ["https://www.happyfappy.net/torrents.php?id=1"]);

// Title phrases match the decoded title text, and appended badges never feed later matches
const tb = rows(row(1, "Tom &amp; Jerry", ["x"], "alice"), row(2, "Plain", ["x"], "alice"), row(3, "Other", ["x"], "alice"));
t = boot({ body: tb, seed: { lfBlacklistTitles: "plain;tom & jerry;other;(other)", lfUpdateToastsEnabled: false } });
assert.deepStrictEqual(t.errors, []);
assert.deepStrictEqual(hidden(t), [true, true, true]);
const badges = [...t.doc.querySelectorAll("tr.torrent")].map(r => [...r.querySelectorAll("span.lfHiddenTitle")].map(s => s.textContent));
assert.deepStrictEqual(badges, [["(tom & jerry)"], ["(plain)"], ["(other)"]]);   // "(other)" did not match its own badge
assert.strictEqual(t.doc.querySelectorAll("color").length, 0);

// Right-click handlers bind once per element, however often binding is requested
t = boot({ body, seed: seed() });
let calls = [];
const tag = t.doc.querySelector("div.tags a");
const origAdd = tag.addEventListener.bind(tag);
tag.addEventListener = function (type, fn, opt) { calls.push(type); return origAdd(type, fn, opt); };
for (let i = 0; i < 3; i++) t.w.__lf.lfBindContextMenu(tag, "tag");
assert.ok(tag.dataset.lfRcmBound);              // already bound while the page was set up
assert.deepStrictEqual(calls, []);               // so re-binding adds nothing
tag.dispatchEvent(new t.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
assert.ok(!t.doc.getElementById("lfRCMBox").classList.contains("hidden"));
assert.strictEqual(t.doc.getElementById("lfRCMBoxTag").textContent, "fine");

// Title menu passes the plain title, without badges
t = boot({ body: tb, seed: { lfBlacklistTitles: "plain", lfUpdateToastsEnabled: false } });
const title = t.doc.querySelectorAll("tr.torrent a.x")[1];
assert.ok(title.querySelector(".lfHiddenTitle"));
t.w.__lf.lfBindContextMenu(title, "title");
title.dispatchEvent(new t.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
assert.strictEqual(t.doc.getElementById("lfRCMTitlePhraseText").value, "Plain");

// Lists interplay: blacklist, whitelist rescue, hard pass override, uploader and title lists (case-insensitive)
const mix = rows(
    row(1, "Alpha", ["bad"], "Alice"),            // blacklisted tag, but whitelisted uploader  -> shown
    row(2, "Beta", ["bad", "good"], "bob"),       // whitelisted tag rescues                      -> shown
    row(3, "Gamma", ["hp", "good"], "bob"),       // hard pass beats whitelist                    -> hidden
    row(4, "Delta", ["fine"], "MALLORY"),         // blacklisted uploader                         -> hidden
    row(5, "Epsilon Special", ["bad"], "bob"),    // whitelisted title phrase                     -> shown
    row(6, "Zeta", ["fine"], "bob")               // untouched                                    -> shown
);
t = boot({ body: mix, seed: { lfTaglist: "bad", lfWhitelist: "good", lfHardPassTaglist: "hp", lfUploaders: "mallory", lfWhitelistUploaders: "ALICE",
                              lfWhitelistTitles: "special", lfHardPassEnabled: true, lfUpdateToastsEnabled: false } });
assert.deepStrictEqual(t.errors, []);
assert.deepStrictEqual(hidden(t), [false, false, true, true, false, false]);

// Saving refreshes what is matched (no stale lookup sets)
t = boot({ body, seed: seed(), expose: ["lfMatch"] });
assert.ok(!t.w.__lf.lfMatch.tagBlacklist.has("brand.new"));
t.doc.getElementById("lfBlacklistTaglistArea").value = "bad.tag;brand.new";
t.w.__lf.saveData();
assert.ok(t.w.__lf.lfMatch.tagBlacklist.has("brand.new"));

console.log("filter.test OK");
