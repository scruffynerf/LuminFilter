# LuminFilter
LuminFilter is a fully featured filtering solution for Luminance-based torrent sites, starting with Empornium. It is a fork of [LuminFilter](https://github.com/ceodoe/noshitempornium) (LuminFilter) by ceodoe, being reworked to support multiple sites with their own layouts, plus filters that apply either everywhere or only on a specific site. Hide torrents based on tags, titles, uploaders, whether you previously downloaded it, and lots more!

# Supported sites
- Empornium (including Emparadise)
- HappyFappy
- Kufirc *(layout not yet verified)*

# Site-specific filters
Everything you put in a list applies on every supported site. To limit an entry to specific sites, prefix it with `@site/`:

```
jerk.off.instruction            applies everywhere
@happyfappy/someuser            only on HappyFappy
@empornium,kufirc/some.tag      on Empornium and Kufirc, not HappyFappy
```

Site names are `empornium`, `happyfappy` and `kufirc`. This works in every tag, title and uploader list. Titles can contain spaces (`@kufirc/some phrase`), since only the leading `@site/` is special.

# Features
- Maintain a blacklist of tags, titles, and uploaders you'd like to automatically hide
- Whitelists to ignore the above blacklist rules
- Filter individual torrents that don't match any of your rules
- Hide uploads based on whether you've grabbed/downloaded it before, or if you're actively leeching/seeding it
- Click a button to see the list of hidden torrents
- Highlighting based on your lists, so you'll always know why a torrent was hidden or whitelisted
- Neat toggle button and GUI to manage lists and settings
- Actively updated
- Lots more!

# Prerequisites
- A supported browser:
  - [Firefox](https://getfirefox.com/) (Recommended!)
  - Chromium-based browsers are also supported (Chrome, Edge, Vivaldi, Brave, etc.)
- The [Tampermonkey](https://tampermonkey.net/) userscript engine addon for your browser

# Note on browsers and userscript engines
Note that LuminFilter is mainly developed on and tested with mainline Firefox and Tampermonkey, and thus Tampermonkey is the only "officially" supported userscript engine. Although I am an avid FF user, I'm not blind to the fact that most of the world uses Chrome, so every release of LuminFilter is also tested and made sure to work on Chromium-based browsers. Waterfox and other comparably niche browser forks and userscript engines might work fully or partly, but are not supported. Thus there is no guarantee it will work on any other combination of browsers and engines aside from FF/Chromium + Tampermonkey.  

# Privacy
LuminFilter does not collect any data, and does not send anything to any external websites or servers. The only data stored by LuminFilter are your settings that make the script work. That data is only stored locally in your browser. LuminFilter is free and open source software, and you can verify this claim by looking through the script itself. There is no separate privacy policy, as it is not required when no data is collected. Tampermonkey, on the other hand, collects some anonymized data, read their privacy policy [here](https://www.tampermonkey.net/privacy.php). LuminFilter is not in any way affiliated with Tampermonkey.

# How to install and use
Make sure the checkbox for "Hide tags in lists" is **unchecked** in your user settings on Emp, the script won't be able to access tags if they're hidden (hover over your username at the top right of any page and click Settings). In addition, it is recommended that you increase the value of "Max Tags in lists" to a high number such as 1000, so that torrents with a lot of tags will be correctly handled.

1. Install [Tampermonkey](https://tampermonkey.net/)
1. Install LuminFilter by clicking [here](https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.user.js)
1. Follow the instructions given by Tampermonkey to install the script
1. Once the script is installed, visit an applicable page on Emp (Torrents, Top 10, Collages, Notifications)
1. Click the Options button in the new LuminFilter configuration area (placed below the search center, or near the top of the torrent list area)
1. Add your lists of tags, title phrases or uploaders in the newly revealed areas, and check the Settings tab for more goodies
1. Click the question mark next to each list for an explanation of what it does
1. Click "Save" then "Reload page" to save your options and reload the page

Torrents matching your blacklist rules will now be hidden, and can be shown by clicking the "Toggle X hidden torrents" button. Torrents matching whitelist rules will be shown regardless of blacklist rules. To hide individual torrents, click the eye icon that appears next to it. For more options and information, be sure to check out the settings page within LuminFilter!

You can also check out the latest (and older) changes in the [changelog](https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md)!

# Coming from NoShitEmpornium?
LuminFilter is a separate script with its own storage, so you can install it alongside NSE and try it out without touching your NSE setup. To bring your lists and settings over, export them from NSE (Options > Settings > Data management > *Export NSE data*), then in LuminFilter use *Import NoShitEmpornium data* in the same place. This only reads the file; it never modifies NSE.

# Important note on data loss
If you do any of the following:

* Use incognito mode to access Emp
* Clear Emp cookies
* Clear Emp website data/LocalStorage
* Reinstall the same version of the script
* Uninstall then reinstall the script

...all your lists and settings may be deleted. If you're planning to do any of these things, please make sure you back up your settings first, as they are irretrievable once lost.

# Backups
* To **backup** all your LuminFilter data to a file, click the *Export LuminFilter data* button in Options > Settings > Data management. You'll be given a JSON file to download that contains all your settings and filter lists. Store this in a safe place, for example on cloud storage.
* To **restore** all your data from a file, click the *Browse* button below *Import LuminFilter data* and select your previously backed-up JSON file.

If you can't open Emp/LuminFilter (at work, people around, script broken, etc), you can also do it through Tampermonkey:
1. Enter the Tampermonkey dashboard by clicking its icon on your browser toolbar and selecting "Dashboard"
1. Click the "Settings" tab, and set "Config mode" to "Advanced"
1. Go back to the "Installed Userscripts" list, and click on LuminFilter
1. Select the "Storage" tab, and copy-paste all that text into a file, save it to your computer or on cloud storage
1. You have now backed up your settings. To restore them, paste your settings back into the Storage text box and click "Save", or use the import function in Options > Settings > Data management.

The files produced by these two backup methods use the same format (JSON), and such they are interchangeable; a file produced using one method will be able to be imported with the other method.

# Troubleshooting
## The script doesn't load or content isn't being hidden
- [Make sure you are using a supported browser and a supported userscript engine.](https://github.com/scruffynerf/LuminFilter#note-on-browsers-and-userscript-engines)
- Make sure there are no foreign characters in any of your filter lists, and that it is properly formatted. The script does some checks to make sure it looks okay, but it can't catch everything. Your lists should be space separated (semicolons for titles), and words within tags are separated by periods, just like the tags on the site.

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
    - Click the option to always allow popups from Emp
  - **Chromium-based browsers**: 
    - Click the "Pop-up blocked" button that appears in the address bar
    - Choose the option to always allow popups from Emp
    - Click "Done"
    - Click the "Open all unfiltered results" button again

## A bug was found, another issue not listed, or the solution described doesn't work
- [Make sure you are using a supported browser and a supported userscript engine.](https://github.com/scruffynerf/LuminFilter#note-on-browsers-and-userscript-engines)
- If you are still experiencing an issue not listed here, or the solution described does not work for you, you may have found a bug. You can create an issue in the GitHub repo, post in the thread on Emp, or send me a message there, and I will do my best to assist you and/or fix the bug.

# Contribute
You can also contribute by reporting bugs, submitting feature requests, pull requests, or just generally using LuminFilter to its fullest. Thanks for considering it.

# [Latest changes](https://github.com/scruffynerf/LuminFilter/blob/master/CHANGELOG.md)