import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// All Firebase config must be supplied via VITE_* environment variables.
// For local development, create a .env file (see .env.example).
// For Netlify, set these in Site configuration > Environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Firebase config is missing. Please set VITE_FIREBASE_* environment variables. " +
    "Copy .env.example to .env and fill in your Firebase project credentials."
  );
}

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

const app = initializeApp(firebaseConfig);
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);
