# MarketOnly

An unofficial Android app focused on Facebook Marketplace, with seller messaging through Messenger, saved listings, photo viewing, and on-device Smart Search. Not affiliated with Meta.

## Current audit build: 1.1.18

- Refresh requests fresh results while preserving the current search, location and category URL. Its cache bypass expires, so scrolling can reuse cached images and scripts. Duplicate refresh requests and late page callbacks are rejected.
- New documents install the page features before becoming visible. Newly inserted listings and recognised ads are processed in a coordinated frame callback; unchanged captions reuse previous extraction. Retained pages stop background DOM work.
- Virtualised listing rows retain their measured heights, transforms and scroll position. React recycling still updates titles, prices, locations and links.
- Photo-picker results are owned by the requesting renderer and page. Navigation or sign-out cancels selection. Sign-out destroys old browsers before clearing cookies.
- Open this page in browser selects an installed browser explicitly, avoiding a loop into MarketOnly.
- Smart Search reuses compiled patterns and query tokens without changing its local matching rules.

## Install the tuned app

Open **Actions → Build and verify MarketOnly → latest successful 1.1.18 run**, then download **MarketOnly-1.1.18-tuned**. Extract the ZIP and tap `MarketOnly-1.1.18-tuned.apk`. If requested, allow your browser or Files app to install it.

This build has application ID `au.sutto.marketonly.tuned` and label **MarketOnly Tuned**. It installs beside your working MarketOnly app and has its own Facebook session and local history. The original private signing key was not supplied, so this installer cannot update that original app. CI generates a debug signing key; subsequent builds may require removing the tuned app first. Removing it clears only its own session and local history.

## Build and verification

GitHub Actions installs JDK 17, Gradle 8.9, Android SDK 35 and Playwright. It runs standalone Java and native-method checks, browser fixtures, local storage checks, builds the APK and verifies its signature and alignment. Logs, screenshots and controlled performance measurements are provided as a separate artifact. See RELEASE-1.1.18.txt and the verification report for final evidence.

Local controlled checks: `python3 tests/run_checks.py`. Browser checks: `npm install`, `npx playwright install chromium`, then `python3 tests/run_checks.py --browser`. On a machine with Chromium installed, set `TEST_CHROME` to its executable. Use JDK 17 or later. Native builds require SDK platform 35 and build tools 35.0.0.

A production update uses application ID `au.sutto.marketonly`, version code 21 and the original signing key. Never commit signing keys or passwords. The standalone release builder is described in README.txt.

## Features and limits

Explore, search, Facebook's location/category filters, selling with system photo selection, saved items/collections, seller profiles, messaging handoff, listing sharing, incoming listing links, galleries, maps, local Smart Search and asking-price comparisons remain available. Facebook controls their actual account availability and web interface. See FEATURE-AUDIT-1.1.18.md for the complete inventory.

Only Internet permission is requested. There is no custom backend or analytics SDK. Facebook receives its normal website traffic. Smart Search stores a bounded local catalogue of encountered listing summaries; sign-out clears it. Camera, microphone, automatic GPS, custom notifications and background scraping are not implemented. Messenger is a separate app.

Controlled fixtures do not establish Android-device or authenticated Facebook acceptance. Refresh cannot force Facebook to return different recommendations. Ad hiding recognises DOM patterns; Facebook changes can require updates. The app blocks known feed/Reels/Watch routes, with some seller/account pages remaining reachable. It is not a parental-control boundary. External apps are outside its navigation restriction.
