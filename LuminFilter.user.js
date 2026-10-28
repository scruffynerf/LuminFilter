// ==UserScript==
// @name         LuminFilter
// @namespace    https://github.com/scruffynerf/LuminFilter
// @version      3.6.9
// @license      GPLv3
// @description  Fully featured torrent filtering solution for Luminance-based sites (fork of NoShitEmpornium)
// @updateURL    https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.meta.js
// @downloadURL  https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.user.js
// @supportURL   https://github.com/scruffynerf/LuminFilter/issues
// @homepageURL  https://github.com/scruffynerf/LuminFilter/
// @icon         https://raw.githubusercontent.com/scruffynerf/LuminFilter/master/assets/icon.png
// @author       ceodoe, xrt141, mchamster, scruffynerf
// @include      /^https://www\.empornium\.(me|sx|is)/.*/
// @include      /^https://emparadise\.rs/.*/
// @include      /^https://www\.happyfappy\.(net|sx|is)/.*/
// @include      /^https://kufirc\.com/.*/
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// ==/UserScript==
//
// Copyright © 2015-2026 ceodoe, xrt141, mchamster, scruffynerf
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Credits:
//   ceodoe     - NoShitEmpornium, the original script this is forked from
//   xrt141     - conditional rules engine (AND/OR/NOT), semicolon-delimited lists, compact
//                header buttons, "if all rows are hidden, go to next page", Open all via
//                the userscript manager
//   mchamster  - "Backfill results" button (thanks for the code!)
//   scruffynerf - LuminFilter: multi-site profiles, site-specific filters
// See CHANGELOG.md for version history.

// +----------------------------------------+
// | Page navigation and which pages we run |
// +----------------------------------------+

// Go to the previous/next page of paginated content (falls back to first/last)
function lfGoBack(event = null) {
    let prevLink = document.getElementsByClassName("pager_prev")[0];
    if(prevLink) {
        if(event) { event.preventDefault(); }
        prevLink.click();
    } else {
        let firstLink = document.getElementsByClassName("pager_first")[0];
        if(firstLink) {
            if(event) { event.preventDefault(); }
            firstLink.click();
        }
    }
}

function lfGoForward(event = null) {
    let nextLink = document.getElementsByClassName("pager_next")[0];
    if(nextLink) {
        if(event) { event.preventDefault(); }
        nextLink.click();
    } else {
        let lastLink = document.getElementsByClassName("pager_last")[0];
        if(lastLink) {
            if(event) { event.preventDefault(); }
            lastLink.click();
        }
    }
}

// Left/Right arrow keys move between pages, except while typing or when a modifier is held
// (Alt+Left is the browser's own Back shortcut)
function lfArrowKeyHandler(event) {
    if(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { return; }

    let target = event.target;
    if(target && (target.nodeName === "TEXTAREA" || target.nodeName === "INPUT" || target.nodeName === "SELECT" || target.isContentEditable)) { return; }

    if(event.code == "ArrowLeft") {
        lfGoBack(event);
    } else if(event.code == "ArrowRight") {
        lfGoForward(event);
    }
}

// Pages that have torrent lists LuminFilter can filter. On every other page of a supported
// site, LuminFilter does nothing except (optionally) arrow key navigation.
// Note: bookmarks.php is deliberately not a filter page. What you bookmarked is your own curated list, so
// nothing is hidden there ("Hide bookmarked" still applies on listings, collages and notifications).
function lfIsFilterPage() {
    const path = window.location.pathname;
    const query = window.location.search;

    if(/\/top10\.php$/.test(path) && /(\?|&)type=(users|tags|taggers)/.test(query)) { return false; }

    return /\/(torrents|top10|requests)\.php$/.test(path)
        || /\/collage(\/|$)/.test(path)
        || (/\/user\.php$/.test(path) && /(\?|&)action=notify/.test(query));
}

if(!lfIsFilterPage()) {
    if(GM_getValue("lfGlobalArrowNavigationEnabled", false)) {
        document.addEventListener("keydown", lfArrowKeyHandler);
    }
} else {
    lfMain();
}

// Everything below runs only on pages that list torrents (see lfIsFilterPage above).
// It lives in its own strict-mode function so none of it leaks into the page's global scope.
function lfMain() {
"use strict";

// +----------------------------+
// | Loading and initialization |
// +----------------------------+

// Get version information
let lfVersion = GM_info.script.version.split(".");
let lfVersionNum = Number(lfVersion[0] + lfVersion[1].padStart(2, "0") + lfVersion[2].padStart(2, "0"));
let lfSavedVersion = GM_getValue("lfSavedVersion", lfVersionNum);
GM_setValue("lfSavedVersion", lfSavedVersion);


// +------------------------------+
// | Site profiles and list scope |
// +------------------------------+

// Every supported site has a profile: which hostnames it lives on, and how its
// HTML differs from the default Luminance layout. To support a new site, add a
// profile here (and its @include lines in the header). Anything a profile
// doesn't override falls back to lfDefaultLayout.
const lfDefaultLayout = {
    // Icon element in a torrent row whose classes say whether you grabbed/seed/leech/snatched it
    statusIcon: "td > span.torrent_icon_container > span.icon > a > div.icon_container > div.icon_stack > i",
    // The class names that icon carries for each state
    statusClasses: { snatched: "snatched", seeding: "seeding", grabbed: "grabbed", leeching: "leeching" },
    // Element present in a torrent row when it's bookmarked
    bookmarked: "i.bookmarked",
    // The "next page" pager link (used by "If all rows are hidden, go to next page")
    nextPage: "a.pager_next[href]"
};

function lfLayout(overrides = {}) {
    return { ...lfDefaultLayout, ...overrides };
}

const lfSiteProfiles = {
    empornium: {
        name: "Empornium",
        hosts: [/(^|\.)empornium\.(me|sx|is)$/, /(^|\.)emparadise\.rs$/],
        layout: lfLayout()
    },
    happyfappy: {
        name: "HappyFappy",
        hosts: [/(^|\.)happyfappy\.(net|sx|is)$/],
        layout: lfLayout({
            statusIcon: "td > span.torrent_icon_container > a > span",
            statusClasses: { snatched: "icon_disk_snatched", seeding: "icon_disk_seed", grabbed: "icon_disk_grabbed", leeching: "icon_disk_leech" },
            // Bookmarked rows carry <i class="... bookmarked ..."> (current markup); the older span is kept as a fallback
            bookmarked: "i.bookmarked, td > span.torrent_icon_container > span.icon_bookmarked"
        })
    },
    kufirc: {
        name: "Kufirc",
        hosts: [/(^|\.)kufirc\.com$/],
        // Checked against Kufirc's listing and bookmark markup: the default layout matches. The first icon in the
        // download link carries the seeding/grabbed/leeching class (the freeleech icon is outside that link, so it
        // isn't mistaken for a status). "snatched" is assumed to follow the same pattern but hasn't been seen yet.
        layout: lfLayout()
    }
};

function lfDetectSite() {
    const host = window.location.hostname.toLowerCase();
    for(const [id, profile] of Object.entries(lfSiteProfiles)) {
        if(profile.hosts.some(function(re) { return re.test(host); })) {
            return { id: id, ...profile };
        }
    }
    return { id: "unknown", name: host, layout: lfDefaultLayout };
}

const lfSite = lfDetectSite();

// Help text shown above the filter lists on the Tags, Titles and Uploaders tabs
const lfScopeHelpHTML = `<span class="lfExplanationSpan">Entries apply on every site. To limit one to a single site, prefix it with <b>@site/</b>, e.g. <b>@${Object.keys(lfSiteProfiles)[0]}/someone</b>, or list several sites with commas: <b>@${Object.keys(lfSiteProfiles).slice(0, 2).join(",")}/some.tag</b>. Sites: ${Object.keys(lfSiteProfiles).join(", ")}. You are on <b>${lfSite.name}</b>.</span>`;

// Filter list entries are either plain or scoped:
//   value                  applies on every site
//   @site/value            applies only on that site
//   @site1,site2/value     applies only on those sites
// (site ids are the keys of lfSiteProfiles)
function lfParseEntry(entry) {
    const match = /^@([a-z0-9_,-]+)\/(.*)$/i.exec(entry.trim());
    if(!match) { return { sites: null, value: entry }; }
    return { sites: match[1].toLowerCase().split(",").filter(Boolean), value: match[2] };
}

// The entries that apply on the current site, with scope prefixes stripped
function lfScopeFilter(entries) {
    const result = [];
    for(const entry of entries) {
        const parsed = lfParseEntry(entry);
        if(parsed.sites === null) {
            result.push(entry);
        } else if(parsed.value.trim() !== "" && parsed.sites.includes(lfSite.id)) {
            result.push(parsed.value);
        }
    }
    return result;
}

// Remove a value as far as the current site is concerned: plain entries are removed,
// entries scoped to this site are removed, and for multi-site entries only this site is dropped.
function lfRemoveValueForSite(entries, value) {
    const result = [];
    for(const entry of entries) {
        const parsed = lfParseEntry(entry);
        if(parsed.sites === null) {
            if(entry !== value) { result.push(entry); }
        } else if(parsed.value !== value || !parsed.sites.includes(lfSite.id)) {
            result.push(entry);
        } else {
            const remaining = parsed.sites.filter(function(site) { return site !== lfSite.id; });
            if(remaining.length) { result.push("@" + remaining.join(",") + "/" + parsed.value); }
        }
    }
    return result;
}

// +--------------------------------------------------------------------------+
// | All filter lists (tags, titles, uploaders) are semicolon-separated.       |
// | Legacy space-separated tag/uploader lists are migrated automatically.     |
// +--------------------------------------------------------------------------+

const LF_DELIMITER = ";";

// Parse a stored/typed list string into a clean array.
// allowSpaces = true for lists whose entries may contain spaces (title phrases).
function lfParseList(listString, allowSpaces = false) {
    if(listString === null || listString === undefined) { return new Array(0); }

    // Tags and uploaders never contain spaces, so whitespace is also treated as
    // a delimiter. This transparently migrates old space-separated lists.
    let parts = allowSpaces ? String(listString).split(/[;\n\r]+/) : String(listString).split(/[;\s]+/);

    return parts.map(item => item.trim()).filter(item => item !== "");
}

// Turn an array back into the canonical semicolon-separated string
function lfStringifyList(listArray) {
    return listArray.join(LF_DELIMITER);
}

// Load, normalize, sort and re-save a filter list in one go
function lfInitList(settingName, defaultValue, allowSpaces = false) {
    let items = lfParseList(GM_getValue(settingName, defaultValue), allowSpaces);
    items = [...new Set(items)];
    items.sort();

    let listString = lfStringifyList(items);
    GM_setValue(settingName, listString);

    return [listString, items];
}

// Load and initialize saved filter lists
let [lfBlacklistTaglist, lfBlacklistTags] = lfInitList("lfTaglist", "enter.tags.here;separated.by.semicolons;no.newlines");
let [lfHardPassTaglist, lfHardPassTags] = lfInitList("lfHardPassTaglist", "enter.hard.pass.tags.here;example.tag;another.tag");
let [lfWhitelistTaglist, lfWhitelistTags] = lfInitList("lfWhitelist", "whitelist.tags;go.here");

let [lfBlacklistTitleList, lfBlacklistTitlePhrases] = lfInitList("lfBlacklistTitles", "this is a title phrase;this is another title phrase", true);
let [lfHardPassTitleList, lfHardPassTitlePhrases] = lfInitList("lfHardPassTitles", "this is a title phrase;this is another title phrase", true);
let [lfWhitelistTitleList, lfWhitelistTitlePhrases] = lfInitList("lfWhitelistTitles", "this is a title phrase;this is another title phrase", true);

// Highlight lists: neither hide nor show anything, they only colour the match
let [lfHighlightTaglist, lfHighlightTags] = lfInitList("lfHighlightTags", "");
let [lfHighlightTitleList, lfHighlightTitlePhrases] = lfInitList("lfHighlightTitles", "", true);
let [lfHighlightUploadersList, lfHighlightUploaders] = lfInitList("lfHighlightUploaders", "");

let [lfBlacklistUploadersList, lfBlacklistUploaders] = lfInitList("lfUploaders", "PutUserNamesHere;SeparatedBySemicolons;NoNewlines");
let [lfWhitelistUploadersList, lfWhitelistUploaders] = lfInitList("lfWhitelistUploaders", "PutUserNamesHere;SeparatedBySemicolons;NoNewlines");

// +--------------------------------------------------------------------------+
// | Conditional rules engine                                                  |
// |                                                                           |
// | One rule per line:  ACTION: <expression>                                  |
// |   ACTION     HIDE (blacklist tier) | PASS (Hard Pass tier) | SHOW (white) |
// |   selectors  $TA{tag}  $UP{uploader}  $TI{title phrase}                   |
// |   operators  NOT > AND > OR, parentheses to override                      |
// |                                                                           |
// | The lexer is mode-switched: operator keywords are ONLY recognised outside |
// | of {} braces, so a title phrase may freely contain the words AND, OR and  |
// | NOT without any escaping. Inside braces only \} and \\ are special.       |
// |                                                                           |
// | Example:                                                                  |
// |   HIDE: $UP{wickedwitch} AND NOT ($TA{munchkin} OR $TI{Emerald City})     |
// +--------------------------------------------------------------------------+

const LF_RULE_ACTIONS = ["HIDE", "PASS", "SHOW"];
const LF_RULE_SELECTORS = { TA: "tag", UP: "uploader", TI: "title", SI: "site" };

// Rules are stored verbatim (newline-separated) so operator keywords and
// punctuation survive a save/load round trip untouched.
let lfConditionalRulesText = String(GM_getValue("lfConditionalRules", ""));
GM_setValue("lfConditionalRules", lfConditionalRulesText);

function lfRuleError(message, position) {
    let error = new Error(message);
    error.lfPosition = position;
    return error;
}

// Turn one expression string into a token array.
// Token kinds: selector, and, or, not, lparen, rparen
function lfTokenizeRule(input) {
    let tokens = new Array(0);
    let i = 0;

    while(i < input.length) {
        let char = input[i];

        // Skip whitespace between tokens
        if(/\s/.test(char)) { i++; continue; }

        if(char === "(") { tokens.push({ kind: "lparen", position: i }); i++; continue; }
        if(char === ")") { tokens.push({ kind: "rparen", position: i }); i++; continue; }

        // Selector: $XX{ ...literal... }
        if(char === "$") {
            let start = i;
            let code = input.substr(i + 1, 2).toUpperCase();

            if(!Object.prototype.hasOwnProperty.call(LF_RULE_SELECTORS, code)) {
                throw lfRuleError(`Unknown selector "$${input.substr(i + 1, 2)}". Use $TA, $UP, $TI or $SI.`, start);
            }

            if(input[i + 3] !== "{") {
                throw lfRuleError(`Expected "{" after $${code}.`, i + 3);
            }

            // Literal mode: consume everything up to the closing brace.
            // Operators and parens have no meaning in here.
            let literal = "";
            let j = i + 4;
            let closed = false;

            while(j < input.length) {
                if(input[j] === "\\" && (input[j + 1] === "}" || input[j + 1] === "{" || input[j + 1] === "\\")) {
                    literal += input[j + 1];
                    j += 2;
                    continue;
                }

                if(input[j] === "}") { closed = true; break; }

                // A bare "{" in here almost always means the user forgot a "}"
                // earlier, so the literal has silently swallowed the rest of the
                // rule. Without this check the expression would still parse and
                // quietly do the wrong thing.
                if(input[j] === "{") {
                    throw lfRuleError(`Unexpected "{" inside $${code}{...} — you are probably missing a closing "}". Write \\{ if you really meant a literal brace.`, j);
                }

                literal += input[j];
                j++;
            }

            if(!closed) {
                throw lfRuleError(`Unterminated $${code}{...} — missing a closing "}".`, start);
            }

            literal = literal.trim();
            if(literal === "") {
                throw lfRuleError(`$${code}{} is empty.`, start);
            }

            tokens.push({ kind: "selector", type: LF_RULE_SELECTORS[code], value: literal.toLowerCase(), position: start });
            i = j + 1;
            continue;
        }

        // Operator keyword (only reachable outside braces)
        let wordMatch = /^[A-Za-z]+/.exec(input.substring(i));
        if(wordMatch !== null) {
            let word = wordMatch[0].toUpperCase();

            if(word === "AND" || word === "OR" || word === "NOT") {
                tokens.push({ kind: word.toLowerCase(), position: i });
                i += wordMatch[0].length;
                continue;
            }

            throw lfRuleError(`Unexpected word "${wordMatch[0]}". Expected AND, OR, NOT or a $TA/$UP/$TI/$SI selector.`, i);
        }

        throw lfRuleError(`Unexpected character "${char}".`, i);
    }

    return tokens;
}

// Recursive descent parser. Precedence: NOT binds tightest, then AND, then OR.
function lfParseRuleExpression(tokens) {
    let pos = 0;

    function peek() { return pos < tokens.length ? tokens[pos] : null; }
    function endPosition() { return tokens.length > 0 ? tokens[tokens.length - 1].position : 0; }

    function parsePrimary() {
        let token = peek();

        if(token === null) {
            throw lfRuleError("Unexpected end of expression — something is missing here.", endPosition());
        }

        if(token.kind === "not") {
            pos++;
            return { kind: "not", operand: parsePrimary() };
        }

        if(token.kind === "lparen") {
            pos++;
            let inner = parseOr();
            let next = peek();

            if(next === null || next.kind !== "rparen") {
                throw lfRuleError('Missing a closing ")".', token.position);
            }

            pos++;
            return inner;
        }

        if(token.kind === "selector") {
            pos++;
            return { kind: "match", type: token.type, value: token.value };
        }

        throw lfRuleError(`Expected a $TA/$UP/$TI/$SI selector, NOT or "(" here.`, token.position);
    }

    function parseAnd() {
        let left = parsePrimary();

        while(peek() !== null && peek().kind === "and") {
            pos++;
            left = { kind: "and", left: left, right: parsePrimary() };
        }

        return left;
    }

    function parseOr() {
        let left = parseAnd();

        while(peek() !== null && peek().kind === "or") {
            pos++;
            left = { kind: "or", left: left, right: parseAnd() };
        }

        return left;
    }

    if(tokens.length === 0) {
        throw lfRuleError("Expression is empty.", 0);
    }

    let ast = parseOr();
    let leftover = peek();

    if(leftover !== null) {
        if(leftover.kind === "rparen") {
            throw lfRuleError('Unmatched closing ")".', leftover.position);
        }

        throw lfRuleError("Expected AND or OR between conditions.", leftover.position);
    }

    return ast;
}

// Compile the whole textarea into { rules: [...], errors: [...] }
function lfCompileConditionalRules(rulesText) {
    let rules = new Array(0);
    let errors = new Array(0);
    let lines = String(rulesText === null || rulesText === undefined ? "" : rulesText).split(/\r?\n/);

    for(let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Blank lines and # comments are ignored
        if(line === "" || line.startsWith("#") || line.startsWith("//")) { continue; }

        let separatorIndex = line.indexOf(":");
        if(separatorIndex === -1) {
            errors.push({ line: i + 1, message: 'Missing an action. Start the line with "HIDE:", "PASS:" or "SHOW:".' });
            continue;
        }

        let action = line.substring(0, separatorIndex).trim().toUpperCase();
        if(!LF_RULE_ACTIONS.includes(action)) {
            errors.push({ line: i + 1, message: `Unknown action "${action}". Use HIDE, PASS or SHOW.` });
            continue;
        }

        let expression = line.substring(separatorIndex + 1);

        try {
            let ast = lfParseRuleExpression(lfTokenizeRule(expression));
            rules.push({ action: action, ast: ast, line: i + 1, source: line });
        } catch(error) {
            errors.push({ line: i + 1, message: error.message });
        }
    }

    return { rules: rules, errors: errors };
}

// Evaluate a compiled AST against one torrent.
// context = { tags: Set of lowercase tags, title: lowercase string, uploader: lowercase string, site: site id }
function lfEvaluateRuleNode(node, context) {
    switch(node.kind) {
        case "and":
            return lfEvaluateRuleNode(node.left, context) && lfEvaluateRuleNode(node.right, context);
        case "or":
            return lfEvaluateRuleNode(node.left, context) || lfEvaluateRuleNode(node.right, context);
        case "not":
            return !lfEvaluateRuleNode(node.operand, context);
        case "match":
            if(node.type === "tag") { return context.tags.has(node.value); }
            if(node.type === "uploader") { return context.uploader === node.value; }
            if(node.type === "site") { return context.site === node.value; }
            return context.title.includes(node.value);
    }

    return false;
}

// What's loaded above is the raw lists, as stored (including scoped entries for any site).
// The textareas and saveData work on these. Matching uses the filtered copies below,
// which only hold the entries that apply on the current site.
const lfRawLists = {
    lfTaglist: lfBlacklistTags,
    lfHardPassTaglist: lfHardPassTags,
    lfWhitelist: lfWhitelistTags,
    lfBlacklistTitles: lfBlacklistTitlePhrases,
    lfHardPassTitles: lfHardPassTitlePhrases,
    lfWhitelistTitles: lfWhitelistTitlePhrases,
    lfUploaders: lfBlacklistUploaders,
    lfWhitelistUploaders: lfWhitelistUploaders,
    lfHighlightTags: lfHighlightTags,
    lfHighlightTitles: lfHighlightTitlePhrases,
    lfHighlightUploaders: lfHighlightUploaders
};

// Each stored list: the setting it lives in, and how to refresh the cached copies of it
// (the raw text for saving, the entries that apply on this site for matching).
const lfListBindings = {
    lfTaglist: { setText: v => { lfBlacklistTaglist = v; }, setItems: v => { lfBlacklistTags = v; } },
    lfHardPassTaglist: { setText: v => { lfHardPassTaglist = v; }, setItems: v => { lfHardPassTags = v; } },
    lfWhitelist: { setText: v => { lfWhitelistTaglist = v; }, setItems: v => { lfWhitelistTags = v; } },
    lfBlacklistTitles: { setText: v => { lfBlacklistTitleList = v; }, setItems: v => { lfBlacklistTitlePhrases = v; } },
    lfHardPassTitles: { setText: v => { lfHardPassTitleList = v; }, setItems: v => { lfHardPassTitlePhrases = v; } },
    lfWhitelistTitles: { setText: v => { lfWhitelistTitleList = v; }, setItems: v => { lfWhitelistTitlePhrases = v; } },
    lfUploaders: { setText: v => { lfBlacklistUploadersList = v; }, setItems: v => { lfBlacklistUploaders = v; } },
    lfWhitelistUploaders: { setText: v => { lfWhitelistUploadersList = v; }, setItems: v => { lfWhitelistUploaders = v; } },
    lfHighlightTags: { setText: v => { lfHighlightTaglist = v; }, setItems: v => { lfHighlightTags = v; } },
    lfHighlightTitles: { setText: v => { lfHighlightTitleList = v; }, setItems: v => { lfHighlightTitlePhrases = v; } },
    lfHighlightUploaders: { setText: v => { lfHighlightUploadersList = v; }, setItems: v => { lfHighlightUploaders = v; } }
};

for(const [setting, binding] of Object.entries(lfListBindings)) {
    binding.setItems(lfScopeFilter(lfRawLists[setting]));
}

// Lookup structures for the per-row matching, built once instead of per row.
// Tags are compared as written; uploaders and phrases case-insensitively.
// Tags are compared by a normalized key: sites differ in capitalization ("VR") and
// some write spaces where others use dots ("porn music video" / "porn.music.video")
function lfTagKey(tag) {
    return String(tag).trim().toLowerCase().replace(/\s+/g, ".");
}

let lfMatch = null;
function lfBuildMatchers() {
    const phrases = list => list.map(entry => entry.trim().toLowerCase()).filter(entry => entry !== "");
    lfMatch = {
        tagBlacklist: new Set(lfBlacklistTags.map(lfTagKey)),
        tagHardPass: new Set(lfHardPassTags.map(lfTagKey)),
        tagWhitelist: new Set(lfWhitelistTags.map(lfTagKey)),
        uploaderBlacklist: new Set(phrases(lfBlacklistUploaders)),
        uploaderWhitelist: new Set(phrases(lfWhitelistUploaders)),
        tagHighlight: new Set(lfHighlightTags.map(lfTagKey)),
        uploaderHighlight: new Set(phrases(lfHighlightUploaders)),
        titleHighlight: phrases(lfHighlightTitlePhrases),
        titleBlacklist: phrases(lfBlacklistTitlePhrases),
        titleHardPass: phrases(lfHardPassTitlePhrases),
        titleWhitelist: phrases(lfWhitelistTitlePhrases)
    };
}
lfBuildMatchers();

// Load saved options
//  Filtering options
//   Individual upload filtering
let lfIndividualUploadHidingEnabled = GM_getValue("lfIndividualUploadHidingEnabled", true);
let lfIndividualUploadHidingBlacklist = GM_getValue("lfIndividualUploadHidingBlacklist", new Array(0));
let lfIndividualUploadHidingWhitelist = GM_getValue("lfIndividualUploadHidingWhitelist", new Array(0));

// Filter all button
let lfFilterAllButtonEnabled = GM_getValue("lfFilterAllButtonEnabled", true);

//   Right-Click Management
let lfRightClickManagementEnabled = GM_getValue("lfRightClickManagementEnabled", true);
let lfRCMTagsEnabled = GM_getValue("lfRCMTagsEnabled", true);
let lfRCMTitlesEnabled = GM_getValue("lfRCMTitlesEnabled", true);
let lfRCMUploadersEnabled = GM_getValue("lfRCMUploadersEnabled", true);

//   Torrent site status
let lfHideAnonUploadsEnabled = GM_getValue("lfHideAnonUploadsEnabled", false);
let lfHideReportedEnabled = GM_getValue("lfHideReportedEnabled", false);
let lfHideWarnedEnabled = GM_getValue("lfHideWarnedEnabled", false);
let lfHideUnseededEnabled = GM_getValue("lfHideUnseededEnabled", false);

//   Torrent personal status
let lfHideGrabbedEnabled = GM_getValue("lfHideGrabbedEnabled", false);
let lfHideLeechingEnabled = GM_getValue("lfHideLeechingEnabled", false);
let lfHideSeedingEnabled = GM_getValue("lfHideSeedingEnabled", false);
let lfHideSnatchedEnabled = GM_getValue("lfHideSnatchedEnabled", false);
let lfHideBookmarkedEnabled = GM_getValue("lfHideBookmarkedEnabled", false);
let lfSpotlightRowGlow = GM_getValue("lfSpotlightRowGlow", false);
let lfBypassWhitelistsEnabled = GM_getValue("lfBypassWhitelistsEnabled", false);

//   Hard Pass
let lfHardPassEnabled = GM_getValue("lfHardPassEnabled", false);
let lfRemoveHardPassResults = GM_getValue("lfRemoveHardPassResults", false);

//   Conditional rules
let lfConditionalEnabled = GM_getValue("lfConditionalEnabled", false);

// Compile the saved rules once, up front
let lfCompiledConditionals = lfCompileConditionalRules(lfConditionalRulesText);

//  Interface options
//   Oblivious mode
let lfObliviousModeEnabled = GM_getValue("lfObliviousModeEnabled", false);

//   Custom CSS
let lfCustomCSSEnabled = GM_getValue("lfCustomCSSEnabled", false);
let lfCustomCSS = GM_getValue("lfCustomCSS", "/* With great power comes great responsibility */");

//   Auto-scroll to LuminFilter
let lfScrollToLFEnabled = GM_getValue("lfScrollToLFEnabled", false);

//   Emoji
let lfEmojiEnabled = GM_getValue("lfEmojiEnabled", true);

//   Update toasts
let lfUpdateToastsEnabled = GM_getValue("lfUpdateToastsEnabled", true);

//   Floating toggle button
let lfFloatingToggleButtonEnabled = GM_getValue("lfFloatingToggleButtonEnabled", true);

//   Open all button
let lfOpenAllButtonEnabled = GM_getValue("lfOpenAllButtonEnabled", true);
let lfOpenAllGoNextEnabled = GM_getValue("lfOpenAllGoNextEnabled", false);
let lfAllHiddenGoNextEnabled = GM_getValue("lfAllHiddenGoNextEnabled", false);

//   Backfill results button
function lfClampPageLimit(value) {
    value = Number(value);
    if(isNaN(value) || value < 1) { return 2; }
    return Math.min(Math.floor(value), 15);
}
let lfBackfillButtonEnabled = GM_getValue("lfBackfillButtonEnabled", true);
let lfBackfillPageLimit = lfClampPageLimit(GM_getValue("lfBackfillPageLimit", 2));

//   Fonts
let lfUIFont = GM_getValue("lfUIFont", "Helvetica");
let lfTextAreaFont = GM_getValue("lfTextAreaFont", "Monospace");

// Highlight colors
let lfBlacklistColor = GM_getValue("lfBlacklistColor", "#F00");
let lfHardPassColor = GM_getValue("lfHardPassColor", "#A00");
let lfWhitelistColor = GM_getValue("lfWhitelistColor", "#0F0");

// Highlight colors for the list categories, with optional backgrounds ("" = no background)
let lfHighlightColor = GM_getValue("lfHighlightColor", "#ffe600");
let lfHighlightBgColor = GM_getValue("lfHighlightBgColor", "#000000");
let lfBlacklistBgColor = GM_getValue("lfBlacklistBgColor", "");
let lfHardPassBgColor = GM_getValue("lfHardPassBgColor", "");
let lfWhitelistBgColor = GM_getValue("lfWhitelistBgColor", "");

// One-click colour sets for the boxes in Settings. The color-blind set uses the Okabe-Ito palette, which stays
// distinguishable with the common kinds of red-green color blindness: vermillion, blue, reddish purple, yellow.
const LF_COLOR_PRESETS = {
    default: {
        label: "Default (red / green / yellow)",
        lfBlacklistColor: "#F00", lfHardPassColor: "#A00", lfWhitelistColor: "#0F0",
        lfHighlightColor: "#ffe600", lfHighlightBgColor: "#000000",
        lfBlacklistBgColor: "", lfHardPassBgColor: "", lfWhitelistBgColor: "",
        lfHiddenOutlineColor: "#e53935"
    },
    colorblind: {
        label: "Color-blind safe (orange / blue / pink / yellow)",
        lfBlacklistColor: "#D55E00", lfHardPassColor: "#CC79A7", lfWhitelistColor: "#56B4E9",
        lfHighlightColor: "#F0E442", lfHighlightBgColor: "#000000",
        lfBlacklistBgColor: "", lfHardPassBgColor: "", lfWhitelistBgColor: "",
        lfHiddenOutlineColor: "#D55E00"
    }
};

// Outline for rows hidden by LuminFilter (visible in the "show hidden" view)
const LF_OUTLINE_STYLES = ["solid", "dashed", "dotted", "double"];
const LF_DEFAULT_OUTLINE_COLOR = "#e53935";
function lfSafeColor(value) {
    value = String(value).trim();
    return value !== "" && /^[#a-z0-9(),.%\s-]+$/i.test(value) ? value : LF_DEFAULT_OUTLINE_COLOR;
}
// Like lfSafeColor, but an empty value is allowed (it means "no background")
function lfSafeOptionalColor(value) {
    value = String(value).trim();
    return value === "" ? "" : lfSafeColor(value);
}
lfHighlightColor = lfSafeColor(lfHighlightColor);
lfHighlightBgColor = lfSafeOptionalColor(lfHighlightBgColor);
lfBlacklistBgColor = lfSafeOptionalColor(lfBlacklistBgColor);
lfHardPassBgColor = lfSafeOptionalColor(lfHardPassBgColor);
lfWhitelistBgColor = lfSafeOptionalColor(lfWhitelistBgColor);
function lfClampOutlineWidth(value) {
    value = Math.floor(Number(value));
    return isNaN(value) || value < 1 ? 2 : Math.min(value, 8);
}
let lfHiddenOutlineColor = lfSafeColor(GM_getValue("lfHiddenOutlineColor", LF_DEFAULT_OUTLINE_COLOR));
let lfHiddenOutlineWidth = lfClampOutlineWidth(GM_getValue("lfHiddenOutlineWidth", 2));
let lfHiddenOutlineStyle = GM_getValue("lfHiddenOutlineStyle", "solid");
if(!LF_OUTLINE_STYLES.includes(lfHiddenOutlineStyle)) { lfHiddenOutlineStyle = "solid"; }

// Custom timeout
let lfTimeout = GM_getValue("lfTimeout", 1500);

//   Theme
let lfSelectedTheme = GM_getValue("lfSelectedTheme", "lfThemeDefault");
let lfCustomTheme = GM_getValue("lfCustomTheme", {
    backgroundColor: "#fff",
    backgroundHighlightColor: "#cfe7ff",
    foregroundColor: "#000",
    accentColor: "#0af",
    highlightColor: "#0071b0"
});

let themes = {
    lfThemeDefault:
        {
            backgroundColor: "#fff",
            backgroundHighlightColor: "#cfe7ff",
            foregroundColor: "#000",
            accentColor: "#0af",
            highlightColor: "#0071b0"
        },
    lfThemeLegacy:
        {
            backgroundColor: "#00f",
            backgroundHighlightColor: "#44f",
            foregroundColor: "#fff",
            accentColor: "#ddd",
            highlightColor: "#fff"
        },
    lfThemeEdgy:
        {
            backgroundColor: "#000",
            backgroundHighlightColor: "#333",
            foregroundColor: "#f00",
            accentColor: "#f22",
            highlightColor: "#f22"
        },
    lfThemeBaked:
        {
            backgroundColor: "#8300ff",
            backgroundHighlightColor: "#087300",
            foregroundColor: "#0a8700",
            accentColor: "#b669ff",
            highlightColor: "#b669ff"
        },
    lfThemeDarkPurple:
        {
            backgroundColor: "#31363b",
            backgroundHighlightColor: "#495057",
            foregroundColor: "#ffffff",
            accentColor: "#7b68ee",
            highlightColor: "#7b68ee"
        },
    lfThemeCustom:
        {
            backgroundColor: lfCustomTheme.backgroundColor,
            backgroundHighlightColor: lfCustomTheme.backgroundHighlightColor,
            foregroundColor: lfCustomTheme.foregroundColor,
            accentColor: lfCustomTheme.accentColor,
            highlightColor: lfCustomTheme.highlightColor
        }
};

let lfThemeDescriptions = {
    lfThemeDefault: "White background with black text and blue accents",
    lfThemeLegacy: "Ye Olde Theme with a blue background and white text",
    lfThemeEdgy: "For the edgelord in all of us, red text on a black background",
    lfThemeBaked: "Green and purple",
    lfThemeDarkPurple: "A dark mode theme with purple highlights",
    lfThemeCustom: "Define your own colors using the text boxes below"
};

//   Extras
let lfRenumberTorrentsEnabled = GM_getValue("lfRenumberTorrentsEnabled", true);
let lfHideCategoryIconsEnabled = GM_getValue("lfHideCategoryIconsEnabled", false);
let lfArrowNavigationEnabled = GM_getValue("lfArrowNavigationEnabled", false);
let lfGlobalArrowNavigationEnabled = GM_getValue("lfGlobalArrowNavigationEnabled", false);

//   "Fun"
let lfRussianRouletteEnabled = GM_getValue("lfRussianRouletteEnabled", false);
let lfEveryDayIsApril1st = GM_getValue("lfEveryDayIsApril1st", false);


// +------------------------------+
// | Script setup and preparation |
// +------------------------------+

// Figure out what page we're on
let currentPage = "Torrents";
if(window.location.href.includes("top10.php")) {
    currentPage = "Top 10";
} else if(window.location.href.includes("user.php?action=notify")) {
    currentPage = "Notification filters";
} else if(window.location.href.match(/torrents\.php.*(\?|&)(action=notify)/)) {
    currentPage = "Notifications";
} else if(window.location.href.match(/torrents\.php.*(\?|&)(id=)/)) {
    currentPage = "Torrent details";
} else if(window.location.href.includes("/collage/")) {
    currentPage = "Collage";
} else if(window.location.href.includes("/requests.php")) {
    currentPage = "Requests";
} else if(window.location.href.includes("type=uploaded")) {
    // Check if we are on our own uploaded page
    let myUserID = document.querySelector(".username").href.match(/id=([0-9]+)/)[1];
    let pageUserID = window.location.href.match(/userid=([0-9]+)/)[1];

    if(myUserID === pageUserID) {
        currentPage = "My uploaded";
    } else {
        currentPage = "Uploaded";
    }
}

// Define which of our pages where filtering doesn't apply, but other functionality should work
let lfUnfilteredPages = ["My uploaded", "Notification filters", "Torrent details"];

// Reenable torrent icon box and hide comments if GCD is running, check for its unique elements a.comment
if(currentPage == "Torrents") { //torrents.php is the only page we have in common
    window.setTimeout(function() {
        if(document.querySelector("a.comment")) {
            GM_addStyle(`
                span.torrent_icon_container {
                    display: flex !important;
                }
            `);

            for(let i = 0; i < torrents.length; i++) {
                let gcdCommentElement = torrents[i].querySelector("td > div > a.comment");
                let clmCommentElement = torrents[i].querySelector("td:nth-child(4)");

                if(gcdCommentElement) {
                    clmCommentElement.innerHTML = "";
                    clmCommentElement.appendChild(gcdCommentElement);
                }

            }
        }
    }, lfTimeout);
}

let lfEnableApril1stOption = false;
if(lfBlacklistTags.includes("hehehehehe")) {
    lfEnableApril1stOption = true;
}

// Get storage size
window.setTimeout(function() {
    let bytesUsed = exportSettings(true);

    if(bytesUsed < 1024) {
        document.getElementById("lfDataUsage").innerHTML = bytesUsed + " bytes";
    } else {
        document.getElementById("lfDataUsage").innerHTML = Math.round((bytesUsed / 1024) * 100) / 100 + " KiB";
    }
}, lfTimeout);


// Check if we've just updated
if(lfUpdateToastsEnabled) {
    if(lfVersionNum > lfSavedVersion) {
        GM_setValue("lfSavedVersion", lfVersionNum); // Update saved version so toast is only shown once

        let updateToast = document.createElement("div");
        updateToast.innerHTML = `
            <div id="lfUpdateToast">
                <div class="lfUpdateToastDiv">
                    <big>Hooray! LuminFilter was just updated to <b>v${GM_info.script.version}</b>!</big>
                </div>

                <div class="lfUpdateToastDiv">
                    <span class="lfNiceButton" id="lfSeeWhatsNewButton">
                        <span class="lfEmoji">📋</span> See what's new!
                    </span>

                    <span class="lfNiceButton" id="lfCloseUpdateToastButton">
                        <span class="lfEmoji">❌</span> Close
                    </span>

                    <span class="lfNiceButton" id="lfNeverShowUpdateToastButton">
                        <span class="lfEmoji">🚫</span> Don't show again
                    </span>
                </div>
            </div>
        `;

        let reference = document.querySelector("body > :last-child");
        reference.after(updateToast);

        document.getElementById("lfSeeWhatsNewButton").onclick = function() {
            window.open("https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md#latest-changes",'_blank');
            this.parentNode.parentNode.remove();
        };

        document.getElementById("lfCloseUpdateToastButton").onclick = function() {
            this.parentNode.parentNode.remove();
        };

        document.getElementById("lfNeverShowUpdateToastButton").onclick = function() {
            document.getElementById("lfCheckUpdateToasts").checked = false;
            saveData();
            this.parentNode.parentNode.remove();
        };
    }
}

// +--------------+
// | HTML section |
// +--------------+

// Set up reference node
let referenceNode = document.querySelector("div#filter_slidetoggle"); // Torrents

if(currentPage == "Top 10" || currentPage == "Notification filters") {
    referenceNode = document.querySelector("div.linkbox");
} else if(currentPage == "Notifications") {
    referenceNode = document.querySelector("#content > div > h2");
} else if(currentPage == "Torrent details") {
    referenceNode = document.querySelector(".linkbox");
} else if(currentPage == "Collage") {
    referenceNode = document.querySelector("div.thin > div.clear:nth-child(6)");
} else if(currentPage == "Uploaded" || currentPage == "My uploaded") {
    referenceNode = document.querySelector(".submit");
} else if(currentPage == "Requests") {
    referenceNode = document.querySelector("#search_form");
}

// Die if we can't get a reference node, most likely the site is borked or changed its code
if(!referenceNode) {
    throw "Note: LuminFilter died on the way back to his home planet (referenceNode is null)";
}

let htmlContent = document.createElement("div");
htmlContent.innerHTML = `
<div id="lfOuter" class="lfOuterDiv">
    <div id="lfHeader">
        <span id="lfHeaderText">LuminFilter</span>
        <span id="lfToggleOptionsNode" class="lfNiceButton"><span class="lfEmoji">⚙️</span> Options</span><span id="lfDynamicRefreshNode" class="lfNiceButton hidden" title="Reload the page to apply your changes" onclick="javascript:location.reload();">🗘</span>
        ${!lfUnfilteredPages.includes(currentPage) && lfOpenAllButtonEnabled ? `
            <span class="lfNiceButton" id="lfOpenAllButton" title="Open all unfiltered results in new tabs">
                <span class="lfEmoji">📂</span> Open all
            </span>
        ` : ''}
        ${currentPage == "Torrents" && lfBackfillButtonEnabled ? `
            <span class="lfNiceButton" id="lfBackfillButton" title="Load the following result pages onto this one and filter them">
                <span class="lfEmoji">🔁</span> Backfill
            </span><span id="lfBackfillStatus" class="lfExplanationSpan"></span>
        ` : ''}
        ${!lfUnfilteredPages.includes(currentPage) && lfFilterAllButtonEnabled && lfIndividualUploadHidingEnabled ? `
            <span class="lfNiceButton" id="lfFilterAllButton" title="Individually blacklist and hide all unfiltered results">
                <span class="lfEmoji">👁</span> Filter all
            </span>
        ` : ''}
    </div>
    <div id="lfMainDiv" class="lfMainBox hidden">
        <input class="lfRadioButton" id="lfTab1" type="radio" name="tabs" checked>
        <label class="lfLabel" for="lfTab1"><span class="lfEmoji">🏷️</span> Tags</label>

        <input class="lfRadioButton" id="lfTab2" type="radio" name="tabs">
        <label class="lfLabel" for="lfTab2"><span class="lfEmoji">📚</span> Titles</label>

        <input class="lfRadioButton" id="lfTab3" type="radio" name="tabs">
        <label class="lfLabel" for="lfTab3"><span class="lfEmoji">👥</span> Uploaders</label>

        <input class="lfRadioButton" id="lfTab5" type="radio" name="tabs">
        <label class="lfLabel${lfConditionalEnabled ? '' : ' hidden'}" for="lfTab5"><span class="lfEmoji">🧩</span> Conditional</label>

        <input class="lfRadioButton" id="lfTab4" type="radio" name="tabs">
        <label class="lfLabel" for="lfTab4"><span class="lfEmoji">⚙️</span> Settings</label>

        <section id="lfContent1">
            <div class="lfFieldDiv">
                ${lfScopeHelpHTML}
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTagBlacklistHeader"><span class="lfEmoji">👎</span> Tag blacklist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfBLEToggler">[?]</sup><br />
                <div id="lfBLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these tags exist, hide the torrent</i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify tags you don't want to see. Any torrent matching
                        any of these tags will be hidden unless overridden by any of the whitelist
                        rules. Tags use a period between words within a tag, just like on the site
                        itself. <b>Tags are separated by semicolons <span class="lfMonospace">;</span></b>
                        Character case does not matter. Blacklisted tags will be
                        <span class="lfHiddenTag">highlighted</span> when viewing
                        hidden torrents.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>documentary;behind.the.scenes;black.and.white;foreign.film</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfBlacklistTaglistArea" rows=4>${lfBlacklistTaglist}</textarea>
            </div>
            <div class="lfFieldDiv${lfHardPassEnabled ? '' : ' hidden'}">
                <span class="lfImageButton lfListHeader" id="lfTagHardPassHeader"><span class="lfEmoji">🚫</span> Hard Pass tag blacklist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfHPEToggler">[?]</sup><br />
                <div id="lfHPE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these tags exist, hide the torrent <b>no matter what</b></i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify tags you don't want to see at all. Any torrent
                        matching any of these tags will be hidden unless overridden by individual
                        filtering (clicking the eye icon). Tags use a period between words within a
                        tag, just like on the site itself. <b>Tags are separated by semicolons
                        <span class="lfMonospace">;</span></b> Character case does not matter.
                        Hard Pass tags will be <span class="lfHardPassTag">highlighted</span> when viewing hidden torrents. The torrent will be removed completely from the results if the Black Hole
                        option is enabled.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>trailer;sample;low.quality;watermarked;screener</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfHardPassTaglistArea" rows=4>${lfHardPassTaglist}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTagWhitelistHeader"><span class="lfEmoji">👍</span> Tag whitelist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfWLEToggler">[?]</sup><br />
                <div id="lfWLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these tags exist, ignore all other rules and show the torrent</i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify tags you want to show regardless of all other
                        rules. In other words, no matter if the torrent matches on tags, title or
                        uploader blacklists — if it contains any of these whitelisted tags, it
                        will be shown regardless. Tags use a period between words within a tag, just
                        like on the site itself. <b>Tags are separated by semicolons
                        <span class="lfMonospace">;</span></b> Character case does not matter.
                        Whitelisted tags will be <span class="lfWhitelistedTag">highlighted</span>.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>director.cut;criterion;remastered;classic</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfWhitelistTaglistArea" rows=4>${lfWhitelistTaglist}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTagHighlightHeader"><span class="lfEmoji">🔆</span> Tag spotlight <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfHLEToggler">[?]</sup><br />
                <div id="lfHLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>Just color these tags ("notice me!"), don't hide or show anything</i>
                    </div>

                    <div class="lfExplanationNode">
                        Tags listed here are shown in the spotlight color wherever they appear. Spotlighting never hides or shows anything by itself, and
                        blacklist, Hard Pass and whitelist colors win if the same entry is on one of those lists too.
                        Colors can be changed in Settings (there is a color-blind safe preset there).
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>favorite.director;rare.edition</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfHighlightTaglistArea" rows=3>${lfHighlightTaglist}</textarea>
            </div>
        </section>

        <section id="lfContent2">
            <div class="lfFieldDiv">
                ${lfScopeHelpHTML}
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTitleBlacklistHeader"><span class="lfEmoji">👎</span> Title blacklist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfTitleBLEToggler">[?]</sup><br />
                <div id="lfTitleBLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these phrases are in the title, hide the torrent</i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify title phrases you want to filter on. This is
                        useful for hiding untagged content with a recurring theme (for example
                        a series you don't care about, or re-encoded content).
                        Character case does not matter. <b>Title phrases are separated by
                        semicolons <span class="lfMonospace">;</span></b>
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>sample;trailer;reencode;low quality</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfBlacklistTitleListArea" rows=4>${lfBlacklistTitleList}</textarea>
            </div>
            <div class="lfFieldDiv${lfHardPassEnabled ? '' : ' hidden'}">
                <span class="lfImageButton lfListHeader" id="lfTitleHardPassHeader"><span class="lfEmoji">🚫</span> Hard Pass title blacklist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfHPTEToggler">[?]</sup><br />
                <div id="lfHPTE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these phrases exist in the title, hide the torrent <b>no matter what</b></i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify title phrases you don't want to see at all. Any torrent
                        matching any of these phrases in the title will be hidden unless overridden by individual filtering (clicking the eye icon). Character case does not matter. <b>Title phrases are separated by semicolons <span class="lfMonospace">;</span></b> Hard Pass title phrases will be <span class="lfHardPassTag">highlighted</span> when viewing hidden torrents. The torrent will be removed completely from the results if the Black Hole
                        option is enabled.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>sample;trailer;reencode;low quality</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfHardPassTitleListArea" rows=4>${lfHardPassTitleList}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTitleWhitelistHeader"><span class="lfEmoji">👍</span> Title whitelist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfTitleWLEToggler">[?]</sup><br />
                <div id="lfTitleWLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If any of these phrases are in the title, ignore all other rules and show the torrent</i>
                    </div>

                    <div class="lfExplanationNode">This is where you specify title phrases you want to show regardless of other rules. Character case does not matter. <b>Title phrases are separated by semicolons <span class="lfMonospace">;</span></b>
                    </div>

                    <div class="lfExplanationNode">Example:<br /><pre>remastered;director's cut;extended edition;restored</pre></div>
                </div>
                <textarea class="lfTextArea" id="lfWhitelistTitleListArea" rows=4>${lfWhitelistTitleList}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfTitleHighlightHeader"><span class="lfEmoji">🔆</span> Title spotlight <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfTitleHLEToggler">[?]</sup><br />
                <div id="lfTitleHLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>Just color titles containing these phrases</i>
                    </div>

                    <div class="lfExplanationNode">
                        A title containing any of these phrases is shown in the spotlight color. Character case does not matter. Spotlighting never hides or shows anything by itself, and
                        blacklist, Hard Pass and whitelist colors win if the same entry is on one of those lists too.
                        Colors can be changed in Settings (there is a color-blind safe preset there).
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>director's cut;special edition</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfHighlightTitleListArea" rows=3>${lfHighlightTitleList}</textarea>
            </div>
        </section>

        <section id="lfContent3">
            <div class="lfFieldDiv">
                ${lfScopeHelpHTML}
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfUploaderBlacklistHeader"><span class="lfEmoji">👎</span> Uploader blacklist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfUBLEToggler">[?]</sup><br />
                <div id="lfUBLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If this torrent is uploaded by any of these users, hide it</i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify the names of uploaders you want to hide all
                        uploads from, unless overriden by a whitelist rule. Uploader names will be
                        <span class="lfHiddenUploader">highlighted</span> when viewing
                        hidden torrents. Character case does not matter. <b>Uploader names are
                        separated by semicolons <span class="lfMonospace">;</span></b> Note that
                        filtering based on usernames will not function on collage or user upload
                        pages, as torrent uploaders are not exposed on those pages.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>ExampleUploader;AnotherUploader</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfBlacklistUploadersArea" rows=4>${lfBlacklistUploadersList}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfUploaderWhitelistHeader"><span class="lfEmoji">👍</span> Uploader whitelist <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfUWLEToggler">[?]</sup><br />
                <div id="lfUWLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>If this torrent is uploaded by any of these users, show it regardless of any other rules</i>
                    </div>

                    <div class="lfExplanationNode">
                        This is where you specify the names of uploaders you want to show all
                        uploads from, regardless of any blacklist rules. Uploader names will be
                        <span class="lfWhitelistedUploader">highlighted</span>. Character
                        case does not matter. <b>Uploader names are separated by semicolons
                        <span class="lfMonospace">;</span></b> Note that filtering based on
                        usernames will not function on collage or user upload pages, as torrent
                        uploaders are not exposed on those pages.
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>TrustedUploader;AnotherGoodUploader</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfWhitelistUploadersArea" rows=4>${lfWhitelistUploadersList}</textarea>
            </div>
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfUploaderHighlightHeader"><span class="lfEmoji">🔆</span> Uploader spotlight <small>(semicolon-separated)</small></span><sup class="lfExplanationToggler" id="lfUHLEToggler">[?]</sup><br />
                <div id="lfUHLE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>Just color these uploaders' names</i>
                    </div>

                    <div class="lfExplanationNode">
                        Uploader names listed here are shown in the spotlight color. Character case does not matter. Spotlighting never hides or shows anything by itself, and
                        blacklist, Hard Pass and whitelist colors win if the same entry is on one of those lists too.
                        Colors can be changed in Settings (there is a color-blind safe preset there).
                    </div>

                    <div class="lfExplanationNode">
                        Example:<br />
                        <pre>FavoriteUploader;AnotherOne</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfHighlightUploadersArea" rows=3>${lfHighlightUploadersList}</textarea>
            </div>
        </section>

        <section id="lfContent5">
            <div class="lfFieldDiv">
                <span class="lfImageButton lfListHeader" id="lfConditionalHeader"><span class="lfEmoji">🧩</span> Conditional rules <small>(one rule per line)</small></span><sup class="lfExplanationToggler" id="lfCREToggler">[?]</sup><br />
                <div id="lfCRE" class="lfExplanationBox hidden">
                    <div class="lfExplanationNode">
                        <b>TL;DR</b>: <i>Combine tags, titles and uploaders with AND, OR and NOT</i>
                    </div>

                    <div class="lfExplanationNode">
                        Regular blacklists can only say "hide anything with this tag". Conditional
                        rules let you express exceptions and combinations instead — for
                        example "hide everything from this uploader, <i>unless</i> it is tagged
                        with something I like".
                    </div>

                    <div class="lfExplanationNode">
                        Write <b>one rule per line</b>, in the form
                        <span class="lfMonospace">ACTION: expression</span>. Blank lines and lines
                        starting with <span class="lfMonospace">#</span> are ignored, so you can
                        leave yourself notes.
                    </div>

                    <div class="lfExplanationNode">
                        <b>Actions</b><br />
                        <span class="lfMonospace">HIDE:</span> hides the torrent. Your normal tag,
                        title and uploader whitelists can still override it.<br />
                        <span class="lfMonospace">PASS:</span> hides the torrent like a Hard Pass
                        — nothing but individual filtering (the eye icon) overrides it.<br />
                        <span class="lfMonospace">SHOW:</span> whitelists the torrent, overriding
                        any blacklist.
                    </div>

                    <div class="lfExplanationNode">
                        <b>Selectors</b><br />
                        <span class="lfMonospace">$TA{tag.name}</span> matches an exact tag<br />
                        <span class="lfMonospace">$UP{username}</span> matches an exact uploader<br />
                        <span class="lfMonospace">$TI{some phrase}</span> matches part of a title<br />
                        <span class="lfMonospace">$SI{site}</span> matches the site you are on (${Object.keys(lfSiteProfiles).join(", ")})
                    </div>

                    <div class="lfExplanationNode">
                        <b>Operators</b><br />
                        <span class="lfMonospace">AND</span>, <span class="lfMonospace">OR</span>,
                        <span class="lfMonospace">NOT</span>, and parentheses
                        <span class="lfMonospace">( )</span> for grouping.
                        <span class="lfMonospace">NOT</span> binds tightest, then
                        <span class="lfMonospace">AND</span>, then
                        <span class="lfMonospace">OR</span> — so
                        <span class="lfMonospace">a OR b AND c</span> means
                        <span class="lfMonospace">a OR (b AND c)</span>. When in doubt, add
                        parentheses.
                    </div>

                    <div class="lfExplanationNode">
                        Character case never matters. Text inside
                        <span class="lfMonospace">{ }</span> is taken completely literally, so a
                        title phrase can safely contain the words AND, OR or NOT, and brackets or
                        parentheses like <span class="lfMonospace">$TI{[Wicked] (2024)}</span>.
                        If you need a literal brace inside the braces, write
                        <span class="lfMonospace">\\{</span> or <span class="lfMonospace">\\}</span>.
                    </div>

                    <div class="lfExplanationNode">
                        Examples:<br />
                        <pre># Block an uploader, but keep the good stuff
HIDE: $UP{wickedwitch} AND NOT ($TA{munchkin} OR $TA{yellow.brick.road} OR $TI{Emerald City})

# Only hide this tag when it shows up in compilations
HIDE: $TA{documentary} AND $TI{compilation}

# Always show anything with both of these tags
SHOW: $TA{director.cut} AND $TA{classic}

# Never show these, no matter what
PASS: $TA{trailer} OR $TA{sample}

# Whitelist an uploader on one site only
SHOW: $SI{happyfappy} AND $UP{someuser}</pre>
                    </div>
                </div>
                <textarea class="lfTextArea" id="lfConditionalRulesArea" rows=8 spellcheck="false">${lfEscapeHTML(lfConditionalRulesText)}</textarea>
                <div id="lfConditionalStatus" class="lfConditionalStatus"></div>
            </div>
        </section>

        <section id="lfContent4">
            <input class="lfRadioButton" id="lfSettingsTab1" type="radio" name="settingsTabs" checked>
            <label class="lfLabel" for="lfSettingsTab1"><span class="lfEmoji">🔍</span> Filtering</label>

            <input class="lfRadioButton" id="lfSettingsTab2" type="radio" name="settingsTabs">
            <label class="lfLabel" for="lfSettingsTab2"><span class="lfEmoji">🖥️</span> Interface</label>

            <input class="lfRadioButton" id="lfSettingsTab3" type="radio" name="settingsTabs">
            <label class="lfLabel" for="lfSettingsTab3"><span class="lfEmoji">🗃️</span> Data management</label>

            <input class="lfRadioButton" id="lfSettingsTab4" type="radio" name="settingsTabs">
            <label class="lfLabel" for="lfSettingsTab4"><span class="lfEmoji">ℹ️</span> About</label>

            <section id="lfSettingsContent1">
                <h3 class="lfH3">Filtering</h3>
                <b>Individual uploads</b><br />
                <input type="checkbox" id="lfCheckIndividualHide"${lfIndividualUploadHidingEnabled ? ' checked' : ''} />
                <label for="lfCheckIndividualHide" class="lfSettingsCheckbox">
                    <span class="lfEmoji">👁️</span> Enable individual upload filtering
                </label><br />
                <span class="lfExplanationSpan lfESOffset">(Click the eye icon next to the torrent name to blacklist/whitelist uploads</span><br />
                <span class="lfExplanationSpan lfESOffset">individually, ignoring <b>all</b> other rules. These filters are automatically saved)</span><br /><br />

                <b>List management</b><br />
                <input type="checkbox" id="lfCheckRightClickManagementEnabled"${lfRightClickManagementEnabled ? ' checked' : ''} />
                <label for="lfCheckRightClickManagementEnabled" class="lfSettingsCheckbox">
                    <span class="lfEmoji">🖱️</span> Enable Right-Click Management (RCM)
                </label>

                <div id="lfRCMCustomizationDiv" ${lfRightClickManagementEnabled ? '' : 'class="hidden"'}>
                    <span class="lfESOffset">
                        <input type="checkbox" id="lfCheckRCMTagsEnabled"${lfRCMTagsEnabled ? ' checked' : ''} />
                        <label for="lfCheckRCMTagsEnabled" class="lfSettingsCheckbox">
                            <span class="lfEmoji">🏷️</span> Enable for tags
                        </label><br />
                    </span>

                    <span class="lfESOffset">
                        <input type="checkbox" id="lfCheckRCMTitlesEnabled"${lfRCMTitlesEnabled ? ' checked' : ''} />
                        <label for="lfCheckRCMTitlesEnabled" class="lfSettingsCheckbox">
                            <span class="lfEmoji">📚</span> Enable for titles
                        </label><br />
                    </span>

                    <span class="lfESOffset">
                        <input type="checkbox" id="lfCheckRCMUploadersEnabled"${lfRCMUploadersEnabled ? ' checked' : ''} />
                        <label for="lfCheckRCMUploadersEnabled" class="lfSettingsCheckbox">
                            <span class="lfEmoji">👥</span> Enable for uploaders
                        </label>
                    </span>
                </div><br />

                <span class="lfExplanationSpan">Right-click a tag/title/uploader in the torrent list to add/remove from your lists.</span><br /><br />

                <b>Torrent site status</b><br />
                <input type="checkbox" id="lfCheckHideAnonUploads"${lfHideAnonUploadsEnabled ? ' checked' : ''} />
                <label for="lfCheckHideAnonUploads" class="lfSettingsCheckbox">
                    <span class="lfEmoji">👤</span> Hide all anonymous uploads
                </label>
                <span class="lfExplanationSpan">(Will still be overridden by whitelist rules)</span><br />

                <input type="checkbox" id="lfCheckHideReported"${lfHideReportedEnabled ? ' checked' : ''} />
                <label for="lfCheckHideReported" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⛔</span> Hide reported uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents with active reports, whitelists will override)</span><br />

                <input type="checkbox" id="lfCheckHideWarned"${lfHideWarnedEnabled ? ' checked' : ''} />
                <label for="lfCheckHideWarned" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⚔️</span> Hide warned uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents with active warning, whitelists will override)</span><br />

                <input type="checkbox" id="lfCheckHideUnseeded"${lfHideUnseededEnabled ? ' checked' : ''} />
                <label for="lfCheckHideUnseeded" class="lfSettingsCheckbox">
                    <span class="lfEmoji">🏜️</span> Hide unseeded uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents with zero seeders, whitelists will override)</span><br /><br />

                <b>Torrent personal status</b><br />
                <input type="checkbox" id="lfCheckHideGrabbed"${lfHideGrabbedEnabled ? ' checked' : ''} />
                <label for="lfCheckHideGrabbed" class="lfSettingsCheckbox">
                    <span class="lfEmoji">💾</span> Hide grabbed uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents you have previously grabbed)</span><br />

                <input type="checkbox" id="lfCheckHideLeeching"${lfHideLeechingEnabled ? ' checked' : ''} />
                <label for="lfCheckHideLeeching" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⏬</span> Hide leeching uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents you are currently leeching)</span><br />

                <input type="checkbox" id="lfCheckHideSeeding"${lfHideSeedingEnabled ? ' checked' : ''} />
                <label for="lfCheckHideSeeding" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⏫</span> Hide seeding uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents you are currently seeding)</span><br />

                <input type="checkbox" id="lfCheckHideSnatched"${lfHideSnatchedEnabled ? ' checked' : ''} />
                <label for="lfCheckHideSnatched" class="lfSettingsCheckbox">
                    <span class="lfEmoji">💽</span> Hide snatched uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents you have already downloaded/snatched)</span><br />

                <input type="checkbox" id="lfCheckHideBookmarked"${lfHideBookmarkedEnabled ? ' checked' : ''} />
                <label for="lfCheckHideBookmarked" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⭐</span> Hide bookmarked uploads
                </label>
                <span class="lfExplanationSpan">(Hide torrents you have previously bookmarked)</span><br /><br />

                <input type="checkbox" id="lfCheckBypassWhitelists"${lfBypassWhitelistsEnabled ? ' checked' : ''} />
                <label for="lfCheckBypassWhitelists" class="lfSettingsCheckbox">
                    <span class="lfEmoji">💫</span> Bypass whitelists for personal status filtering
                </label><br />
                <span class="lfExplanationSpan lfESOffset">(Ignore all whitelists when filtering grabbed/leeching/seeding/snatched torrents)</span><br /><br />

                <b>Hard Pass</b><br />
                <input type="checkbox" id="lfCheckHardPassEnabled"${lfHardPassEnabled ? ' checked' : ''} />
                <label for="lfCheckHardPassEnabled" class="lfSettingsCheckbox">
                    <span class="lfEmoji">🚫</span> Hard Pass
                </label><span class="lfExplanationSpan">(Enable the Hard Pass blacklists, found in the "Tags" and "Titles" tabs)</span><br />
                <input type="checkbox" id="lfCheckRemoveHardPassResults"${lfRemoveHardPassResults ? ' checked' : ''} />
                <label for="lfCheckRemoveHardPassResults" class="lfSettingsCheckbox">
                    <span class="lfEmoji">⚫</span> Black Hole
                </label><span class="lfExplanationSpan">(Remove results instead of hiding them behind the toggle)</span><br /><br />
                <span class="lfExplanationSpan">Hard Pass enables extra blacklists that will make sure that torrents with the given tags or title phrases will be hidden no matter what. The only thing that can override Hard Pass is whitelisting a torrent through individual filtering when Black Hole is disabled. Enable the Black Hole option to remove results from the page entirely.</span><br /><br />

                <b>Conditional rules</b><br />
                <input type="checkbox" id="lfCheckConditionalEnabled"${lfConditionalEnabled ? ' checked' : ''} />
                <label for="lfCheckConditionalEnabled" class="lfSettingsCheckbox">
                    <span class="lfEmoji">🧩</span> Conditional rules
                </label><span class="lfExplanationSpan">(Enable the "Conditional" tab)</span><br /><br />
                <span class="lfExplanationSpan">Conditional rules let you combine tags, titles and uploaders with AND, OR and NOT — for example hiding an uploader except when the torrent carries a tag you like. See the "Conditional" tab for the full syntax.</span><br /><br />
            </section>

            <section id="lfSettingsContent2">
                <h3 class="lfH3">Interface</h3>

                <div>
                    <input type="checkbox" id="lfCheckObliviousMode"${lfObliviousModeEnabled ? ' checked' : ''} />
                    <label for="lfCheckObliviousMode" class="lfSettingsCheckbox">
                        <span class="lfEmoji">❓</span> Oblivious
                    </label>
                    <span class="lfExplanationSpan">(Hide torrent tag lists)</span><br />

                    <input type="checkbox" id="lfCheckCustomCSS"${lfCustomCSSEnabled ? ' checked' : ''} />
                    <label for="lfCheckCustomCSS" class="lfSettingsCheckbox">
                        <span class="lfEmoji">📜</span> Custom CSS
                    </label>
                    <span class="lfExplanationSpan">(Define your own CSS rules)</span><br />
                    <div id="lfCustomCSSDiv" ${lfCustomCSSEnabled ? '' : 'class="hidden"'}>
                        Define your custom CSS below. Note that this code is injected at the very end of the built-in CSS, so use the !important tag liberally to overwrite existing rules. Do not escape backslashes, it will be done automatically. Avoid using backticks. <br />
                        <textarea class="lfTextArea" id="lfCustomCSSArea" rows=10>${lfCustomCSS.replace(/\\\\/gi,"\\")}</textarea>
                    </div>

                    <input type="checkbox" id="lfCheckScrollToLFEnabled"${lfScrollToLFEnabled ? ' checked' : ''} />
                    <label for="lfCheckScrollToLFEnabled" class="lfSettingsCheckbox">
                        <span class="lfEmoji">⚓</span> Automatically scroll to LuminFilter on page load
                    </label>
                    <span class="lfExplanationSpan">(Makes browsing several pages easier)</span><br />

                    <input type="checkbox" id="lfCheckEmojiEnabled"${lfEmojiEnabled ? ' checked' : ''} />
                    <label for="lfCheckEmojiEnabled" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🖼️</span> Enable extended Unicode icons ("emoji")
                    </label>
                    <span class="lfExplanationSpan">(Disable if you see garbled characters)</span><br />

                    <input type="checkbox" id="lfCheckUpdateToasts"${lfUpdateToastsEnabled ? ' checked' : ''} />
                    <label for="lfCheckUpdateToasts" class="lfSettingsCheckbox">
                        <span class="lfEmoji">❗</span> Notify me when LuminFilter is updated
                    </label>
                    <span class="lfExplanationSpan">(Get changelog info on update)</span><br />

                    <input type="checkbox" id="lfCheckFloatingToggleButton"${lfFloatingToggleButtonEnabled ? ' checked' : ''} />
                    <label for="lfCheckFloatingToggleButton" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🛟</span> Enable the floating toggle button on the bottom right of the page
                    </label><br />

                    <input type="checkbox" id="lfCheckOpenAllButton"${lfOpenAllButtonEnabled ? ' checked' : ''} />
                    <label for="lfCheckOpenAllButton" class="lfSettingsCheckbox">
                        <span class="lfEmoji">📂</span> Show "Open all" button in the header
                    </label><br />
                    <span class="lfExplanationSpan lfESOffset">(Opens all unfiltered results in background tabs using your userscript manager.)</span><br /><br />

                    <input type="checkbox" id="lfCheckFilterAllButtonEnabled"${lfFilterAllButtonEnabled ? ' checked' : ''} />
                    <label for="lfCheckFilterAllButtonEnabled" class="lfSettingsCheckbox">
                        <span class="lfEmoji">👁️</span> Show "Filter all" button in the header
                    </label><br />
                    <span class="lfExplanationSpan lfESOffset">(Blacklists all unfiltered results. Requires individual upload filtering.)</span><br /><br />

                    <input type="checkbox" id="lfCheckOpenAllGoNext"${lfOpenAllGoNextEnabled ? ' checked' : ''} />
                    <label for="lfCheckOpenAllGoNext" class="lfSettingsCheckbox">
                        <span class="lfEmoji">➡️</span> Automatically go to next results page after clicking "Open all" button
                    </label><br />

                    <input type="checkbox" id="lfCheckAllHiddenGoNext"${lfAllHiddenGoNextEnabled ? ' checked' : ''} />
                    <label for="lfCheckAllHiddenGoNext" class="lfSettingsCheckbox">
                        If All Rows Are Hidden, Next Page
                    </label><br /><br />
                    <span class="lfExplanationSpan lfESOffset">(Waits 2 seconds, then clicks Next. Stops at the last page.)</span><br />

                    <input type="checkbox" id="lfCheckBackfillButton"${lfBackfillButtonEnabled ? ' checked' : ''} />
                    <label for="lfCheckBackfillButton" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🔁</span> Show the "Backfill" button on torrent lists
                    </label><br />
                    <span class="lfExplanationSpan lfESOffset">(Loads the next result pages onto the current one and filters them like the rest)</span><br />

                    Pages to backfill per click: <br />
                    <input type="text" class="lfInput" style="width: 50px;" value="${lfBackfillPageLimit}" id="lfBackfillPageLimit" /> <span class="lfExplanationSpan">(1-15, default 2)</span><br />

                    <br />

                    User interface font family: <br />
                    <input type="text" class="lfInput" value="${lfUIFont}" id="lfUIFont" /> <span class="lfExplanationSpan">(Corresponds to the <a class="lfLink" href="https://developer.mozilla.org/en-US/docs/Web/CSS/font-family" target="_blank"><b><u>CSS font-family property</u></b></a>)</span>
                    <br /><br />

                    Filter list font family: <br />
                    <input type="text" class="lfInput" value="${lfTextAreaFont}" id="lfTextAreaFont" /> <span class="lfExplanationSpan">(Font for black/whitelists textareas)</span>
                    <br /><br />


                    Colors for your lists (<a class="lfLink" href="https://developer.mozilla.org/en-US/docs/Web/CSS/color_value" target="_blank"><b><u>any CSS color notation</u></b></a>; leave a background empty for none): <br />
                    <table class="lfColorTable">
                        <tr><th></th><th>Text</th><th>Background</th></tr>
                        <tr><td>Blacklist</td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfBlacklistColor}" id="lfBlacklistColor" /></td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfBlacklistBgColor}" id="lfBlacklistBgColor" /></td></tr>
                        <tr><td>Hard Pass</td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfHardPassColor}" id="lfHardPassColor" /></td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfHardPassBgColor}" id="lfHardPassBgColor" /></td></tr>
                        <tr><td>Whitelist</td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfWhitelistColor}" id="lfWhitelistColor" /></td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfWhitelistBgColor}" id="lfWhitelistBgColor" /></td></tr>
                        <tr><td>Spotlight</td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfHighlightColor}" id="lfHighlightColor" /></td><td><input type="text" class="lfInput" style="width: 90px;" value="${lfHighlightBgColor}" id="lfHighlightBgColor" /></td></tr>
                    </table>
                    <span class="lfExplanationSpan">(A background helps light colors like yellow stay readable.)</span>
                    <br /><br />

                    Color set: <br />
                    <select class="lfInput" id="lfColorPreset">
                        <option value="">Fill in the boxes above and the outline below with...</option>
                        ${Object.entries(LF_COLOR_PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join("")}
                    </select> <span class="lfExplanationSpan">(Only fills in the boxes. Click [Save] to keep it.)</span>
                    <br /><br />

                <input type="checkbox" id="lfCheckSpotlightRowGlow"${lfSpotlightRowGlow ? ' checked' : ''} />
                <label for="lfCheckSpotlightRowGlow" class="lfSettingsCheckbox">
                    <span class="lfEmoji">🔆</span> Spotlight the whole row
                </label>
                <span class="lfExplanationSpan">(Marks the entire row, not just the tag, title or uploader, when something in it matches a spotlight list. Uses the spotlight color.)</span><br /><br />

                    Outline for hidden torrents: <br />
                    <input type="text" class="lfInput" style="width: 90px;" value="${lfHiddenOutlineColor}" id="lfHiddenOutlineColor" title="Color" />
                    <input type="text" class="lfInput" style="width: 40px;" value="${lfHiddenOutlineWidth}" id="lfHiddenOutlineWidth" title="Thickness in pixels (1-8)" /> px
                    <select class="lfInput" id="lfHiddenOutlineStyle" title="Line style">
                        ${LF_OUTLINE_STYLES.map(style => `<option value="${style}"${style === lfHiddenOutlineStyle ? " selected" : ""}>${style}</option>`).join("")}
                    </select>
                    <span class="lfExplanationSpan">(Color, thickness 1-8, style. Drawn inside the row when you toggle hidden torrents.)</span>
                    <br /><br />

                    Timeout for timed functions (milliseconds): <br />
                    <input type="text" class="lfInput" style="width: 50px;" value="${lfTimeout}" id="lfTimeout" /> <span class="lfExplanationSpan">(Used for GCD support and computing storage size)</span>
                    <br /><br />


                    Theme:<br />
                    <select name="lfThemeDropdown" id="lfThemeDropdown" class="lfInput">
                        <option value="lfThemeDefault" ${lfSelectedTheme=="lfThemeDefault" ? "selected='selected'" : ''}>Default</option>
                        <option value="lfThemeLegacy" ${lfSelectedTheme=="lfThemeLegacy" ? "selected='selected'" : ''}>Legacy</option>
                        <option value="lfThemeEdgy" ${lfSelectedTheme=="lfThemeEdgy" ? "selected='selected'" : ''}>Edgy</option>
                        <option value="lfThemeBaked" ${lfSelectedTheme=="lfThemeBaked" ? "selected='selected'" : ''}>Baked</option>
                        <option value="lfThemeDarkPurple" ${lfSelectedTheme=="lfThemeDarkPurple" ? "selected='selected'" : ''}>Dark Purple</option>
                        <option value="lfThemeCustom" ${lfSelectedTheme=="lfThemeCustom" ? "selected='selected'" : ''}>Custom</option>
                    </select>
                    <span id="lfThemeDescription" class="lfExplanationSpan">${lfThemeDescriptions[lfSelectedTheme]}</span>

                    <div id="lfCustomThemeDiv" ${lfSelectedTheme=="lfThemeCustom" ? '' : 'class="hidden"'}>
                        <p>
                            You can use any <a class="lfLink" href="https://developer.mozilla.org/en-US/docs/Web/CSS/color_value" target="_blank">CSS color notation</a> here.<br />
                            Examples: <span class="lfMonospace">#ffffff — rgb(0,0,255) — aquamarine</span>
                        </p>
                        <p>
                            Background color:<br />
                            <input type="text" class="lfInput" id="lfCustomThemeBgCol" value='${lfCustomTheme.backgroundColor}' />
                        </p>
                        <p>
                            Background highlight color:<br />
                            <input type="text" class="lfInput" id="lfCustomThemeBgHighCol" value='${lfCustomTheme.backgroundHighlightColor}' />
                        </p>
                        <p>
                            Foreground color:<br />
                            <input type="text" class="lfInput" id="lfCustomThemeForeCol" value='${lfCustomTheme.foregroundColor}' />
                        </p>
                        <p>
                            Accent color:<br />
                            <input type="text" class="lfInput" id="lfCustomThemeAccentCol" value='${lfCustomTheme.accentColor}' />
                        </p>
                        <p>
                            Highlight color:<br />
                            <input type="text" class="lfInput" id="lfCustomThemeHighCol" value='${lfCustomTheme.highlightColor}' />
                        </p>

                        <p>Remember to click the [Save] button to save your changes!</p>
                    </div>
                </div>

                <div class="lfTopAiryDiv">
                    <b>Extras</b><br />
                    <input type="checkbox" id="lfCheckRenumberTorrents"${lfRenumberTorrentsEnabled ? ' checked' : ''} />
                    <label for="lfCheckRenumberTorrents" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🔢</span> Renumber torrents on "Top X" pages
                    </label>
                    <span class="lfExplanationSpan">(Fixes torrent numbering after filtering)</span><br />

                    <input type="checkbox" id="lfCheckHideCategoryIcons"${lfHideCategoryIconsEnabled ? ' checked' : ''} />
                    <label for="lfCheckHideCategoryIcons" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🟪</span> Hide category icons
                    </label>
                    <span class="lfExplanationSpan">(Hides category icons/links in torrent lists)</span><br />

                    <input type="checkbox" id="lfCheckArrowNavigation"${lfArrowNavigationEnabled ? ' checked' : ''} />
                    <label for="lfCheckArrowNavigation" class="lfSettingsCheckbox">
                        <span class="lfEmoji">⌨️</span> Navigate paginated torrent lists with keyboard arrow keys
                    </label><br />
                    <br />
                    <input type="checkbox" id="lfCheckGlobalArrowNavigation"${lfGlobalArrowNavigationEnabled ? ' checked' : ''} />
                    <label for="lfCheckGlobalArrowNavigation" class="lfSettingsCheckbox">
                        <span class="lfEmoji">⌨️</span> Use the arrow keys on every other page of the site too
                    </label><br />
                    <span class="lfExplanationSpan lfESOffset">(Forums, comments, and anywhere else with page links. Works even when the option above is off.)</span><br />
                </div>

                <div class="lfTopAiryDiv lfBtmAiryDiv">
                    <b>"Fun"</b><br />
                    <input type="checkbox" id="lfCheckRussianRouletteMode"${lfRussianRouletteEnabled ? ' checked' : ''} />
                    <label for="lfCheckRussianRouletteMode" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🎲</span> Russian Roulette
                    </label>
                    <span class="lfExplanationSpan">(Randomly and silently show filtered torrents)</span><br />

                    ${lfEnableApril1stOption ? `<input type="checkbox" id="lfCheckApril1stAllYear"${lfEveryDayIsApril1st ? ' checked' : ''} />
                    <label for="lfCheckApril1stAllYear" class="lfSettingsCheckbox">
                        <span class="lfEmoji">🤪</span> Every day is April 1st
                    </label>
                    <span class="lfExplanationSpan">(For the masochists among us)</span>` : ''}
                </div>
            </section>

            <section id="lfSettingsContent3">
                <h3 class="lfH3">Data management</h3>
                <p>
                    <span class="lfExplanationSpan">Use these functions to import, export or reset all your LuminFilter lists and settings.</span><br /><br />

                    LuminFilter is currently using <span id="lfDataUsage"></span> of data in your LocalStorage.

                    <div class="lfNiceBox"><span class="lfEmoji">⤵️</span> Import LuminFilter data<br />
                        <input type="file" accept=".json,text/plain" id="lfImportFilePicker" class="lfInput">
                    </div><br />
                    <div class="lfNiceBox"><span class="lfEmoji">🔁</span> Import NSE data<br />
                        <span class="lfExplanationSpan">Reads an export file made by NSE (the script LuminFilter is forked from) and copies its lists and settings in. Settings not in the file are left alone, and NSE itself is never modified.</span><br />
                        <input type="file" accept=".json,text/plain" id="lfImportNseFilePicker" class="lfInput">
                    </div><br />
                    <span class="lfNiceButton" id="lfExportButton"><span class="lfEmoji">⤴️</span> Export LuminFilter data</span> 
                    <span class="lfNiceButton" id="lfEraseDataButton"><span class="lfEmoji">🔄</span> Reset LuminFilter data</span><br /><br />

                    <span class="lfExplanationSpan"><b>IMPORTANT: Data overwritten or reset by the functions above is <i>not</i> recoverable!</b></span>
                </p>
            </section>

            <section id="lfSettingsContent4">
                <h3 class="lfH3">About</h3>
                <p>
                    Copyright &copy; 2015-2026 ceodoe, xrt141, mchamster, scruffynerf. LuminFilter v${GM_info.script.version} is a fork of <a class="lfLink" href="https://github.com/ceodoe/noshitempornium" target="_blank">NSE</a>, originally made with ${lfEmojiEnabled ? '💕' : 'love'} by ceodoe. The conditional rules engine and several interface improvements are by xrt141, and the Backfill button is based on code by mchamster, thank you! Its code is licensed under the <a class="lfLink" href="https://www.gnu.org/licenses/gpl-3.0.txt" target="_blank">GNU General Public License v3.0</a>.
                </p>

                <h3 class="lfH3">Statistics</h3>
                <p>
                    <span class="lfExplanationSpan">This section is populated when the page loads, and does not reflect changes done thereafter.</span><br />
                    <br />
                    Site profile in use: <b>${lfSite.name}</b><br />
                    Userscript manager: <b>${GM_info.scriptHandler || "unknown"}${GM_info.version ? " " + GM_info.version : ""}</b><br /><br />
                    Number of blacklisted tags: <span class="lfHiddenTag">${lfBlacklistTags.length}</span><br />
                    ${lfHardPassEnabled ? `Number of Hard Pass tags: <span class="lfHiddenTag">${lfHardPassTags.length}</span><br />` : ""}
                    Number of blacklisted title phrases: <span class="lfHiddenTag">${lfBlacklistTitlePhrases.length}</span><br />
                    Number of blacklisted uploaders: <span class="lfHiddenTag">${lfBlacklistUploaders.length}</span><br />
                    ${lfIndividualUploadHidingEnabled ? `Number of individually blacklisted torrents: <span class="lfHiddenTag">${lfIndividualUploadHidingBlacklist.length}</span><br />` : ""}
                    <br />
                    Number of whitelisted tags: <span class="lfWhitelistedTag">${lfWhitelistTags.length}</span><br />
                    Number of whitelisted title phrases: <span class="lfWhitelistedTag">${lfWhitelistTitlePhrases.length}</span><br />
                    Number of whitelisted uploaders: <span class="lfWhitelistedTag">${lfWhitelistUploaders.length}</span><br />
                    <br />
                    Number of spotlighted tags, title phrases and uploaders: <span class="lfHighlightedTag">${lfHighlightTags.length} / ${lfHighlightTitlePhrases.length} / ${lfHighlightUploaders.length}</span><br />
                    ${lfIndividualUploadHidingEnabled ? `Number of individually whitelisted torrents: <span class="lfWhitelistedTag">${lfIndividualUploadHidingWhitelist.length}</span><br />` : ""}
                </p>

                <h3 class="lfH3">Resources</h3>
                <p>
                    <b>
                        <span class="lfEmoji">🐙</span> <a class="lfLink" href="https://github.com/scruffynerf/LuminFilter" target="_blank">Report a bug or view commit history on GitHub</a><br />
                        
                        <span class="lfEmoji">📋</span> <a class="lfLink" href="https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md#latest-changes" target="_blank">Read the changelog</a><br />
                    </b>
                </p>

                <h3 class="lfH3">Contribute</h3>
                <p>
                    You can also contribute by reporting bugs, submitting feature requests, pull requests, or just generally using LuminFilter to its fullest. Thanks for using it!
                </p>

                <p></p>
            </section>
        </section>

        <div class="lfSettingsControlDiv">
            <span id="lfSaveButton" class="lfNiceButton"><span class="lfEmoji">💾</span> Save</span>
            <span id="lfReloadButton" class="lfNiceButton"><span class="lfEmoji">🔃</span> Reload page and apply changes</span>
            <span id="lfCloseOptionsButton" class="lfNiceButton"><span class="lfEmoji">❌</span> Close options</span>
        </div>

        <div class="lfSettingsControlDiv" id="lfSaveDiv" class="hidden">

        </div>
    </div>
</div>

<div id="lfRCMBox" class="hidden">
    <div id="lfRCMClose">${lfEmojiEnabled ? '❌' : '<span class="lfHiddenTag"><b><big>X</big></b></span>'}</div>
    <p id="lfRCMBoxInfoText">Tag/uploader placeholder text</p>
    <p id="lfRCMBoxChoices">

    </p>
    <p><small>Your settings will be automatically saved when you choose one of the above options. Your changes will reflect in the torrent list once the page is <span class="lfSpanLink" onclick="location.reload();"><b>reloaded</b></a>.</small></p>
</div>
`;

referenceNode.after(htmlContent);

// Do this before filtering in case it takes a while to filter the page
if(lfScrollToLFEnabled) {
    document.getElementById("lfOuter").scrollIntoView();
}

// Add floating toggle button if enabled
if(lfFloatingToggleButtonEnabled && !lfUnfilteredPages.includes(currentPage)) {
    document.querySelector("body").insertAdjacentHTML("afterbegin", `
        <div id="lfFloatyBoi">
            <span class="lfEmoji" alt="Toggle hidden torrents" title="Toggle hidden torrents">👁️</span>
        </div>
    `);
    document.querySelector("#lfFloatyBoi").addEventListener("click", function() { toggleTorrents(); });
}

// Set up elements for "Notification filters" page
if(currentPage == "Notification filters") {
    let textareas = document.querySelectorAll("textarea.long");

    for(let i = 0; i < textareas.length; i++) {
        let newElement = document.createElement("p");
        newElement.classList.add("min_padding");
        newElement.style.marginTop = "10px";

        if(textareas[i].name == "tags") {
            newElement.innerHTML = `
                <span class="lfNiceButton" id="lfImportListButton${i}">
                    <span class="lfEmoji">⤵️</span>
                    Import your LuminFilter tag whitelist into the above field
                </span>
            `;
        } else if(textareas[i].name == "nottags") {
            newElement.innerHTML = `
                <span class="lfNiceButton" id="lfImportListButton${i}">
                    <span class="lfEmoji">⤵️</span>
                    Import your LuminFilter tag blacklist${lfHardPassEnabled ? " and Hard Pass list" : ""} into the above field
                </span>
            `;
        }

        newElement.onclick = function() {
            let coupledTextarea = this.parentNode.parentNode.querySelector("textarea.long");

            if(coupledTextarea.name == "tags") {
                // The site's own tag fields are space-separated, so convert
                coupledTextarea.innerHTML = lfScopeFilter(lfParseList(document.getElementById("lfWhitelistTaglistArea").value)).join(" ");
            } else if(coupledTextarea.name == "nottags") {
                let exportTags = new Array(0);

                if(lfHardPassEnabled) {
                    exportTags = exportTags.concat(lfScopeFilter(lfParseList(document.getElementById("lfHardPassTaglistArea").value)));
                }

                exportTags = exportTags.concat(lfScopeFilter(lfParseList(document.getElementById("lfBlacklistTaglistArea").value)));

                coupledTextarea.innerHTML = [...new Set(exportTags)].join(" ");
            }
        };

        textareas[i].parentNode.querySelector("textarea.long + p").appendChild(newElement);
    }
}

// Filter one torrent row: hides it, highlights what matched, and adds the individual hide button.
// "i" only needs to be unique per row (it is used for the eye icon's element id).
// The torrent title link of a listing row. Other scripts (thumbnail viewers) may put an image-only link in the
// first cell, so take the first link that has real text and no image, falling back to the first link at all.
// Mark the whole row when anything in it is spotlighted (optional setting)
function lfSyncSpotlightRow(row) {
    row.classList.toggle("lfSpotlightRow", row.querySelector(".lfHighlightedTag, .lfHighlightedTitle, .lfHighlightedUploader") !== null);
}

function lfFindTitleLink(row) {
    const links = row.querySelectorAll(currentPage == "Collage" ? "td > strong > a" : "td > a");
    for(const link of links) {
        if(link.textContent.trim() !== "" && !link.querySelector("img")) { return link; }
    }
    return links.length ? links[0] : null;
}

function lfFilterRow(row, i) {
    let tagElement = row.querySelector("td > div.tags");

    if(!tagElement) {
        return; // can't get a taglist, so this isn't a torrent row
    }

    let russianRouletteBulletInChamber = false;
    if(lfRussianRouletteEnabled) {
        let randNum = Math.floor(Math.random() * 6) + 1; // 1/6 chance to fire
        if(randNum == 6) {
            russianRouletteBulletInChamber = true;
        }
    }

    let uploaderElement, titleElement;

    if(currentPage == "Top 10") {
        uploaderElement = row.querySelector("td:nth-child(10) > a");
    } else {
        uploaderElement = row.querySelector("td.user > a");
    }

    titleElement = lfFindTitleLink(row);

    let countMe = 1;
    let currentHidden = false;
    let currentWhitelisted = false;
    let currentBypassWhitelist = false;
    let currentForceHide = false;
    let currentForceShow = false;

    // Snapshot the pristine tags/title/uploader for the conditional rule
    // engine. This has to happen before the title checks below, which
    // append "(matched phrase)" markup to the title element.
    let lfRuleContext = null;
    if(lfConditionalEnabled && lfCompiledConditionals.rules.length > 0) {
        let contextTags = new Set();
        let contextTagNodes = tagElement.querySelectorAll("a");

        for(let t = 0; t < contextTagNodes.length; t++) {
            contextTags.add(contextTagNodes[t].innerHTML.trim().toLowerCase());
        }

        lfRuleContext = {
            tags: contextTags,
            title: titleElement ? titleElement.textContent.trim().toLowerCase() : "",
            uploader: uploaderElement ? uploaderElement.innerHTML.trim().toLowerCase() : "",
            site: lfSite.id
        };
    }

    // Check if we are adding the hide button
    if(lfIndividualUploadHidingEnabled) {
        let torrentIconContainer = row.querySelector("td > span.torrent_icon_container");

        if(torrentIconContainer) {
            let lfToggleHideElement = document.createElement("span");
            lfToggleHideElement.className = "icon";
            lfToggleHideElement.innerHTML = `
            <div class="icon_container">
                <div class="icon_stack">
                    <i class="font_icon torrent_icons clickable lfToggleIcon" id="lfToggleIcon_${i}">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAC6npUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHja7ZdtktwoDIb/c4ocAUkIieNgPqpygz1+XrDb0z2T3SS1+2urTdlggSX5fWR6Joy/vs/wDQeVzCGpeS45RxyppMIVA4/nUfaVYtrX84avOXq1h3uCYRL0ct5avdZX2PXjgUcMOl7twa8Z9ssR3Y73ISvyGvfnJGHn007pclTGOcjF7TnV43LUroU7letMd1pnt+7Di8GgUlcEEuYhJHFf/cxAzrMu+75CFYl7zEJhd493hSAvr/foY3wW6EXkxyh8Vv8efRKf62WXT1rmSyMMfjpB+skudxh+Dix3Rvw6YfJw9VXkObvPOc63qylD0XxV1BabHm6w8IDksh/LaIZTMbbdCprHGhuQ99jigdaoEEP9GShRp0qTxu4bNaSYeLChZ24AsmwuxoUbGJGk1WiySZEuDliNRxCBme9caMctO14jR+ROWMoEZ4RH/raFf5r8kxbmbEsiin5rhbx41TXSWOTWFasAhObFTbfAj3bhj0/1s0o1YdmS2fGCNR6ni0Ppo7ZkcxasU/TnJ0TB+uUAEiG2IhkUf6KYSZQyRWM2IujoAFSROUviAwRIlTuS5CSC/cjYecXGM0Z7LStnXmbsTQChksXApkgFrJQU9WPJUUNVRZOqZjX1oEVrlpyy5pwtr02umlgytWxmbsWqiydXz27uXrwWLoI9UEsuVryUUiuHikAVvirWV1gOPuRIhx75sMOPctSG8mmpacvNmrfSaucuHdtEz92699LroDCwU4w0dORhw0cZdaLWpsw0deZp02eZ9aZ2Uf3S/oAaXdR4k1rr7KYGazB7uKC1nehiBmKcCMRtEUBB82IWnVLiRW4xi4XxUSgjSV1sQqdFDAjTINZJN7sPcr/FLaj/Fjf+Fbmw0P0X5ALQfeX2E2p9/c61Tez8CpemUfD1YX54Dex1/ajVf9u/Hb0dvR29Hb0dvR29Hf0PHE388YB/YsMPGOidZZTdxfYAAAGFaUNDUElDQyBwcm9maWxlAAB4nH2RPUjDQBiG37ZKpVYcLCLikKE6WRAVESetQhEqhFqhVQeTS/+gSUOS4uIouBYc/FmsOrg46+rgKgiCPyBOjk6KLlLid0mhRYx3HPfw3ve+3H0H+OtlppodY4CqWUYqERcy2VUh+IoQzX50Y0Zipj4nikl4jq97+Ph+F+NZ3nV/jh4lZzLAJxDPMt2wiDeIpzYtnfM+cYQVJYX4nHjUoAsSP3JddvmNc8FhP8+MGOnUPHGEWCi0sdzGrGioxJPEUUXVKN+fcVnhvMVZLVdZ8578heGctrLMdVpDSGARSxAhQEYVJZRhIUa7RoqJFJ3HPfyDjl8kl0yuEhg5FlCBCsnxg//B796a+YlxNykcBzpfbPtjGAjuAo2abX8f23bjBAg8A1day1+pA9OfpNdaWvQI6N0GLq5bmrwHXO4AA0+6ZEiOFKDlz+eB9zP6pizQdwuE1ty+Nc9x+gCkqVfJG+DgEBgpUPa6x7u72vv2b02zfz9/THKseNROhQAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+QKChYVGrZwy10AAAF0SURBVDjL3dK/S9ZhFAXwj74ZvoXwllAKiSZYQ0uIQaND0BKUjQ1ODYIOBiKIEA1RNLWECIUQqIuL4BJFFoElmhjakk4a+YMgQYkIhVqu8PDw/gHRnZ7vufd7OPeew79WheR9ErcxF3g1zqMdF1CJPRyUIzqSvKvQiz94h5f4hvXoN6MeixjGC/wqR1qDFnxCX4IXQ91h3cAbvEZdTnIG27iCElbxAOcwH9/v0ZScpAc/Yn1wHNPoTIiPYgP34qcCurGLU8ncTXyIbXTgeabwetxjFgMJ/gjj2ewIbsECLmfNVdTiBL7iaeLsWjbbiqXKsLs1a37HReygAVdDWQEr2WxbuOxsWHo6aXZgM7lHETO4n5HUh5DGQ+BOHPdYMtSPn3iCwYjGOh5Hv4QtdKXJno1AjuFzqHmLqYhANT7ibhCV8BtfMAQVmdR2PMQ+XkWG1iLtTbiECYxiMl21okzCi3HoaxG22sB3QsGzMGMmbF/2f9dfX9xN/BNad7IAAAAASUVORK5CYII=" />
                    </i>
                </div>
            </div>
            `;

            lfToggleHideElement.title = "Filter this torrent with LuminFilter";
            lfToggleHideElement.classList.add("lfToggleHideButton");

            let actualIcon = lfToggleHideElement.querySelector("div > div > i");
            let torrentID = titleElement.href.match(/([0-9]+)/)[0];
            actualIcon.torrentID = torrentID;
            actualIcon.onclick = function() { lfToggleIndividualRows(this); };

            // Clear list status on right-click
            actualIcon.addEventListener('contextmenu', function(event) {
                event.preventDefault();
                lfClearIndividualRows(this);
            }, false);

            torrentIconContainer.appendChild(lfToggleHideElement);

            // Check if torrent is black/whitelisted this way
            let currentBLIndex = lfIndividualUploadHidingBlacklist.indexOf(torrentID);
            if(currentBLIndex > -1) {
                if(russianRouletteBulletInChamber == false) {
                    actualIcon.classList.add("lfIndividuallyBlacklisted");
                    currentHidden = true;
                    currentForceHide = true;
                }
            }

            let currentWLIndex = lfIndividualUploadHidingWhitelist.indexOf(torrentID);
            if(currentWLIndex > -1) {
                actualIcon.classList.add("lfIndividuallyWhitelisted");
                currentWhitelisted = true;
                currentForceShow = true;
            }

            if(currentForceHide == false && currentForceShow == false) {
                // Torrent not acted upon
                actualIcon.classList.add("lfIndividuallyUntouched");
            }
        }
    }

    if(lfObliviousModeEnabled == true) {
        tagElement.classList.add("hidden");
    }

    // Check if filtered via options
    if(lfHideReportedEnabled) {
        if(titleElement.querySelector("span.reported") !== null) {
            currentHidden = true;
        }
    }

    if(lfHideWarnedEnabled) {
        if(row.classList.contains("redbar")) {
            currentHidden = true;
        }
    }

    if(lfHideUnseededEnabled) {
        let selector = "td:nth-child(8)";

        if(currentPage == "Collage") {
            selector = "td:nth-child(7)";
        }

        let seeders = row.querySelector(selector);
        if(seeders.classList.contains("r00")) {
            currentHidden = true;
            seeders.innerHTML = "(0)";
        }
    }
    
    // Your relationship with the torrent (snatched/seeding/grabbed/leeching); selectors and
    // class names come from the current site's layout profile
    let torrentIconElement = row.querySelector(lfSite.layout.statusIcon);

    if(torrentIconElement) {
        let statusChecks = [
            [lfHideSnatchedEnabled, "snatched"],
            [lfHideSeedingEnabled, "seeding"],
            [lfHideGrabbedEnabled, "grabbed"],
            [lfHideLeechingEnabled, "leeching"]
        ];

        for(const [enabled, status] of statusChecks) {
            if(enabled && torrentIconElement.classList.contains(lfSite.layout.statusClasses[status])) {
                currentHidden = true;

                if(lfBypassWhitelistsEnabled) {
                    currentBypassWhitelist = true;
                }
            }
        }
    }

    if(lfHideBookmarkedEnabled) {
        let bmElement = row.querySelector(lfSite.layout.bookmarked);
        if(bmElement) {
            currentHidden = true;

            if(lfBypassWhitelistsEnabled) {
                currentBypassWhitelist = true;
            }
        }
    }

    // Check uploaders
    // No uploaders on collage and user uploaded pages
    if(currentPage !== "Collage" && currentPage !== "Uploaded") {
        if(!uploaderElement) { // If it is null, it's an anon upload
            if(lfHideAnonUploadsEnabled) {
                let anonName = row.querySelector("td > span.anon_name");
                if(anonName && anonName.innerHTML == "anon") {
                    currentHidden = true;
                    if(russianRouletteBulletInChamber == false) {
                        anonName.classList.add("lfHiddenUploader");
                    }
                }
            }
        } else { // Not an anon upload
            let uploader = uploaderElement.innerHTML.trim().toLowerCase();

            if(lfMatch.uploaderHighlight.has(uploader)) {
                uploaderElement.classList.add("lfHighlightedUploader");
            }

            // Usernames are unique, so a blacklisted uploader needs no whitelist check
            if(lfMatch.uploaderBlacklist.has(uploader)) {
                currentHidden = true;
                if(russianRouletteBulletInChamber == false) {
                    uploaderElement.classList.add("lfHiddenUploader");
                }
            } else if(currentBypassWhitelist == false && lfMatch.uploaderWhitelist.has(uploader)) {
                currentWhitelisted = true;
                uploaderElement.classList.add("lfWhitelistedUploader");
            }
        }
    }

    // Match against the title as the site rendered it (before any badges are appended below)
    const torrentTitle = titleElement.textContent.trim().toLowerCase();

    // Scan the title against the phrase lists; matches are shown as "(phrase)" badges,
    // collected here and appended in one go
    let titleBadges = "";
    const addTitleBadge = function(cssClass, phrase) {
        titleBadges += ` <span class="${cssClass}">(${lfEscapeHTML(phrase)})</span>`;
    };

    for(const phrase of lfMatch.titleBlacklist) {
        if(torrentTitle.includes(phrase)) {
            currentHidden = true;
            if(russianRouletteBulletInChamber == false) { addTitleBadge("lfHiddenTitle", phrase); }
        }
    }

    if(lfHardPassEnabled) {
        for(const phrase of lfMatch.titleHardPass) {
            if(torrentTitle.includes(phrase)) {
                currentHidden = true;
                currentForceHide = true;
                if(russianRouletteBulletInChamber == false) {
                    addTitleBadge("lfHardPassTitle", phrase);

                    if(lfRemoveHardPassResults) {
                        row.classList.add("lfHardPassRemove");
                        countMe = 0;
                    }
                }
            }
        }
    }

    if(currentBypassWhitelist == false) {
        for(const phrase of lfMatch.titleWhitelist) {
            if(torrentTitle.includes(phrase)) {
                currentWhitelisted = true;
                addTitleBadge("lfWhitelistedTitle", phrase);
            }
        }
    }

    if(titleBadges !== "") {
        titleElement.insertAdjacentHTML("beforeend", titleBadges);
    }

    if(lfMatch.titleHighlight.some(phrase => torrentTitle.includes(phrase))) {
        titleElement.classList.add("lfHighlightedTitle");
    }

    // For every tag in the current torrent
    let tagList = tagElement.querySelectorAll("a");
    for(let k = 0; k < tagList.length; k++) {
        const tagName = lfTagKey(tagList[k].innerHTML);

        if(lfMatch.tagHighlight.has(tagName)) {
            tagList[k].classList.add("lfHighlightedTag");
        }

        if(lfHardPassEnabled && lfMatch.tagHardPass.has(tagName)) {
            currentHidden = true;
            currentForceHide = true;
            if(russianRouletteBulletInChamber == false) {
                tagList[k].classList.add("lfHardPassTag");

                if(lfRemoveHardPassResults) {
                    row.classList.add("lfHardPassRemove");
                    countMe = 0;
                }
            }
        }

        if(lfMatch.tagBlacklist.has(tagName)) {
            currentHidden = true;
            if(russianRouletteBulletInChamber == false) {
                tagList[k].classList.add("lfHiddenTag");
            }
        }

        if(currentBypassWhitelist == false && lfMatch.tagWhitelist.has(tagName)) {
            currentWhitelisted = true;
            tagList[k].classList.add("lfWhitelistedTag");
        }
    }

    // Conditional rules
    // TODO: surface "why was this hidden" — we know rule.line/rule.source
    // here, so a tooltip or data attribute on the row would be cheap.
    if(lfRuleContext !== null) {
        for(let r = 0; r < lfCompiledConditionals.rules.length; r++) {
            let rule = lfCompiledConditionals.rules[r];

            if(!lfEvaluateRuleNode(rule.ast, lfRuleContext)) { continue; }

            if(rule.action === "SHOW") {
                currentWhitelisted = true;
            } else if(rule.action === "PASS") {
                // Hard Pass tier: only individual filtering can override
                currentHidden = true;
                currentForceHide = true;

                if(russianRouletteBulletInChamber == false && lfRemoveHardPassResults) {
                    row.classList.add("lfHardPassRemove");
                    countMe = 0;
                }
            } else {
                // HIDE: blacklist tier, whitelists can still win
                currentHidden = true;
            }
        }
    }

    if(lfSpotlightRowGlow) { lfSyncSpotlightRow(row); }

    // If forcing through individual filtering, ignore results
    if(currentForceShow) {
        currentHidden = false;
        currentWhitelisted = true;
    } else if(currentForceHide) {
        currentHidden = true;
        currentWhitelisted = false;
    }

    if(currentWhitelisted === true) {
        row.classList.remove("hidden");
        row.setAttribute("isLFHidden", "0");
    } else if(currentHidden === true) {
        if(russianRouletteBulletInChamber == false) {
            row.classList.add("hidden");
            row.setAttribute("isLFHidden", "1");

            count += countMe;
        }
    }
}

// +---------------------+
// | Main filtering loop |
// +---------------------+
let count = 0;
let torrents = document.querySelectorAll("tr.torrent");
let lfHiddenTorrentsToggled = false;   // true while the "show hidden" view is on
let lfBackfillNextURL = null;
let lfNextRowId = 100000;               // element ids for eye icons on backfilled rows (above any page position)

if(currentPage == "Requests") {
    torrents = document.querySelectorAll("#request_table tr");
}

if(torrents) {
    if(!lfUnfilteredPages.includes(currentPage)) { // Skip filtering where it doesn't apply
        for(let i = 0; i < torrents.length; i++) {
            lfFilterRow(torrents[i], i);
        }
    } else if(currentPage == "Torrent details") {
        if(lfHideUnseededEnabled) {
            let seedersElement = document.querySelector("div.top_info > table.boxstat > tbody > tr > td:nth-child(4)");
            let seedersElement2 = document.querySelector("tr.group_torrent > td:nth-child(5)");
            let currSeeders = seedersElement2.innerHTML;

            if(currSeeders.trim() === "0") {
                seedersElement.classList.add("lfBlacklistIdentifier");
                seedersElement2.classList.add("lfBlacklistIdentifier");

                seedersElement.innerHTML = "(" + seedersElement.innerHTML + ")"; // This has a div element also
                seedersElement2.innerHTML = "(0)";
            }
        }

        // Highlight if uploader is anon and user has LuminFilter set to hide anon uploads
        let anonName = document.querySelectorAll(".anon_name");
        if(anonName.length) {
            if(lfHideAnonUploadsEnabled) {
                for(let anon = 0; anon < anonName.length; anon++) {
                    anonName[anon].classList.add("lfHiddenUploader");
                }
            }
        // Highlight if uploader is any of the lists
        } else {
            let uploaderElement = document.querySelector("table.boxstat > tbody > tr > td:nth-child(1) > a");
            let uploaderElement2 = document.querySelector(".torrent_table > tbody > tr:nth-child(5) > td > em > a");

            if(uploaderElement) {
                let uploader = uploaderElement.innerHTML.trim().toLowerCase();

                for(let l = 0; l < lfBlacklistUploaders.length; l++) {
                    if(uploader == lfBlacklistUploaders[l].trim().toLowerCase()) {
                        uploaderElement.classList.add("lfHiddenUploader");
                        uploaderElement2.classList.add("lfHiddenUploader");
                        break;
                    }
                }

                for(let m = 0; m < lfWhitelistUploaders.length; m++) {
                    if(uploader == lfWhitelistUploaders[m].trim().toLowerCase()) {
                        uploaderElement.classList.add("lfWhitelistedUploader");
                        uploaderElement2.classList.add("lfWhitelistedUploader");
                        break;
                    }
                }

                if(lfMatch.uploaderHighlight.has(uploader)) {
                    uploaderElement.classList.add("lfHighlightedUploader");
                    if(uploaderElement2) { uploaderElement2.classList.add("lfHighlightedUploader"); }
                }
            }
        }

        let titleElement2 = document.querySelector(".torrent_table > tbody > tr:nth-child(2) > td:nth-child(2) > strong");
        let titleElement = document.querySelector("#content > div:nth-child(1) > h2:nth-child(1)");
        let h2textChild = Array.from(titleElement.childNodes).filter(node => node.nodeType === 3 && node.textContent.trim().length > 1)[0];

        let newSpan = document.createElement('span');
        h2textChild.after(newSpan);
        newSpan.appendChild(h2textChild);
        titleElement = newSpan;

        // Match against the title as the site rendered it (before any badges are appended below)
        const torrentTitle = titleElement.textContent.trim().toLowerCase();

        if(lfMatch.titleHighlight.some(phrase => torrentTitle.includes(phrase))) {
            titleElement.classList.add("lfHighlightedTitle");
            titleElement2.classList.add("lfHighlightedTitle");
        }

        // Scan title for lfBlacklistTitlePhrases
        // ...For every blacklisted phrase:
        for(let tblCount = 0; tblCount < lfBlacklistTitlePhrases.length; tblCount++) {
            let currentTBLPhrase = lfBlacklistTitlePhrases[tblCount].trim().toLowerCase();

            if(currentTBLPhrase != "") {
                if(torrentTitle.includes(currentTBLPhrase)) {
                    titleElement.innerHTML = titleElement.innerHTML + ` <span class="lfHiddenTitle">(${lfEscapeHTML(currentTBLPhrase)})</span>`;
                    titleElement2.innerHTML = titleElement2.innerHTML + ` <span class="lfHiddenTitle">(${lfEscapeHTML(currentTBLPhrase)})</span>`;
                }
            }
        }

        // Scan title for lfHardPassTitlePhrases
        for(let tblCount = 0; tblCount < lfHardPassTitlePhrases.length; tblCount++) {
            let currentTBLPhrase = lfHardPassTitlePhrases[tblCount].trim().toLowerCase();

            if(currentTBLPhrase != "") {
                if(torrentTitle.includes(currentTBLPhrase)) {
                    titleElement.innerHTML = titleElement.innerHTML + ` <span class="lfHardPassTitle">(${lfEscapeHTML(currentTBLPhrase)})</span>`;
                    titleElement2.innerHTML = titleElement2.innerHTML + ` <span class="lfHardPassTitle">(${lfEscapeHTML(currentTBLPhrase)})</span>`;
                }
            }
        }

        // Scan title for lfWhitelistTitlePhrases
        // ...For every whitelisted phrase:
        for(let tblCount = 0; tblCount < lfWhitelistTitlePhrases.length; tblCount++) {
            let currentTWLPhrase = lfWhitelistTitlePhrases[tblCount].trim().toLowerCase();

            if(currentTWLPhrase != "") {
                if(torrentTitle.includes(currentTWLPhrase)) {
                    titleElement.innerHTML = titleElement.innerHTML + ` <span class="lfWhitelistedTitle">(${lfEscapeHTML(currentTWLPhrase)})</span>`;
                    titleElement2.innerHTML = titleElement2.innerHTML + ` <span class="lfWhitelistedTitle">(${lfEscapeHTML(currentTWLPhrase)})</span>`;
                }
            }
        }


        // Add individual filter icon to torrent details page
        if(lfIndividualUploadHidingEnabled) {
            let torrentIconContainer = document.querySelector("td > span.torrent_icon_container");

            if(torrentIconContainer) {
                let lfToggleHideElement = document.createElement("span");
                lfToggleHideElement.className = "icon";
                lfToggleHideElement.innerHTML = `
                <div class="icon_container">
                    <div class="icon_stack">
                        <i class="font_icon torrent_icons clickable">
                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAC6npUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHja7ZdtktwoDIb/c4ocAUkIieNgPqpygz1+XrDb0z2T3SS1+2urTdlggSX5fWR6Joy/vs/wDQeVzCGpeS45RxyppMIVA4/nUfaVYtrX84avOXq1h3uCYRL0ct5avdZX2PXjgUcMOl7twa8Z9ssR3Y73ISvyGvfnJGHn007pclTGOcjF7TnV43LUroU7letMd1pnt+7Di8GgUlcEEuYhJHFf/cxAzrMu+75CFYl7zEJhd493hSAvr/foY3wW6EXkxyh8Vv8efRKf62WXT1rmSyMMfjpB+skudxh+Dix3Rvw6YfJw9VXkObvPOc63qylD0XxV1BabHm6w8IDksh/LaIZTMbbdCprHGhuQ99jigdaoEEP9GShRp0qTxu4bNaSYeLChZ24AsmwuxoUbGJGk1WiySZEuDliNRxCBme9caMctO14jR+ROWMoEZ4RH/raFf5r8kxbmbEsiin5rhbx41TXSWOTWFasAhObFTbfAj3bhj0/1s0o1YdmS2fGCNR6ni0Ppo7ZkcxasU/TnJ0TB+uUAEiG2IhkUf6KYSZQyRWM2IujoAFSROUviAwRIlTuS5CSC/cjYecXGM0Z7LStnXmbsTQChksXApkgFrJQU9WPJUUNVRZOqZjX1oEVrlpyy5pwtr02umlgytWxmbsWqiydXz27uXrwWLoI9UEsuVryUUiuHikAVvirWV1gOPuRIhx75sMOPctSG8mmpacvNmrfSaucuHdtEz92699LroDCwU4w0dORhw0cZdaLWpsw0deZp02eZ9aZ2Uf3S/oAaXdR4k1rr7KYGazB7uKC1nehiBmKcCMRtEUBB82IWnVLiRW4xi4XxUSgjSV1sQqdFDAjTINZJN7sPcr/FLaj/Fjf+Fbmw0P0X5ALQfeX2E2p9/c61Tez8CpemUfD1YX54Dex1/ajVf9u/Hb0dvR29Hb0dvR29Hf0PHE388YB/YsMPGOidZZTdxfYAAAGFaUNDUElDQyBwcm9maWxlAAB4nH2RPUjDQBiG37ZKpVYcLCLikKE6WRAVESetQhEqhFqhVQeTS/+gSUOS4uIouBYc/FmsOrg46+rgKgiCPyBOjk6KLlLid0mhRYx3HPfw3ve+3H0H+OtlppodY4CqWUYqERcy2VUh+IoQzX50Y0Zipj4nikl4jq97+Ph+F+NZ3nV/jh4lZzLAJxDPMt2wiDeIpzYtnfM+cYQVJYX4nHjUoAsSP3JddvmNc8FhP8+MGOnUPHGEWCi0sdzGrGioxJPEUUXVKN+fcVnhvMVZLVdZ8578heGctrLMdVpDSGARSxAhQEYVJZRhIUa7RoqJFJ3HPfyDjl8kl0yuEhg5FlCBCsnxg//B796a+YlxNykcBzpfbPtjGAjuAo2abX8f23bjBAg8A1day1+pA9OfpNdaWvQI6N0GLq5bmrwHXO4AA0+6ZEiOFKDlz+eB9zP6pizQdwuE1ty+Nc9x+gCkqVfJG+DgEBgpUPa6x7u72vv2b02zfz9/THKseNROhQAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+QKChYVGrZwy10AAAF0SURBVDjL3dK/S9ZhFAXwj74ZvoXwllAKiSZYQ0uIQaND0BKUjQ1ODYIOBiKIEA1RNLWECIUQqIuL4BJFFoElmhjakk4a+YMgQYkIhVqu8PDw/gHRnZ7vufd7OPeew79WheR9ErcxF3g1zqMdF1CJPRyUIzqSvKvQiz94h5f4hvXoN6MeixjGC/wqR1qDFnxCX4IXQ91h3cAbvEZdTnIG27iCElbxAOcwH9/v0ZScpAc/Yn1wHNPoTIiPYgP34qcCurGLU8ncTXyIbXTgeabwetxjFgMJ/gjj2ewIbsECLmfNVdTiBL7iaeLsWjbbiqXKsLs1a37HReygAVdDWQEr2WxbuOxsWHo6aXZgM7lHETO4n5HUh5DGQ+BOHPdYMtSPn3iCwYjGOh5Hv4QtdKXJno1AjuFzqHmLqYhANT7ibhCV8BtfMAQVmdR2PMQ+XkWG1iLtTbiECYxiMl21okzCi3HoaxG22sB3QsGzMGMmbF/2f9dfX9xN/BNad7IAAAAASUVORK5CYII=" />
                        </i>
                    </div>
                </div>
                `;

                lfToggleHideElement.title = "Filter this torrent with LuminFilter";
                lfToggleHideElement.classList.add("lfToggleHideButton");

                let actualIcon = lfToggleHideElement.querySelector("div > div > i");
                let torrentID = window.location.href.match(/id=([0-9]+)/)[1];
                actualIcon.torrentID = torrentID;
                actualIcon.onclick = function() {
                    lfRefreshIndividualLists();
                    let target = lfIndividualUploadHidingBlacklist.includes(this.torrentID) ? "Whitelisted" : "Blacklisted";
                    lfMoveIndividual(this.torrentID, target);
                    lfSetIndividualState(this, target);
                    lfSaveIndividualLists();
                };

                // Clear list status on right-click
                actualIcon.addEventListener('contextmenu', function(event) {
                    event.preventDefault();
                    lfRefreshIndividualLists();
                    lfMoveIndividual(this.torrentID, null);
                    lfSetIndividualState(this, "Untouched");
                    lfSaveIndividualLists();
                }, false);

                torrentIconContainer.appendChild(lfToggleHideElement);

                // Check if torrent is black/whitelisted this way
                let currentBLIndex = lfIndividualUploadHidingBlacklist.indexOf(torrentID);
                if(currentBLIndex > -1) {
                    actualIcon.classList.add("lfIndividuallyBlacklisted");
                }

                let currentWLIndex = lfIndividualUploadHidingWhitelist.indexOf(torrentID);
                if(currentWLIndex > -1) {
                    actualIcon.classList.add("lfIndividuallyWhitelisted");
                }

                if(currentBLIndex == -1 && currentWLIndex == -1) {
                    actualIcon.classList.add("lfIndividuallyUntouched");
                }
            }
        }
    } else if(currentPage == "My uploaded") {
        // Make sure colors function as expected on user uploads pages
        recolorTags();
    }
}


// +-----------------------------------------+
// | Event handler assignment and miscellany |
// +-----------------------------------------+

// Renumber if enabled
if(lfRenumberTorrentsEnabled && currentPage == "Top 10") {
    renumberTorrents();
}

// Add classes for Right-Click Management if enabled
if(lfRightClickManagementEnabled && currentPage !== "Notification filters") {
    if(currentPage == "Torrent details") {
        if(lfRCMTagsEnabled) {
            let currTaglist = document.querySelector("#torrent_tags");
            let observerOptions = {subtree: true, childList: true};
            let mObserver = new MutationObserver(function() {
                let tagList = document.querySelectorAll("ul#torrent_tags_list > li > a");
                if(tagList !== null && tagList !== undefined) {
                    for(let i = 0; i < tagList.length; i++) {
                        tagList[i].classList.add("lfTagElement");
                    }
                }
            });

            mObserver.observe(currTaglist, observerOptions);
        }

        if(lfRCMTitlesEnabled) {
            // "Torrent Info" box
            let titleElement = document.querySelector(".group_torrent > td:nth-child(2) > strong");
            titleElement.classList.add("lfTitleElement");

            // Header text
            titleElement = document.querySelector("#content > div:nth-child(1) > h2:nth-child(1)");
            titleElement.classList.add("lfTitleElement");
        }

        if(lfRCMUploadersEnabled) {
            // First uploader element in torrent stats/controls near top of page
            let uploaderElement = document.querySelector("table.boxstat > tbody > tr > td:nth-child(1) > a");
            if(uploaderElement) {
                uploaderElement.classList.add("lfUploaderElement");
            }

            // Second uploader element in "Torrent Info" box
            uploaderElement = document.querySelector(".torrent_table > tbody > tr:nth-child(5) > td > em > a");
            if(uploaderElement) {
                uploaderElement.classList.add("lfUploaderElement");
            }
        }
    } else {
        for(let i = 0; i < torrents.length; i++) {
            lfMarkRowForMenus(torrents[i]);
        }
    }
}

// Attach the right-click menus to every marked element under root (safe to repeat)
function lfBindMenus(root) {
    root.querySelectorAll(".lfTagElement").forEach(function(el) { lfBindContextMenu(el, "tag"); });
    root.querySelectorAll(".lfUploaderElement").forEach(function(el) { lfBindContextMenu(el, "uploader"); });
    root.querySelectorAll(".lfTitleElement").forEach(function(el) { lfBindContextMenu(el, "title"); });
}

// Tag the tag, title and uploader elements of a listed row so right-click management can find them
function lfMarkRowForMenus(row) {
    // Tags
    if(lfRCMTagsEnabled) {
        row.querySelectorAll("td > div.tags > a").forEach(function(tag) { tag.classList.add("lfTagElement"); });
    }

    // Titles
    if(lfRCMTitlesEnabled) {
        let titleElement = lfFindTitleLink(row);
        if(titleElement) { titleElement.classList.add("lfTitleElement"); }
    }

    // Uploaders
    if(lfRCMUploadersEnabled && currentPage !== "Collage" && currentPage !== "Uploaded") {
        let uploaderElement = row.querySelector(currentPage == "Top 10" ? "td:nth-child(10) > a" : "td.user > a");
        if(uploaderElement) { uploaderElement.classList.add("lfUploaderElement"); }
    }
}

// Keep torrent details taglist colored when it changes
if(currentPage == "Torrent details") {
    let currTaglist = document.querySelector("#torrent_tags");
    let observerOptions = {subtree: true, childList: true};
    let mObserver = new MutationObserver(function() { recolorTags(); });
    mObserver.observe(currTaglist, observerOptions);
}

function recolorTags() {
    let tagList;
    if(currentPage == "Torrent details") {
        tagList = document.querySelectorAll("ul#torrent_tags_list > li > a");
    } else if(currentPage == "My uploaded") {
        tagList = document.querySelectorAll("div.tags > a");
    } else if(lfUnfilteredPages.includes(currentPage)) {
        return;
    } else {
        tagList = document.querySelectorAll("a.lfTagElement");
    }

    if(tagList !== null && tagList !== undefined) {
        for(let i = 0; i < tagList.length; i++) {
            tagList[i].classList.toggle("lfHighlightedTag", lfMatch.tagHighlight.has(lfTagKey(tagList[i].innerHTML)));
            const glowRow = tagList[i].closest("tr.torrent");
            if(glowRow && lfSpotlightRowGlow) { lfSyncSpotlightRow(glowRow); }

            if(lfMatch.tagBlacklist.has(lfTagKey(tagList[i].innerHTML))) {
                tagList[i].classList.remove("lfHardPassTag");
                tagList[i].classList.remove("lfWhitelistedTag");
                tagList[i].classList.add("lfHiddenTag");
            } else if(lfHardPassEnabled && lfMatch.tagHardPass.has(lfTagKey(tagList[i].innerHTML))) {
                tagList[i].classList.remove("lfHiddenTag");
                tagList[i].classList.remove("lfWhitelistedTag");
                tagList[i].classList.add("lfHardPassTag");
            } else if(lfMatch.tagWhitelist.has(lfTagKey(tagList[i].innerHTML))) {
                tagList[i].classList.remove("lfHiddenTag");
                tagList[i].classList.remove("lfHardPassTag");
                tagList[i].classList.add("lfWhitelistedTag");
            } else {
                tagList[i].classList.remove("lfHiddenTag");
                tagList[i].classList.remove("lfHardPassTag");
                tagList[i].classList.remove("lfWhitelistedTag");
            }
        }
    }
}

function recolorUploaders() {
    let uploaderElements;

    if(currentPage == "Top 10") {
        uploaderElements = document.querySelectorAll("td:nth-child(10) > a");
    } else if(lfUnfilteredPages.includes(currentPage) || currentPage == "Collage"|| currentPage == "Uploaded") {
        return;
    } else {
        uploaderElements = document.querySelectorAll("td.user > a");
    }

    if(uploaderElements) {
        for(let i = 0; i < uploaderElements.length; i++) {
            uploaderElements[i].classList.toggle("lfHighlightedUploader", lfMatch.uploaderHighlight.has(uploaderElements[i].innerHTML.trim().toLowerCase()));
            const glowRow = uploaderElements[i].closest("tr.torrent");
            if(glowRow && lfSpotlightRowGlow) { lfSyncSpotlightRow(glowRow); }

            if(lfBlacklistUploaders.includes(uploaderElements[i].innerHTML.trim())) {
                uploaderElements[i].classList.remove("lfWhitelistedUploader");
                uploaderElements[i].classList.add("lfHiddenUploader");
            } else if(lfWhitelistUploaders.includes(uploaderElements[i].innerHTML.trim())) {
                uploaderElements[i].classList.remove("lfHiddenUploader");
                uploaderElements[i].classList.add("lfWhitelistedUploader");
            } else {
                uploaderElements[i].classList.remove("lfHiddenUploader");
                uploaderElements[i].classList.remove("lfWhitelistedUploader");
            }
        }
    }
}

// Remove categories if enabled
if(lfHideCategoryIconsEnabled && currentPage !== "Notification filters" && currentPage !== "Torrent details") {
    let selector = ".cats_col";
    if(currentPage == "Collage" || currentPage == "Uploaded") {
        selector = "#torrent_table > tbody > tr > td:nth-child(1)";
    } else if(currentPage == "Notifications") {
        selector = ".cats_cols";
    }

    let catsCols = document.querySelectorAll(selector);
    for(let i = 0; i < catsCols.length; i++) {
        catsCols[i].nextElementSibling.setAttribute("colspan", "2");
        catsCols[i].style.display = "none";
    }
}

// Remove Hard Pass results if Black Hole is enabled
if(lfHardPassEnabled && lfRemoveHardPassResults && !lfUnfilteredPages.includes(currentPage)) {
    let elementsToRemove = document.querySelectorAll(".lfHardPassRemove");
    if(elementsToRemove) {
        for(let i = 0; i < elementsToRemove.length; i++) {
            if(elementsToRemove[i]) {
                elementsToRemove[i].remove();
            }
        }
    }
}

// Assign event handlers if arrow key navigation is enabled
if(lfGlobalArrowNavigationEnabled || (lfArrowNavigationEnabled && currentPage !== "Notification filters" && currentPage !== "Torrent details")) {
    document.addEventListener("keydown", lfArrowKeyHandler);
}

let headerNode = document.getElementById("lfHeaderText");

if(lfUnfilteredPages.includes(currentPage)) {
    headerNode.innerHTML = "Filtering is disabled on this page";
    headerNode.style.cursor = "auto";
} else {
    adjustHiddenHeaderCount(count);

    headerNode.onclick = function() {
        if(headerNode.innerHTML.match(/([0-9]+)/) !== null) {
            toggleTorrents();
        }
    };
}

document.getElementById("lfToggleOptionsNode").onclick = function() {
    document.getElementById("lfMainDiv").classList.toggle("hidden");
};

document.getElementById("lfCloseOptionsButton").onclick = function() {
    document.getElementById("lfMainDiv").classList.add("hidden");
    document.getElementById("lfOuter").scrollIntoView();
};

document.getElementById("lfCheckCustomCSS").onclick = function() {
    if(this.checked) {
        document.getElementById("lfCustomCSSDiv").classList.remove("hidden");
    } else {
        document.getElementById("lfCustomCSSDiv").classList.add("hidden");
    }
};

document.getElementById("lfCheckRightClickManagementEnabled").onclick = function() {
    if(this.checked) {
        document.getElementById("lfRCMCustomizationDiv").classList.remove("hidden");
    } else {
        document.getElementById("lfRCMCustomizationDiv").classList.add("hidden");
    }
};

document.getElementById("lfColorPreset").onchange = function() {
    const preset = LF_COLOR_PRESETS[this.value];
    if(!preset) { return; }

    for(const [id, value] of Object.entries(preset)) {
        if(id !== "label") { document.getElementById(id).value = value; }
    }
    this.value = "";
};

document.getElementById("lfThemeDropdown").onchange = function() {
    let selectedTheme = this.options[this.selectedIndex].value;
    let descriptionNode = document.getElementById("lfThemeDescription");

    if(selectedTheme == "lfThemeCustom") {
        document.getElementById("lfCustomThemeDiv").classList.remove("hidden");
    } else {
        document.getElementById("lfCustomThemeDiv").classList.add("hidden");
    }

    descriptionNode.innerHTML = lfThemeDescriptions[selectedTheme];
};

if(lfBackfillButtonEnabled && currentPage == "Torrents") {
    lfBackfillNextURL = lfNextPageURL(document);
    if(!lfBackfillNextURL) {
        lfDisableBackfillButton("No more pages");
    } else {
        document.getElementById("lfBackfillButton").onclick = function() { lfBackfillResults(); };
    }
}

if(lfOpenAllButtonEnabled && !lfUnfilteredPages.includes(currentPage)) {
    document.getElementById("lfOpenAllButton").onclick = function() {
        let rows = document.querySelectorAll(currentPage == "Requests" ? "#request_table tr" : "tr.torrent");
        let visitedLinks = new Set();
        let detailsPath = currentPage == "Requests" ? "/requests.php" : "/torrents.php";

        for(const row of rows) {
            if(row.getAttribute("isLFHidden") === "1") {
                continue;
            }

            // Right-click management is optional; identify detail links by URL instead.
            let links = row.querySelectorAll("td > a[href], td > strong > a[href]");
            for(const link of links) {
                let url = new URL(link.href, window.location.href);
                if(url.origin !== window.location.origin || url.pathname !== detailsPath ||
                    !/^\d+$/.test(url.searchParams.get("id") || "") || url.searchParams.has("action")) {
                    continue;
                }

                let resultKey = url.pathname + "?id=" + url.searchParams.get("id");
                if(!visitedLinks.has(resultKey)) {
                    lfOpenInBackgroundTab(url.href);
                    visitedLinks.add(resultKey);
                }
                break;
            }
        }

        if(visitedLinks.size === 0) {
            alert("LuminFilter: No unfiltered result links were found on this page.");
            return;
        }

        if(lfOpenAllGoNextEnabled) {
            lfGoForward();
        }
    };
}

if(lfFilterAllButtonEnabled && lfIndividualUploadHidingEnabled && !lfUnfilteredPages.includes(currentPage)) {
    document.getElementById("lfFilterAllButton").onclick = function() {
        if(confirm(`Are you sure you want to filter all unfiltered results on this page?\n\nThis cannot be automatically undone, and you will have to manually unhide each torrent to undo it.`)) {
            for(let i = 0; i < torrents.length; i++) {
                if(!torrents[i].getAttribute("isLFHidden") || torrents[i].getAttribute("isLFHidden") === "0") {
                    torrents[i].querySelector(".lfToggleIcon").click();
                }
            }
        }
    };
}

// We like to have fun around here 😏
{
    let now = new Date();
    if(lfEveryDayIsApril1st || (now.getMonth() == 3 && now.getDate() == 1)) {
        let emojiElements = document.getElementsByClassName("lfEmoji");
        let normieArray = new Array("😂","🤣","😆", "💯", "😭", "🙃", "👌", "😏", "🙄", "😱", "👀", "🎉", "🤪", "🦄", "🍕", "🌈");
        for(let i = 0; i < emojiElements.length; i++) {
            let randNum = Math.floor(Math.random() * normieArray.length);
            emojiElements[i].innerHTML = normieArray[randNum];
        }
    }
}

let lfTextAreas = new Array("lfBlacklistTaglistArea", "lfHardPassTaglistArea", "lfWhitelistTaglistArea","lfBlacklistTitleListArea","lfHardPassTitleListArea","lfWhitelistTitleListArea","lfBlacklistUploadersArea","lfWhitelistUploadersArea","lfHighlightTaglistArea","lfHighlightTitleListArea","lfHighlightUploadersArea","lfConditionalRulesArea");

for(let textAreaCounter = 0; textAreaCounter < lfTextAreas.length; textAreaCounter++) {
    document.getElementById(lfTextAreas[textAreaCounter]).addEventListener("keydown", function(event) {
        if ((window.navigator.platform.match("Mac") ? event.metaKey : event.ctrlKey)  && event.code == "KeyS") {
            event.preventDefault();
            saveData();
        }
     }, false);
}

let explanationTogglers = new Array("lfBLE", "lfHPE", "lfHPTE", "lfWLE","lfTitleBLE", "lfTitleWLE", "lfUBLE", "lfUWLE", "lfHLE", "lfTitleHLE", "lfUHLE", "lfCRE");

for(let i = 0; i < explanationTogglers.length; i++) {
    document.getElementById(explanationTogglers[i] + "Toggler").onclick = function() {
        document.getElementById(this.id.substring(0, this.id.length - 7)).classList.toggle("hidden");
    };
}

// Live syntax checking for the conditional rule editor
// Open a link in a background tab through the userscript manager (Tampermonkey and Violentmonkey
// both provide GM_openInTab). Fall back to a normal popup if it's unavailable.
function lfOpenInBackgroundTab(url) {
    if(typeof GM_openInTab === "function") {
        GM_openInTab(url, { active: false, insert: true });
    } else {
        window.open(url, "_blank");
    }
}

function lfEscapeHTML(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lfValidateConditionalArea() {
    let statusNode = document.getElementById("lfConditionalStatus");
    if(!statusNode) { return; }

    let result = lfCompileConditionalRules(document.getElementById("lfConditionalRulesArea").value);

    statusNode.classList.remove("lfConditionalGood", "lfConditionalBad");

    if(result.errors.length > 0) {
        statusNode.classList.add("lfConditionalBad");
        statusNode.innerHTML = result.errors
            .map(error => `${lfEmojiEnabled ? "⚠️ " : ""}Line ${error.line}: ${lfEscapeHTML(error.message)}`)
            .join("\n");
    } else if(result.rules.length > 0) {
        statusNode.classList.add("lfConditionalGood");
        statusNode.innerHTML = `${lfEmojiEnabled ? "✔️ " : ""}${result.rules.length} rule${result.rules.length === 1 ? "" : "s"} OK`;
    } else {
        statusNode.innerHTML = "No rules defined.";
    }
}

document.getElementById("lfConditionalRulesArea").addEventListener("input", lfValidateConditionalArea, false);
lfValidateConditionalArea();

// The Conditional tab only exists when the feature is switched on
document.getElementById("lfCheckConditionalEnabled").onclick = function() {
    document.querySelector('label[for="lfTab5"]').classList.toggle("hidden", !this.checked);
};


if(lfRightClickManagementEnabled && currentPage !== "Notification filters") {
    if(currentPage == "Torrent details") {
        new MutationObserver(function() { lfBindMenus(document); }).observe(document.querySelector("#torrent_tags"), {subtree: true, childList: true});
    }
    lfBindMenus(document);

    document.getElementById("lfRCMClose").onclick = function() {
        this.parentNode.classList.add("hidden");
    };
}

document.getElementById("lfExportButton").onclick = function() { exportSettings(); };
document.getElementById("lfImportFilePicker").onchange = function () { importSettings(event); };
document.getElementById("lfImportNseFilePicker").onchange = function (e) { importNseSettings(e); };
document.getElementById("lfEraseDataButton").onclick = function () { resetSettings(); };
document.getElementById("lfSaveButton").onclick = function() { saveData(); };
document.getElementById("lfReloadButton").onclick = function() { location.reload(); };
// End event handler assignment section

let lfAllHiddenGoNextTimer = null;
// Keep the original rows so Black Hole removals still count as hidden results.
let lfAutoNextRows = Array.from(torrents).filter(row =>
    currentPage !== "Requests" || row.querySelector("td > div.tags")
);

let lfAutoNextObserver = null;
if(!lfUnfilteredPages.includes(currentPage)) {
    lfAutoNextObserver = new MutationObserver(lfCheckAllHiddenGoNext);
    for(const row of lfAutoNextRows) {
        lfAutoNextObserver.observe(row, {attributes: true, attributeFilter: ["class"]});
    }
    lfCheckAllHiddenGoNext();
}


// +-----------+
// | Functions |
// +-----------+
function lfAllRowsHidden() {
    return lfAllHiddenGoNextEnabled &&
        !lfUnfilteredPages.includes(currentPage) &&
        lfAutoNextRows.length > 0 &&
        lfAutoNextRows.every(row => !row.isConnected || row.classList.contains("hidden"));
}

function lfCheckAllHiddenGoNext() {
    if(!lfAllRowsHidden() || !document.querySelector(lfSite.layout.nextPage)) {
        if(lfAllHiddenGoNextTimer !== null) {
            window.clearTimeout(lfAllHiddenGoNextTimer);
            lfAllHiddenGoNextTimer = null;
        }
        return;
    }

    if(lfAllHiddenGoNextTimer === null) {
        lfAllHiddenGoNextTimer = window.setTimeout(function() {
            lfAllHiddenGoNextTimer = null;
            if(lfAllRowsHidden() && document.querySelector(lfSite.layout.nextPage)) {
                lfGoForward();
            }
        }, 2000);
    }
}

// +----------------------------------------------------+
// | Individually hidden / shown torrents (the eye icon) |
// +----------------------------------------------------+

// The lists are shared between tabs, so re-read them before acting and save right after
function lfRefreshIndividualLists() {
    lfIndividualUploadHidingBlacklist = GM_getValue("lfIndividualUploadHidingBlacklist", new Array(0));
    lfIndividualUploadHidingWhitelist = GM_getValue("lfIndividualUploadHidingWhitelist", new Array(0));
}

function lfSaveIndividualLists() {
    GM_setValue("lfIndividualUploadHidingBlacklist", lfIndividualUploadHidingBlacklist);
    GM_setValue("lfIndividualUploadHidingWhitelist", lfIndividualUploadHidingWhitelist);
}

// Put a torrent on exactly one of the two lists ("Blacklisted" / "Whitelisted"), or on neither (null).
// Returns where it was before: { blacklist: bool, whitelist: bool }
function lfMoveIndividual(torrentID, target) {
    const before = {
        blacklist: lfIndividualUploadHidingBlacklist.includes(torrentID),
        whitelist: lfIndividualUploadHidingWhitelist.includes(torrentID)
    };

    lfIndividualUploadHidingBlacklist = lfIndividualUploadHidingBlacklist.filter(id => id !== torrentID);
    lfIndividualUploadHidingWhitelist = lfIndividualUploadHidingWhitelist.filter(id => id !== torrentID);

    if(target === "Blacklisted") { lfIndividualUploadHidingBlacklist.push(torrentID); }
    if(target === "Whitelisted") { lfIndividualUploadHidingWhitelist.push(torrentID); }

    return before;
}

// Colour the eye icon: state is "Blacklisted", "Whitelisted" or "Untouched"
function lfSetIndividualState(icon, state) {
    for(const name of ["Blacklisted", "Whitelisted", "Untouched"]) {
        icon.classList.toggle("lfIndividually" + name, name === state);
    }
}

// The table row an eye icon sits in
function lfIndividualRow(icon) {
    return icon.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode;
}

// Rows that show this torrent. Top 10 can list one torrent several times and they all follow the click.
function lfIndividualRows(icon) {
    if(currentPage !== "Top 10") { return [lfIndividualRow(icon)]; }

    const wanted = new RegExp("[?&]id=" + icon.torrentID + "(&|#|$)");
    const rows = [];
    document.querySelectorAll("tr.torrent > td > a").forEach(function(link) {
        if(wanted.test(link.getAttribute("href") || "")) { rows.push(link.parentNode.parentNode); }
    });
    return rows;
}

// Flip a row between shown and hidden, with the matching background
function lfApplyRowHidden(row, hide) {
    row.classList.toggle("hidden");
    row.setAttribute("isLFHidden", hide ? "1" : "0");
}

function lfIconForRow(row, clickedIcon) {
    return lfIndividualRow(clickedIcon) === row ? clickedIcon : row.querySelector(".lfToggleIcon");
}

// Click on the eye icon of a listed torrent: hidden -> whitelisted (shown), otherwise -> blacklisted (hidden)
function lfToggleIndividualRows(icon) {
    lfRefreshIndividualLists();

    const clickedRow = lfIndividualRow(icon);
    if(!clickedRow) { return; }

    if(!clickedRow.getAttribute("isLFHidden")) {
        clickedRow.setAttribute("isLFHidden", "0");
    }

    const wasHidden = clickedRow.getAttribute("isLFHidden") === "1";
    const target = wasHidden ? "Whitelisted" : "Blacklisted";
    lfMoveIndividual(icon.torrentID, target);

    const rows = lfIndividualRows(icon);
    for(const row of rows) {
        lfApplyRowHidden(row, !wasHidden);
        lfSetIndividualState(lfIconForRow(row, icon), target);
    }

    adjustHiddenHeaderCount(wasHidden ? -rows.length : rows.length);

    // Save lists immediately after manipulating them
    lfSaveIndividualLists();

    if(lfRenumberTorrentsEnabled && currentPage == "Top 10") {
        renumberTorrents();
    }
}

// Right-click on the eye icon: forget any individual decision about this torrent
function lfClearIndividualRows(icon) {
    lfRefreshIndividualLists();

    if(!lfIndividualRow(icon)) { return; }

    const was = lfMoveIndividual(icon.torrentID, null);

    if(was.blacklist || was.whitelist) {
        const rows = lfIndividualRows(icon);
        for(const row of rows) {
            // A row that was only whitelisted is already visible; one that was blacklisted comes back
            if(!was.whitelist) { row.classList.toggle("hidden"); }
            row.setAttribute("isLFHidden", "0");
            lfSetIndividualState(lfIconForRow(row, icon), "Untouched");
        }

        if(was.blacklist) { adjustHiddenHeaderCount(-rows.length); }

        // Save lists immediately after manipulating them
        lfSaveIndividualLists();
    }

    if(lfRenumberTorrentsEnabled && currentPage == "Top 10") {
        renumberTorrents();
    }
}

function toggleTorrents() {
    lfHiddenTorrentsToggled = !lfHiddenTorrentsToggled;

    const shownCount = headerNode.innerHTML.match(/([0-9]+)/);
    lfRenderHeaderToggle(shownCount ? Number(shownCount[0]) : 0);

    for(let k = 0; k < torrents.length; k++) {
        torrents[k].classList.toggle("hidden");
    }
}

function renumberTorrents() {
    let torrentTables = document.querySelectorAll("table.torrent_table");
    for(let i = 0; i < torrentTables.length; i++) {
        let currTorrents = torrentTables[i].querySelectorAll("tr.torrent");
        if(currTorrents) {
            let shownNum = 1;
            let hiddenNum = 1;
            for(let j = 0; j < currTorrents.length; j++) {
                if(currTorrents[j].classList.contains("hidden")) {
                    currTorrents[j].querySelector("td > strong").innerHTML = hiddenNum;
                    hiddenNum++;
                } else {
                    currTorrents[j].querySelector("td > strong").innerHTML = shownNum;
                    shownNum++;
                }
            }
        }
    }
}

function adjustHiddenHeaderCount(value) {
    let currNum = headerNode.innerHTML.match(/([0-9]+)/);

    if(currNum === null) {
        currNum = value;
    } else {
        currNum = currNum[0];
        currNum = Number(currNum) + value;
    }

    if(currNum === 0 && value !== 0) {
        lfRenderHeaderToggle(0);
        toggleTorrents();
    } else {
        lfRenderHeaderToggle(currNum);
    }
}

// With hidden torrents the header label is a toggle button (highlighted while hidden torrents are being shown);
// without any it is just the plain title
function lfRenderHeaderToggle(currNum) {
    headerNode.classList.toggle("lfNiceButton", currNum !== 0);
    headerNode.classList.toggle("lfToggleOn", currNum !== 0 && lfHiddenTorrentsToggled);

    if(currNum === 0) {
        headerNode.innerHTML = "LuminFilter";
        headerNode.removeAttribute("title");
    } else if(lfHiddenTorrentsToggled) {
        headerNode.innerHTML = `${lfEmojiEnabled ? '<span class="lfEmoji">👁</span> ' : ""}${currNum} shown`;
        headerNode.title = "Showing the " + currNum + " hidden torrent" + (currNum == 1 ? "" : "s") + " (click to hide them again)";
    } else {
        headerNode.innerHTML = `${lfEmojiEnabled ? '<span class="lfEmoji">🙈</span> ' : ""}${currNum} hidden`;
        headerNode.title = "Show the " + currNum + " hidden torrent" + (currNum == 1 ? "" : "s");
    }
}

// +----------------------------------------------------------------------+
// | Backfill: load the following result pages onto this one and filter them |
// | Idea and first implementation: mchamster, thank you!                     |
// +----------------------------------------------------------------------+
function lfAbsoluteURL(href) {
    return new URL(href, window.location.href).href;
}

// The next results page according to a (fetched or current) document's pager
function lfNextPageURL(sourceDocument) {
    const nextLink = sourceDocument.querySelector(lfSite.layout.nextPage);
    return nextLink ? lfAbsoluteURL(nextLink.getAttribute("href")) : null;
}

// Fallback when a fetched page has no "next" link: the next pager number we haven't loaded yet
function lfNextPagerURLAfter(currentURL) {
    const pageLinks = Array.from(document.querySelectorAll("a.pager_page"));
    const index = pageLinks.findIndex(link => lfAbsoluteURL(link.getAttribute("href")) === currentURL);
    if(index === -1) { return null; }

    const next = pageLinks.slice(index + 1).find(link => !link.classList.contains("lfBackfilledPagerPage"));
    return next ? lfAbsoluteURL(next.getAttribute("href")) : null;
}

// Point the pager's "next" links at the first page we haven't loaded
function lfUpdateBackfillNextURL(nextURL) {
    lfBackfillNextURL = nextURL;

    if(nextURL) {
        document.querySelectorAll(lfSite.layout.nextPage).forEach(function(link) { link.href = nextURL; });
    }
}

function lfMarkBackfilledPagerLink(loadedURL) {
    document.querySelectorAll("a.pager_page").forEach(function(link) {
        if(lfAbsoluteURL(link.getAttribute("href")) === loadedURL) {
            link.classList.add("lfBackfilledPagerPage");
        }
    });
}

function lfSetBackfillStatus(text) {
    const node = document.getElementById("lfBackfillStatus");
    if(node) { node.textContent = text ? " " + text : ""; }
}

function lfSetBackfillBusy(busy) {
    const button = document.getElementById("lfBackfillButton");
    if(button) { button.classList.toggle("lfDisabledButton", busy); }
}

function lfDisableBackfillButton(text) {
    const button = document.getElementById("lfBackfillButton");
    if(button) {
        button.classList.add("lfDisabledButton");
        button.onclick = null;
    }
    lfSetBackfillStatus(text);
}

function lfTorrentIDFromRow(row) {
    const link = row.querySelector("td > a[href*='id=']");
    const match = link ? link.getAttribute("href").match(/id=([0-9]+)/) : null;
    return match ? match[1] : null;
}

// Rows parsed from another page don't run their inline scripts (they define the hover preview data)
function lfRunRowScripts(row) {
    row.querySelectorAll("script").forEach(function(old) {
        const fresh = document.createElement("script");
        fresh.textContent = old.textContent;
        old.parentNode.replaceChild(fresh, old);
    });
}

// While the "show hidden" view is on, new rows must follow it: hidden ones shown, the rest hidden
function lfApplyToggleState(row) {
    if(lfHiddenTorrentsToggled) {
        row.classList.toggle("hidden", row.getAttribute("isLFHidden") !== "1");
    }
}

// Run freshly appended rows through everything the original rows went through.
// Returns how many of them ended up hidden.
function lfProcessBackfilledRows(rows) {
    const hiddenBefore = count;

    for(const row of rows) {
        lfRunRowScripts(row);
        lfFilterRow(row, lfNextRowId++);

        if(lfRightClickManagementEnabled) {
            lfMarkRowForMenus(row);
            lfBindMenus(row);
        }

        if(lfHideCategoryIconsEnabled) {
            const catsCol = row.querySelector(".cats_col");
            if(catsCol && catsCol.nextElementSibling) {
                catsCol.nextElementSibling.setAttribute("colspan", "2");
                catsCol.style.display = "none";
            }
        }

        lfApplyToggleState(row);

        // Keep them in the "all rows hidden?" check used by the auto-next option
        lfAutoNextRows.push(row);
        if(lfAutoNextObserver) { lfAutoNextObserver.observe(row, {attributes: true, attributeFilter: ["class"]}); }

        if(lfHardPassEnabled && lfRemoveHardPassResults && row.classList.contains("lfHardPassRemove")) {
            row.remove();
        }
    }

    return count - hiddenBefore;
}

async function lfBackfillResults() {
    const pageLimit = lfClampPageLimit(GM_getValue("lfBackfillPageLimit", lfBackfillPageLimit));
    const lastRow = torrents.length ? torrents[torrents.length - 1] : null;
    const targetBody = lastRow ? lastRow.parentNode : null;
    let nextURL = lfBackfillNextURL || lfNextPageURL(document);
    let pagesLoaded = 0;

    if(!targetBody) {
        lfSetBackfillStatus("Could not find the torrent table");
        return;
    }

    if(!nextURL) {
        lfDisableBackfillButton("No more pages");
        return;
    }

    // Only take rows from the same table on the other pages, and skip ones we already have
    const table = targetBody.closest("table");
    const rowSelector = (table && table.id ? "#" + table.id + " " : "") + "tr.torrent";
    const knownIDs = new Set();
    document.querySelectorAll(rowSelector).forEach(function(row) {
        const id = lfTorrentIDFromRow(row);
        if(id) { knownIDs.add(id); }
    });

    lfSetBackfillBusy(true);

    try {
        for(let pageCount = 0; pageCount < pageLimit && nextURL; pageCount++) {
            lfSetBackfillStatus("Loading page " + (pageCount + 1) + " of " + pageLimit + "...");
            const currentURL = nextURL;

            const response = await fetch(currentURL, { credentials: "same-origin" });
            if(!response.ok) { throw new Error("Failed to fetch " + currentURL); }

            const fetchedDocument = new DOMParser().parseFromString(await response.text(), "text/html");
            const appendedRows = [];

            fetchedDocument.querySelectorAll(rowSelector).forEach(function(fetchedRow) {
                const id = lfTorrentIDFromRow(fetchedRow);
                if(id && !knownIDs.has(id)) {
                    const imported = document.importNode(fetchedRow, true);
                    targetBody.appendChild(imported);
                    appendedRows.push(imported);
                    knownIDs.add(id);
                }
            });

            if(appendedRows.length === 0) {
                nextURL = null;
                break;
            }

            const newlyHidden = lfProcessBackfilledRows(appendedRows);
            if(newlyHidden !== 0) { adjustHiddenHeaderCount(newlyHidden); }

            lfMarkBackfilledPagerLink(currentURL);
            pagesLoaded++;
            nextURL = lfNextPageURL(fetchedDocument) || lfNextPagerURLAfter(currentURL);
        }

        lfUpdateBackfillNextURL(nextURL);
        torrents = document.querySelectorAll("tr.torrent");

        lfSetBackfillStatus(pagesLoaded === 0 ? "No results loaded" : "");

        if(!lfBackfillNextURL) { lfDisableBackfillButton("No more pages"); }
    } catch(error) {
        console.error(error);
        lfSetBackfillStatus("Backfill failed");
    } finally {
        if(lfBackfillNextURL) { lfSetBackfillBusy(false); }
    }
}

// Attach a right-click handler to an element exactly once, however often this is called
// (the torrent details taglist is rebuilt by the page, which re-runs the observers)
function lfBindContextMenu(element, kind) {
    if(element.dataset.lfRcmBound) { return; }
    element.dataset.lfRcmBound = "1";
    element.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        let value = this.innerHTML.trim();
        if(kind === "title") {
            let titleClone = this.cloneNode(true);
            titleClone.querySelectorAll(".lfHiddenTitle, .lfHardPassTitle, .lfWhitelistedTitle").forEach(function(badge) { badge.remove(); });
            value = titleClone.textContent.trim();
        }
        showRCMBox(kind, value, event.pageX, event.pageY, this.getAttribute("href"), this);
    }, false);
}

function showRCMBox(boxType, elementValue, mouseX, mouseY, linkHref, sourceElement) {
    let box = document.getElementById("lfRCMBox");
    let x = mouseX;
    let y = mouseY;

    // Make sure the box stays within page bounds
    if(x - 150 < 0) {
        x = 0;
    } else if(x + 320 > window.innerWidth) {
        x = window.innerWidth - 350;
    } else {
        x -= 150;
    }

    box.style.left = x + "px";
    box.style.top = y - 90 + "px";

    let lfRCMBoxInfoText = box.querySelector("#lfRCMBoxInfoText");
    if(boxType == "tag") {
        elementValue = lfTagKey(elementValue);
        let infoText = `<b>Tag:</b> <span class="lfMonospace" id="lfRCMBoxTag">${elementValue}</span><br /><br />`;

        let currTagBlacklist = lfScopeFilter(lfParseList(document.getElementById("lfBlacklistTaglistArea").value));
        let currTagHardPassList = lfScopeFilter(lfParseList(document.getElementById("lfHardPassTaglistArea").value));
        let currTagWhitelist = lfScopeFilter(lfParseList(document.getElementById("lfWhitelistTaglistArea").value));
        let lfRCMBoxChoices = document.getElementById("lfRCMBoxChoices");

        if(currTagBlacklist.includes(elementValue)) { // Current tag is in blacklist
            infoText = infoText + `This tag was found in your <span class="lfBlacklistIdentifier">blacklist</span>!`;

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxBLRemove">${lfEmojiEnabled ? '➖' : '-'} Remove from blacklist</span><br /><br />
                ${lfHardPassEnabled ?
                    `<span class="lfRCMButton" id="lfRCMBoxHPAdd">${lfEmojiEnabled ? '➕' : '+'} Move to Hard Pass</span><br /><br />`
                : ''}
                <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to whitelist</span><br />
            `;

            document.getElementById("lfRCMBoxBLRemove").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                removeItemFromList("lfBlacklistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };

            if(lfHardPassEnabled) {
               document.getElementById("lfRCMBoxHPAdd").onclick = function() {
                    let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                    addItemToList("lfHardPassTaglistArea", "lfBlacklistTaglistArea", currTag);
                    saveData();
                    recolorTags();
                    closeRCMBox();
                };
            }

            document.getElementById("lfRCMBoxWLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                addItemToList("lfWhitelistTaglistArea", "lfBlacklistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };
        } else if(currTagWhitelist.includes(elementValue)) { // Current tag is in whitelist
            infoText = infoText + `This tag was found in your <span class="lfWhitelistIdentifier">whitelist</span>!`;

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxWLRemove">${lfEmojiEnabled ? '➖' : '-'} Remove from whitelist</span><br /><br />
                <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to blacklist</span><br /><br />
                ${lfHardPassEnabled ?
                    `<span class="lfRCMButton" id="lfRCMBoxHPAdd">${lfEmojiEnabled ? '➕' : '+'} Move to Hard Pass</span><br />`
                : ''}
            `;

            document.getElementById("lfRCMBoxWLRemove").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                removeItemFromList("lfWhitelistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };

            document.getElementById("lfRCMBoxBLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                addItemToList("lfBlacklistTaglistArea", "lfWhitelistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };

            if(lfHardPassEnabled) {
                document.getElementById("lfRCMBoxHPAdd").onclick = function() {
                     let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                     addItemToList("lfHardPassTaglistArea", "lfWhitelistTaglistArea", currTag);
                     saveData();
                     recolorTags();
                     closeRCMBox();
                 };
             }
        } else if(lfHardPassEnabled && currTagHardPassList.includes(elementValue)) {
                // Current tag is in Hard Pass and it is enabled
                infoText = infoText + `This tag was found in your <span class="lfBlacklistIdentifier">Hard Pass blacklist</span>!`;

                lfRCMBoxChoices.innerHTML = `
                    <span class="lfRCMButton" id="lfRCMBoxHPRemove">${lfEmojiEnabled ? '➖' : '-'} Remove from Hard Pass</span><br /><br />
                    <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to blacklist</span><br /><br />
                    <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to whitelist</span><br />
                `;

                document.getElementById("lfRCMBoxHPRemove").onclick = function() {
                    let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                    removeItemFromList("lfHardPassTaglistArea", currTag);
                    saveData();
                    recolorTags();
                    closeRCMBox();
                };

                document.getElementById("lfRCMBoxBLAdd").onclick = function() {
                    let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                    addItemToList("lfBlacklistTaglistArea", "lfHardPassTaglistArea", currTag);
                    saveData();
                    recolorTags();
                    closeRCMBox();
                };

                document.getElementById("lfRCMBoxWLAdd").onclick = function() {
                    let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                    addItemToList("lfWhitelistTaglistArea", "lfHardPassTaglistArea", currTag);
                    saveData();
                    recolorTags();
                    closeRCMBox();
                };
        } else { // Current tag is in no list
            infoText = infoText + "This tag was not found in any of your taglists.";

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Add to blacklist</span><br /><br />
                ${lfHardPassEnabled ?
                    `<span class="lfRCMButton" id="lfRCMBoxHPAdd">${lfEmojiEnabled ? '➕' : '+'} Add to Hard Pass</span><br /><br />`
                : ''}
                <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Add to whitelist</span><br />
            `;

            document.getElementById("lfRCMBoxBLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                addItemToList("lfBlacklistTaglistArea", "lfWhitelistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };

            if(lfHardPassEnabled) {
                document.getElementById("lfRCMBoxHPAdd").onclick = function() {
                     let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                     addItemToList("lfHardPassTaglistArea", "lfWhitelistTaglistArea", currTag);
                     saveData();
                     recolorTags();
                     closeRCMBox();
                 };
             }

            document.getElementById("lfRCMBoxWLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxTag").innerHTML;
                addItemToList("lfWhitelistTaglistArea", "lfBlacklistTaglistArea", currTag);
                saveData();
                recolorTags();
                closeRCMBox();
            };
        }

        lfRCMBoxInfoText.innerHTML = infoText;
    } else if(boxType == "uploader") {
        let infoText = "<b>Uploader:</b> <span class=\"lfMonospace\" id=\"lfRCMBoxUploader\">" + elementValue + "</span><br /><br />";

        let currUploaderBlacklist = lfScopeFilter(lfParseList(document.getElementById("lfBlacklistUploadersArea").value));
        let currUploaderWhitelist = lfScopeFilter(lfParseList(document.getElementById("lfWhitelistUploadersArea").value));
        let lfRCMBoxChoices = document.getElementById("lfRCMBoxChoices");

        if(currUploaderBlacklist.includes(elementValue)) { // Current uploader is in blacklist
            infoText = infoText + `This uploader was found in your <span class="lfBlacklistIdentifier">blacklist</span>!`;

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxBLRemove">${lfEmojiEnabled ? '➖' : '-'} Remove from blacklist</span><br /><br />
                <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to whitelist</span><br />
            `;

            document.getElementById("lfRCMBoxBLRemove").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                removeItemFromList("lfBlacklistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };

            document.getElementById("lfRCMBoxWLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                addItemToList("lfWhitelistUploadersArea", "lfBlacklistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };
        } else if(currUploaderWhitelist.includes(elementValue)) { // Current uploader is in whitelist
            infoText = infoText + `This uploader was found in your <span class="lfWhitelistIdentifier">whitelist</span>!`;

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxWLRemove">${lfEmojiEnabled ? '➖' : '-'} Remove from whitelist</span><br /><br />
                <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Move to blacklist</span><br />
            `;

            document.getElementById("lfRCMBoxWLRemove").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                removeItemFromList("lfWhitelistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };

            document.getElementById("lfRCMBoxBLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                addItemToList("lfBlacklistUploadersArea", "lfWhitelistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };
        } else { // Current uploader is in no list
            infoText = infoText + "This uploader was not found in any of your uploader lists.";

            lfRCMBoxChoices.innerHTML = `
                <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Add to blacklist</span><br /><br />
                <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Add to whitelist</span><br />
            `;

            document.getElementById("lfRCMBoxBLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                addItemToList("lfBlacklistUploadersArea", "lfWhitelistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };

            document.getElementById("lfRCMBoxWLAdd").onclick = function() {
                let currTag = document.getElementById("lfRCMBoxUploader").innerHTML;
                addItemToList("lfWhitelistUploadersArea", "lfBlacklistUploadersArea", currTag);
                saveData();
                recolorUploaders();
                closeRCMBox();
            };
        }

        lfRCMBoxInfoText.innerHTML = infoText;
    } else if(boxType == "title") {
        let infoText = `Customize the title phrase you would like to filter in the text box below. You can use a semicolon <span class="lfMonospace">;</span> to separate multiple phrases:<br /><br />
        <input type="text" class="lfInput" id="lfRCMTitlePhraseText" value="${lfEscapeHTML(elementValue).replace(/"/g, '&quot;')}"></input><br />`;
        lfRCMBoxInfoText.innerHTML = infoText;

        let lfRCMBoxChoices = document.getElementById("lfRCMBoxChoices");

        lfRCMBoxChoices.innerHTML = `
            <span class="lfRCMButton" id="lfRCMBoxBLAdd">${lfEmojiEnabled ? '➕' : '+'} Add phrase(s) to title blacklist</span><br /><br />
            ${lfHardPassEnabled ? `<span class="lfRCMButton" id="lfRCMBoxHPTAdd">${lfEmojiEnabled ? '➕' : '+'} Add phrase(s) to title Hard Pass</span><br /><br />` : ''}
            <span class="lfRCMButton" id="lfRCMBoxWLAdd">${lfEmojiEnabled ? '➕' : '+'} Add phrase(s) to title whitelist</span><br />
        `;

        document.getElementById("lfRCMBoxBLAdd").onclick = function() {
            let currTitlePhrase = document.getElementById("lfRCMTitlePhraseText").value;

            addItemToList("lfBlacklistTitleListArea", "lfWhitelistTitleListArea", currTitlePhrase);
            saveData();
            closeRCMBox();
        };

        // The Hard Pass button only exists when Hard Pass is enabled
        if(lfHardPassEnabled) {
            document.getElementById("lfRCMBoxHPTAdd").onclick = function() {
                let currTitlePhrase = document.getElementById("lfRCMTitlePhraseText").value;

                addItemToList("lfHardPassTitleListArea", "lfWhitelistTitleListArea", currTitlePhrase);
                saveData();
                closeRCMBox();
            };
        }

        document.getElementById("lfRCMBoxWLAdd").onclick = function() {
            let currTitlePhrase = document.getElementById("lfRCMTitlePhraseText").value;

            addItemToList("lfWhitelistTitleListArea", "lfBlacklistTitleListArea", currTitlePhrase);
            saveData();
            closeRCMBox();
        };
    }

    lfAddHighlightButton(boxType, elementValue);
    lfAddUploaderRuleButton(boxType, elementValue, sourceElement);
    lfAddRCMLink(linkHref);

    box.classList.remove("hidden");
    return false;
}

// Tag menu, listing rows only: hide this tag just for the uploader of this row, by adding a conditional rule.
// Only offered when conditional rules are enabled.
function lfAddUploaderRuleButton(boxType, tagKey, sourceElement) {
    if(boxType !== "tag" || !lfConditionalEnabled || !sourceElement) { return; }

    const row = sourceElement.closest("tr.torrent");
    const uploaderLink = row ? row.querySelector(currentPage == "Top 10" ? "td:nth-child(10) > a" : "td.user > a") : null;
    const choices = document.getElementById("lfRCMBoxChoices");
    if(!uploaderLink || !choices) { return; }

    const uploader = uploaderLink.textContent.trim();
    if(uploader === "" || /[{}]/.test(uploader + tagKey)) { return; }

    const rule = `HIDE: $UP{${uploader}} AND $TA{${tagKey}}`;
    choices.insertAdjacentHTML("beforeend", `<br /><br /><span class="lfRCMButton" id="lfRCMBoxUploaderRule" title="Adds a conditional rule: ${lfEscapeHTML(rule)}">${lfEmojiEnabled ? "🧩" : "+"} Hide only for ${lfEscapeHTML(uploader)}</span>`);

    document.getElementById("lfRCMBoxUploaderRule").onclick = function() {
        const area = document.getElementById("lfConditionalRulesArea");
        const existing = area.value.split("\n").map(line => line.trim().toLowerCase());
        if(!existing.includes(rule.toLowerCase())) {
            area.value = area.value.replace(/\s+$/, "") + (area.value.trim() === "" ? "" : "\n") + rule + "\n";
        }

        saveData();
        document.getElementById("lfDynamicRefreshNode").classList.remove("hidden");
        closeRCMBox();
    };
}

// Our menu replaces the browser's, so offer the original link here as a real link: right-click it for
// "open in new tab/window", copy address, etc., or just click it
function lfAddRCMLink(href) {
    const old = document.getElementById("lfRCMBoxLinkRow");
    if(old) { old.remove(); }
    const choices = document.getElementById("lfRCMBoxChoices");
    if(!href || !choices) { return; }

    const row = document.createElement("div");
    row.id = "lfRCMBoxLinkRow";
    row.style.marginTop = "10px";
    const link = document.createElement("a");
    link.className = "lfLink";
    link.id = "lfRCMBoxLink";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = (lfEmojiEnabled ? "🔗 " : "") + "Open link (right-click for browser options)";
    link.addEventListener("click", function() { closeRCMBox(); });
    row.appendChild(link);
    choices.appendChild(row);
}

// Extra right-click menu button shared by tags, uploaders and titles: add to / remove from the Highlight list
function lfAddHighlightButton(boxType, elementValue) {
    const area = {tag: "lfHighlightTaglistArea", uploader: "lfHighlightUploadersArea", title: "lfHighlightTitleListArea"}[boxType];
    const choices = document.getElementById("lfRCMBoxChoices");
    if(!area || !choices) { return; }

    const plus = lfEmojiEnabled ? "🔆" : "+";
    let inList = false;
    let label;

    if(boxType === "title") {
        label = `${plus} Add phrase(s) to title spotlight`;
    } else {
        const value = elementValue.trim().toLowerCase();
        inList = lfScopeFilter(lfParseList(document.getElementById(area).value)).includes(value);
        label = inList ? `${lfEmojiEnabled ? "➖" : "-"} Remove from spotlight` : `${plus} Spotlight this ${boxType}`;
    }

    choices.insertAdjacentHTML("beforeend", `<br /><br /><span class="lfRCMButton" id="lfRCMBoxHLToggle">${label}</span>`);

    document.getElementById("lfRCMBoxHLToggle").onclick = function() {
        if(boxType === "title") {
            addItemToList(area, area, document.getElementById("lfRCMTitlePhraseText").value);
        } else {
            const value = elementValue.trim().toLowerCase();
            if(inList) { removeItemFromList(area, value); } else { addItemToList(area, area, value); }
        }

        saveData();
        recolorTags();
        recolorUploaders();
        closeRCMBox();
    };
}

function closeRCMBox() {
    document.getElementById("lfRCMBox").classList.add("hidden");
}

function lfIsPhraseList(tagListAreaName) {
    return tagListAreaName == "lfWhitelistTitleListArea"
        || tagListAreaName == "lfBlacklistTitleListArea"
        || tagListAreaName == "lfHardPassTitleListArea"
        || tagListAreaName == "lfHighlightTitleListArea";
}

function removeItemFromList(tagListAreaName, tagName) {
    let currList = lfParseList(document.getElementById(tagListAreaName).value, lfIsPhraseList(tagListAreaName));

    currList = lfRemoveValueForSite(currList, tagName);

    document.getElementById(tagListAreaName).value = lfStringifyList(currList);

    // Show the refresh button because we've done changes
    document.getElementById("lfDynamicRefreshNode").classList.remove("hidden");
}

function addItemToList(tagListAreaName, oppositeTagListAreaName, filterValue) {
    let isPhraseList = lfIsPhraseList(tagListAreaName);

    if(!isPhraseList) {
        // Only do opposite removal for tags/uploaders
        removeItemFromList(oppositeTagListAreaName, filterValue);
    }

    let currList = lfParseList(document.getElementById(tagListAreaName).value, isPhraseList);

    // The incoming value may itself contain several semicolon-separated entries
    currList = currList.concat(lfParseList(filterValue, isPhraseList));

    document.getElementById(tagListAreaName).value = lfStringifyList([...new Set(currList)]);

    // Show the refresh button because we did changes
    document.getElementById("lfDynamicRefreshNode").classList.remove("hidden");
}

function downloadFile(filename, text) {
    let element = document.createElement('a');
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);

    element.click();
    document.body.removeChild(element);
}

function exportSettings(getSize = false) {
    if(!getSize) { saveData(); }

    let settingsNames = GM_listValues();
    let settings = {};

    for(let i = 0; i < settingsNames.length; i++) {
        settings[settingsNames[i]] = GM_getValue(settingsNames[i], null);
    }

    let jsonOutput = JSON.stringify(settings);

    if(getSize) {
        return String(jsonOutput.length);
    } else {
        downloadFile(`lfExport-${Date.now()}.json`, jsonOutput);
    }
}

function importSettings(event) {
    let reader = new FileReader();
    reader.onload = function(){
        if(confirm("Are you sure you want to import this file? Your existing settings will be cleared and overwritten!")) {

            // Clear old data before importing
            let settingsNames = GM_listValues();

            for(let i = 0; i < settingsNames.length; i++) {
                GM_deleteValue(settingsNames[i]);
            }

            // Import JSON
            let settingsObject = JSON.parse(reader.result);
            for(let i = 0; i < Object.keys(settingsObject).length; i++) {
                GM_setValue(Object.keys(settingsObject)[i], settingsObject[Object.keys(settingsObject)[i]]);
            }

            location.reload();
        }
    };
    reader.readAsText(event.target.files[0]);
}

// Import an export file made by NoShitEmpornium (nse* keys) into LuminFilter (lf* keys).
// Non-destructive: only keys present in the file are written, nothing is cleared,
// and NSE's own storage is never touched (userscript storage is per-script).
function importNseSettings(event) {
    let picker = event.target;
    let file = picker.files[0];
    if(!file) { return; }

    let reader = new FileReader();
    reader.onload = function() {
        let source;
        try {
            source = JSON.parse(reader.result);
        } catch(e) {
            alert("That file isn't valid JSON, so it can't be imported.");
            picker.value = "";
            return;
        }

        let converted = {};
        let count = 0;
        if(source && typeof source === "object" && !Array.isArray(source)) {
            Object.keys(source).forEach(function(oldKey) {
                // Only NSE keys; skip nseSavedVersion so update toasts keep working normally
                if(!/^nse[A-Z]/.test(oldKey) || oldKey === "nseSavedVersion") { return; }
                let value = source[oldKey];
                // Saved theme names are stored as values, e.g. "nseThemeDark" -> "lfThemeDark"
                if(typeof value === "string" && /^nseTheme[A-Za-z]*$/.test(value)) {
                    value = value.replace(/^nse/, "lf");
                }
                converted[oldKey.replace(/^nse/, "lf")] = value;
                count++;
            });
        }

        if(count === 0) {
            alert("No NSE settings were found in that file.");
            picker.value = "";
            return;
        }

        if(confirm(`Import ${count} settings from this NSE export? Matching LuminFilter settings will be overwritten; everything else is kept.`)) {
            Object.keys(converted).forEach(function(newKey) {
                GM_setValue(newKey, converted[newKey]);
            });
            location.reload();
        } else {
            picker.value = "";
        }
    };
    reader.readAsText(file);
}

function resetSettings() {
    if(confirm("Are you sure you want to reset all blacklists, all whitelists, and all preferences in LuminFilter? This cannot be undone!")) {
        let settingsNames = GM_listValues();

        for(let i = 0; i < settingsNames.length; i++) {
            GM_deleteValue(settingsNames[i]);
        }

        location.reload();
    }
}

function saveData() {
    // Conditional rules are stored verbatim — no lowercasing, no delimiter
    // mangling — so operator keywords and punctuation survive untouched.
    let conditionalArea = document.getElementById("lfConditionalRulesArea");
    if(conditionalArea) {
        lfConditionalRulesText = conditionalArea.value.replace(/\r\n/g, "\n").trim();
        GM_setValue("lfConditionalRules", lfConditionalRulesText);
        lfCompiledConditionals = lfCompileConditionalRules(lfConditionalRulesText);
        lfValidateConditionalArea();
    }

    let listsToSave = {
        lfTaglist: "lfBlacklistTaglistArea",
        lfHardPassTaglist: "lfHardPassTaglistArea",
        lfWhitelist: "lfWhitelistTaglistArea",
        lfBlacklistTitles: "lfBlacklistTitleListArea",
        lfHardPassTitles: "lfHardPassTitleListArea",
        lfWhitelistTitles: "lfWhitelistTitleListArea",
        lfUploaders: "lfBlacklistUploadersArea",
        lfWhitelistUploaders: "lfWhitelistUploadersArea",
        lfHighlightTags: "lfHighlightTaglistArea",
        lfHighlightTitles: "lfHighlightTitleListArea",
        lfHighlightUploaders: "lfHighlightUploadersArea"
    };

    // Convert to lower case, trim whitespace, remove duplicates and save filter lists
    for(const setting in listsToSave) {
        let strList = document.getElementById(listsToSave[setting]).value.trim().toLowerCase();
        let isPhraseList = lfIsPhraseList(listsToSave[setting]);

        // Empty diff lists
        let removedList = new Array(0);
        let addedList = new Array(0);

        // List from text boxes
        let freshList = lfParseList(strList, isPhraseList);

        // Stored list (might have changed since we made our cache at the start of the script)
        let storedList = lfParseList(GM_getValue(setting), isPhraseList);

        // Cached copy of stored list (raw, so scoped entries diff correctly)
        let cachedList = lfRawLists[setting];

        // Compute additions and removals from OG array
        freshList.forEach(function(item){
            if(cachedList.indexOf(item) == -1) {
                addedList.push(item);
            }
        });

        cachedList.forEach(function(item) {
            if(freshList.indexOf(item) == -1) {
                removedList.push(item);
            }
        });

        // Remove removals and add additions to the stored list
        removedList.forEach(function(item) {
            let foundIndex = storedList.indexOf(item);
            if(foundIndex > -1) {
                storedList.splice(foundIndex, 1);
            }
        });

        addedList.forEach(function(item) {
            let foundIndex = storedList.indexOf(item);
            if(foundIndex == -1) {
                if(item !== "" && item !== null) {
                    storedList.push(item);
                }
            }
        });

        // Turning it into a set and back into an array will automagically kill dupes
        storedList = [...new Set(storedList)];
        storedList.sort();

        strList = lfStringifyList(storedList);
        GM_setValue(setting, strList);

        // Reflect updated list in textarea
        document.getElementById(listsToSave[setting]).value = strList;

        // Update cached copies of list: raw for saving, filtered for matching on this site
        lfRawLists[setting] = storedList;
        lfListBindings[setting].setText(strList);
        lfListBindings[setting].setItems(lfScopeFilter(storedList));
    }
    lfBuildMatchers();

    let checkboxes = {
        lfObliviousModeEnabled: "lfCheckObliviousMode",
        lfRussianRouletteEnabled: "lfCheckRussianRouletteMode",
        lfHideAnonUploadsEnabled: "lfCheckHideAnonUploads",
        lfHideWarnedEnabled: "lfCheckHideWarned",
        lfHideReportedEnabled: "lfCheckHideReported",
        lfHideSnatchedEnabled: "lfCheckHideSnatched",
        lfHideSeedingEnabled: "lfCheckHideSeeding",
        lfHideLeechingEnabled: "lfCheckHideLeeching",
        lfHideGrabbedEnabled: "lfCheckHideGrabbed",
        lfHideBookmarkedEnabled: "lfCheckHideBookmarked",
        lfSpotlightRowGlow: "lfCheckSpotlightRowGlow",
        lfBypassWhitelistsEnabled: "lfCheckBypassWhitelists",
        lfIndividualUploadHidingEnabled: "lfCheckIndividualHide",
        lfFilterAllButtonEnabled: "lfCheckFilterAllButtonEnabled",
        lfRightClickManagementEnabled: "lfCheckRightClickManagementEnabled",
        lfRCMTagsEnabled: "lfCheckRCMTagsEnabled",
        lfRCMTitlesEnabled: "lfCheckRCMTitlesEnabled",
        lfRCMUploadersEnabled: "lfCheckRCMUploadersEnabled",
        lfEmojiEnabled: "lfCheckEmojiEnabled",
        lfScrollToLFEnabled: "lfCheckScrollToLFEnabled",
        lfHardPassEnabled: "lfCheckHardPassEnabled",
        lfRemoveHardPassResults: "lfCheckRemoveHardPassResults",
        lfConditionalEnabled: "lfCheckConditionalEnabled",
        lfHideUnseededEnabled: "lfCheckHideUnseeded",
        lfRenumberTorrentsEnabled: "lfCheckRenumberTorrents",
        lfHideCategoryIconsEnabled: "lfCheckHideCategoryIcons",
        lfArrowNavigationEnabled: "lfCheckArrowNavigation",
        lfGlobalArrowNavigationEnabled: "lfCheckGlobalArrowNavigation",
        lfUpdateToastsEnabled: "lfCheckUpdateToasts",
        lfFloatingToggleButtonEnabled: "lfCheckFloatingToggleButton",
        lfOpenAllButtonEnabled: "lfCheckOpenAllButton",
        lfOpenAllGoNextEnabled: "lfCheckOpenAllGoNext",
        lfAllHiddenGoNextEnabled: "lfCheckAllHiddenGoNext",
        lfBackfillButtonEnabled: "lfCheckBackfillButton",
        lfCustomCSSEnabled: "lfCheckCustomCSS"
    };

    for(const setting in checkboxes) {
        GM_setValue(setting, document.getElementById(checkboxes[setting]).checked);
    }

    lfAllHiddenGoNextEnabled = document.getElementById("lfCheckAllHiddenGoNext").checked;
    lfCheckAllHiddenGoNext();

    if(lfEnableApril1stOption) {
        GM_setValue("lfEveryDayIsApril1st", document.getElementById("lfCheckApril1stAllYear").checked);
    }

    let lfThemeDropdown = document.getElementById("lfThemeDropdown");
    GM_setValue("lfSelectedTheme", lfThemeDropdown.options[lfThemeDropdown.selectedIndex].value);

    lfCustomTheme = {
        backgroundColor: document.getElementById("lfCustomThemeBgCol").value,
        backgroundHighlightColor: document.getElementById("lfCustomThemeBgHighCol").value,
        foregroundColor: document.getElementById("lfCustomThemeForeCol").value,
        accentColor: document.getElementById("lfCustomThemeAccentCol").value,
        highlightColor: document.getElementById("lfCustomThemeHighCol").value
    };
    GM_setValue("lfCustomTheme", lfCustomTheme);

    GM_setValue("lfUIFont", document.getElementById("lfUIFont").value);
    GM_setValue("lfTextAreaFont", document.getElementById("lfTextAreaFont").value);

    lfHiddenOutlineColor = lfSafeColor(document.getElementById("lfHiddenOutlineColor").value);
    lfHiddenOutlineWidth = lfClampOutlineWidth(document.getElementById("lfHiddenOutlineWidth").value);
    lfHiddenOutlineStyle = document.getElementById("lfHiddenOutlineStyle").value;
    if(!LF_OUTLINE_STYLES.includes(lfHiddenOutlineStyle)) { lfHiddenOutlineStyle = "solid"; }
    GM_setValue("lfHiddenOutlineColor", lfHiddenOutlineColor);
    GM_setValue("lfHiddenOutlineWidth", lfHiddenOutlineWidth);
    GM_setValue("lfHiddenOutlineStyle", lfHiddenOutlineStyle);
    document.getElementById("lfHiddenOutlineColor").value = lfHiddenOutlineColor;
    document.getElementById("lfHiddenOutlineWidth").value = lfHiddenOutlineWidth;

    lfHighlightColor = lfSafeColor(document.getElementById("lfHighlightColor").value);
    GM_setValue("lfHighlightColor", lfHighlightColor);
    document.getElementById("lfHighlightColor").value = lfHighlightColor;
    for(const id of ["lfHighlightBgColor", "lfBlacklistBgColor", "lfHardPassBgColor", "lfWhitelistBgColor"]) {
        const cleaned = lfSafeOptionalColor(document.getElementById(id).value);
        GM_setValue(id, cleaned);
        document.getElementById(id).value = cleaned;
    }

    GM_setValue("lfBlacklistColor", document.getElementById("lfBlacklistColor").value);
    GM_setValue("lfHardPassColor", document.getElementById("lfHardPassColor").value);
    GM_setValue("lfWhitelistColor", document.getElementById("lfWhitelistColor").value);

    GM_setValue("lfTimeout", Number(document.getElementById("lfTimeout").value));

    lfBackfillPageLimit = lfClampPageLimit(document.getElementById("lfBackfillPageLimit").value);
    GM_setValue("lfBackfillPageLimit", lfBackfillPageLimit);
    document.getElementById("lfBackfillPageLimit").value = lfBackfillPageLimit;

    // We need to escape backslashes in the custom CSS as it will be included in a back-ticked CSS block
    let css = document.getElementById("lfCustomCSSArea").value;
    css = css.replace(/\\/gi, "\\\\");
    GM_setValue("lfCustomCSS", css);

    let time = new Date().toLocaleTimeString();
    document.getElementById("lfSaveDiv").innerHTML = "Saved at " + time + "!";
    document.getElementById("lfSaveDiv").classList.remove("hidden");
}

// +-----+
// | CSS |
// +-----+
GM_addStyle(`

.lfOuterDiv, #lfRCMBox {
    font-family: ${lfUIFont} !important;
    margin:auto;
    color: ${themes[lfSelectedTheme].foregroundColor};
    padding: 10px;
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    background-color: ${themes[lfSelectedTheme].backgroundColor} !important;
    border-radius: 20px;
}

#lfOuter {
    width: 600px;
    margin-top: 10px;
}

p:not(:last-child) {
    margin: 0 0 20px;
}

section {
    display: none;
    padding: 20px 0 0;
    border-top: 1px solid ${themes[lfSelectedTheme].accentColor};
}

#lfUpdateToast {
    font-family: ${lfUIFont} !important;
    z-index: 9001 !important;
    position: fixed;
    bottom: 0px;
    width: 100%;
    height: 80px;
    text-align: center;
    color: ${themes[lfSelectedTheme].foregroundColor};
    background-color: ${themes[lfSelectedTheme].backgroundColor};
    border-top: 3px solid ${themes[lfSelectedTheme].accentColor};
}

.lfRadioButton {
    display: none;
}

.lfLabel {
    display: inline-block;
    margin: 0 0 -1px;
    padding: 10px;
    font-weight: 600;
    text-align: center;
    color: ${themes[lfSelectedTheme].accentColor};
    background-color: ${themes[lfSelectedTheme].backgroundColor} !important;
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
    margin-right: 5px;
}

.lfSettingsCheckbox {
    padding: 5px;
}

a.lfLink, a.lfLink:visited {
    color: ${themes[lfSelectedTheme].accentColor};
}

.lfSpanLink {
    color: ${themes[lfSelectedTheme].accentColor};
    cursor: pointer;
}

.lfLabel:hover {
    color: ${themes[lfSelectedTheme].highlightColor};
    background-color: ${themes[lfSelectedTheme].backgroundHighlightColor} !important;
}

.lfRadioButton:checked + .lfLabel {
    color: ${themes[lfSelectedTheme].accentColor};
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
    border-top: 2px solid ${themes[lfSelectedTheme].accentColor};
    border-bottom: 1px solid ${themes[lfSelectedTheme].backgroundColor};
}

#lfTab1:checked ~ #lfContent1,#lfTab2:checked ~ #lfContent2,#lfTab3:checked ~ #lfContent3,#lfTab4:checked ~ #lfContent4,#lfTab5:checked ~ #lfContent5 {
    display: block;
}

.lfConditionalStatus {
    font-size: 14px;
    margin-top: 6px;
    min-height: 1em;
    white-space: pre-wrap;
    color: ${themes[lfSelectedTheme].accentColor};
}

.lfConditionalStatus.lfConditionalBad {
    color: ${lfBlacklistColor} !important;
    font-weight: bold;
}

.lfConditionalStatus.lfConditionalGood {
    color: ${lfWhitelistColor} !important;
}

#lfSettingsTab1:checked ~ #lfSettingsContent1,#lfSettingsTab2:checked ~ #lfSettingsContent2,#lfSettingsTab3:checked ~ #lfSettingsContent3,#lfSettingsTab4:checked ~ #lfSettingsContent4 {
    display: block;
}

.lfExplanationSpan {
    font-size: 14px !important;
    color: ${themes[lfSelectedTheme].accentColor};
}

.lfESOffset {
    margin-left: 60px;
}

.lfListHeader {
    font-size: 18px;
}

.lfImageButton {
    position: relative;
    color: ${themes[lfSelectedTheme].foregroundColor};
    font-weight: bold;
}

.lfImageButton > a, .lfImageButton  > a:visited {
    color: ${themes[lfSelectedTheme].foregroundColor};
    text-decoration: none;
    border: 0;
}

.lfImageButton:before {
    font-weight: normal;
    margin-right: 5px;
}

.lfExplanationBox, #lfCustomThemeDiv, #lfCustomCSSDiv, .lfNiceBox {
    width: 97%;
    margin-top: 10px;
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
    padding: 10px;
    border-radius: 10px;
}

#lfRCMCustomizationDiv {
    margin-top: 0px;
}

.lfNiceBox {
    width: 75%;
}

#lfHeader, .lfCenterDiv {
    width: 100%;
    margin: auto;
    text-align: center;
    font-size: 18px;
}

#lfHeader {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 5px;
}

#lfHeader .lfNiceButton {
    margin: 0;
    white-space: nowrap;
    font-size: 14px;
}

#lfHeaderText, #lfBackfillStatus {
    white-space: nowrap;
    font-size: 16px;
}

.lfExplanationToggler, ${currentPage !== "My uploaded" ? "#lfHeaderText," : ""} .lfNiceButton, .lfRCMButton, .lfLabel:hover {
    cursor: pointer;
}

#lfRCMBox {
    width: 300px;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9001;
}

#lfRCMClose {
    float: right;
    cursor: pointer;
}

.lfMonospace {
    font-family: Courier New;
    font-size: 16px;
}

.lfTextArea {
    font-family: ${lfTextAreaFont} !important;
    width: 99%;
    max-width: 99%;
    height: 100px;
    resize: vertical;
    overflow: auto;
}

/* The custom CSS editor benefits from more room than the filter lists */
#lfCustomCSSArea {
    height: 200px;
}

.lfTextArea, .lfInput {
    color: ${themes[lfSelectedTheme].foregroundColor};
    background: none !important;
    background-color: ${themes[lfSelectedTheme].backgroundColor};
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
}

.lfFieldDiv, .lfExplanationNode, .lfExplanationBox, #lfCustomThemeDiv, #lfCustomCSSDiv, .lfOuterDiv {
    margin-bottom: 10px;
}

.lfColorTable, .lfColorTable tr, .lfColorTable td, .lfColorTable th {
    background: none !important;
    color: ${themes[lfSelectedTheme].foregroundColor} !important;
    border: none !important;
    padding: 2px 8px 2px 0;
    text-align: left;
}
.lfColorTable input.lfInput {
    color: ${themes[lfSelectedTheme].foregroundColor} !important;
    background-color: ${themes[lfSelectedTheme].backgroundColor} !important;
    border: 1px solid ${themes[lfSelectedTheme].accentColor} !important;
}
/* Spotlight lists (internally "highlight"): blacklist/Hard Pass/whitelist styling wins when an entry is on one of those too */
.lfHighlightedUploader:not(.lfHiddenUploader):not(.lfWhitelistedUploader),
.lfHighlightedTag:not(.lfHiddenTag):not(.lfHardPassTag):not(.lfWhitelistedTag),
.lfHighlightedTitle {
    color: ${lfHighlightColor} !important;
    ${lfHighlightBgColor ? `background-color: ${lfHighlightBgColor} !important;` : ""}
    font-weight: bold !important;
    border-radius: 3px;
    padding: 0 3px;
}

.lfHiddenUploader, .lfHiddenTag, .lfHiddenTitle, .lfBlacklistIdentifier {
    color: ${lfBlacklistColor} !important;
    ${lfBlacklistBgColor ? `background-color: ${lfBlacklistBgColor} !important;` : ""}
    font-weight: bold !important;
}

.lfWhitelistedUploader, .lfWhitelistedTag, .lfWhitelistedTitle, .lfWhitelistIdentifier {
    color: ${lfWhitelistColor} !important;
    ${lfWhitelistBgColor ? `background-color: ${lfWhitelistBgColor} !important;` : ""}
    font-weight: bold !important;
}

.lfHiddenTag, .lfWhitelistedTag, .lfWhitelistedTitle, .lfHiddenTitle {
    display: inline;
}

.lfHardPassTag, .lfHardPassTitle {
    color: ${lfHardPassColor} !important;
    ${lfHardPassBgColor ? `background-color: ${lfHardPassBgColor} !important;` : ""}
    font-weight: bold !important;
}

.lfNiceButton, .lfRCMButton {
    background-color: ${themes[lfSelectedTheme].backgroundColor} !important;
    color: ${themes[lfSelectedTheme].foregroundColor} !important;
    border: 1px solid ${themes[lfSelectedTheme].accentColor};
    border-radius: 10px;
    padding: 5px;
    margin-left: 5px;
    margin-right: 5px;
    font-size: 16px;
}

tr.lfSpotlightRow {
    box-shadow: inset 4px 0 0 0 ${lfHighlightColor}, 0 0 10px 1px ${lfHighlightColor}66;
}

.lfNiceButton.lfToggleOn {
    background-color: ${themes[lfSelectedTheme].accentColor} !important;
    color: ${themes[lfSelectedTheme].backgroundColor} !important;
    font-weight: bold;
}

.lfNiceButton:hover, .lfRCMButton:hover {
    background-color: ${themes[lfSelectedTheme].backgroundHighlightColor} !important;
}

.lfNiceButton, .lfRCMButton {
    padding-top: 3px;
}

/* Rows hidden by LuminFilter are only ever visible in the "show hidden" view. Mark them with an outline drawn
   inside the row (no background change, so text and tags stay readable and the layout doesn't shift). */
tr[isLFHidden="1"] {
    outline: ${lfHiddenOutlineWidth}px ${lfHiddenOutlineStyle} ${lfHiddenOutlineColor};
    outline-offset: -${lfHiddenOutlineWidth}px;
}

.lfDisabledButton {
    opacity: 0.6;
    pointer-events: none;
}

.lfBackfilledPagerPage {
    text-decoration: line-through !important;
    opacity: 0.65;
}

.lfBtmAiryDiv {
    margin-bottom: 20px;
}

#lfSaveDiv, .lfTopAiryDiv {
    margin-top: 20px;
}

#lfSaveDiv, #lfDataUsage {
    font-weight: bold;
}

#lfMainDiv, .lfUpdateToastDiv {
    margin-top: 10px;
}

h3.lfH3 {
    color: ${themes[lfSelectedTheme].foregroundColor} !important;
}

.lfIndividuallyWhitelisted {
    border: 2px solid green;
    background-color: #CEF6D8;
}

.lfIndividuallyBlacklisted {
    border: 2px solid red;
    background-color: #F6CED8;
}

.lfIndividuallyUntouched {
    border: 2px solid gray;
    background-color: #EBEBEB;
}

.lfIndividuallyBlacklisted, .lfIndividuallyWhitelisted, .lfIndividuallyUntouched {
    border-radius: 5px;
}

.lfEmoji {
    display: ${lfEmojiEnabled ? 'inline-block' : 'none'};
}

.lfToggleHideButton {
    z-index: 1 !important;
}

#lfRCMTitlePhraseText {
    width: 95%;
}

.lfSettingsControlDiv {
    text-align: center;
}

#lfFloatyBoi {
    bottom: 2em;
    right: 2em;
    background-color: ${themes[lfSelectedTheme].backgroundColor} !important;
    color: ${themes[lfSelectedTheme].foregroundColor} !important;
    padding: 0.4em;
    border-radius: 0.8em;
    position: fixed;
    float: right;
    z-index: 1000;
    user-select: none;
    cursor: pointer;
}

${lfCustomCSSEnabled ? lfCustomCSS : ''}

`);
// End CSS section

} // End of lfMain
