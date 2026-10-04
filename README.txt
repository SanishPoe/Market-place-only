For the current 1.1.18 audit fixes and side-by-side test installation, see README.md and RELEASE-1.1.18.txt.

MarketOnly 1.1.18 - Source project
=================================
Version code: 21
Android package: au.sutto.marketonly
Minimum Android: 8.0 (API 26)
Compile/target SDK: 35

This ZIP contains the complete application source, resources, build scripts,
controlled tests and recent release notes. The application source includes the 1.1.18 audit improvements
over version 1.1.16. See RELEASE-1.1.16.txt for Smart Search, Check Price and
retained search results when returning from a listing.

START HERE
1. Extract the ZIP.
2. Open the MarketOnly folder in Android Studio.
3. Use JDK 17, Android SDK 35, Android Gradle Plugin 8.7.3 and Gradle 8.9.
   Install missing SDK packages through Android Studio's SDK Manager.
4. This original project has no bundled Gradle wrapper. Use a local Gradle 8.9
   installation, or run the following from the MarketOnly folder with that
   Gradle installation to generate one:
      gradle wrapper --gradle-version 8.9
   Then sync/open the project in Android Studio.
5. Build the debug APK using Android Studio, or run:
      ./gradlew :app:assembleDebug
   On Windows use gradlew.bat :app:assembleDebug instead.
   Output: app/build/outputs/apk/debug/app-debug.apk

An Internet connection is needed to download Gradle/SDK/build dependencies.
The app has no third-party runtime libraries or required paid API key.
AGP compatibility reference:
https://developer.android.com/build/releases/agp-8-7-0-release-notes

SIGNING
The original private signing key and password are deliberately NOT included.
A debug build or a build signed with your own key cannot update the existing
release installation in place. Debug builds automatically use applicationId au.sutto.marketonly.tuned
and label MarketOnly Tuned; the production namespace remains unchanged.
Updating the existing release requires the original private signing backup.
Do not uninstall the existing app just to try a development build, because
uninstalling removes its local session and listing history.

MANUAL BUILD ALTERNATIVE (Linux/macOS)
The supplied Python builder is the build path used for the release APK.
Requires Python 3, JDK 17, Android platform 35 and SDK build-tools 35.0.0.
No Gradle is needed for this alternative.

Generate YOUR OWN keystore (you will be prompted to choose a password):
  keytool -genkeypair -keystore my-marketonly.p12 -storetype PKCS12 \
    -alias marketonly -keyalg RSA -keysize 2048 -validity 10000

In bash, enter that password without displaying it:
  read -r -s -p 'Keystore password: ' MARKETONLY_KEYSTORE_PASSWORD
  export MARKETONLY_KEYSTORE_PASSWORD

Build, substituting your SDK directories:
  python3 build_apk.py --platform /path/to/platforms/android-35 \
    --tools /path/to/build-tools/35.0.0 --key my-marketonly.p12
  unset MARKETONLY_KEYSTORE_PASSWORD

The manual builder requires alias marketonly and the same key/store password.
It checks the signature, ZIP alignment and uncompressed resource table.
Its default output is dist/MarketOnly-1.1.18.apk. Without --key and the password
variable it expects the private signing backup, which is not in this archive.
On Windows, prefer Android Studio; the Python builder assumes Unix tool names.

PROJECT MAP
app/src/main/java/au/sutto/marketonly/ - Java Android app and search logic
app/src/main/assets/                  - Marketplace layout, galleries and JS
app/src/main/res/                     - Android resources
app/src/main/AndroidManifest.xml      - Permissions and link routing
app/build.gradle                     - App version and Android build settings
tests/                               - Controlled regression fixtures
RELEASE-1.1.18.txt                    - Latest changes and validation limits

TESTS
These are standalone controlled tests, not an Android instrumentation suite.
They do not prove real-device or signed-in Facebook behaviour. See
VERIFICATION-1.1.18.md for the completed build evidence and
FEATURE-AUDIT-1.1.18.md for features and device acceptance limits.

Simple standalone checks (JDK 17/Python 3/Node.js as applicable):
  python3 tests/search_navigation_test.py
  python3 tests/external_intent_test.py
  python3 tests/refresh_lifecycle_test.py
  node tests/guard_test.cjs

Browser fixtures need the Playwright Node package and a Chromium installation.
Browser fixtures accept TEST_CHROME or use the browser installed by Playwright.
The portable runner is python3 tests/run_checks.py --browser.
SmartSearchTest.java additionally needs Android API classes and a working JVM
org.json implementation; Android's stub android.jar alone cannot execute it.

Excluded: signing secrets, generated APKs, build output, SDK/JDK binaries,
local machine settings and browser/account data.
