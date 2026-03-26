import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBcJ1VY2CrXD9Xfjs7j4_mfIAwI4kpjv8",
  authDomain: "axia-6ce9d.firebaseapp.com",
  projectId: "axia-6ce9d",
  storageBucket: "axia-6ce9d.firebasestorage.app",
  messagingSenderId: "934399070059",
  appId: "1:934399070059:web:5496c4a5175696e890862e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Simple key-value storage using Firestore
// Each key is a document in the "axia_data" collection
export const storage = {
  get: async (key) => {
    try {
      const ref = doc(db, "axia_data", key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return { key, value: snap.data().value };
      }
      return null;
    } catch(e) {
      console.error("Storage get error:", e);
      return null;
    }
  },
  set: async (key, value) => {
    try {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      const ref = doc(db, "axia_data", key);
      await setDoc(ref, { value: str, updated_at: new Date().toISOString() });
      return { key, value: str };
    } catch(e) {
      console.error("Storage set error:", e);
      return null;
    }
  },
  delete: async (key) => {
    try {
      const { deleteDoc } = await import("firebase/firestore");
      const ref = doc(db, "axia_data", key);
      await deleteDoc(ref);
      return { key, deleted: true };
    } catch(e) {
      return null;
    }
  },
  list: async (prefix) => {
    return { keys: [] };
  }
};
