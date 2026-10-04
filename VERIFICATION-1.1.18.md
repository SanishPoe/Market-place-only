# Verification of MarketOnly 1.1.18 Tuned

[Successful GitHub Actions run](https://github.com/SanishPoe/Market-place-only/actions/runs/37164708038), built from commit `117ca3256dc5073f531a826de2013a5a3591c744` on 2026-10-04 (UTC).

All **39 controlled check groups passed**, covering URL/incoming-link routing, actual native refresh/injection/Back/sign-out/popup/upload method bodies with stateful fakes, JavaScript syntax, layout/captions, ad hiding, maps, descriptions, media/photos, saving/action preservation, scroll gestures, virtualised spacers, recycled DOM and SPA navigation. A separate suite passed **23 Smart Search, asking-price and persisted-catalogue checks**; nine search-filter checks are also included in the 39 groups.

The new native suites include 130 popup/routing/browser/upload checks, 29 refresh/cache/timer checks and 24 injection/visibility checks. The generated native installer bundle is also executed with a failing feature to confirm independent installation, transient recovery and duplicate-work suppression.

Android compilation succeeded. Android `apksigner` verified the APK v2 signature; `zipalign -c -P 16 4` passed. Archive integrity, unique entries, valid DEX and the uncompressed/aligned resource table passed. The downloaded checksum matches the build output. Local read-only verification decoded the final manifest and compared all ten bundled assets byte-for-byte with the tested source.

- APK: `MarketOnly-1.1.18-tuned.apk`
- Size: 103,440 bytes
- SHA-256: `d9ce49212060f64c4694bba954020733406d44f1229d99ad097166641072a1f8`
- Manifest package: `au.sutto.marketonly.tuned`
- Label: **MarketOnly Tuned**
- Manifest version: `1.1.18-test`, code 21
- Minimum Android: 8.0 / API 26; target API 35
- Permission: Internet only; backup and cleartext traffic disabled

The installer uses a CI debug signing key and installs beside the original MarketOnly and the older development package. It does not update those apps or import their Facebook sessions. The original private release key was absent. Later CI builds may need the tuned app removed because CI debug keys are generated per runner.

[Performance evidence](PERFORMANCE-1.1.18.md) records controlled work counts, not S21 Ultra FPS. [Feature audit](FEATURE-AUDIT-1.1.18.md) records the available features and specific acceptance limits. No physical Android device or authenticated Facebook account was accessible for this verification. Live login/2FA, selling/uploading, conversations, account availability and subjective scrolling smoothness still require phone acceptance. Facebook chooses refreshed recommendations, so a fresh request can return the same items.
