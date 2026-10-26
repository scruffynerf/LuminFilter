// Loads the real LuminFilter.user.js into jsdom with a Violentmonkey/Tampermonkey-style GM_* API.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const SCRIPT = fs.readFileSync(path.join(__dirname, "..", "LuminFilter.user.js"), "utf8");
const END_MARKER = "} // End of lfMain";
// Internals every test can reach through window.__lf (the script keeps them out of the global scope)
const DEFAULT_EXPOSE = ["saveData", "removeItemFromList", "addItemToList", "importNseSettings", "lfBindContextMenu", "showRCMBox"];

function row(id, title, tags, user, extra) {
    return `<tr class="torrent"><td><span class="torrent_icon_container"><a><span class="icon"></span></a></span><a class="x" href="/torrents.php?id=${id}">${title}</a><div class="tags">${tags.map(t => `<a href="/torrents.php?taglist=${t}">${t}</a>`).join(" ")}</div></td><td class="user"><a href="/user.php?id=1">${user}</a></td>${extra || ""}</tr>`;
}

// opts: host, path, body (html inside <body>), seed (stored values), expose (names to expose on window.__lf),
//       withOpenInTab, manager
function boot(opts) {
    const o = Object.assign({ host: "www.happyfappy.net", path: "/torrents.php", body: "", seed: {}, expose: [], withOpenInTab: true, manager: "Violentmonkey" }, opts);
    const dom = new JSDOM(`<html><body>${o.body}</body></html>`, { url: `https://${o.host}${o.path}`, runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window, errors = [], opened = [], popups = [], bad = [];
    const raw = {};
    for (const [k, v] of Object.entries(o.seed)) raw[k] = JSON.stringify(v);
    w.GM_info = { scriptHandler: o.manager, version: "2.31.0", script: { version: (SCRIPT.match(/@version\s+(\S+)/) || [])[1] } };
    w.GM_getValue = (k, d) => (k in raw ? JSON.parse(raw[k]) : d);
    // Storage must be JSON-serializable (Violentmonkey stores JSON)
    w.GM_setValue = (k, v) => { if (v === undefined || typeof v === "function" || v instanceof w.Set || v instanceof w.Map) bad.push(k); raw[k] = JSON.stringify(v); };
    w.GM_listValues = () => Object.keys(raw);
    w.GM_deleteValue = k => { delete raw[k]; };
    w.GM_addStyle = () => {};
    if (o.withOpenInTab) w.GM_openInTab = (u, opt) => { opened.push([u, opt]); };
    w.open = u => { popups.push(u); };
    w.alert = () => {};
    w.addEventListener("error", e => errors.push(e.message + (process.env.LF_STACK && e.error ? "\n" + e.error.stack : "")));
    const names = [...new Set(DEFAULT_EXPOSE.concat(o.expose))];
    const expose = `window.__lf={${names.map(n => `get ${n}(){return ${n};}`).join(",")}};\n`;
    try { w.eval(SCRIPT.replace(END_MARKER, expose + END_MARKER)); } catch (e) { errors.push(String((e && e.stack) || e)); }
    return { w, raw, errors, opened, popups, bad, dom, doc: w.document };
}

// A minimal torrent listing page body around the given row html
const listing = (...rows) => `<div id="content"><div id="filter_slidetoggle"></div><div class="linkbox"></div><table><tbody>${rows.join("")}</tbody></table></div>`;

module.exports = { boot, row, listing, SCRIPT };
