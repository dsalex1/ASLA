import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  collection,
  CollectionReference,
  connectFirestoreEmulator,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { getPerformance } from 'firebase/performance'
import { getAnalytics } from 'firebase/analytics'
import { Setlist, Song } from '@/types'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

const useEmulators = env.VITE_FIREBASE_EMULATORS === 'true'

export const db = initializeFirestore(app, useEmulators ? {} : { localCache: persistentLocalCache({}) })

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(getStorage(app), '127.0.0.1', 9199)
}

//get performance and analytics infos collected (not against emulators)
export const perf = useEmulators ? undefined : getPerformance(app)
export const analytics = useEmulators ? undefined : getAnalytics(app)

const typedCollection = <T>(db: Firestore, col: string) => collection(db, col) as CollectionReference<T>

export const setlistCollection = typedCollection<Setlist>(db, 'setlist')
export const songCollection = typedCollection<Song>(db, 'songs')

type FilteredKeys<T, U> = { [P in keyof T]: P extends U ? never : P }[keyof T]

export const withoutFields = <
  T extends Record<string, unknown>,
  Keys extends string[],
  Return = {
    [Key in FilteredKeys<T, Keys[number]>]: T[Key]
  }
>(
  obj: T,
  ...fields: Keys
): Return => {
  const copy = { ...obj }
  fields.forEach((field) => delete copy[field as keyof T])
  return copy as unknown as Return
}
