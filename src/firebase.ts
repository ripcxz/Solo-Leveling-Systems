import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  projectId: "gen-lang-client-0048806937",
  appId: "1:672079437458:web:9db5057fe270d1e850904b",
  apiKey: "AIzaSyAsl44pmeGU83Ptzrnv7t3stMpdhs2DSz0",
  authDomain: "gen-lang-client-0048806937.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-1d79a009-dd3f-48be-84af-fc331eacf9c6",
  storageBucket: "gen-lang-client-0048806937.firebasestorage.app",
  messagingSenderId: "672079437458",
  measurementId: ""
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove };
export type { FirebaseUser };
