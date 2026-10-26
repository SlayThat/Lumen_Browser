'use strict';
// Page context menu: builds the item list shown by the glass UI and runs the chosen action.
const { clipboard } = require('electron');
const S = require('./state');
const { classify } = require('./omnibox');

function build(tab, p) {
  const wc = tab.wc;
  const items = [];
  const sep = () => { if (items.length && !items[items.length - 1].sep) items.push({ sep: true }); };
  const add = (id, label, enabled = true) => items.push({ id, label, enabled });

  if (p.misspelledWord) {
    (p.dictionarySuggestions || []).slice(0, 3).forEach((w, i) => add('spell:' + i, w));
    add('addDict', `Add “${p.misspelledWord}” to dictionary`);
    sep();
  }
  if (p.linkURL) {
    add('openLink', 'Open link in new tab');
    add('copyLink', 'Copy link address');
    sep();
  }
  if (p.mediaType === 'image' && p.srcURL) {
    add('openImage', 'Open image in new tab');
    add('saveImage', 'Save image');
    add('copyImage', 'Copy image');
    add('copyImageUrl', 'Copy image address');
    sep();
  }
  if (p.isEditable) {
    const f = p.editFlags || {};
    add('undo', 'Undo', !!f.canUndo); add('redo', 'Redo', !!f.canRedo); sep();
    add('cut', 'Cut', !!f.canCut); add('copy', 'Copy', !!f.canCopy); add('paste', 'Paste', !!f.canPaste);
    add('selectAll', 'Select all');
  } else if (p.selectionText) {
    add('copy', 'Copy');
    const short = p.selectionText.trim().slice(0, 24);
    add('search', `Search for “${short}${p.selectionText.trim().length > 24 ? '…' : ''}”`);
  }
  if (!p.linkURL && !p.selectionText && !p.isEditable && p.mediaType !== 'image') {
    const h = wc ? wc.navigationHistory : null;
    add('back', 'Back', !!h && h.canGoBack());
    add('forward', 'Forward', !!h && h.canGoForward());
    add('reload', 'Reload');
    sep();
    add('print', 'Print…');
    add('viewSource', 'View page source');
  }
  sep();
  add('inspect', 'Inspect element');
  while (items.length && items[items.length - 1].sep) items.pop();
  return items;
}

function run(win, tab, p, id) {
  const wc = tab.wc;
  if (!wc || !p) return;
  switch (id) {
    case 'openLink': win.newTab(p.linkURL, { background: true, opener: tab }); win.toast('Opened in a new tab'); break;
    case 'copyLink': clipboard.writeText(p.linkURL); break;
    case 'openImage': win.newTab(p.srcURL, { background: true, opener: tab }); break;
    case 'saveImage': wc.downloadURL(p.srcURL); break;
    case 'copyImage': wc.copyImageAt(p.x, p.y); break;
    case 'copyImageUrl': clipboard.writeText(p.srcURL); break;
    case 'undo': wc.undo(); break;
    case 'redo': wc.redo(); break;
    case 'cut': wc.cut(); break;
    case 'copy': wc.copy(); break;
    case 'paste': wc.paste(); break;
    case 'selectAll': wc.selectAll(); break;
    case 'search': win.newTab(classify(p.selectionText, S.settings.data.searchEngine).url, { opener: tab }); break;
    case 'back': tab.back(); break;
    case 'forward': tab.forward(); break;
    case 'reload': tab.reload(false); break;
    case 'print': wc.print(); break;
    case 'viewSource': win.newTab('view-source:' + wc.getURL(), { opener: tab }); break;
    case 'inspect': wc.inspectElement(p.x, p.y); break;
    case 'addDict': wc.session.addWordToSpellCheckerDictionary(p.misspelledWord); break;
    default:
      if (id.startsWith('spell:')) {
        const w = (p.dictionarySuggestions || [])[parseInt(id.slice(6), 10)];
        if (w) wc.replaceMisspelling(w);
      }
  }
}

module.exports = { build, run };
