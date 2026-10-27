# Latest changes
## v3.5.4
- The outline for hidden torrents is now its own setting (Options > Settings, under the highlight colours): colour, thickness (1-8 px) and line style (solid, dashed, dotted, double), instead of being tied to the Custom theme
- The default outline is now a red, to match the blacklist highlight (it used to be a light purple)
- The old "Hidden torrent outline color" box in the Custom theme is gone

## v3.5.3
- When you toggle hidden torrents, those rows are now marked with an outline drawn inside the row instead of a coloured background, so their text and tags stay readable. The colour is still the theme's "hidden torrent" colour (Options > Settings > Theme, custom theme)

## v3.5.2
- Backfill results now loads 2 pages per click by default (was 5); change it in Settings

## v3.5.1
- Credit for the Backfill results button now uses mchamster's GitHub username

## v3.5.0
- **Backfill results** button on torrent lists: loads the next pages (1-15, default 2, set in Settings) onto the current page and runs the new rows through all your filters, including the eye icon, right-click menus and the Black Hole. Rows already on the page are skipped, new rows follow the "show hidden" view if it is on, and pager links for loaded pages are struck through. Based on code by mchamster, thank you!; reworked to reuse LuminFilter's own row filtering instead of a second copy of it
## v3.4.1
- New script icon (a filter funnel), replacing a site favicon

## v3.4.0
- Fixed: right-clicking a title did nothing (and threw an error) unless Hard Pass was enabled, because the menu tried to wire up a button that only exists with Hard Pass on
- Faster filtering: tag, uploader and phrase lists are prepared once instead of being re-processed for every row, and title badges are added in one step
- The eye icon (individual hide/show) now shares one code path between listings, Top 10 and the details page, and Top 10 matches torrent ids exactly (id 31 no longer also matches id 310)
- The script now runs in strict mode inside its own function, so nothing leaks into the page's global scope
- Less repeated code (about 150 lines fewer); the tests now cover list scoping, the rules engine, NSE import, the eye icon, the settings UI and the right-click menus
## v3.3.1
- Fixed: on a torrent's details page, right-clicking a tag could open the menu several times, because the page re-bound the handler every time the taglist changed. Each element is now bound once
- Fixed: title phrases are now matched against the title text rather than its HTML, so phrases containing `&` or `<` match, and the `(phrase)` badges added to a title can no longer trigger further matches
- Right-clicking a title passes the plain title (without badges) to the menu
- Title badges now use a standard `span` instead of a made-up `color` element
- Added an automated test suite (`npm install`, then `npm test`) that runs the real script against simulated pages
## v3.3.0
- **Arrow-key navigation is now built in**, so the separate GlobalArrowKeyNavigation script is no longer needed (uninstall it). Left/Right arrows page through results on filter pages as before; the new option *Use the arrow keys on every other page of the site too* (Settings, off by default) extends this site-wide
- Arrow keys are ignored while typing in a field and when Ctrl/Alt/Shift/Meta is held (so Alt+Left still goes Back)
- The script now loads on every page of the supported sites, but only builds the filter UI on listing pages; elsewhere it does nothing unless site-wide arrow keys are enabled

## v3.2.1
- Works with both Tampermonkey and Violentmonkey; the README covers installing and backing up on either
- "Open all" falls back to a normal popup if the userscript manager doesn't provide `GM_openInTab`
- Options > Settings > About now shows which userscript manager you are running
- Removed the old changelog from this repository

## v3.2.0
### Contributions from xrt141
- **Conditional rules**: new *Conditional* tab (enable it in Settings > Filtering). Combine `$TA{tag}`, `$UP{uploader}` and `$TI{title}` with `AND`, `OR`, `NOT` and parentheses, with actions `HIDE`, `PASS` (Hard Pass) and `SHOW`. Live syntax checking as you type
- All lists are now **semicolon-separated** (old space-separated lists are converted automatically)
- Filter lists default to a more compact height, and the Open all / Filter all buttons moved into the header
- *If all rows are hidden, next page*: optionally advances to the next page 2 seconds after everything on a page is hidden
- *Open all* now uses the userscript manager to open tabs, so browser popup limits no longer apply, and works without right-click management
### LuminFilter
- New `$SI{site}` selector for conditional rules, e.g. `SHOW: $SI{site1} AND $UP{someuser}`
- The next-page link is part of each site's layout profile
- Fixed HTML escaping that was lost in the contributed code (rule editor and the right-click title box)
- Scoped (`@site/`) entries are respected by the notification filter export and right-click menus

## v3.1.0
### Multi-site support
- Now works across multiple Luminance sites, each with its own layout
- Per-site profiles describe each site's hostnames and HTML layout; adding a site means adding a profile and its `@include` lines. Sites with a different layout can override the selectors for snatched/seeding/grabbed/leeching and bookmark detection
- Some site profiles still use the default layout and are unverified
### Site-specific filters
- Every list entry applies to all sites by default. Prefix an entry with `@site/` to limit it to one site (e.g. `@site1/someuser`), or `@site1,site2/` for several (e.g. `@site1,site2/some.tag`). Works in all tag, title and uploader lists (blacklist, whitelist, hard pass)
- Right-click removal on a site removes the entry for that site, leaving it intact on the others
- Options shows which site profile is in use

## v3.0.0
### Renamed to LuminFilter
- NSE is now **LuminFilter**, a fork that supports multiple Luminance sites
- Files are now `LuminFilter.user.js` / `LuminFilter.meta.js`; update URLs point to `scruffynerf/LuminFilter`
- Starts with a clean slate: all stored settings use new `lf*` keys, and LuminFilter is a separate script from NSE, so both can be installed side by side
- Added *Import NSE data* (Options > Settings > Data management) to optionally copy lists and settings from an NSE export; it never modifies NSE
- Removed the original author's donation addresses; credit to ceodoe kept in About and the license header

## v2.8.2 (NSE)
### Misc
- Updated includes to match new domain

---

Older changelogs can be found at [NSE's site](https://github.com/ceodoe/noshitempornium).
