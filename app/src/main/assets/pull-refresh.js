(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname) || window.__marketOnlyPullInstalled) return;
  window.__marketOnlyPullInstalled = true;
  let gesture = null, hint = null, lastRefresh = 0;
  function allowed() {
    if (document.hidden || window.__marketOnlyActive === false) return false;
    const path = location.pathname.toLowerCase();
    if (!/^\/marketplace(?:\/|$)/.test(path)
        || /^\/marketplace\/(?:item|create|profile|inbox|messages|selling|buying)(?:\/|$)/.test(path)) return false;
    return !/^\/marketplace\/you(?:\/|$)/.test(path) || /^\/marketplace\/you\/saved\/?$/.test(path);
  }
  function scrollParents(target) {
    const parents = [];
    for (let p = target; p && p !== document.documentElement; p = p.parentElement) {
      const css = getComputedStyle(p);
      if (/(auto|scroll)/.test(css.overflowY) && p.scrollHeight > p.clientHeight + 1) parents.push(p);
    }
    return parents;
  }
  function atTop(parents) {
    if ((document.scrollingElement && document.scrollingElement.scrollTop > 1) || scrollY > 1) return false;
    return parents.every(p => p.scrollTop <= 1);
  }
  function hide() { if (hint) hint.style.display = 'none'; }
  function show(ready) {
    if (!hint) {
      hint = document.createElement('div'); hint.setAttribute('data-mo-pull-hint', '');
      hint.setAttribute('role', 'status');
      hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border-radius:22px;background:#263f57;color:#e4e6eb;font:600 14px system-ui;pointer-events:none;white-space:nowrap';
      document.documentElement.appendChild(hint);
    }
    hint.textContent = ready ? 'Release to refresh' : 'Pull down to refresh';
    hint.style.display = 'block';
  }
  document.addEventListener('touchstart', e => {
    gesture = null; hide();
    if (!allowed() || e.touches.length !== 1 || Date.now() - lastRefresh < 1500) return;
    if (!e.target.closest || e.target.closest('input,textarea,select,button,[role="button"],[role="dialog"],[contenteditable]:not([contenteditable="false"])')) return;
    const parents = scrollParents(e.target);
    if (!atTop(parents)) return;
    gesture = {x:e.touches[0].clientX, y:e.touches[0].clientY, parents, href:location.href, ready:false, claimed:false};
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!gesture) return;
    if (!allowed() || location.href !== gesture.href || e.touches.length !== 1 || !atTop(gesture.parents)) { gesture = null; hide(); return; }
    const dx = Math.abs(e.touches[0].clientX - gesture.x), dy = e.touches[0].clientY - gesture.y;
    if (dy < -8 || (dx > 12 && dx > Math.max(dy, 0) * .7)) { gesture = null; hide(); return; }
    if (dy < 18) { gesture.ready = false; if (gesture.claimed && e.cancelable) e.preventDefault(); hide(); return; }
    if (!e.cancelable) { gesture = null; hide(); return; }
    e.preventDefault(); gesture.claimed = true; gesture.ready = dy >= 85;
    show(gesture.ready);
  }, {passive:false});
  document.addEventListener('touchend', e => {
    const refresh = gesture && gesture.ready && allowed() && location.href === gesture.href && atTop(gesture.parents) && e.touches.length === 0;
    gesture = null; hide();
    if (refresh) { lastRefresh = Date.now(); location.href = 'marketonly://refresh'; }
  }, {passive:true});
  function cancel() { gesture = null; hide(); }
  document.addEventListener('touchcancel', cancel, {passive:true});
  document.addEventListener('visibilitychange', cancel);
  window.addEventListener('marketonly:activity', cancel);
  window.addEventListener('marketonly:navigation', cancel);
  window.addEventListener('popstate', cancel);
})();
