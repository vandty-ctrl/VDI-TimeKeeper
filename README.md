# VDI TimeKeeper

A time clock that employees install on their phones (iPhone and Android) and a manager dashboard for Windows.

- **Employees** sign in, tap **Clock in** / **Clock out**, and set their own reminder times and work days.
- **The manager** (only you) sees everyone's weekly hours, daily breakdown, typical clock-in and clock-out times, who is on the clock now, and overtime. You can fix punches, add missed shifts, clock someone out, and export a CSV timesheet.
- Clock-in and clock-out times are stamped by Google's servers, so changing a phone's clock can't fake a punch.
- Employees can't see anyone's hours, including their own. The database rules enforce this, not just the screen.

It runs free on **GitHub Pages** (hosting) plus **Firebase** (sign-in and database). Firebase's free plan is far more than a small team needs.

---

## Setup (about 20 minutes, one time)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Create a project**. Name it something like `vdi-timekeeper`. You can turn off Google Analytics.
2. On the project home page, click the **Web** icon (`</>`) to add a web app. Name it `VDI TimeKeeper`. Leave Firebase Hosting unchecked.
3. Firebase shows a `firebaseConfig` block. Copy those six values into **`config.js`** in this folder, replacing the `PASTE_...` text.

### 2. Turn on sign-in
1. In the left menu: **Build → Authentication → Get started**.
2. Under **Sign-in method**, choose **Email/Password**, switch on the first toggle, and click **Save**.

### 3. Create the database
1. **Build → Firestore Database → Create database**.
2. Pick the location closest to you (for Maryland, `us-east4` or `nam5`).
3. Choose **Start in production mode**.

### 4. Put the code on GitHub Pages
1. Create a new repository on GitHub, for example `vdi-timekeeper`. It can be public or private (private repos need a paid GitHub plan for Pages).
2. Upload every file and the `icons` folder from this project: click **Add file → Upload files**, drag them all in, then click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, then click **Save**.
4. After a minute, your site is at `https://YOUR-GITHUB-NAME.github.io/vdi-timekeeper/`.

### 5. Let Firebase accept sign-ins from your site
In Firebase: **Authentication → Settings → Authorized domains → Add domain**, then enter `YOUR-GITHUB-NAME.github.io`.

### 6. Make yourself the manager
1. Open your site and **Create account** with your own email and password.
2. In Firebase: **Authentication → Users**. Copy the **User UID** next to your email.
3. Paste that UID in two places:
   - **`config.js`**: replace `PASTE_YOUR_UID` and commit the change on GitHub.
   - **`firestore.rules`**: replace `PASTE_YOUR_UID`.
4. In Firebase: **Firestore Database → Rules**. Delete what's there, paste the full contents of `firestore.rules`, and click **Publish**.
5. Reload your site. You'll see **Team hours**.

### 7. Send the link to your employees
Each employee does this:
1. Open the link on their phone.
   - **iPhone:** open it in **Safari**, tap **Share → Add to Home Screen**.
   - **Android:** open it in **Chrome** and tap **Install app** (or **⋮ → Add to Home screen**).
2. Open TimeKeeper from the new home-screen icon.
3. Tap **Create account**, enter their name, and set their reminder times and work days.
4. Tap **Allow notifications**, then add the two Google Calendar reminders.

---

## About reminders

There are two kinds, because phones limit what a website-based app can do in the background:

- **In-app alerts.** At the employee's reminder time, the app shows a banner, plays a chime, and sends a phone notification. This works while TimeKeeper is open or was opened recently. iPhones require the app to be added to the Home Screen first, on iOS 16.4 or later.
- **Google Calendar reminders.** These are always reliable. The **Add clock-in reminder** and **Add clock-out reminder** buttons create repeating events on the employee's work days. They should set each event's alert to **At time of event**.

Fully automatic push reminders while the app is closed would need a paid Firebase plan (Blaze) and a small scheduled server function. That can be added later if you want it.

---

## Updating the app later
- Edit files on GitHub. Pages republishes within a minute or two.
- When you change any app file, also change `VERSION` at the top of `sw.js` (for example `vdi-tk-v2`). This makes phones fetch the new version instead of a saved copy.
- Whenever you change `firestore.rules`, paste it into **Firestore Database → Rules** again and click **Publish**. GitHub does not update Firebase for you.

## Removing an employee
1. In the dashboard, open their punch log and click **Remove**. Their past punches stay on file.
2. To block them from signing in, go to Firebase **Authentication → Users**, click **⋮** next to their email, and choose **Delete account** or **Disable account**.

Anyone with the link can create an account. A new account only appears on your dashboard after the person sets up a time card, and it can never see anyone's hours. Remove anyone you don't recognize.

## Checking the privacy rules (optional)
In **Firestore Database → Rules**, open **Rules Playground**:
- Simulate a **get** on `/staff/SOME_EMPLOYEE_UID/punches/anything` as **Authenticated**, with a different UID in the Firebase UID box. It should be **denied**.
- Run it again with your manager UID. It should be **allowed**.

## Files
| File | What it is |
|---|---|
| `index.html` | The page and its styling |
| `app.js` | All app behavior: sign-in, punches, reminders, dashboard |
| `config.js` | Your Firebase settings and manager UID (you edit this) |
| `firestore.rules` | Database security rules (paste into Firebase) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make it installable on phones |

The Firebase `apiKey` in `config.js` is designed to be public. Your data is protected by `firestore.rules`, not by hiding the key.
