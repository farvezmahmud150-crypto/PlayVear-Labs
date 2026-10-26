import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom connection validation as specified in SKILL.md
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();

/**
 * Perform Google Authentication with Firebase Auth
 */
export async function signInWithGoogleFirebase(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (user) {
      // Create or update user profile document in Firestore
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || '',
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      // Check if credit exists, if not, initialize with 0.00
      const userDoc = await getDocFromServer(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.credit === undefined) {
        await setDoc(doc(db, 'users', user.uid), { credit: 0.00 }, { merge: true });
      }
    }
    return user;
  } catch (error: any) {
    // Handle popup closed or cancelled gracefully without throwing
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      console.info('Google Sign-In popup closed by user.');
      return null;
    }
    console.warn('Firebase Google Sign In Error:', error);
    return null;
  }
}

/**
 * Sign out from Firebase Auth
 */
export async function signOutFirebase(): Promise<void> {
  return await firebaseSignOut(auth);
}

export interface UserVoiceCloneRecord {
  id: string;
  name: string;
  description?: string;
  category?: string;
  userId: string;
  userEmail?: string;
  createdAt: string;
  isPaidCloned: boolean;
  isV4: boolean;
}

/**
 * Save user cloned voice to Firestore (Strictly user-scoped)
 */
export async function saveUserClonedVoice(
  userId: string,
  userEmail: string,
  voice: { id: string; name: string; description?: string; category?: string }
): Promise<void> {
  if (!userId || !voice.id) return;
  const cloneRef = doc(db, 'voice_clones', voice.id);
  await setDoc(cloneRef, {
    id: voice.id,
    name: voice.name,
    description: voice.description || 'Cartesia V4 Paid Cloned Character',
    category: voice.category || 'news_anchor',
    userId,
    userEmail: userEmail || '',
    createdAt: new Date().toISOString(),
    isPaidCloned: true,
    isV4: true,
  });
}

/**
 * Delete user cloned voice from Firestore
 */
export async function deleteUserClonedVoice(voiceId: string): Promise<void> {
  if (!voiceId) return;
  const cloneRef = doc(db, 'voice_clones', voiceId);
  await deleteDoc(cloneRef);
}

/**
 * Real-time listener for user's personal cloned voices
 */
export function subscribeUserClonedVoices(
  userId: string,
  onUpdate: (voices: UserVoiceCloneRecord[]) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, 'voice_clones'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const voices: UserVoiceCloneRecord[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        voices.push({
          id: data.id || d.id,
          name: data.name || 'Cloned Voice',
          description: data.description || '',
          category: data.category || 'news_anchor',
          userId: data.userId,
          userEmail: data.userEmail,
          createdAt: data.createdAt || new Date().toISOString(),
          isPaidCloned: true,
          isV4: true,
        });
      });
      // Sort newest first
      voices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(voices);
    },
    (err) => {
      console.warn('Error subscribing to user cloned voices:', err);
    }
  );
}
export async function checkUserV2Limit(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDocFromServer(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const v2Usage = data?.v2Usage || {};
      const todayCount = v2Usage[todayStr] || 0;
      return todayCount >= 5;
    }
  } catch (e) {
    console.warn('Firestore user V2 limit check warning:', e);
  }
  return false;
}

/**
 * Increment user Model V2 daily usage count in Firestore
 */
export async function incrementUserV2Limit(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDocFromServer(userDocRef);
    let v2Usage: Record<string, number> = {};
    if (userSnap.exists()) {
      v2Usage = userSnap.data()?.v2Usage || {};
    }
    const currentCount = v2Usage[todayStr] || 0;
    v2Usage[todayStr] = currentCount + 1;

    await setDoc(userDocRef, { v2Usage }, { merge: true });
  } catch (e) {
    console.warn('Firestore user V2 limit increment warning:', e);
  }
}

/**
 * Check if user has exceeded Model V3 daily limit (1 per day) via Firestore
 */
export async function checkUserV3Limit(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDocFromServer(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const v3Usage = data?.v3Usage || {};
      const todayCount = v3Usage[todayStr] || 0;
      return todayCount >= 1;
    }
  } catch (e) {
    console.warn('Firestore user V3 limit check warning:', e);
  }
  return false;
}

/**
 * Increment user Model V3 daily usage count in Firestore
 */
export async function incrementUserV3Limit(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDocFromServer(userDocRef);
    let v3Usage: Record<string, number> = {};
    if (userSnap.exists()) {
      v3Usage = userSnap.data()?.v3Usage || {};
    }
    const currentCount = v3Usage[todayStr] || 0;
    v3Usage[todayStr] = currentCount + 1;

    await setDoc(userDocRef, { v3Usage }, { merge: true });
  } catch (e) {
    console.warn('Firestore user V3 limit increment warning:', e);
  }
}
