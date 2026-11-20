# Strength Log

Strength Log is the working title for a mobile-first Push/Pull/Legs tracker. It runs as a static React app and keeps workout records and settings in the browser.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To test the installable, offline-capable build locally, run `npm run build` and then `npm run preview`. Open the printed preview URL at `/strength-log/`. The service worker runs in production builds on HTTPS or localhost. Open the app online once before going offline.

## Push to GitHub and deploy

1. Create an empty GitHub repository. The suggested name is `strength-log`. Leave GitHub's README and .gitignore initialization unchecked.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. From this project directory, run the commands below. Replace `YOUR-USERNAME` and, if you picked a different repository name, replace `strength-log` in the remote URL.

```sh
git init -b main
git add .
git commit -m "Add Strength Log gym tracker"
git remote add origin https://github.com/YOUR-USERNAME/strength-log.git
git push -u origin main
```

4. Open the repository's **Actions** tab and wait for **Deploy Strength Log** to finish. Open the deployment URL linked by the workflow. A standard project URL looks like `https://YOUR-USERNAME.github.io/strength-log/`.

The workflow uses the base path returned by GitHub Pages, so a different repo name also works in deployment. For a local preview of a different path, set `BASE_PATH` to the desired path with leading and trailing slashes before building and previewing it.

## Install on iPhone

1. Open the deployed HTTPS URL in **Safari**.
2. Tap **Share** and choose **Add to Home Screen**. If Share is inside the page menu, open that menu first.
3. Enable **Open as Web App** if shown, then tap **Add**.
4. Launch **Strength Log** from the Home Screen while online once and allow the page to finish loading. You can then test by reopening it in Airplane Mode.

[Apple's Safari installation instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)

## Log a workout

Select a date, then choose Push, Pull, or Legs. Gold marks a planned workout and icy blue marks a completed workout. Open an exercise to reveal its sets. Enter reps and optional weight in pounds, then tap **Log**, or tap **✓** to save and mark a set done in one step. Earlier entries for that exercise appear above the set rows. Tap **Complete workout** when finished and use **History** to reopen your sessions.

The timer can start when you first log a set, when you mark a set done, or only when you tap **Start**. The countdown uses an end time so it catches up when you return to the app. The completion indicator is in the app.

The earlier conversation specified reps for lat pulldown, seated row, and high row. The other targets are starter values. Edit the routine definitions in `src/data.js` if you want to change those defaults before logging.

## Keep backups private

The repository contains code, routine templates, and app assets. The app keeps workout data in browser storage and has no server or analytics. Use **Backup → Export JSON** to save a copy to Files. **Restore backup** replaces this installation's workouts and settings after confirmation. Export from the browser before switching to the installed web app if you already entered data, then import there if needed. Clearing website data or changing the deployed URL can affect access to existing records.

Keep workout exports outside the repository. The default backup filename is ignored by Git.

## Rename the app later

Update the heading in `src/main.jsx`, title in `index.html`, and `name` and `short_name` in `public/manifest.webmanifest`. The installed icon label can also be edited when adding the app to the Home Screen. Keep the existing Pages URL and storage key to retain access to workouts when changing the display name.

