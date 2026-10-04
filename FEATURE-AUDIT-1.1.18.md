# MarketOnly feature and privacy audit for the 1.1.18 candidate

Audit date: 4 October 2026 (Australia/Brisbane).

Reviewed the supplied 1.1.17 source, the 1.1.18 candidate's native lifecycle fixes, every native feature class, Android manifest, browser assets, fixture coverage and release/build instructions. This report records implementation and controlled evidence. It does not assert Facebook account acceptance or performance on the user's phone.

The candidate installs separately as **MarketOnly Tuned**, package `au.sutto.marketonly.tuned`; it does not import the original app's login or local history. Final verification passed 39 controlled check groups, 23 Smart Search/storage checks, Android compilation and APK signature/alignment validation. See [VERIFICATION-1.1.18.md](VERIFICATION-1.1.18.md) for the exact run, checksum and scope. Device/account acceptance remains separate.

## Feature inventory

| Feature | Implementation / controlled support | Remaining real-device acceptance |
| --- | --- | --- |
| Facebook login and retained session | HTTPS Facebook browsing; DOM storage; cookies; checkpoint/login routes allowed; cookie flushing; no app-owned credential form | Sign in, 2FA/checkpoint, app restart and account-specific Marketplace eligibility |
| Explore and listing search | Native Explore/Search, Facebook query URLs, location/filter action hooks | Actual result retrieval, prices, categories, distance, sorting and recommendations |
| Refresh and pull to refresh | Native menu/Explore refresh, `pull-refresh.js`, cache-policy lifecycle and before/after listing snapshots | Verify request reaches Facebook and compare newly available listings; Facebook determines recommendation rotation |
| Feed, Reels and Watch restriction | Native `UrlRules` known-feed routing plus `focus.js` link guard; URL and DOM fixtures | Facebook can add unknown routes/labels; authenticated redirects and account pages need acceptance |
| Compact listing layout | Dark CSS, header removal, listing grid, title/location summaries; several nested/recycled/mixed-layout fixtures | Current Facebook page variants at actual device width/font size |
| Scroll and touch handling | Native browser scrolling; pull gesture and photo/gallery gesture fixtures | Android WebView frame pacing and keyboard/IME/inset behavior on the user's phone |
| Listing details and description | Detail/media hooks preserve listing text/actions; detail/description/maps fixtures | Actual description expansion, seller details, Save, availability and messages |
| Listing photos | Trusted photo URLs; isolated native dialog; bundled CSP; contain/pinch/zoom/gallery/swipe fixtures | Android dialog, real CDN images, pinch rendering and delayed carousel loading |
| Sell and uploads | Native Sell points to Facebook create page; Android document picker supports single/multiple accepted files; owner/session checks | Create/edit a listing, upload selected photos, select all required seller fields and confirm posting |
| Seller messaging | Exact known Facebook/Messenger thread URL retained; native Messenger handoff and web composer preserved | Existing and first-time seller conversations, Messenger installed/missing, chooser behavior |
| Saved items, collections and profile | Native Saved/More links; DOM action preservation fixtures | Saving/unsaving/saved collections/profile account operations |
| Back and retained browsing | Original query/result/scroll WebView retained for Back; bounded four retained pages plus current view; stateful lifecycle fixtures | Real process eviction, large page memory use and nested detail navigation |
| Smart Search | On-device catalogue of encountered summaries, max 400 entries, 30-day age limit, opened/hidden markers, text/budget/repair/write-off filters, restore/clear; separate Java storage/filter suite | Native controls and extraction against actual Facebook layouts; missing details remain unknown |
| Check Price and margin calculator | User-selected advertised-price comparables; minimum three; year within two years; median/range and user-entered cost arithmetic | Native UI, appropriate comparables and realistic input; these are asking prices, not sold values |
| Shared/deep listing links | VIEW/SEND direct Marketplace links on five exact Facebook hosts and safe l.php wrappers; cold/warm launch fixtures | Android default-link setup and Facebook/other apps' own link viewers |
| Options and recovery | Desktop/compact/ad-hide toggles; share, external browser, layout/refresh reports; retry, TLS failure and renderer replacement code | Real handler resolution, offline recovery, renderer death and lifecycle edge cases |
| Sign-out and local privacy | Cookies/storage cleared, browser and retained pages replaced, local listing history cleared, overlays and pending chooser cancelled; stale snapshots blocked | Actual account switch, worker/site storage behavior and process restart |

## Native regression added during this audit

`tests/browser_chrome_test.py` compiles and executes the actual extracted routing, popup creation/cleanup, external-browser launch, file chooser, picker-result and picker-cancellation bodies against stateful Android-shaped fakes. Its local run passed **130 checks** covering:

- Rejecting passive and inactive-page popup requests; handling about:blank bootstrap, trusted Facebook login/listings, known feed routes, exact seller threads and external HTTPS links.
- Blocking popup allocation during sign-out, expiring unused popups after 30 seconds, removing expiry callbacks/ownership, rejecting duplicate/expired navigation callbacks and cleaning multiple popups exactly once.
- Rejecting executable/local schemes, attacker intents and untrusted intent fallbacks; accepting the trusted fallback without executing the supplied raw intent.
- Resolving browser-category apps explicitly, excluding MarketOnly itself and duplicate/unavailable handlers, preserving listing URLs, offering only browser alternatives and handling a missing browser.
- Single/multiple file selection, accepted MIME types, native document-picker request, valid result completion, duplicate results, cancelled selection and unavailable picker feedback.
- Rejecting file results after browser identity, page URL or sign-out state changes, and clearing ownership fields before invoking completion callbacks.

This harness does not execute the Android `Intent.parseUri` implementation, real system document picker, WebView popup transport or the actual Android/Messenger resolver. The native code still requires Android compilation and device acceptance. An independent `browser_launch_test.py` also exercises the actual browser helper. Final merged regression counts and build evidence belong in the release verification record.

## Findings and specific fixes

1. **High: sign-out initially left the old renderers running while cookie removal completed.** An old page could issue more requests or callbacks during session clearing. The 1.1.18 lifecycle work introduces sign-out state, rejects new routing/captures/chooser access, cancels active callbacks and destroys old/retained browsers before clearing cookies and rebuilding. Existing reset fixtures plus the new picker fixture cover callback isolation; cookie/network timing remains Android acceptance.
2. **Medium: the file chooser previously accepted requests from inactive retained views and could return selected files after navigation.** The 1.1.18 lifecycle work captures the owning view and URL, rejects stale results and cancels selection on navigation, retained swaps, reset, renderer loss and destruction. Added executable fixture covers single/multiple results and owner/URL/session invalidation.
3. **Medium: repeated browser observers, reinjection, hidden retained views and recurring catalogue extraction add work while scrolling.** Implemented changes cache asset strings in native code, install page features in one renderer call per document, coalesce app observer work, ignore app-owned attribute changes, reuse layout metadata and stop app observers when a retained page is hidden. Refresh bypasses cache for a bounded 20-second window and then restores normal resource caching; it no longer wipes the image/script cache each time. The final merged DOM fixtures and before/after work-count benchmark passed; see [PERFORMANCE-1.1.18.md](PERFORMANCE-1.1.18.md). Android frame pacing and Facebook's own background scripts cannot be inferred solely from Chromium timings.
4. **Medium, corrected: the external-browser menu could reopen MarketOnly itself when MarketOnly was Android's default handler for Marketplace URLs.** `openInBrowser` now resolves browser-category applications, selects explicit browser packages and excludes MarketOnly. Controlled native helper checks pass; Android resolver acceptance is still required on a phone with supported-link handling enabled.
5. **Low, corrected: popup creation could allocate an untracked browser during sign-out or leave a blank popup alive indefinitely.** Sign-out gates creation, popups are registered with a 30-second expiry, handled/expired callbacks cannot route twice, and sign-out/destruction remove tracked popups and their expiry callbacks. The executable fake-based suite covers these helpers and decisions.
6. **Low: restored retained views can keep the user-agent chosen before a Desktop website preference change.** A subsequent normal load uses the retained view's existing settings. If this option is expected to affect all restored views, synchronize that setting on restore; reloading a retained page would trade away exact scroll/DOM retention.
7. **Retained user preference: Smart Search preferences survive account sign-out.** Catalogue/history are cleared; previous query, exclusion terms, budget and settings remain in private app preferences. These are retained user settings. They are not uploaded by MarketOnly; clearing local listing history likewise leaves the search settings intact.

Bundled-script robustness was also reviewed. The candidate isolates individual installer exceptions, records only failed feature names, marks installation complete only after success and allows a bounded retry. The final injection regression and full browser run must validate this new path; a fixture's happy path alone does not establish successful installation on every future Facebook DOM variant.

## Capability and privacy limits to communicate accurately

- The app is a Facebook website container with native controls. Website-controlled buying, selling, account access and recommendations are not independent app implementations.
- Messaging uses the separate Messenger app. Its other conversations and external apps are outside MarketOnly's route restriction. The listing ID is never fabricated into a recipient ID.
- The route blocker recognizes known feed routes; other Facebook account/seller/group/profile routes remain reachable. Saved collections intentionally use Facebook `/saved/`. This is not an app-level parental-control boundary.
- Only the Internet Android permission is requested. Location is set manually. Camera/microphone WebView permission requests are denied; photos come from user-selected documents. There is no direct camera capture flow.
- Ad hiding removes recognized DOM cards and does not establish that Facebook ad/tracking network traffic is blocked. Facebook still receives normal website traffic. Third-party cookies are enabled for compatibility.
- No custom backend, analytics SDK, remote AI, background listing scanner, native listing notifications or managed downloads are present.
- Smart Search operates on a bounded local sample already encountered. Radius is not verified locally; the Facebook location UI controls the source results. Repair/write-off flags depend on explicit available words and are not a vehicle-history check.
- Short Facebook `/share/...` links are unsupported without their direct Marketplace destination. Incoming Marketplace query/filter parameters are kept for navigation; catalogue listing identities omit tracking queries.
- TLS errors are cancelled; mixed content, file/content browser access and arbitrary intent execution are restricted; the photo viewer has no JS bridge and limits remote images to approved Facebook/CDN hosts.

## Focused phone acceptance after installing the final APK

1. Sign in including 2FA, leave/reopen the app and confirm the same session.
2. Refresh Explore and a filtered search; watch newly available items without requiring recommendation order to change every time; pull to refresh should activate only at the top.
3. Scroll several long result pages, open a listing, view/zoom/swipe photos and use Back to recover the exact original query and scroll position.
4. Search with location/radius/category/price filters, save/unsave an item, open saved items/collections, then use Smart Search and Check Price on loaded listings.
5. Start an existing and new seller conversation; confirm exact seller/chat, including Messenger absent if applicable.
6. Create/edit a listing with one and several selected photos; cancel a picker, navigate away while a picker is open and verify that the old page receives no chosen file.
7. Enable opening Marketplace links here, open/share a direct listing into MarketOnly, then use Open this page in browser and confirm an actual browser opens.
8. Sign out while listing/Smart/photo screens have been used; Back/reopen must not expose the old listing history/session. Log in as another account if an account-switch test is available.
9. Test offline/retry, background/foreground, display rotation and a larger system font. Check native controls and Facebook rendering rather than only screenshots of fixtures.

Successful controlled fixtures demonstrate behavior within their explicitly bounded inputs. Only the user's Android device and authenticated Facebook account can validate the final Marketplace experience and subjective smoothness.
