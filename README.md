# FitnessPilot Web — iPhone workout tracker, v1

A private, no-account workout tracker that you can add to the Home Screen of an **iPhone 12 Pro Max** from Safari. No Xcode, Mac, App Store, subscription, build tools, or app developer account required. Built using only HTML, CSS, and JavaScript.

This package is **a website ready to upload**, not a live hosted URL. Follow the steps below to put it on your iPhone.

## 1. Put it online using GitHub Pages (Windows PC)

You need a free GitHub account. For the simplest free Pages setup, use a public repository. **The app's source code will be public, but workout records stay on your iPhone** (not in GitHub).

1. Download and unzip `FitnessPilot-Web-v1.zip` to your Windows PC.
2. Open https://github.com and sign in.
3. At the top right click the **+** icon, choose **New repository**.
4. Name it `fitnesspilot-web`. Select **Public**. Click **Create repository**.
5. Choose **uploading an existing file** (or **Add file → Upload files**).
6. Drag the **contents** of the `FitnessPilot-Web` folder into the upload area — **not the containing folder**. Make sure `index.html` is in the repository's top level along with `app.js`, `core.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, the `assets` folder, and the `examples` folder. The `tests` folder is optional for publishing.
7. Scroll down and click **Commit changes**.
8. In the repository open **Settings → Pages**.
9. Under **Build and deployment**, choose **Deploy from a branch**. Choose `main`, select `/(root)`, and click **Save**.
10. Give GitHub a few minutes to publish. The URL usually looks like `https://YOUR-USERNAME.github.io/fitnesspilot-web/` (replace YOUR-USERNAME). The exact link is shown in GitHub Pages settings after publishing.
11. Open that URL on your Windows PC first. Confirm the FitnessPilot screen appears and you can select **Use example workout plan**.

**Don't upload real workout logs, personal data exports, Apple passwords, API keys or `.json` backups to GitHub.** Everything in this starter ZIP is code or an example workout CSV, not your personal history.

If your repository uses a different branch name or Pages interface, choose that actual branch and the folder containing `index.html`.

## 2. Install on your iPhone 12 Pro Max

1. On the iPhone open **Safari** (not the GitHub mobile app).
2. Visit the published Pages URL from step 10.
3. Tap **Share** (or the Page Menu and Share, depending on iOS version).
4. Tap **Add to Home Screen**.
5. Enable **Open as Web App** if that option appears, then tap **Add**.
6. Tap the **FitnessPilot** icon on the Home Screen. It opens in its own window.
7. Tap **Use example workout plan** to add Monday Upper A, Tuesday Lower A, Thursday Upper B, and Friday Lower B.

After the first online visit, the static website files are cached for offline use. Workout records save locally on the device. Offline support still needs to be verified on your own iPhone, and an iPhone can clear website data under storage pressure.

## 3. Your first workout — example

1. Open **Train**. Change **Workout date** if needed.
2. Select your workout (for example, Upper A).
3. Tap **Dumbbell Bench Press**.
4. In set 1, enter `20` kg, `10` reps, `8` RPE (effort 8/10).
5. Tick the check box at the right of that set.
6. Tap **Save checked sets**. The app saves the checked set only.
7. Repeat for more sets or other exercises.
8. Open **Dashboard** to see the saved working sets and volume.

Example: 20 kg × 10 reps = 200 kg training volume for that logged set. For dumbbells, enter the weight consistently (such as **per hand**); FitnessPilot does **not** automatically double the volume for two hands. Bodyweight exercises can use 0 kg; these count as completed sets but contribute 0 kg of external load volume.

Use **Train → Daily check-in** to add body weight, protein, calories, sleep and recovery. Leaving a field blank means it was not measured.

## 4. Import a different workout plan from Excel

Open the provided `examples/UpperLower-4-Day.csv` to see the format.

Required column headings:

`day,workout,exercise,muscle,sets,rep_min,rep_max`

Optional column: `rest_seconds` (default 90)

Example rows:

```csv
day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds
Mon,Upper A,Dumbbell Bench Press,Chest,3,8,12,120
Mon,Upper A,Chest Supported Row,Back,3,8,12,120
Tue,Lower A,Leg Press,Quads,3,8,12,120
```

1. Enter your routine into Excel.
2. Choose **File → Save As → CSV UTF-8 (Comma delimited)**.
3. Put the `.csv` file in iCloud Drive, Files, or another location your iPhone can open.
4. Open FitnessPilot **Plan → Choose CSV**, select the file, review the list, and tap **Add templates to library**.
5. Assign the imported plan to the right weekday and tap **Save weekly schedule**.

Importing **adds** workout templates and skips exact duplicates. It does **not** delete saved sets or silently change a schedule. The app does **not** yet import `.xlsx` directly, nor historic rows from an old gym workbook.

## 5. Set workout reminders

**This is the main limitation of a static web app.** No Clock-style alarm can ring while FitnessPilot is closed. Actual background web push would require a separate server and notification permissions. We have not built that server.

FitnessPilot instead exports repeatable calendar events:

1. Assign at least one workout day in **Plan** and **Save weekly schedule**.
2. In **Tools → Workout reminders**, set the workout time (example: `18:30`) and alert lead time (`15 minutes before`).
3. Tap **Save alert settings**.
4. Tap **Export Calendar reminders (.ics)**.
5. Import that file into a calendar app that supports `.ics` events and alerts, such as an Apple Calendar-compatible import workflow. Depending on your iPhone/iOS version, directly tapping an `.ics` from Files might not offer the import; emailing the file to yourself or importing through a desktop calendar may be necessary. **Verify the weekly repeating events and alert in Apple Calendar.**
6. For guaranteed audible alarms, set a repeating alarm in the iPhone **Clock** app instead.

If you change your workout days or times, existing calendar events do not auto-update. Remove the old imported events before adding a new file, or you may get duplicate alerts. Calendar notifications still respect notification and Focus settings.

The in-app **Rest timer** can beep while the app is open; it is not reliable when the phone is locked or the app is closed.

## 6. Protect your records

- Open **Tools → Download full backup (.json)** every week, and save the file in **Files / iCloud Drive**. Do this before changing phones or restoring another file.
- To restore, choose **Tools → Restore backup**, review the number of records in the file, type `REPLACE`, and confirm. It will **replace the app's current templates, sets, and daily metrics**. Export a backup first.
- **Do not clear Safari website data** or delete the Home Screen web app until you have a recent backup and have verified restoring it.
- Records stay in that phone/browser's local storage; they do **not** follow your GitHub account or automatically sync between Safari and your Home Screen web app. Export/import if you move between them.
- The source files have **no network requests for your workout data**, advertising libraries, analytics, or third-party packages. Web hosting still processes normal page visits.

The original browser state remains untouched when you first open the app. Only explicit actions such as **Save**, **Use example workout plan**, **Add templates**, or the two-confirmation **Restore** write local data.

## 7. How to update your website later

1. Back up the app's data on your iPhone first.
2. Upload replacement project files to the same GitHub repository, preserving its Pages URL.
3. Wait for Pages to publish, and open the installed web app while online. The service worker uses the network when available and falls back to cached files when offline.
4. Confirm the app still displays your records before making changes.

Keep the repository and site URL stable to preserve its local-storage origin. Do not assume changing domains or GitHub repository names carries records across.

## 8. Test on a Windows PC before uploading

In the extracted folder, open PowerShell:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/` in a Windows browser. Press `Ctrl+C` in PowerShell to stop the preview server.

Do **not** open `index.html` by double-clicking it: module loading and offline web-app features need a local web server or an HTTPS website.

Developer-only automated data checks, if Node.js is installed:

```powershell
node --test tests/core.test.mjs
```

No Node.js, npm, Python, or Xcode is required to **use** the live website from your iPhone.

## 9. Limits and current verification

- Compatible design: iPhone 12 Pro Max, Safari with iOS 17+ (not tested on a real device in this environment).
- Dashboard: weekly sessions, saved sets, total external-load volume, weight/nutrition/sleep averages, strongest logged sets.
- Plans: 7-day assignments, example 4-day split, CSV import and duplicate prevention.
- Storage: local-only; JSON export and guarded JSON restore. No remote sync.
- Reminders: calendar file and in-app rest timer. No guaranteed background ringing, no push server.
- Offline: service worker precache; real iPhone offline behavior not yet tested.
- Checks: `node --test tests/core.test.mjs` and a headless Chromium UI exercise on mobile dimensions. Real navigation on sandbox Chromium was blocked by the sandbox policy, so UI checks loaded the same HTML/CSS/JavaScript in a controlled `about:blank` fixture rather than verifying actual HTTP/service worker behavior.
- No website was deployed to GitHub on your behalf.