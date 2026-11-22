# Banana Thesis Tracker Android 1.0.29

Download the [signed APK](Banana-Thesis-Tracker-Android-1.0.29.apk). Its SHA-256 digest is in [SHA256SUMS.txt](SHA256SUMS.txt). Package ID: `com.feliciety02.thesistracker`; `versionCode 30`; `versionName 1.0.29`.

The Samples screen now shows separate Drive confirmed and phone pending counts. A spinning count, progress strip, current filename, and waiting count appear while Android is actively sending a photo. Queued and retrying uploads show clear status without exposing raw HTML or JSON parsing errors. The native upload status avoids rereading every queued photo on each poll, improving responsiveness on phones with large queues. Unexpected web pages returned by the tracker are retried automatically.

The signing certificate matches 1.0.28 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). **Install over the existing app to retain queued uploads and app data. Do not uninstall first.**

The Apps Script owner still needs to publish the current `apps-script/WebApp.gs` as a new web app version for the earlier server changes to take effect. Actual upload completion should be checked on a physical phone with the deployed tracker.
