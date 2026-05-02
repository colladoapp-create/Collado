import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFmy5FvnNuv1q90oRUbLX9yk9K9TT4Kjg",
  authDomain: authDomain: "collado.vercel.app",
  projectId: "ktu-attendance-2171a",
  storageBucket: "ktu-attendance-2171a.firebasestorage.app",
  messagingSenderId: "654902840646",
  appId: "1:654902840646:web:b1d02d7af0be6483fc2947"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);