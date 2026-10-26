const assert = require("assert");
const { boot, listing } = require("./harness");

const EXPOSE = ["lfSite", "lfParseEntry", "lfScopeFilter", "lfRemoveValueForSite", "lfParseList", "lfStringifyList", "lfInitList"];
const on = (host, seed) => boot({ host, seed: seed || { lfUpdateToastsEnabled: false }, expose: EXPOSE, body: listing() });
const json = v => JSON.stringify(Array.from(v));   // arrays come from another realm, so compare as JSON

// Host detection
for (const [host, id] of [["www.empornium.sx", "empornium"], ["emparadise.rs", "empornium"], ["www.happyfappy.net", "happyfappy"],
                          ["kufirc.com", "kufirc"], ["example.org", "unknown"], ["evilempornium.me", "unknown"]]) {
    const t = on(host);
    assert.deepStrictEqual(t.errors, [], host);
    assert.strictEqual(t.w.__lf.lfSite.id, id, host);
}
assert.strictEqual(on("www.happyfappy.net").w.__lf.lfSite.layout.statusClasses.leeching, "icon_disk_leech");
assert.strictEqual(on("kufirc.com").w.__lf.lfSite.layout.bookmarked, "i.bookmarked");

// Entry parsing
const L = on("www.happyfappy.net").w.__lf;
assert.strictEqual(JSON.stringify(L.lfParseEntry("plain")), JSON.stringify({ sites: null, value: "plain" }));
assert.strictEqual(JSON.stringify(L.lfParseEntry("@HappyFappy,Kufirc/Some Tag")), JSON.stringify({ sites: ["happyfappy", "kufirc"], value: "Some Tag" }));

// Scope filtering per site
const raw = ["scat", "@happyfappy/bob", "@empornium,kufirc/some.tag", "@HAPPYFAPPY/Upper", "@happyfappy/", "", "plain"];
const eff = host => json(on(host).w.__lf.lfScopeFilter(raw));
assert.strictEqual(eff("www.happyfappy.net"), json(["scat", "bob", "Upper", "", "plain"]));
assert.strictEqual(eff("www.empornium.sx"), json(["scat", "some.tag", "", "plain"]));
assert.strictEqual(eff("kufirc.com"), json(["scat", "some.tag", "", "plain"]));
assert.strictEqual(eff("example.org"), json(["scat", "", "plain"]));
assert.strictEqual(json(on("kufirc.com").w.__lf.lfScopeFilter(["@kufirc/some phrase here", "other phrase"])), json(["some phrase here", "other phrase"]));

// Removal only affects the current site
assert.strictEqual(json(L.lfRemoveValueForSite(["a", "@happyfappy/a", "@empornium,happyfappy/a", "@kufirc/a", "b"], "a")), json(["@empornium/a", "@kufirc/a", "b"]));

// List parsing: old space-separated lists still load; phrase lists keep their spaces
assert.strictEqual(json(L.lfParseList("a.b c.d  e")), json(["a.b", "c.d", "e"]));
assert.strictEqual(json(L.lfParseList("a.b;c.d;@kufirc/e.f")), json(["a.b", "c.d", "@kufirc/e.f"]));
assert.strictEqual(json(L.lfParseList("some phrase;@kufirc/other phrase", true)), json(["some phrase", "@kufirc/other phrase"]));
assert.strictEqual(json(L.lfParseList(null)), json([]));
assert.strictEqual(L.lfStringifyList(["a", "b"]), "a;b");

// Migration: a space-separated stored list is normalized, de-duplicated, sorted and re-saved
const m = on("www.happyfappy.net", { lfUpdateToastsEnabled: false });
m.raw.lfTaglist = JSON.stringify("zed.tag beta.tag  @happyfappy/x.y beta.tag");
const [str] = m.w.__lf.lfInitList("lfTaglist", "d");
assert.strictEqual(str, "@happyfappy/x.y;beta.tag;zed.tag");
assert.strictEqual(JSON.parse(m.raw.lfTaglist), str);
console.log("lists.test OK");
