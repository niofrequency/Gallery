import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseConfig } from './types';

// Default / fallback blank config that the user can override via .env/UI
export const DEFAULT_BLANK_CONFIG: FirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Check if variables exist in VITE_ environment variables
const loadEnvConfig = (): FirebaseConfig => {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
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
