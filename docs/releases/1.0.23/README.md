# Banana Thesis Tracker Android 1.0.23

The [signed APK](Banana-Thesis-Tracker-Android-1.0.23.apk) has package ID `com.feliciety02.thesistracker`, `versionCode 24`, and `versionName 1.0.23`. Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt).

This release removes the Before the farm checklist. Fe Anne sees everyone's samples by default. The first photo schedules the RCPC submission task for the next day. On that day, one action in Samples or completing the RCPC task marks all due collected samples as submitted, moving them to Waiting for RCPC. A later collection reopens the task for its next batch. Empty reserved labels and samples collected today are not marked submitted early.

The signing certificate matches 1.0.22 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing team release to retain queued uploads and app data. Do not uninstall first.

The matching backend updates in `apps-script/WebApp.gs` must be published as a new Apps Script web-app version. Until then, the 1.0.23 app itself performs the batch submission and task scheduling when team members use this release, and displays a pending task correctly if the older server still reports it as done.
