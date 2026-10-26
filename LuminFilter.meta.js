// ==UserScript==
// @name         LuminFilter
// @namespace    https://github.com/scruffynerf/LuminFilter
// @version      3.0.0
// @license      GPLv3
// @description  Fully featured torrent filtering solution for Luminance-based sites (fork of NoShitEmpornium)
// @updateURL    https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.meta.js
// @downloadURL  https://github.com/scruffynerf/LuminFilter/raw/master/LuminFilter.user.js
// @supportURL   https://github.com/scruffynerf/LuminFilter/issues
// @homepageURL  https://github.com/scruffynerf/LuminFilter/
// @icon         https://www.google.com/s2/favicons?domain=empornium.sx
// @author       ceodoe, scruffynerf
// @include      /^https://www\.empornium\.(me|sx|is)/torrents\.php*/
// @include      /^https://www\.empornium\.(me|sx|is)/collage\/*
// @include      /^https://www\.empornium\.(me|sx|is)/top10\.php*/
// @include      /^https://www\.empornium\.(me|sx|is)/user\.php\?action=notify/
// @include      /^https://www\.empornium\.(me|sx|is)/requests\.php/
// @exclude      /^https://www\.empornium\.(me|sx|is)/top10\.php.*(\?|&)(type=(users|tags|taggers))/
// @include      /^https://emparadise\.rs/torrents\.php*/
// @include      /^https://emparadise\.rs/collage\/*
// @include      /^https://emparadise\.rs/top10\.php*/
// @include      /^https://emparadise\.rs/user\.php\?action=notify/
// @include      /^https://emparadise\.rs/requests\.php/
// @exclude      /^https://emparadise\.rs/top10\.php.*(\?|&)(type=(users|tags|taggers))/
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==
