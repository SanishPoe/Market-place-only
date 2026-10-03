(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname) || window.top !== window) return;
  if (window.__moListingTools) return;
  window.__moListingTools = true;
  const parse = value => { try { return new URL(value, location.href); } catch (_) { return null; } };
  const listing = value => {
    const u = parse(value);
    return u && u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      /^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/i.test(u.hostname) && /^\/marketplace\/item\/[^/]+\/?$/.test(u.pathname)
      ? 'https://www.facebook.com' + u.pathname.replace(/\/?$/, '/') : null;
  };
  const clean = text => (text || '').replace(/\s+/g, ' ').trim();
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' &&
    !e.closest('[data-mo-ad-hidden],[data-mo-ad],script,style,input,textarea,[contenteditable]');
  function lines(root) {
    const out = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n, count = 0;
    while ((n = walker.nextNode()) && count++ < 2000) {
      const e = n.parentElement, text = clean(n.textContent);
      if (!e || !text || e.closest('script,style,button,input,textarea,[contenteditable],s,del,strike,[data-mo-summary]')) continue;
      let crossed = false;
      for (let p = e; p && root.contains(p); p = p.parentElement) if (getComputedStyle(p).textDecorationLine.includes('line-through')) crossed = true;
      if (!crossed) out.push(text);
    }
    return out;
  }
  const priceOf = text => {
    if (/^Free\b/i.test(text)) return 0;
    const m = /^(?:A(?:U)?\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)(?=\s|$|[·])/i.exec(text);
    return m ? Number(m[1].replace(/,/g, '')) : -1;
  };
  const flags = text => (text.match(/\b(?:not running|non[ -]?runner|won.t start|doesn.t (?:run|start)|blown|overheat(?:ing|ed|s)?|head gasket|mechanical (?:issue|problem)s?|needs? (?:an? )?(?:engine|repair|work)|engine (?:issue|problem)s?|project|(?:(?:never |not (?:a )?|no ))?(?:repairable |statutory )?(?:write[ -]?off|written off)|wovr|wovi)\b/gi) || []).join('; ');
  function card(anchor, url) {
    let root = anchor;
    for (let i = 0; i < 5 && root.parentElement; i++) {
      const p = root.parentElement;
      if (p.matches('body,main,[role="main"]') || [...p.querySelectorAll('a[href*="/marketplace/item/"]')].some(a => listing(a.href) !== url)) break;
      root = p;
    }
    const original = lines(root), summary = root.querySelector('[data-mo-summary-title]');
    let title = '', price = -1, place = '';
    if (summary) {
      const text = clean(summary.textContent), parts = text.split(' · ');
      price = priceOf(parts.shift() || ''); title = parts.join(' · ');
      place = clean(root.querySelector('[data-mo-summary-location]')?.textContent);
    }
    if (!title) {
      const index = original.findIndex(t => priceOf(t) >= 0);
      if (index < 0) return null;
      price = priceOf(original[index]);
      const inline = original[index].replace(/^(?:A(?:U)?\s*)?\$\s*[\d,.]+\s*[·•]\s*/, '');
      if (inline !== original[index]) title = inline;
      else title = original.slice(index + 1).find(t => priceOf(t) < 0 && !/^(?:Just listed|Pending|Sold|Shipping|Delivery|Pickup)$/i.test(t)) || '';
    }
    if (!place) place = original.find(t => /^[^,]{1,70},\s*(?:QLD|NSW|VIC|SA|WA|NT|ACT|TAS)\b/i.test(t)) || '';
    return title ? {url, title: title.slice(0,250), price, place: place.slice(0,100), notes: flags(original.join(' '))} : null;
  }
  window.__moListingSnapshot = () => {
    if (!/^\/marketplace(?:\/|$)/.test(location.pathname) || document.querySelector('input[type="password"]')) return [];
    const rows = new Map(), current = listing(location.href);
    if (current) {
      const heading = [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')].find(e => visible(e) && clean(e.textContent) !== 'Marketplace');
      if (heading) {
        let scope = heading;
        for (let i = 0; i < 5 && scope.parentElement; i++) {
          if (lines(scope).some(t => priceOf(t) >= 0)) break;
          scope = scope.parentElement;
        }
        const text = lines(scope), price = text.map(priceOf).find(p => p >= 0);
        const placeLine = text.find(t => /^Listed\b/.test(t)) || '';
        const place = placeLine.match(/\bin\s+(.+,\s*(?:QLD|NSW|VIC|SA|WA|NT|ACT|TAS))\b/);
        rows.set(current, {url:current,title:clean(heading.textContent).slice(0,250),price:price ?? -1,place:place ? place[1] : '',notes:flags(text.join(' '))});
      }
      return [...rows.values()];
    }
    for (const a of document.querySelectorAll('a[href*="/marketplace/item/"]')) {
      if (!visible(a) || a.closest('[role="dialog"]')) continue;
      const rect = a.getBoundingClientRect();
      // Sample near the viewport, so long feeds do not repeatedly index only
      // their first cards or scan every old card while the user scrolls.
      if (rect.bottom < -innerHeight || rect.top > innerHeight * 2) continue;
      const url = listing(a.href); if (!url || rows.has(url)) continue;
      const item = card(a, url); if (item) rows.set(url,item);
      if (rows.size >= 100) break;
    }
    return [...rows.values()];
  };
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
        !/^\/marketplace(?:\/|$)/.test(location.pathname)) return;
    const a = e.target.closest && e.target.closest('a[href]'), url = a && listing(a.href);
    if (!url || url === listing(location.href) || a.closest('[contenteditable],input,textarea')) return;
    e.preventDefault();e.stopImmediatePropagation();
    location.href = 'marketonly://listing?url=' + encodeURIComponent(url);
  }, true);
})();
