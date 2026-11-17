# Banana Thesis Tracker Android 1.0.25

Download the [signed APK](Banana-Thesis-Tracker-Android-1.0.25.apk). Its SHA-256 digest is recorded in [SHA256SUMS.txt](SHA256SUMS.txt). The package ID is `com.feliciety02.thesistracker`, with `versionCode 26` and `versionName 1.0.25`.

This release simplifies the Samples, photo upload, Home, and Tasks workflows. Missing RCPC hand-over dates are flagged for checking instead of treating the samples as late. The submission flow can fill dates for the selected batch. Home groups related alerts and shows each person's tasks. The sync count avoids counting the same photo in multiple upload states.

The signing certificate matches 1.0.24 (certificate SHA-256: `a5da57b857aa2130ed3f93c7435dca6a661a29578b61e228b03d0edfcbe51988`). Install over the existing release to retain queued uploads and app data. Do not uninstall first.

The matching `apps-script/ThesisTracker.gs` change must be published as a new Apps Script web-app version for shared Sheet status and weekly email wording. Until then, those server-side messages continue using the previous rules.
