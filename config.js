// VDI TimeKeeper settings.
// 1) Paste your Firebase web app config below (Firebase console > Project settings > Your apps).
// 2) After you create your own account in the app, paste your User UID as MANAGER_UID
//    (Firebase console > Authentication > Users). Put the same UID in firestore.rules.
// The apiKey here is meant to be public; your data is protected by firestore.rules.

export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

export const MANAGER_UID = "PASTE_YOUR_UID";
