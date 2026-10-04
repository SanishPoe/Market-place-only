(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return;
  if (window.__marketOnlyInstalled) { window.__marketOnlySweep(); return; }
  window.__marketOnlyInstalled = true;
  const market = 'https://www.facebook.com/marketplace/';
  const hostOK = h => /(^|\.)facebook\.com$/i.test(h);
  const url = s => { try { return new URL(s, location.href); } catch (_) { return null; } };
  const feed = u => u && hostOK(u.hostname) && (/^\/(?:home\.php|index\.php)?$/.test(u.pathname) || /^\/(?:watch|reels?|stories|gaming|friends|newsfeed|feeds)(?:\/|$)/.test(u.pathname) || /^\/groups\/feed(?:\/|$)/.test(u.pathname));
  const auth = () => /^\/(?:login|checkpoint|two_step|recover|confirm|auth|security|device|dialog|reg|r\.php|consent)/.test(location.pathname) || !!document.querySelector('input[type="password"], form[action*="login"]');
  const message = u => u && ((u.protocol === 'https:' && (/^(?:www\.)?messenger\.com$/i.test(u.hostname) || u.hostname === 'm.me' || (hostOK(u.hostname) && /^\/(?:messages|messenger)(?:\/|\.php|$)/.test(u.pathname)))) || u.protocol === 'fb-messenger:');
  const thread = u => message(u) && (/\/t\/[^/]+/.test(u.pathname) || u.hostname === 'm.me' || u.protocol === 'fb-messenger:');
  const openMessage = u => { location.href = 'marketonly://message?url=' + encodeURIComponent(u.href); };
  let waitingUntil = 0, opened = '', scheduled = false;
  // CSS markers leave Facebook-owned inline styles intact and are reversible
  // when React reuses a node for a different destination or navigation role.
  const hidden = new Set();
  const hide = (node, seen) => { seen.add(node); if (!node.hasAttribute('data-mo-focus-hidden')) node.setAttribute('data-mo-focus-hidden', ''); };
  function sweep() {
    scheduled = false;
    if (auth()) {
      for (const node of hidden) node.removeAttribute('data-mo-focus-hidden');
      hidden.clear();
      return;
    }
    if (feed(url(location.href))) { document.documentElement.style.visibility = 'hidden'; location.replace(market); return; }
    if (message(url(location.href))) { openMessage(url(location.href)); return; }
    // Hide Facebook's global navigation, not the Marketplace result list or filters.
    const seen = new Set();
    document.querySelectorAll('[role="navigation"][aria-label="Facebook"], nav[aria-label="Facebook"], [role="navigation"][aria-label="Facebook Navigation"]').forEach(node => hide(node, seen));
    document.querySelectorAll('a[href]').forEach(a => {
      if (feed(url(a.getAttribute('href')))) hide(a, seen);
    });
    for (const node of hidden) if (!seen.has(node)) node.removeAttribute('data-mo-focus-hidden');
    hidden.clear();
    for (const node of seen) hidden.add(node);
    if (Date.now() < waitingUntil) {
      // Only use a conversation link that Facebook actually exposes in the active dialog.
      const candidate = [...document.querySelectorAll('[role="dialog"] a[href]')]
        .map(a => url(a.href)).find(thread);
      if (candidate && opened !== candidate.href) { opened = candidate.href; waitingUntil = 0; openMessage(candidate); }
    }
  }
  window.__marketOnlySweep = sweep;
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(sweep, 80); } }
  ['pushState', 'replaceState'].forEach(name => {
    const original = history[name];
    history[name] = function (state, title, target) {
      const destination = target == null ? null : url(target);
      if (!auth() && feed(destination)) { location.replace(market); return; }
      if (message(destination)) { openMessage(destination); return; }
      const result = original.apply(this, arguments); schedule(); return result;
    };
  });
  document.addEventListener('click', e => {
    const anchor = e.target.closest && e.target.closest('a[href]');
    const destination = anchor && url(anchor.href);
    if (!auth() && feed(destination)) { e.preventDefault(); e.stopImmediatePropagation(); location.replace(market); return; }
    if (message(destination)) { e.preventDefault(); e.stopImmediatePropagation(); openMessage(destination); return; }
    const control = e.target.closest && e.target.closest('button,[role="button"],a');
    const label = control ? (control.getAttribute('aria-label') || control.textContent || '').trim() : '';
    if (/^(?:message(?: seller)?|contact seller|send message|view (?:in messenger|conversation))$/i.test(label)) {
      waitingUntil = Date.now() + 12000; opened = ''; schedule();
    }
  }, true);
  addEventListener('popstate', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['href','role','aria-label']
  });
  const style = document.createElement('style');
  style.textContent = '[data-mo-focus-hidden]{display:none!important}';
  (document.head || document.documentElement).appendChild(style);
  sweep();
})();
