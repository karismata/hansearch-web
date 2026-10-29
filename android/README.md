# HanSearch Android APK

This Android shell opens the live HanSearch service (`https://hansearch-web.pages.dev`) in Android WebView. It uses the existing Supabase-backed data and needs an internet connection. Since it loads the live site, website updates appear in the APK without reinstalling it.

## Build

GitHub Actions builds a debug APK when Android project files are merged into `main`, or when the workflow is started manually. Download `app-debug.apk` from the `HanSearch-Android-APK` artifact on the completed workflow run, then install it on an Android device. Android may ask you to allow installation from the browser or file manager used to open the APK.

The debug APK is suitable for direct installation and testing. Publishing through Google Play requires a separately signed release build.
