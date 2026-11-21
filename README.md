# Training Journal

An iPhone-friendly React/Vite PWA for Push, Pull and Legs training.

**Live app:** https://carl-ackerly.github.io/strength-log/

## Features

- True black OLED theme with steel-blue accents and safe-area-aware bottom navigation.
- Home shows today's dated schedule, real completed-workout statistics and weekly progress.
- Calendar supports independent Push, Pull, Legs and Rest plans on every date.
- Workout exercise list opens dedicated set logging; exercise order is unrestricted.
- Each edit is written synchronously to local storage. Inputs, completed sets and optional effort ratings survive navigation and reloads.
- Resistance can be pounds, machine levels, bodyweight or repetitions only. Each recorded set retains its units. Changing resistance type clears that session's resistance values after confirmation; historical sessions retain theirs.
- Previous comparisons come from the latest earlier completed workout containing the exercise. Resistance never increases automatically.
- Progress includes history, best recorded sets, progression and pounds-times-repetitions volume. Machine levels and unweighted exercises never contribute to weight volume.
- Editable routine names, exercises, ordering, set counts and repetition targets; existing sessions keep snapshots of their exercise lists.
- Feedback Notebook saves a local draft and dated notes with screen context, with copy and text export.
- No built-in rest timer.

## Data and compatibility

Data stays in the browser on the current device. No account, backend, analytics or workout-data uploads are used.

The original storage key is retained: `strength-log:v1:/strength-log/` for the deployed base path. Version-1 backups migrate to schema version 2 without losing set keys, completion states, weights or repetitions. Legacy sessions retain all three sets per exercise, including exercises whose new template now has two. Old timer settings are discarded during migration.

Original version-1 data is retained locally under the key ending `:before-v2` before the first migrated write. Restoring a backup also retains the replaced raw data under `:before-restore`. Unreadable saved data is protected from overwrite until a valid backup is restored. Settings provides JSON backup/restore and original-data recovery download. Clearing Safari website data removes local records: export backups regularly. Restores replace the current dataset after confirmation.

Schema version 2 stores `days`, dated exercise snapshots and set maps, `templates`, resistance `preferences`, `showDifficulty`, `notes` and `noteDraft`. New backups restore into this version of Training Journal; they are not intended for older app code.

Completed workout volume includes all entered sets. In-progress volume includes only checked sets. Personal records rank by resistance then repetitions within one exercise and resistance type; bodyweight and reps-only records rank by reps. Machine-level comparisons are meaningful only on the same machine.

## Development and checks

Use Node.js 24 or newer.

```sh
npm ci
npm test
npm run dev
npm run build
npm run preview
```

Data checks use the Node test runner. Browser checks run against the production preview:

```sh
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node scripts/browser-check.mjs
```

The validation workflow runs data checks, production build, mobile browser navigation and persistence checks, legacy restore, notebook, routine edits, unit-safe records, responsive widths and offline reload. All fixtures are synthetic; no personal workout data is committed.

## GitHub Pages and iPhone offline support

The existing Pages workflow and `/strength-log/` Vite base path are retained. Pushing main runs data checks and builds/deploys Pages. The build emits a versioned service worker that caches the app shell, manifest and icons. Hash navigation works without Pages route rewrites.

In Safari use Share → Add to Home Screen. Open online once to cache the current version. For a new version, close all installed-app windows and browser tabs for the app, then reopen online. The service worker waits for old windows to close rather than replacing a running workout.
