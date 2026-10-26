# LuminFilter
LuminFilter is a fully featured filtering solution for sites running Luminance. It is a fork of [NSE](https://github.com/ceodoe/noshitempornium) by ceodoe, being reworked to handle sites with different layouts, plus filters that apply either everywhere or only on a specific site. Hide torrents based on tags, titles, uploaders, whether you previously downloaded it, and lots more!

# Site-specific filters
Everything you put in a list applies on every supported site. To limit an entry to specific sites, prefix it with `@site/`:

```
documentary                     applies everywhere
@site1/someuser                 only on site1
@site1,site2/some.tag           on site1 and site2, not elsewhere
```

Entries in every list are separated by semicolons: `documentary;black.and.white;@site1/someuser`. The site names to use are shown in the hint at the top of the list tabs in Options. This works in every tag, title and uploader list. Titles can contain spaces (`@site1/some phrase`), since only the leading `@site/` is special.

# Conditional rules
For anything a plain list can't say, turn on **Conditional rules** in Options > Settings > Filtering and use the new *Conditional* tab. One rule per line, written as `ACTION: expression`:

```
# Block an uploader, but keep the good stuff
HIDE: $UP{wickedwitch} AND NOT ($TA{munchkin} OR $TI{Emerald City})

# Only hide this tag in compilations
HIDE: $TA{documentary} AND $TI{compilation}

# Whitelist an uploader on one site only
SHOW: $SI{site1} AND $UP{someuser}

# Never show these, no matter what
PASS: $TA{trailer} OR $TA{sample}
```

- Actions: `HIDE` (like the blacklists; whitelists can still win), `PASS` (like Hard Pass), `SHOW` (like the whitelists)
- Selectors: `$TA{tag}`, `$UP{uploader}`, `$TI{title phrase}`, `$SI{site}`
- Operators: `AND`, `OR`, `NOT` and parentheses. `NOT` binds tightest, then `AND`, then `OR`
- Text inside `{ }` is literal, so a title phrase can contain the words AND, OR and NOT
- Blank lines and lines starting with `#` are ignored, and mistakes are flagged as you type

# Features
- Maintain a blacklist of tags, titles, and uploaders you'd like to automatically hide
- Whitelists to ignore the above blacklist rules
- Filter individual torrents that don't match any of your rules
- Hide uploads based on whether you've grabbed/downloaded it before, or if you're actively leeching/seeding it
- Click a button to see the list of hidden torrents
- Highlighting based on your lists, so you'll always know why a torrent was hidden or whitelisted
- Neat toggle button and GUI to manage lists and settings
- Conditional rules: combine tags, titles, uploaders and sites with AND, OR and NOT
- Optionally jump to the next page when everything on a page is hidden
- Left/Right arrow-key paging, optionally on every page of the site
- Actively updated
- Lots more!

# Prerequisites
- A supported browser:
  - [Firefox](https://getfirefox.com/) (Recommended!)
  - Chromium-based browsers are also supported (Chrome, Edge, Vivaldi, Brave, etc.)
- A userscript manager addon for your browser: [Tampermonkey](https://tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)

# Note on browsers and userscript engines
LuminFilter is built to work with both [Tampermonkey](https://tampermonkey.net/) and [Violentmonkey](https://violentmonkey.github.io/), on Firefox and on Chromium-based browsers (Chrome, Edge, Vivaldi, Brave, etc). It only uses the standard `GM_*` functions that both provide. Other userscript managers may work, but aren't tested. If something misbehaves, Options > Settings > About shows which userscript manager and version you are running, which is useful to include in a bug report.

# Privacy
LuminFilter does not collect any data, and does not send anything to any external websites or servers. The only data stored by LuminFilter are your settings that make the script work. That data is only stored locally in your browser. LuminFilter is free and open source software, and you can verify this claim by looking through the script itself. There is no separate privacy policy, as it is not required when no data is collected. Tampermonkey, on the other hand, collects some anonymized data, read their privacy policy [here](https://www.tampermonkey.net/privacy.php). LuminFilter is not in any way affiliated with Tampermonkey.

# How to install and use
Make sure the checkbox for "Hide tags in lists" is **unchecked** in your user settings on the site, the script won't be able to access tags if they're hidden (hover over your username at the top right of any page and click Settings). In addition, it is recommended that you increase the value of "Max Tags in lists" to a high number such as 1000, so that torrents with a lot of tags will be correctly handled.

1. Install [Tampermonkey](https://tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
1. Install LuminFilter by clicking [here](https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.user.js)
1. Follow the instructions given by your userscript manager to install the script
1. Once the script is installed, visit an applicable page on the site (Torrents, Top 10, Collages, Notifications)
1. Click the Options button in the new LuminFilter configuration area (placed below the search center, or near the top of the torrent list area)
1. Add your lists of tags, title phrases or uploaders in the newly revealed areas, and check the Settings tab for more goodies
1. Click the question mark next to each list for an explanation of what it does
1. Click "Save" then "Reload page" to save your options and reload the page

Torrents matching your blacklist rules will now be hidden, and can be shown by clicking the "Toggle X hidden torrents" button. Torrents matching whitelist rules will be shown regardless of blacklist rules. To hide individual torrents, click the eye icon that appears next to it. For more options and information, be sure to check out the settings page within LuminFilter!

You can also check out the latest changes in the [changelog](https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md). Older changelogs can be found at [NSE's site](https://github.com/ceodoe/noshitempornium).

# Coming from NSE?
LuminFilter is a separate script with its own storage, so you can install it alongside NSE and try it out without touching your NSE setup. To bring your lists and settings over, export them from NSE (Options > Settings > Data management > *Export NSE data*), then in LuminFilter use *Import NSE data* in the same place. This only reads the file; it never modifies NSE.

## Replacing the old arrow-key script
Arrow-key navigation used to be a separate companion script. It is now built into LuminFilter (Settings > *Use the arrow keys on every other page of the site too*), so you can uninstall the companion.

# Important note on data loss
If you do any of the following:

* Use incognito mode to access the site
* Clear the site's cookies
* Clear the site's website data/LocalStorage
* Reinstall the same version of the script
* Uninstall then reinstall the script

...all your lists and settings may be deleted. If you're planning to do any of these things, please make sure you back up your settings first, as they are irretrievable once lost.

# Backups
* To **backup** all your LuminFilter data to a file, click the *Export LuminFilter data* button in Options > Settings > Data management. You'll be given a JSON file to download that contains all your settings and filter lists. Store this in a safe place, for example on cloud storage.
* To **restore** all your data from a file, click the *Browse* button below *Import LuminFilter data* and select your previously backed-up JSON file.

If you can't open the site/LuminFilter (at work, people around, script broken, etc), you can also do it through your userscript manager.

**Tampermonkey:**
1. Enter the Tampermonkey dashboard by clicking its icon on your browser toolbar and selecting "Dashboard"
1. Click the "Settings" tab, and set "Config mode" to "Advanced"
1. Go back to the "Installed Userscripts" list, and click on LuminFilter
1. Select the "Storage" tab, and copy-paste all that text into a file, save it to your computer or on cloud storage
1. You have now backed up your settings. To restore them, paste your settings back into the Storage text box and click "Save", or use the import function in Options > Settings > Data management.

**Violentmonkey:** open the Violentmonkey dashboard, open LuminFilter in its editor and use the *Values* tab to view and edit the stored settings. The export and import buttons in Options > Settings > Data management work the same in both managers and are the easiest way to back up.

The files produced by these two backup methods use the same format (JSON), and such they are interchangeable; a file produced using one method will be able to be imported with the other method.

# Troubleshooting
## The script doesn't load or content isn't being hidden
- [Make sure you are using a supported browser and a supported userscript engine.](https://github.com/scruffynerf/LuminFilter#note-on-browsers-and-userscript-engines)
- Make sure there are no foreign characters in any of your filter lists, and that it is properly formatted. The script does some checks to make sure it looks okay, but it can't catch everything. Your lists should be separated by semicolons (`;`) and entries should not contain stray characters. Old space-separated lists are converted automatically. Words within tags are separated by periods, just like the tags on the site.

## Right-clicking torrent titles to open them in a new tab doesn't work anymore
- This is because Right-Click Management is enabled. You can either:
  - Use your mouse's middle button on the link to open it in a new tab
  - Hold down Ctrl, then click the link to open it in a new tab
  - Hold down Shift, then right-click the link to override RCM and show the context menu (Firefox only)
  - Disable Right-Click Management in Options > Settings > Filtering > List management

## There are weird/garbled characters next to all the options
Disable extended unicode support by going to Options > Settings > Interface and unchecking "Enable extended Unicode icons ("emoji")".

## The "Open all unfiltered results" button doesn't work or only opens a single tab
Go to the results tab you clicked the button in, and your browser will tell you that it blocked the website from opening a bunch of popups. To enable popups:
  - **Firefox**: 
    - Click the "Preferences" button next to the popup notice
    - Click the option to always allow popups from the site
  - **Chromium-based browsers**: 
    - Click the "Pop-up blocked" button that appears in the address bar
    - Choose the option to always allow popups from the site
    - Click "Done"
    - Click the "Open all unfiltered results" button again

## A bug was found, another issue not listed, or the solution described doesn't work
- [Make sure you are using a supported browser and a supported userscript engine.](https://github.com/scruffynerf/LuminFilter#note-on-browsers-and-userscript-engines)
- If you are still experiencing an issue not listed here, or the solution described does not work for you, you may have found a bug. You can create an issue in the GitHub repo, and I will do my best to assist you and/or fix the bug.

# Credits
- **ceodoe**: author of [NSE](https://github.com/ceodoe/noshitempornium), which LuminFilter is forked from
- **xrt141**: conditional rules engine, semicolon-delimited lists, compact header buttons, "if all rows are hidden, go to next page", and Open all via the userscript manager

# Contribute
You can also contribute by reporting bugs, submitting feature requests, pull requests, or just generally using LuminFilter to its fullest. Thanks for considering it.

# [Latest changes](https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md)