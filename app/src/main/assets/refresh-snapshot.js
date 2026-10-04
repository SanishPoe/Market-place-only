(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return [];
  const ids = [], seen = new Set(), visibleCache = new Map();
  function visible(element) {
    if (!element) return true;
    if (visibleCache.has(element)) return visibleCache.get(element);
    const css = getComputedStyle(element);
    const shown = css.display !== 'none' && css.visibility !== 'hidden' && !element.hidden
      && visible(element.parentElement);
    visibleCache.set(element, shown);
    return shown;
  }
  for (const a of document.querySelectorAll('a[href*="/marketplace/item/"]')) {
    if (!a.querySelector('img') || a.closest('[role="dialog"],[data-mo-ad-hidden],[data-mo-ad]')) continue;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch (_) { continue; }
    const match = u.pathname.match(/^\/marketplace\/item\/([0-9]+)\/?$/);
    if (u.protocol !== 'https:' || !/(^|\.)facebook\.com$/i.test(u.hostname) || !match) continue;
    if (seen.has(match[1]) || !visible(a) || !a.getClientRects().length) continue;
    seen.add(match[1]); ids.push(match[1]);
    if (ids.length === 40) break;
  }
  return ids;
})();
