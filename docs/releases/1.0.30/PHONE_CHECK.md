# Android 1.0.30 phone check

Checked on 23 November 2026 with a connected realme RMX2151 phone running Android 12.

- Installed the signed 1.0.30 APK over 1.0.29. Android reported `versionCode 31` and `versionName 1.0.30`; the original installation date was preserved.
- The existing sign-in session survived the update and a force-stop/relaunch. Samples, Home, Tasks, and Expenses opened without a fatal app error.
- Watched the live Samples upload queue move from five pending photos to zero. The screen showed upload progress and a checked Gallery status. No pending photos remained on this phone at the end of the check.
- Ran `PhotoUploadWorkerTest` on the phone (one test) and `NamedGalleryTest` (three tests); both passed. The worker test used an invalid token and did not write to the tracker sheet or Drive.
- Confirmed that the currently deployed Apps Script endpoint returned JSON for an invalid-token request.

The correct-password login flow was not exercised because no account password was supplied. The live Apps Script deployment has not yet been updated from the source in this release. Publish `apps-script/WebApp.gs` as a new web-app version to activate the server-side ownership and upload-lock fixes; then repeat a real sign-in and upload check on a slow connection.
