// "Backfill results": loads following pages onto the current one and filters them like the original rows.
const assert = require("assert");
const { boot, row } = require("./harness");

const pageHtml = (rows, next, pagerPages) =>
    `<div id="content"><div id="filter_slidetoggle"></div><div class="linkbox">${pagerPages.map(n => `<a class="pager_page" href="/torrents.php?page=${n}">${n}</a>`).join("")}${next ? `<a class="pager_next" href="/torrents.php?page=${next}">Next</a>` : ""}</div>` +
    `<table id="torrent_table"><tbody>${rows.join("")}</tbody></table></div>`;
const PAGES = {
    "https://www.happyfappy.net/torrents.php?page=2": pageHtml([row(2, "Dup", ["x"], "u"), row(3, "Three", ["bad"], "u"), row(4, "Four", ["x"], "u")], 3, [2, 3]),
    "https://www.happyfappy.net/torrents.php?page=3": pageHtml([row(5, "Five", ["x"], "u"), row(6, "Six", ["bad"], "u")], null, [2, 3])
};
const start = (seed, opts) => {
    const t = boot(Object.assign({ body: pageHtml([row(1, "One", ["x"], "u"), row(2, "Two", ["bad"], "u")], 2, [2, 3]), seed: Object.assign({ lfTaglist: "bad", lfUpdateToastsEnabled: false }, seed) }, opts));
    t.fetched = [];
    t.w.fetch = async url => { t.fetched.push(url); return { ok: url in PAGES, text: async () => PAGES[url] }; };
    return t;
};
const wait = async (t, cond) => { for (let i = 0; i < 200 && !cond(); i++) await new Promise(r => setTimeout(r, 5)); assert.ok(cond(), "timed out"); };
const rows = t => [...t.doc.querySelectorAll("tr.torrent")];
const ids = t => rows(t).map(r => r.querySelector("a.x").getAttribute("href").match(/id=(\d+)/)[1]);
const hidden = t => rows(t).map(r => r.classList.contains("hidden"));
const button = t => t.doc.getElementById("lfBackfillButton");
const status = t => t.doc.getElementById("lfBackfillStatus").textContent.trim();
const click = (t, el) => el.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, cancelable: true }));

(async () => {
    // Loads everything, skips duplicates, filters new rows, and ends with "No more pages"
    let t = start({});
    assert.deepStrictEqual(t.errors, []);
    assert.ok(button(t) && !button(t).classList.contains("lfDisabledButton"));
    click(t, button(t));
    await wait(t, () => status(t) === "No more pages");
    assert.deepStrictEqual(t.fetched, Object.keys(PAGES));
    assert.deepStrictEqual(ids(t), ["1", "2", "3", "4", "5", "6"]);                 // row 2 was not added twice
    assert.deepStrictEqual(hidden(t), [false, true, true, false, false, true]);
    assert.strictEqual(t.doc.getElementById("lfHeader").textContent.match(/(\d+) hidden/)[1], "3");
    assert.strictEqual(t.doc.querySelectorAll(".lfToggleIcon").length, 6 - 0);      // eye icon on every row (individual hiding is on by default)
    assert.strictEqual(t.doc.querySelectorAll("tr.torrent a.lfTagElement.lfHiddenTag").length, 3);   // tag highlighting + right-click marks on new rows
    assert.deepStrictEqual([...t.doc.querySelectorAll("a.pager_page")].map(a => a.classList.contains("lfBackfilledPagerPage")), [true, true]);
    assert.ok(button(t).classList.contains("lfDisabledButton"));
    assert.deepStrictEqual(t.errors, []);

    // Page limit: one page per click, "next" now points past what was loaded
    t = start({ lfBackfillPageLimit: 1 });
    click(t, button(t));
    await wait(t, () => ids(t).length === 4);
    assert.deepStrictEqual(t.fetched, ["https://www.happyfappy.net/torrents.php?page=2"]);
    assert.strictEqual(t.doc.querySelector("a.pager_next").href, "https://www.happyfappy.net/torrents.php?page=3");
    await wait(t, () => !button(t).classList.contains("lfDisabledButton"));
    assert.strictEqual(status(t), "");
    click(t, button(t));
    await wait(t, () => status(t) === "No more pages");
    assert.deepStrictEqual(ids(t), ["1", "2", "3", "4", "5", "6"]);

    // New rows follow the "show hidden" view when it's on: hidden rows shown, others hidden
    t = start({ lfBackfillPageLimit: 1 });
    click(t, t.doc.querySelector("#lfFloatyBoi"));
    assert.deepStrictEqual(hidden(t), [true, false]);
    click(t, button(t));
    await wait(t, () => ids(t).length === 4);
    assert.deepStrictEqual(hidden(t), [true, false, false, true]);

    // A failing fetch reports it and leaves the button usable
    t = start({});
    t.w.fetch = async () => ({ ok: false, text: async () => "" });
    const err = console.error; console.error = () => {};
    click(t, button(t));
    await wait(t, () => status(t) === "Backfill failed");
    console.error = err;
    assert.ok(!button(t).classList.contains("lfDisabledButton"));
    assert.strictEqual(ids(t).length, 2);

    // No next link on load: the button starts disabled; setting off: no button at all
    t = boot({ body: pageHtml([row(1, "One", ["x"], "u")], null, []), seed: { lfUpdateToastsEnabled: false } });
    assert.ok(button(t).classList.contains("lfDisabledButton")); assert.strictEqual(status(t), "No more pages");
    t = boot({ body: pageHtml([row(1, "One", ["x"], "u")], 2, [2]), seed: { lfBackfillButtonEnabled: false, lfUpdateToastsEnabled: false } });
    assert.strictEqual(button(t), null);

    // Settings: the limit is clamped and saved
    t = start({});
    t.doc.getElementById("lfBackfillPageLimit").value = "99";
    t.w.__lf.saveData();
    assert.strictEqual(JSON.parse(t.raw.lfBackfillPageLimit), 15);
    assert.strictEqual(t.doc.getElementById("lfBackfillPageLimit").value, "15");
    t.doc.getElementById("lfBackfillPageLimit").value = "abc";
    t.w.__lf.saveData();
    assert.strictEqual(JSON.parse(t.raw.lfBackfillPageLimit), 2);

    console.log("backfill.test OK");
})().catch(e => { console.error(e); process.exit(1); });
