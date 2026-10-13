// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCo00deD3LAzDy2pNOiBMvn_OZRy6Y8AVI",
  authDomain: "vdi-timekeeper.firebaseapp.com",
  projectId: "vdi-timekeeper",
  storageBucket: "vdi-timekeeper.firebasestorage.app",
  messagingSenderId: "218175216914",
  appId: "1:218175216914:web:67f74932c3cb04fd7da7cb",
  measurementId: "G-NQ1EJ73P7S",
  uid: "C4vcpU6HImfa3Q7uqpA5pP8EbeO2"
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
