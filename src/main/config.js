'use strict';
// Everything you might want to rename or tune lives here.
module.exports = {
  APP_NAME: 'Lumen',
  SCHEME: 'lumen',

  // Height in CSS px of the glass area (tab row + toolbar row). Pages extend under it.
  STRIP_H: 92,
  BAR_H: 34,                    // extra height when the bookmarks bar is shown

  // false: frameless window with Lumen's own round window buttons on the left.
  // true: the system's caption buttons on the right (keeps Windows 11 snap layouts).
  NATIVE_CAPTION_BUTTONS: false,
  CAPTION_H: 46,
  CAPTION_W: 144,

  ENGINES: {
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
    google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' }
  },

  ZOOM_STEPS: [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5],

  HISTORY_MAX: 5000,

  DEFAULT_SETTINGS: {
    version: 3,                 // bump to reset layout-related settings for everyone
    searchEngine: 'duckduckgo',
    homePage: 'lumen://newtab',
    theme: 'system',            // system | light | dark
    glassMode: 'glass',         // glass | frosted | off
    underlay: false,            // false: page starts below the toolbar; true: page scrolls under it
    glass: { blur: 11, refraction: 24, saturation: 1.18, tint: 0.28 },
    sleepMinutes: 20,           // 0 = never
    restoreSession: true,
    adblock: true,              // block third-party ad and tracker hosts
    httpsFirst: true,           // try https for http:// addresses, fall back if the site has none
    bookmarksBar: true,
    zoom: {}                    // host -> factor
  }
};
