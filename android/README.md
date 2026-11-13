# HanSearch Android APK

This Android shell opens the live HanSearch service (`https://hansearch-web.pages.dev`) in Android WebView. It uses the existing Supabase-backed data and needs an internet connection. Since it loads the live site, website updates appear in the APK without reinstalling it.

## Build

GitHub Actions builds a debug APK when Android project files are merged into `main`, or when the workflow is started manually. Download `app-debug.apk` from the `HanSearch-Android-APK` artifact on the completed workflow run, then install it on an Android device. Android may ask you to allow installation from the browser or file manager used to open the APK.

The debug APK is suitable for direct installation and testing. Publishing through Google Play requires a separately signed release build.

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
