# HanSearch Android APK

This Android shell opens the live HanSearch service (`https://hansearch-web.pages.dev`) in Android WebView. It uses the existing Supabase-backed data and needs an internet connection. Since it loads the live site, website updates appear in the APK without reinstalling it.

## Build

Pull requests build a debug APK for validation. Production builds require the fixed
`HANSEARCH_SIGNING_BUNDLE` repository secret and publish a signed release APK to
`downloads/HanSearch.apk`. CI increments versionCode with the workflow run number.
A missing secret or different certificate fails the build without publishing a
temporary-key APK. Only the public fingerprint in `signing-certificate.sha256`
belongs in source control; keep the private bundle backed up outside the repo.

One-time setup: repository Settings → Secrets and variables → Actions → New
repository secret. Name: `HANSEARCH_SIGNING_BUNDLE`. Value: the prepared private
JSON bundle containing the base64 PKCS12 key, password and alias. Never paste it
into a chat, commit it or attach it to a public issue. GitHub Actions restores it
in the runner's temporary directory, checks its public fingerprint using keytool,
signs the release and removes the temporary file after the build.

The previous 1.0.x debug keys were generated on disposable CI runners. The first
switch to the stable release requires uninstall/reinstall once. Later signed
releases with the same package, key and increasing versionCode install as updates.

## Photo attachments (1.0.1)

The WebView forwards image inputs to Android's system document picker and returns
single/multiple selected content URIs to the page. Canceling the picker or closing
the activity releases its callback. No broad storage or media-read permission is
required for these user-selected provider URIs. This native change requires a new
APK installation; subsequent web image processing still uses the live website.

On a device, check selecting one photo, selecting multiple photos, canceling and
selecting again, and saving a record after its uploaded thumbnails appear.

## APK downloads (1.0.2)

APK navigation and WebView download responses open in the system browser to save
the file. Browser launch uses ACTION_VIEW directly and handles missing/disabled
browser apps without relying on package-visibility-sensitive resolveActivity.
No broad storage permission is added. Older installed shells require opening the
website/download URL in Chrome or Samsung Internet once to install this fix.

Device checks: the menu's app download opens the browser, the downloaded file is
an APK, normal HanSearch links stay in-app, and external knowledge links still
open in the browser. The photo chooser from 1.0.1 remains enabled.

## Back navigation (1.1.0)

The native back action asks the live page to handle its current state. Photo,
data editor, settings, help and account screens return to the home list; search
and filters reset and active AI requests are canceled. Open menus, notifications
and comment panels consume back. Upload/save/account mutations must finish first.
At home, the first press displays a short exit notice; another within two seconds
finishes the activity. Navigation, backgrounding and timeouts reset exit arming.
Android 13+ predictive back and the legacy button use the same handler. A page
that is loading or unavailable still gets guarded exit, never immediate exit.

Device checks: photo/editor back to home, search reset, busy upload/save, keyboard
back, first/second press at home, waiting longer than two seconds, and leaving
the app between presses. Unsubmitted editor text is discarded when going home.
