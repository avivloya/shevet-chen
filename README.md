# Shevet Chen · Tzofim Shachbag

The Shevet Chen staff app (roster, attendance, calendar, messages, machsan, peulot, group portals) as a normal website.

- **Site:** hosted free on GitHub Pages from this repository.
- **Sign-in and data:** Firebase (Google sign-in or email + password, Cloud Firestore database).
- **Who sees what:** `firestore.rules` is enforced by Google's servers. Only people Aviv approves into the shachbag portal can read or change anything. Only Aviv can approve people, change access settings, or teach Cheny.

## Files

| File | What it is |
| --- | --- |
| `app.html` | The app itself (same code as the claude.ai version). |
| `index.html` | The page people open. Built from `app.html` by `python3 build.py`. |
| `bridge.js` | Connects the app to Firebase: sign-in screen, database, owner. |
| `firebase-config.js` | This project's Firebase web settings (public by design). |
| `firestore.rules` | Server-side access rules. Paste into Firebase > Firestore > Rules. |
| `seed.json` | Starting data loaded once: machsan items, group needs, the weekly Peula and Tuesday Meeting calendar, position access. |

## One-time Firebase setup

1. Go to <https://console.firebase.google.com>, click **Create a project**, name it `shevet-chen`. Google Analytics is not needed.
2. **Build > Authentication > Get started.** Turn on **Google** and **Email/Password**.
   Then **Settings > Authorized domains > Add domain**: `avivloya.github.io`.
3. **Build > Firestore Database > Create database.** Choose a location, start in **production mode**.
   Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
4. **Project settings (gear icon) > Your apps > Web (`</>`).** Register an app called `Shevet Chen` (no hosting needed).
   Copy the `firebaseConfig` values into `firebase-config.js`.
5. Open the site and **sign in first, before anyone else**. The first person to sign in becomes the owner and the starting data is loaded.

## Updating the app

Edit `app.html`, run `python3 build.py`, commit and push. GitHub Pages updates within a minute.

## Not on the website yet

- **Cheny The AI** is hidden. On claude.ai it used each person's own Claude account. On a website it needs its own AI key and a small server function.
- Permissions inside the app (who can post messages, edit the calendar, and so on) are still checked by the app. The server checks that someone is an approved member and keeps owner-only settings owner-only.
