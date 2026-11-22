# Banana Thesis Tracker Android 1.0.28

Download the [signed APK](Banana-Thesis-Tracker-Android-1.0.28.apk). Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt). The package ID is `com.feliciety02.thesistracker`, with `versionCode 29` and `versionName 1.0.28`.

This release includes the 1.0.27 sign-in and photo upload reliability fixes. It corrects the app's social preview URL after the GitHub repository rename. The repository README button now downloads the maintained latest APK directly.

The companion `apps-script/WebApp.gs` change also corrects the web app's “Open the tracker app” link and narrows the legacy photo search during uploads. The deployment owner must publish a new Apps Script web-app version for those server-side changes to reach phones.

The signing certificate matches 1.0.27 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing release to retain queued uploads and app data. Do not uninstall first.
