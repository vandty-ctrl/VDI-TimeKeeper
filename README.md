# VDI TimeKeeper — Setup Guide

A time clock your employees install on their phones (iPhone and Android), plus a private hours dashboard for you on Windows.

**Your site address once it's live:** https://vandty-ctrl.github.io/vdi-timekeeper/

Total setup time: about 30 minutes. Do the parts in order.

---

## What's in this folder (11 files, no subfolders)

| File | What it is | Do you edit it? |
|---|---|---|
| `index.html` | The page and its look | No |
| `app.js` | Everything the app does | No |
| `config.js` | Your Firebase settings and manager ID | **Yes** |
| `firestore.rules` | Privacy rules you paste into Firebase | **Yes**, one line |
| `sw.js`, `manifest.webmanifest` | Make it installable on phones | No |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Home-screen icons | No |
| `README.md` | This guide | No |

---

## Part 1 — Set up Firebase (about 10 minutes)

Firebase is Google's free service that handles sign-ins and stores the punches. Do this on your Windows computer.

### 1.1 Create the project
1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project** (or **Add project**).
3. Name it `vdi-timekeeper` and click **Continue**.
4. Turn **off** Google Analytics (you don't need it), then click **Create project**. Wait, then click **Continue**.

### 1.2 Register the web app and copy its settings
1. On the project's home page, click the **`</>`** (Web) icon under "Get started by adding Firebase to your app."
2. App nickname: `VDI TimeKeeper`. Leave **Firebase Hosting unchecked**. Click **Register app**.
3. Firebase shows a block of code with `const firebaseConfig = { ... }`. **Leave this tab open.** You'll copy six values from it in Part 2.
4. Click **Continue to console**.

You can always find these values again at the **gear icon → Project settings → Your apps**.

### 1.3 Turn on email and password sign-in
1. Left menu: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, click **Email/Password**.
3. Switch on the **first** toggle (Email/Password). Leave "Email link" off. Click **Save**.

### 1.4 Allow your website to use sign-in
1. Still in Authentication, click the **Settings** tab, then **Authorized domains**.
2. Click **Add domain**, type `vandty-ctrl.github.io` (no `https://`, nothing after it), and click **Add**.

### 1.5 Create the database
1. Left menu: **Build → Firestore Database → Create database**.
2. Location: choose **nam5 (United States)** or **us-east4 (Northern Virginia)**. You can't change this later, but either is fine.
3. Choose **Start in production mode**, then click **Create**.

---

## Part 2 — Fill in `config.js` (about 3 minutes)

1. Unzip the download: right-click the zip → **Extract All** → **Extract**.
2. In the extracted folder, right-click **config.js** → **Open with** → **Notepad**.
3. Copy each value from the Firebase tab (Part 1.2) into the matching line, replacing the `PASTE_...` text. Keep the quotes and commas. It should look like this, with your own values:

   ```js
   export const firebaseConfig = {
     apiKey: "AIzaSyB...",
     authDomain: "vdi-timekeeper-1a2b3.firebaseapp.com",
     projectId: "vdi-timekeeper-1a2b3",
     storageBucket: "vdi-timekeeper-1a2b3.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123def456"
   };

   export const MANAGER_UID = "PASTE_YOUR_UID";
   ```
4. **Leave `MANAGER_UID` as is for now.** You fill it in during Part 5.
5. Save (**Ctrl+S**) and close Notepad.

The `apiKey` is safe in a public repo. Firebase designs it to be public; the privacy rules are what protect the data.

---

## Part 3 — Put the files on GitHub (about 5 minutes)

You already have the repo **vandty-ctrl/vdi-timekeeper**. Uploading files with the same names replaces the old ones.

1. Go to **https://github.com/vandty-ctrl/vdi-timekeeper**.
2. Click **Add file → Upload files**.
3. Open the extracted folder on your computer, press **Ctrl+A** to select all 11 files, and drag them onto the GitHub page. Drag the **files**, not the folder that holds them.
4. Click **Commit changes**.
5. Check the repo's front page: you should see `index.html`, `app.js`, `config.js` and the rest listed directly there, not inside a folder.
6. Optional cleanup: if an old `icons` folder is there from before, you can leave it. The new version doesn't use it.

---

## Part 4 — Turn on GitHub Pages (about 3 minutes, plus waiting)

This step is what fixes the 404.

1. In the repo, click **Settings** (top tabs), then **Pages** (left menu).
2. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`, folder **`/ (root)`**
   - Click **Save**.
3. The repo must be **Public**. If Pages says it needs an upgrade, go to **Settings → General**, scroll to **Danger Zone**, and click **Change visibility → Public**.
4. Click the **Actions** tab. Wait for "pages build and deployment" to show a **green check** (1–3 minutes).
5. Open **https://vandty-ctrl.github.io/vdi-timekeeper/**. You should see the VDI TimeKeeper sign-in screen.

---

## Part 5 — Make yourself the manager (about 5 minutes)

1. On the sign-in screen, enter your email and a password (6+ characters) and click **Create account**.
2. The app shows **"Make this account the manager"** with your **user ID**. Click **Copy user ID**.
3. On GitHub, click **config.js** → the **pencil icon** (Edit). Replace `PASTE_YOUR_UID` with your ID (keep the quotes). Click **Commit changes** twice.
4. On GitHub, click **firestore.rules** → the **pencil icon**. Find `PASTE_YOUR_UID` (it's in one place, inside single quotes) and replace it with your ID. Click **Commit changes** twice.
5. Still on `firestore.rules`, click the **copy** icon (two overlapping squares, top right of the file view) to copy the whole file.
6. In Firebase: **Firestore Database → Rules** tab. Select everything in the editor (**Ctrl+A**), delete it, paste (**Ctrl+V**), and click **Publish**.
7. Wait about a minute, then reload the site. You should see **Team hours**.

---

## Part 6 — Test it yourself (about 5 minutes)

**On your phone:**
1. Open the site link. Use **Safari** on iPhone or **Chrome** on Android.
2. Install it:
   - **iPhone:** tap the **Share** button → **Add to Home Screen** → **Add**.
   - **Android:** tap **Install app** on the page, or **⋮ → Add to Home screen**.
3. Open TimeKeeper from the **new home-screen icon** and sign in with your account.
4. Tap the **My clock** tab. Enter your name and tap **Create my time card**.
5. Tap **Clock in**.

**On your Windows computer:**
1. Open the site and sign in. **Team hours** should show you as **In since** the time you clocked in.
2. Clock out on the phone. The dashboard updates by itself.

---

## Part 7 — Roll it out to employees

Send each employee something like:

> Our new time clock is VDI TimeKeeper. On your phone, open https://vandty-ctrl.github.io/vdi-timekeeper/ in Safari (iPhone) or Chrome (Android) and add it to your home screen. Open it from the icon, tap Create account, enter your name, and set your clock-in and clock-out reminder times. Then tap Allow notifications and add the two calendar reminders.

Each employee:
1. Installs the app and creates an account.
2. Enters their name.
3. Sets their **clock-in and clock-out reminder times** and **work days**, then taps **Save reminders**.
4. Taps **Allow notifications**.
5. Taps **Add clock-in reminder** and **Add clock-out reminder** to put repeating events in Google Calendar, then sets each event's alert to **At time of event**.

They show up on your dashboard as soon as they create their time card.

---

## How reminders work in this trial version

- **App alerts:** at the reminder time, the app shows a banner, plays a chime, and sends a phone notification. This works when the app is open or was used recently. On iPhone it requires the app to be on the Home Screen (iOS 16.4 or later).
- **Calendar alerts:** the two Google Calendar events always fire, even when the app is closed. These are the dependable ones during the trial.
- **Closed-app push reminders** can be added later on Firebase's paid plan if the trial goes well.

---

## Using the manager dashboard

- **← / →** buttons or arrow keys change the week.
- Click an employee row to open their **punch log**. From there you can:
  - fix a clock-in or clock-out time, then click **Save**;
  - delete a punch (click **Delete**, then **Confirm delete**);
  - add a missed shift;
  - clock out someone who forgot.
- **Export CSV** downloads the week as a timesheet you can open in Excel.
- Totals over 40 hours turn orange.

---

## Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| **404 page** | GitHub Pages isn't on, or still building | Part 4. Wait for the green check in Actions. |
| **"The site is live. Now add your Firebase settings."** | `config.js` still has `PASTE_` text | Part 2, then upload `config.js` again (or edit it on GitHub). |
| **Sign-in fails right away** | Your site isn't authorized in Firebase, or Email/Password is off | Parts 1.3 and 1.4. |
| **"Make this account the manager" keeps showing** | `MANAGER_UID` in `config.js` isn't filled in yet, or GitHub hasn't updated | Part 5, step 3. Wait a minute and reload. |
| **"Firebase blocked this…"** or nothing saves | The rules weren't published, or have the wrong ID | Part 5, steps 4–6. The ID in the rules must match `config.js` exactly. |
| **Phones still show the old version** | The phone kept a saved copy | Change `VERSION` in `sw.js` (`vdi-tk-v1` → `vdi-tk-v2`), commit, then close and reopen the app. |
| **No notification on iPhone** | The app isn't installed to the Home Screen | Install it (Part 6) and tap **Allow notifications** from the installed app. |

## Removing an employee
1. Dashboard: open their punch log → **Remove** → **Confirm remove**. Their past punches stay on file.
2. To block sign-in: Firebase → **Authentication → Users** → **⋮** next to their email → **Delete account** or **Disable account**.

Anyone with the link can create an account, but a new account can never see anyone's hours. It only appears on your dashboard after the person makes a time card. Remove anyone you don't recognize.

## Making changes later
- Edit files on GitHub. The live site updates within 1–2 minutes.
- After changing any app file, also bump `VERSION` in `sw.js` so phones pick up the change.
- After changing `firestore.rules`, paste it into **Firestore Database → Rules** and click **Publish** again. GitHub doesn't update Firebase for you.
