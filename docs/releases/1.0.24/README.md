# Banana Thesis Tracker Android 1.0.24

The [signed APK](Banana-Thesis-Tracker-Android-1.0.24.apk) has package ID `com.feliciety02.thesistracker`, `versionCode 25`, and `versionName 1.0.24`. Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt).

Fe Anne now enters the collection date at the top of Samples. The RCPC hand-over task is due the following day. Checking the hand-over task, or marking it Done in Tasks, submits every recorded sample collected on that date across all members and moves them to Waiting for RCPC. The planning date then clears for the next batch while sample history remains. A sample from another collection date is kept for its own batch.

The signing certificate matches 1.0.23 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing release to retain queued uploads and app data. Do not uninstall first.

The matching `apps-script/ThesisTracker.gs` and `apps-script/WebApp.gs` changes must be published as a new Apps Script web-app version for the shared plan date and server-side task automation. Until then, the 1.0.24 app keeps Fe Anne's plan on her phone and performs the batch through the existing API.
