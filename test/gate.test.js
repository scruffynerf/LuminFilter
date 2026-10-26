const assert = require("assert");
const { boot } = require("./harness");

const pager = `<a class="pager_prev" href="/prev">p</a><a class="pager_next" href="/next">n</a><a class="pager_last" href="/last">l</a><input id="i"><textarea id="t"></textarea>`;
function page(url, seed) {
    const u = new URL(url);
    const t = boot({ host: u.host, path: u.pathname + u.search, body: pager, seed });
    t.clicks = [];
    for (const a of t.doc.querySelectorAll("a")) a.addEventListener("click", e => { e.preventDefault(); t.clicks.push(a.className); });
    t.press = (code, target, mods) => (target || t.doc.body).dispatchEvent(new t.w.KeyboardEvent("keydown", Object.assign({ code, bubbles: true, cancelable: true }, mods)));
    t.hasUI = () => !!t.doc.getElementById("lfHeader");
    return t;
}
const forum = "https://www.happyfappy.net/forums.php?action=viewthread&threadid=1";

// Off by default: inert, no UI, no key handling
let p = page(forum, {});
assert.deepStrictEqual(p.errors, []); assert.ok(!p.hasUI()); p.press("ArrowRight"); assert.deepStrictEqual(p.clicks, []);

// Site-wide arrows on: no filter UI, arrows work, guarded in inputs and with modifiers
p = page(forum, { lfGlobalArrowNavigationEnabled: true });
assert.deepStrictEqual(p.errors, []); assert.ok(!p.hasUI());
p.press("ArrowRight"); p.press("ArrowLeft"); assert.deepStrictEqual(p.clicks, ["pager_next", "pager_prev"]);
p.clicks.length = 0;
p.press("ArrowRight", p.doc.getElementById("i")); p.press("ArrowRight", p.doc.getElementById("t"));
p.press("ArrowLeft", null, { altKey: true }); p.press("ArrowRight", null, { ctrlKey: true });
assert.deepStrictEqual(p.clicks, []);
p.doc.querySelector("a.pager_next").remove(); p.press("ArrowRight"); assert.deepStrictEqual(p.clicks, ["pager_last"]);

// Pages the filter excludes (top10 users, bookmarks) are plain pages
p = page("https://www.happyfappy.net/top10.php?type=users", { lfGlobalArrowNavigationEnabled: true });
assert.ok(!p.hasUI()); p.press("ArrowRight"); assert.deepStrictEqual(p.clicks, ["pager_next"]);
p = page("https://www.happyfappy.net/bookmarks.php", {});
assert.deepStrictEqual(p.errors, []); assert.ok(!p.hasUI());

// Other site behaves the same
p = page("https://kufirc.com/index.php", { lfGlobalArrowNavigationEnabled: true });
assert.deepStrictEqual(p.errors, []); p.press("ArrowRight"); assert.deepStrictEqual(p.clicks, ["pager_next"]);
console.log("gate.test OK");
