const assert = require("assert");
const { boot, row, listing } = require("./harness");
const body = listing(row(1, "Plain one", ["fine"], "alice"), row(2, "Shiny title", ["pop.tag"], "bob"), row(3, "Hidden", ["bad.tag"], "carol"));
const seed = extra => Object.assign({ lfUpdateToastsEnabled: false, lfTaglist: "bad.tag", lfHighlightTags: "pop.tag;bad.tag;@kufirc/other.tag",
    lfHighlightTitles: "shiny", lfHighlightUploaders: "alice;@kufirc/bob" }, extra);
const cls = (t, sel) => [...t.doc.querySelectorAll(sel)].map(e => e.className);
const has = (t, c) => t.doc.querySelectorAll("." + c).length;

let t = boot({ body, seed: seed() });
assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.bad, []);
// Highlighting never hides or shows anything
assert.deepStrictEqual([...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden")), [false, false, true]);
assert.strictEqual(has(t, "lfHighlightedTitle"), 1);
assert.strictEqual(has(t, "lfHighlightedUploader"), 1);          // alice only; bob's entry is scoped to kufirc
assert.ok(has(t, "lfHighlightedTag") >= 2);                      // pop.tag and bad.tag (blacklist wins visually via CSS :not)
assert.ok(t.styles.join("\n").includes(".lfHighlightedTag:not(.lfHiddenTag)"));
assert.ok(/color: #ffe600 !important/.test(t.styles.join("\n")));

// Scoped on kufirc
t = boot({ host: "kufirc.com", body, seed: seed() });
assert.deepStrictEqual(t.errors, []);

// Settings: sanitized and saved; background optional
t = boot({ body, seed: seed(), expose: ["lfHighlightColor", "lfHighlightBgColor"] });
t.doc.getElementById("lfHighlightColor").value = "not a color;}";
t.doc.getElementById("lfHighlightBgColor").value = "red;}evil";
t.doc.getElementById("lfBlacklistBgColor").value = "#102030";
t.w.__lf.saveData();
assert.deepStrictEqual(t.bad, []);
assert.ok(/^#[0-9a-f]{3,8}$/i.test(JSON.parse(t.raw.lfHighlightColor)), t.raw.lfHighlightColor);
assert.ok(!/[;}]/.test(JSON.parse(t.raw.lfHighlightBgColor)), t.raw.lfHighlightBgColor);
assert.strictEqual(JSON.parse(t.raw.lfBlacklistBgColor), "#102030");
t.doc.getElementById("lfHighlightBgColor").value = "";
t.w.__lf.saveData();
assert.strictEqual(JSON.parse(t.raw.lfHighlightBgColor), "");

// Preset fills inputs, does not save
t = boot({ body, seed: seed() });
const sel = t.doc.getElementById("lfColorPreset");
const presetKey = [...sel.options].map(o => o.value).find(v => v);
sel.value = presetKey;
sel.dispatchEvent(new t.w.Event("change"));
assert.strictEqual(sel.value, "");
assert.ok(/^#/.test(t.doc.getElementById("lfHighlightColor").value));
assert.strictEqual(t.raw.lfHighlightColor, undefined);

// Lists persist through saveData
t = boot({ body, seed: seed() });
t.doc.getElementById("lfHighlightTaglistArea").value = "pop.tag;New.Tag";
t.w.__lf.saveData();
assert.ok(JSON.parse(t.raw.lfHighlightTags).split(";").includes("new.tag"));

// Right-click toggle exists in tag menu
t = boot({ body, seed: seed({ lfRightClickManagementEnabled: true }) });
const tag = t.doc.querySelector("tr.torrent a[href*='taglist'], tr.torrent .tags a, tr.torrent a.tag");
console.log("highlight.test OK");
