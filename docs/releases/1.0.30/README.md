# Banana Thesis Tracker Android 1.0.30

Download the [signed APK](Banana-Thesis-Tracker-Android-1.0.30.apk). Its SHA-256 digest is in [SHA256SUMS.txt](SHA256SUMS.txt). Package ID: `com.feliciety02.thesistracker`; `versionCode 31`; `versionName 1.0.30`.

This update keeps the live upload progress display from 1.0.29. It warns when an offline change or sign-in cannot be stored on the phone, saves photo capture metadata with the durable queued photo, limits camera actions to the sample owner, and streams the Android upload request to reduce memory use. The Apps Script source also enforces sample ownership and reduces lock contention for uploads.

The signing certificate matches 1.0.29 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). **Install over the existing app; do not uninstall first.** This preserves queued uploads and app data.

The Apps Script owner must publish the updated `apps-script/WebApp.gs` as a new web-app version before the server-side permission and lock changes take effect.

See the [real-phone check](PHONE_CHECK.md) for device and upload verification.
