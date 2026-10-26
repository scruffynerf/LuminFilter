const assert = require("assert");
const { boot, listing } = require("./harness");
const { JSDOM } = require("jsdom");

// Site detection by host
const site = host => boot({ host, expose: ["lfSite"], body: listing() }).w.__lf.lfSite.id;
assert.strictEqual(site("www.happyfappy.net"), "happyfappy");
assert.strictEqual(site("kufirc.com"), "kufirc");
assert.strictEqual(site("www.empornium.sx"), "empornium");

// Kufirc layout against real-shaped markup: status class sits on the first icon inside the download link;
// the freeleech icon (outside that link) must not read as a status.
const rowHtml = (cls, bm) => `<tr class="torrent"><td><span class="torrent_icon_container">
<span class="icon"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons icon_torrent_okay"></i></div></div></span>
<span class="icon"><a href="/d"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons clickable ${cls} icon_torrent_download"></i><i class="font_icon ${cls} icon_torrent_seeding"></i></div></div></a></span>
<span class="icon"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons bonus icon_torrent_leeching"></i></div></div></span>
${bm ? '<span class="icon"><div class="icon_container"><div class="icon_stack"><i class="font_icon torrent_icons clickable bookmark bookmarked icon_nav_bookmarks"></i></div></div></span>' : ""}
</span></td></tr>`;
const k = boot({ host: "kufirc.com", expose: ["lfSite"], body: listing() });
const layout = k.w.__lf.lfSite.layout;
const doc = new JSDOM(`<table>${rowHtml("seeding", true)}${rowHtml("grabbed", false)}${rowHtml("leeching", true)}</table>`).window.document;
const states = [...doc.querySelectorAll("tr.torrent")].map(r => {
    const icon = r.querySelector(layout.statusIcon);
    return [Object.keys(layout.statusClasses).filter(s => icon.classList.contains(layout.statusClasses[s])).join(","), !!r.querySelector(layout.bookmarked)];
});
assert.deepStrictEqual(states, [["seeding", true], ["grabbed", false], ["leeching", true]]);

// End to end: "hide seeding" hides the seeding row only
const rows = ["seeding", "grabbed", "none"].map((c, i) => rowHtml(c, false).replace("<td>", `<td><a href="/torrents.php?id=${i + 1}">t${i}</a><div class="tags"><a href="/torrents.php?taglist=x">x</a></div>`));
const t = boot({ host: "kufirc.com", seed: { lfHideSeedingEnabled: true, lfUpdateToastsEnabled: false }, body: listing(...rows) });
assert.deepStrictEqual(t.errors, []);
assert.deepStrictEqual([...t.doc.querySelectorAll("tr.torrent")].map(r => r.classList.contains("hidden")), [true, false, false]);
console.log("layout.test OK");
