// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxhByqudqsbR04GEjpSNbJGOcyVTrREQA",
  authDomain: "glenn-ehs-website.firebaseapp.com",
  projectId: "glenn-ehs-website",
  storageBucket: "glenn-ehs-website.firebasestorage.app",
  messagingSenderId: "55680431383",
  appId: "1:55680431383:web:f360bd4d8b12816e383352"
};

// Initialize Firebase + Firestore
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
