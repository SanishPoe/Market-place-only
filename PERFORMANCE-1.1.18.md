# Controlled performance verification, 1.1.18

The [successful build](https://github.com/SanishPoe/Market-place-only/actions/runs/37164708038) compares the unmodified 1.1.17 assets in `tests/fixtures/performance-before-1.1.17` with the tuned assets. The fixture has 160 cards nested 20 levels and instruments selector calls, computed-style reads, geometry reads and text walkers. These are operation counts, not timings, FPS or live-network results.

| Scenario | 1.1.17 operations | 1.1.18 operations |
| --- | ---: | ---: |
| Five unrelated status updates | 58,905 | 0 |
| Four explicit layout sweeps | 23,512 | 4,308 |
| Five existing-card style updates | 58,910 | 290 |
| Four updates while retained/paused | 47,131 | 4 |

The four paused operations are selectors called by the fixture itself; the tuned observers contributed none. Five changed cards required five text walks instead of 1,600. Unchanged captions required no new text walks. No card source text, prices, locations, destinations or ad recycling updates were lost.

At the first inspected frame after insertion, 1.1.17 exposed the recognised ad and the new card had not been styled. In 1.1.18 the recognised ad was hidden and the new card was styled. Native code separately waits for Android visual-state readiness before showing a newly installed document; its lifecycle is checked using renderer fakes.

Virtualised result geometry remained stable: 24,000px native result spacer, 300px absolute row height, unchanged transforms and 4,500px scroll offset, including insertion/recycling of an advert. The location control changes from 35px to 36px under the compact styling; tests compare the result area's native height separately. Same-URL Saved → Sell → Saved navigation restores captions without reinstalling assets.

All browser regressions passed. Chromium fixtures cannot establish S21 Ultra frame pacing, actual Facebook DOM variants, network latency or recommendation freshness. Android `WebView.onPause` does not stop Facebook's own timers; the activity flag suspends MarketOnly's added observer work.
