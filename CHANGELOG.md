# Latest changes
## v3.2.0
### Contributions from xrt141
- **Conditional rules**: new *Conditional* tab (enable it in Settings > Filtering). Combine `$TA{tag}`, `$UP{uploader}` and `$TI{title}` with `AND`, `OR`, `NOT` and parentheses, with actions `HIDE`, `PASS` (Hard Pass) and `SHOW`. Live syntax checking as you type
- All lists are now **semicolon-separated** (old space-separated lists are converted automatically)
- Filter lists default to a more compact height, and the Open all / Filter all buttons moved into the header
- *If all rows are hidden, next page*: optionally advances to the next page 2 seconds after everything on a page is hidden
- *Open all* now uses the userscript manager to open tabs, so browser popup limits no longer apply, and works without right-click management
### LuminFilter
- New `$SI{site}` selector for conditional rules, e.g. `SHOW: $SI{happyfappy} AND $UP{someuser}`
- The next-page link is part of each site's layout profile
- Fixed HTML escaping that was lost in the contributed code (rule editor and the right-click title box)
- Scoped (`@site/`) entries are respected by the notification filter export and right-click menus

## v3.1.0
### Multi-site support
- Now runs on **Empornium** (and Emparadise), **HappyFappy** and **Kufirc**
- Per-site profiles describe each site's hostnames and HTML layout; adding a site means adding a profile and its `@include` lines. HappyFappy's snatched/seeding/grabbed/leeching and bookmark detection uses its own selectors
- Kufirc currently uses the default layout and is **unverified**
### Site-specific filters
- Every list entry applies to all sites by default. Prefix an entry with `@site/` to limit it to one site (e.g. `@happyfappy/someuser`), or `@site1,site2/` for several (e.g. `@empornium,kufirc/some.tag`). Works in all tag, title and uploader lists (blacklist, whitelist, hard pass)
- Right-click removal on a site removes the entry for that site, leaving it intact on the others
- Options shows which site profile is in use

## v3.0.0
### Renamed to LuminFilter
- NoShitEmpornium is now **LuminFilter**, a fork that will support multiple Luminance-based sites
- Files are now `LuminFilter.user.js` / `LuminFilter.meta.js`; update URLs point to `scruffynerf/LuminFilter`
- Starts with a clean slate: all stored settings use new `lf*` keys, and LuminFilter is a separate script from NSE, so both can be installed side by side
- Added *Import NoShitEmpornium data* (Options > Settings > Data management) to optionally copy lists and settings from an NSE export; it never modifies NSE
- Removed the original author's donation addresses; credit to ceodoe kept in About and the license header

## v2.8.2 (NoShitEmpornium)
### Misc
- Updated includes to match new domain

---

[(Older versions)](https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG_OLD.md#older-versions)
