import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDodHhD9WddUJx6FPmuYjfnuJ2d04ovLBM",
  authDomain: "printmypage-app.firebaseapp.com",
  projectId: "printmypage-app",
  storageBucket: "printmypage-app.firebasestorage.app",
  messagingSenderId: "1000645577686",
  appId: "1:1000645577686:web:f5e50747f85f5ecade7277"
}

// Prevent multiple initialization in Next.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

// Google provider for login/register
export const provider = new GoogleAuthProvider()