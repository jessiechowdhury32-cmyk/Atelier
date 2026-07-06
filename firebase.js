// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUA4Hy6VF0c7dkM4NQLxaecpiSYrNwdKY",
  authDomain: "atelier-1dc1d.firebaseapp.com",
  projectId: "atelier-1dc1d",
  storageBucket: "atelier-1dc1d.firebasestorage.app",
  messagingSenderId: "506557043710",
  appId: "1:506557043710:web:dc393a13065274321526af",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore — this is the actual database connection the app will use
export const db = getFirestore(app);
