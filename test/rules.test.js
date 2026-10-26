const assert = require("assert");
const { boot, row, listing } = require("./harness");

const t = boot({ body: listing(), seed: { lfUpdateToastsEnabled: false }, expose: ["lfCompileConditionalRules", "lfEvaluateRuleNode", "lfEscapeHTML"] });
assert.deepStrictEqual(t.errors, []);
const { lfCompileConditionalRules: compile, lfEvaluateRuleNode: evaluate, lfEscapeHTML: esc } = t.w.__lf;

const ctx = (o = {}) => ({ tags: new t.w.Set(o.tags || []), title: (o.title || "").toLowerCase(), uploader: (o.uploader || "").toLowerCase(), site: o.site || "happyfappy" });
function ev(rule, c) { const r = compile(rule); assert.strictEqual(r.errors.length, 0, rule); return evaluate(r.rules[0].ast, c); }

const R1 = "HIDE: $UP{WickedWitch} AND NOT ($TA{munchkin} OR $TI{Emerald City})";
assert.strictEqual(ev(R1, ctx({ uploader: "wickedwitch", tags: ["x"] })), true);
assert.strictEqual(ev(R1, ctx({ uploader: "wickedwitch", tags: ["munchkin"] })), false);
assert.strictEqual(ev(R1, ctx({ uploader: "wickedwitch", title: "visit the EMERALD city" })), false);
// precedence: NOT > AND > OR
assert.strictEqual(ev("SHOW: $TA{a} OR $TA{b} AND $TA{c}", ctx({ tags: ["a"] })), true);
assert.strictEqual(ev("SHOW: $TA{a} OR $TA{b} AND $TA{c}", ctx({ tags: ["b"] })), false);
// keywords are literal inside braces
assert.strictEqual(ev("HIDE: $TI{this AND that OR NOT those}", ctx({ title: "x this and that or not those y" })), true);
// $SI scoping, case-insensitive
assert.strictEqual(ev("SHOW: $SI{happyfappy} AND $UP{someuser}", ctx({ uploader: "SomeUser" })), true);
assert.strictEqual(ev("SHOW: $SI{happyfappy} AND $UP{someuser}", ctx({ uploader: "someuser", site: "kufirc" })), false);
assert.strictEqual(ev("HIDE: $SI{HappyFappy}", ctx()), true);

// Syntax errors are reported, one per bad rule
for (const [bad, frag] of [["HIDE: $TA{a", "Unterminated"], ["HIDE: $XX{a}", "Unknown selector"], ["HIDE: $TA{a} $TA{b}", "between"],
                           ["HIDE: ($TA{a}", "closing"], ["NOPE: $TA{a}", "Unknown action"], ["$TA{a}", "Missing an action"], ["HIDE: $TA{}", "empty"]]) {
    const r = compile(bad);
    assert.ok(r.errors.length === 1 && r.errors[0].message.includes(frag), bad + " -> " + JSON.stringify(r.errors));
}
assert.strictEqual(compile("# note\n\n// c\nHIDE: $TA{a}\nPASS: $TA{b}").rules.length, 2);
assert.strictEqual(esc('</textarea><b>&"'), '&lt;/textarea&gt;&lt;b&gt;&amp;"');

// End to end on a page: HIDE and SHOW rules, with the rule engine switched on
const body = listing(row(1, "keep", ["fine"], "alice"), row(2, "hide me", ["bad"], "bob"), row(3, "other", ["bad"], "carol"));
const page = rules => boot({ body, seed: { lfConditionalEnabled: true, lfConditionalRules: rules, lfUpdateToastsEnabled: false } });
const hidden = p => [...p.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden"));
let p = page("HIDE: $TA{bad} AND NOT $UP{carol}");
assert.deepStrictEqual(p.errors, []); assert.deepStrictEqual(hidden(p), [false, true, false]);
p = page("HIDE: $TA{bad}\nSHOW: $UP{carol}");
assert.deepStrictEqual(hidden(p), [false, true, false]);
p = page("HIDE: $SI{kufirc}");
assert.deepStrictEqual(hidden(p), [false, false, false]);   // wrong site: rule doesn't apply

// NSE import: converts nse* keys, keeps lists as-is (normalized on next load), skips the saved-version key
const q = boot({ body: listing(), seed: { lfUpdateToastsEnabled: false } });
q.w.confirm = () => true; q.w.alert = () => {};
q.w.FileReader = class { readAsText(f) { this.result = f.text; this.onload(); } };
const stored = {};
q.w.GM_setValue = (k, v) => { stored[k] = v; };
const file = { text: JSON.stringify({ nseTaglist: "a.b c.d", nseSelectedTheme: "nseThemeBaked", nseConditionalRules: "HIDE: $TA{x}", nseConditionalEnabled: true, nseSavedVersion: 1, other: 1 }) };
q.w.importNseSettings({ target: { files: [file], value: "x" } });
assert.deepStrictEqual(JSON.parse(JSON.stringify(stored)), { lfTaglist: "a.b c.d", lfSelectedTheme: "lfThemeBaked", lfConditionalRules: "HIDE: $TA{x}", lfConditionalEnabled: true });
console.log("rules.test OK");
