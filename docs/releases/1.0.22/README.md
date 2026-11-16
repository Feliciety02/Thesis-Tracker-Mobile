# Banana Thesis Tracker Android 1.0.22

The [signed APK](Banana-Thesis-Tracker-Android-1.0.22.apk) has package ID `com.feliciety02.thesistracker`, `versionCode 23`, and `versionName 1.0.22`. Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt).

This release fixes the click handler that treated taps inside forms and dropdowns as navigation. Expense and task editors now stay open when moving between fields, and their submit buttons save changes. The keyboard action key also advances through add forms instead of submitting the first field. Background refresh protection from 1.0.21 remains included.

The signing certificate matches 1.0.21 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing team release to retain queued uploads and app data. Do not uninstall first.

The APK contains the Android app. Updates to the Google Sheet and Drive backend in `apps-script/WebApp.gs` require a separate Apps Script deployment.
