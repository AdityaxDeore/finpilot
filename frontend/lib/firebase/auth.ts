import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./config";
import { setAuthUserId } from "@/lib/user";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Sign in with Google using a popup.
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    setAuthUserId(result.user.uid);
  }
  return result.user;
}

/**
 * Sign in with email and password.
 */
export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  if (result.user) {
    setAuthUserId(result.user.uid);
  }
  return result.user;
}

/**
 * Sign up a new user with email and password.
 */
export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (result.user) {
    setAuthUserId(result.user.uid);
  }
  return result.user;
}

/**
 * Sign out of Firebase.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  setAuthUserId(null);
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      setAuthUserId(user.uid);
    } else {
      setAuthUserId(null);
    }
    callback(user);
  });
}
