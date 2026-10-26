// VDI TimeKeeper settings — the only file you need to edit.
//
// STEP A: Paste your Firebase web app values below, replacing each PASTE_... text.
//         Find them in Firebase console > gear icon > Project settings > Your apps.
//         Keep the quotes and commas exactly as they are.
//
// STEP B: Leave MANAGER_UID alone at first. After you create your own account in the
//         app, it shows you your user ID. Paste it here, between the quotes.
//
// The apiKey is meant to be public. Your data is protected by firestore.rules.

export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

export const MANAGER_UID = "PASTE_YOUR_UID";
