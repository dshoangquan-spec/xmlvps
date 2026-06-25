
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
}

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase(): FirebaseServices {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
  
  if (getApps().length > 0) {
    const app = getApp();
    // Use initializeFirestore with settings if it hasn't been initialized with them yet, 
    // but getFirestore is safer for multiple calls if we just want the instance.
    // However, to ensure long polling is used, we should try initializeFirestore if possible.
    // In many cases, just getFirestore works after the first initializeFirestore.
    // Here we'll use initializeFirestore only for the first init.
    return {
      firebaseApp: app,
      firestore: getFirestore(app, databaseId),
    };
  }
  
  const firebaseApp = initializeApp(firebaseConfig);
  const firestore = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
  }, databaseId);
  
  return {
    firebaseApp,
    firestore,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
// use-user is removed as Firebase Auth is no longer used.
export * from './errors';
export * from './error-emitter';
