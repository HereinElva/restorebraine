# Google Play Store — Restorebraine Android

This branch ships a **hosted Capacitor Android app** that loads `https://restorebraine.base44.app` in a WebView (same flow as the current iOS build). Payments use **Stripe** on the hosted web app — not Google Play Billing.

## Prerequisites (on your Mac or Windows PC)

1. **Android Studio** with Android SDK (API 35+ recommended)
2. **JDK 17+** (bundled with recent Android Studio)
3. **Google Play Console** developer account
4. **Upload keystore** (create once, keep forever)

### One-time Android SDK setup (Mac)

If `android:bundle` fails with **SDK location not found**:

1. Install [Android Studio](https://developer.android.com/studio) and open it once.
2. **Android Studio → Settings → Languages & Frameworks → Android SDK** — note the **Android SDK Location** (usually `~/Library/Android/sdk`).
3. Create `android/local.properties` in the repo (this file is gitignored):

```bash
echo 'sdk.dir=/Users/ari/Library/Android/sdk' > android/local.properties
```

Replace `/Users/ari` with your Mac username if different.

4. Re-run:

```bash
npm run android:bundle
```

### Java 21 required

Capacitor Android plugins compile with **Java 21**. Android Studio may ship Java 25, which Gradle will not use for this project.

**Option A — Homebrew JDK 21 (recommended for Terminal builds):**

```bash
brew install openjdk@21
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
npm run android:bundle
```

**Option B — Let Gradle download JDK 21 automatically** (after `git pull` — `settings.gradle` includes the Foojay toolchain resolver):

```bash
cd ~/restorebraine/android
./gradlew --stop
cd ..
npm run android:bundle
```

The first build may take a few minutes while JDK 21 downloads.

## One-time keystore setup

From the repo root:

```bash
keytool -genkey -v \
  -keystore restorebraine-upload.keystore \
  -alias restorebraine \
  -keyalg RSA -keysize 2048 -validity 10000
```

Copy the example and fill in your passwords:

```bash
cp android/keystore.properties.example android/keystore.properties
```

Edit `android/keystore.properties`:

```properties
storeFile=../restorebraine-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=restorebraine
keyPassword=YOUR_KEY_PASSWORD
```

**Never commit** `keystore.properties` or `*.keystore`. Back up the keystore file securely — losing it blocks future Play Store updates.

## Build the release AAB

```bash
npm install
npm run build:android
npm run android:bundle
```

Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Without `keystore.properties`, Gradle builds an **unsigned** release bundle (useful for CI checks). Play Console requires a **signed** AAB from your upload keystore.

## Version numbers

`scripts/write-build-info.mjs` writes:

- `src/lib/build-info.js` — in-app build label
- `android/version.properties` — `VERSION_CODE` / `VERSION_NAME` for Gradle

Bump `versionCode` in `scripts/write-build-info.mjs` before each Play Store upload. `VERSION_CODE` must increase monotonically; Play Console rejects duplicates.

Current format: `VERSION_NAME=1.0.<code>` (e.g. `1.0.34`).

## Play Console checklist

1. **Create app** → Android → package name `com.restorebraine.app`
2. **App content** — complete privacy policy, data safety, and target audience forms
3. **Store listing** — title **Restorebraine**, short/long description, screenshots (phone 1080×1920 or similar)
4. **App icon** — 512×512 PNG (use `public/AppIcon.png` or `assets/logo.png`)
5. **Release** → Production (or Internal testing first) → Upload `app-release.aab`
6. **Signing** — enroll in **Play App Signing**; upload key = your `restorebraine-upload.keystore`

## OAuth and hosted URL

The app loads the hosted Restorebraine site. Google sign-in redirects to `https://restorebraine.base44.app` (not a custom URL scheme). `capacitor.config.json` already allows OAuth and Stripe hosts in `server.allowNavigation`.

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run build:android` | Web build + icon sync + `cap sync android` + verify |
| `npm run android:icons` | Regenerate launcher icons from `public/AppIcon.png` |
| `npm run android:bundle` | Gradle `bundleRelease` → `.aab` |
| `npm run android:verify` | Check sync without rebuilding |

## Internal testing (recommended first upload)

1. Play Console → **Testing** → **Internal testing**
2. Create release, upload AAB, add tester email addresses
3. Confirm login, gallery, organize, and Stripe checkout on a physical Android device

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SDK location not found` | Install Android Studio; create `android/local.properties` with `sdk.dir=/Users/YOU/Library/Android/sdk` |
| `languageVersion=21` / Java not found | Install JDK 21: `brew install openjdk@21` then `export JAVA_HOME="$(/usr/libexec/java_home -v 21)"` — do not use Android Studio's Java 25 |
| `keystore.properties not found` | Copy example file and set paths/passwords |
| Wrong launcher icon | `npm run android:icons` then rebuild |
| Version rejected | Increase `versionCode` in `write-build-info.mjs` |
| OAuth fails in WebView | Confirm device has Chrome; check `allowNavigation` hosts |

## What this cloud agent cannot do

Uploading to Play Console requires **your** Google account, upload keystore, and Play Console access. This repo prepares the signed-ready Android project; you run the final upload locally or in your own CI.
