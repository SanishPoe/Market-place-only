# Verification of MarketOnly 1.1.17-test

[Successful GitHub Actions run](https://github.com/SanishPoe/Market-place-only/actions/runs/37162248086), built from commit `e10715ea4e908a4d664a21b60b7fa98efa0302b0` on 2026-10-03.

All 34 controlled check groups passed, including routing, incoming links, retained search navigation, refresh lifecycle, sign-out callback isolation, DOM recycling, layout, captions, ad hiding, listing tools, media/gallery, maps, touch scrolling, and the photo viewer. A separate Smart Search suite passed 23 search, asking-price and persisted-catalogue checks.

Android compilation succeeded. Android `apksigner` verified the APK's v2 signature. `zipalign` validated alignment. The archive has no duplicate ZIP entries or corrupt entries; the resource table is uncompressed and aligned. The downloaded artifact checksum matches the build output.

- APK: `MarketOnly-1.1.17-test.apk`
- Size: 94,104 bytes
- SHA-256: `40999913dc2f579e6cf97f9590e9a6c84c1983edb446a5489a8a7d81ba920ad8`
- Manifest package: `au.sutto.marketonly.dev`
- Manifest version: `1.1.17-test`, code 20

The test package installs beside `au.sutto.marketonly`; it does not update that release or import its session. The original signing key was not supplied. Phone testing still needs to verify Facebook login/2FA, listing search and details, selling/photo uploads, seller conversations, Back/reopening, and sign-out with an actual account. Controlled Chromium screenshots use synthetic listings, not captured Facebook content.

Remaining audit limitations: blocking targets known feed routes, and overlapping DOM observers may perform redundant work on large result sets. The browsing restriction is not a security or parental-control boundary. There is no claimed live Facebook or Android device acceptance.
