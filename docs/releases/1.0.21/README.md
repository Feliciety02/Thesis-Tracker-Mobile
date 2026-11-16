# Banana Thesis Tracker Android 1.0.21

The [signed APK](Banana-Thesis-Tracker-Android-1.0.21.apk) has package ID `com.feliciety02.thesistracker`, `versionCode 22`, and `versionName 1.0.21`. Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt).

This release keeps forms, dropdowns, and modals usable while team data refreshes in the background. A refresh fetched during an edit is applied after the editor closes; a response started before a local save cannot replace that save.

The signing certificate matches 1.0.20 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install it over the existing team release to retain queued uploads and app data. Do not uninstall the old app first. Android cannot install it over a debug build signed with a different key.

The APK contains the Android app. Updates to the Google Sheet and Drive backend in `apps-script/WebApp.gs` require a separate Apps Script deployment.
