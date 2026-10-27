// Clicks through the whole settings UI and the right-click menu; nothing may throw (strict mode catches stray globals).
const assert = require("assert");
const { boot, row, listing } = require("./harness");

const body = listing(row(1, "Alpha", ["a", "b"], "alice"), row(2, "Beta", ["c"], "bob"));
const t = boot({ body, seed: { lfTaglist: "a", lfWhitelist: "c", lfUploaders: "bob", lfConditionalEnabled: true, lfUpdateToastsEnabled: false } });
t.w.confirm = () => false;                  // never actually erase or import
t.w.HTMLElement.prototype.scrollIntoView = function () {};
assert.deepStrictEqual(t.errors, []);

const SKIP = new Set(["lfEraseDataButton", "lfReloadButton"]);
const click = el => el.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));
let clicked = 0;

// Everything with an lf id that's a button, tab label, link-like span, checkbox, radio or select
for (const el of t.doc.querySelectorAll("#lfMainDiv [id^=lf], label[for^=lfTab], .lfNiceButton, .lfSpanLink, #lfFloatyBoi")) {
    if (SKIP.has(el.id)) continue;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || (tag === "INPUT" && !/^(checkbox|radio|button)$/.test(el.type))) continue;
    if (tag === "DIV" || tag === "SECTION" || tag === "TABLE") continue;
    click(el); clicked++;
}
assert.ok(clicked > 20, "clicked " + clicked);

// Save with every checkbox flipped, then reload the state
for (const cb of t.doc.querySelectorAll("#lfMainDiv input[type=checkbox]")) cb.checked = !cb.checked;
t.w.__lf.saveData();
assert.deepStrictEqual(t.bad, []);

// Right-click menu: every kind opens and its buttons work
const tag = t.doc.querySelector("div.tags a");
tag.dispatchEvent(new t.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
const rcmLink = t.doc.getElementById("lfRCMBoxLink");   // the menu keeps a real link for the browser's own context menu
assert.ok(rcmLink && rcmLink.getAttribute("href") === tag.getAttribute("href") && rcmLink.target === "_blank");
for (const b of t.doc.querySelectorAll("#lfRCMBoxChoices .lfRCMButton")) click(b);
for (const [sel, kind] of [[".lfUploaderElement", "uploader"], [".lfTitleElement", "title"]]) {
    const el = t.doc.querySelector(sel);
    if (!el) continue;
    el.dispatchEvent(new t.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    for (const b of t.doc.querySelectorAll("#lfRCMBoxChoices .lfRCMButton")) click(b);
}
assert.deepStrictEqual(t.errors, []);
// Title menu opens and its buttons exist with Hard Pass off (default) and on
for (const hp of [false, true]) {
    const p = boot({ body, seed: { lfHardPassEnabled: hp, lfUpdateToastsEnabled: false } });
    const title = p.doc.querySelector(".lfTitleElement");
    title.dispatchEvent(new p.w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    assert.deepStrictEqual(p.errors, [], "hard pass " + hp);
    assert.ok(!p.doc.getElementById("lfRCMBox").classList.contains("hidden"), "menu opens, hard pass " + hp);
    assert.strictEqual(!!p.doc.getElementById("lfRCMBoxHPTAdd"), hp);
    p.doc.getElementById("lfRCMTitlePhraseText").value = "new phrase";
    click_(p, p.doc.getElementById("lfRCMBoxBLAdd"));
    assert.ok(p.doc.getElementById("lfBlacklistTitleListArea").value.includes("new phrase"));
}
function click_(p, el) { el.dispatchEvent(new p.w.MouseEvent("click", { bubbles: true, cancelable: true })); }

console.log("ui.test OK (" + clicked + " controls clicked)");
