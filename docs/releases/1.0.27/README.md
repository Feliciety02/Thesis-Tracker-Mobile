# Banana Thesis Tracker Android 1.0.27

Download the [signed APK](Banana-Thesis-Tracker-Android-1.0.27.apk). Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt). The package ID is `com.feliciety02.thesistracker`, with `versionCode 28` and `versionName 1.0.27`.

This release keeps timed-out and aborted photo uploads safely queued for automatic retry, stops a connection failure from appearing as a permanent Drive error, and avoids cancelling an active upload when the app opens. Sign-in now times out with a clear connection message instead of leaving the button spinning or implying a correct password was wrong. A fresh phone retries its first data load once and offers a Try again button if needed. Gallery recovery and the connection banner also describe their actual state.

The companion `apps-script/WebApp.gs` change narrows the legacy photo search during uploads. The deployment owner must publish a new Apps Script web-app version for that server-side improvement to reach phones.

The signing certificate matches 1.0.26 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing release to retain queued uploads and app data. Do not uninstall first.
