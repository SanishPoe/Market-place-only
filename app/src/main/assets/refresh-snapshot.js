(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return [];
  const ids = [], seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/marketplace/item/"]')) {
    if (!a.querySelector('img') || a.closest('[role="dialog"],[data-mo-ad-hidden],[data-mo-ad]')) continue;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch (_) { continue; }
    const match = u.pathname.match(/^\/marketplace\/item\/([0-9]+)\/?$/);
    if (u.protocol !== 'https:' || !/(^|\.)facebook\.com$/i.test(u.hostname) || !match) continue;
    let visible = true;
    for (let p = a; p; p = p.parentElement) {
      const css = getComputedStyle(p);
      if (css.display === 'none' || css.visibility === 'hidden' || p.hidden) { visible = false; break; }
    }
    if (!visible || !a.getClientRects().length || seen.has(match[1])) continue;
    seen.add(match[1]); ids.push(match[1]);
    if (ids.length === 40) break;
  }
  return ids;
})();
