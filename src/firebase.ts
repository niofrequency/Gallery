/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { FirebaseConfig } from './types';

// Your exact web app Firebase configuration
export const DEFAULT_BLANK_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyBy7maWYwB7fKfqPs4x2Hwv1yhPeeuk8Yc",
  authDomain: "arx-207a2.firebaseapp.com",
  projectId: "arx-207a2",
  storageBucket: "arx-207a2.firebasestorage.app",
  messagingSenderId: "633149834764",
  appId: "1:633149834764:web:3145ed0024bd9ee3c31029",
  measurementId: "G-7JX9KDD740"
};

// Initialize default Firebase App
const defaultApp = getApps().length === 0 ? initializeApp(DEFAULT_BLANK_CONFIG) : getApp();

// Safely initialize analytics (prevents crashes in environments that block it)
isSupported().then(supported => {
  if (supported) {
    getAnalytics(defaultApp);
  }
});

// Initialize Storage
export const storage = getStorage(defaultApp);

/**
 * Uploads a Blob (Image or Video) to Firebase Storage and returns the public download URL.
 * 
 * @param fileBlob The raw Blob data of the generated asset.
 * @param storagePath The path in your bucket (e.g., 'outputs/12345.mp4')
 * @returns The permanent Firebase HTTP Download URL
 */
export const uploadToFirebase = async (fileBlob: Blob, storagePath: string): Promise<string> => {
  try {
    // Create a reference to the specific path in your bucket
    const storageRef = ref(storage, storagePath);

    // Upload the blob
    await uploadBytes(storageRef, fileBlob);

    // Fetch and return the public download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
    
  } catch (error) {
    console.error("Firebase Upload Error:", error);
    throw new Error("Failed to upload the generated asset to Firebase Cloud Storage.");
  }
};

// Check if variables exist in VITE_ environment variables
const loadEnvConfig = (): FirebaseConfig => {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
  };
};

/**
 * Checks if a config configuration is functionally complete.
 */
export const isConfigValid = (config: FirebaseConfig): boolean => {
  return !!(
    config &&
    config.apiKey &&
    config.projectId &&
    config.storageBucket
  );
};

export const getStoredConfig = (): FirebaseConfig => {
  const envConfig = loadEnvConfig();
  if (isConfigValid(envConfig)) {
    return envConfig;
  }

  try {
    const saved = localStorage.getItem('firebase_gallery_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isConfigValid(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to parse saved Firebase config from localStorage", e);
  }

  return DEFAULT_BLANK_CONFIG;
};

// Singleton storage to avoid recreating clients repeatedly
let initializedApp: FirebaseApp | null = null;
let initializedStorage: FirebaseStorage | null = null;
let initializedFirestore: Firestore | null = null;
let lastUsedConfigString = "";

export const initializeFirebaseServices = (config: FirebaseConfig) => {
  if (!isConfigValid(config)) {
    throw new Error("Invalid or incomplete Firebase configuration. Please check your keys.");
  }

  const configStr = JSON.stringify(config);
  
  // If config matches DEFAULT_BLANK_CONFIG, we can use the defaultApp directly instead of creating a named one
  if (configStr === JSON.stringify(DEFAULT_BLANK_CONFIG)) {
    initializedApp = defaultApp;
    initializedStorage = storage;
    initializedFirestore = getFirestore(defaultApp);
    lastUsedConfigString = configStr;
    
    return {
      app: initializedApp!,
      storage: initializedStorage!,
      firestore: initializedFirestore!
    };
  }
  
  // If config changed, re-initialize or retrieve apps
  if (configStr !== lastUsedConfigString) {
    // Standard firebase initialization
    const name = "firebase_gallery_app";
    // Check if app already exists, delete/restart if needed to avoid "app already exists" error
    const existingApps = getApps();
    const targetApp = existingApps.find(a => a.name === name);
    
    if (targetApp) {
      initializedApp = targetApp;
    } else {
      initializedApp = initializeApp(config, name);
    }
    
    initializedStorage = getStorage(initializedApp);
    initializedFirestore = getFirestore(initializedApp);
    lastUsedConfigString = configStr;
  }

  return {
    app: initializedApp!,
    storage: initializedStorage!,
    firestore: initializedFirestore!
  };
};

export const clearInitializedFirebase = () => {
  initializedApp = null;
  initializedStorage = null;
  initializedFirestore = null;
  lastUsedConfigString = "";
};
