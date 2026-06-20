import { 
  ref, 
  listAll, 
  getDownloadURL, 
  getMetadata, 
  uploadBytesResumable, 
  deleteObject,
  updateMetadata,
  FirebaseStorage 
} from 'firebase/storage';
import { 
  collection, 
  getDocs, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Firestore 
} from 'firebase/firestore';
import { GalleryImage } from './types';

// ==========================================
// 📁 DIRECTORY CONFIGURATION 
// ==========================================
// CHANGE THIS string to exactly match the folder name in your Firebase screenshot!
// Example: If your folder is named "Uploads", change it to "Uploads"
// Example: If your files are in the root, change it to ""
export const STORAGE_FOLDER_NAME = "images";
// ==========================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

/**
 * Robust error handling helper adhering to the Firebase Integration Skill.
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, 
      email: null,
      emailVerified: false,
      isAnonymous: false,
    },
    operationType,
    path
  };
  console.error('Firestore/Storage Error Context:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Mode 1: Fetch metadata and URLs directly from the Storage Bucket.
 * It polls / lists all files under the specified folder in Firebase Storage.
 */
export async function fetchFromStorageBucket(
  storage: FirebaseStorage, 
  folderPath = STORAGE_FOLDER_NAME
): Promise<GalleryImage[]> {
  try {
    // List elements from both the subfolder path and the root bucket
    const targetPaths = [""];
    if (folderPath && folderPath !== "") {
      targetPaths.push(folderPath);
    }

    const uniqueItemsMap = new Map<string, any>();
    const errors: { path: string; error: any }[] = [];

    for (const path of targetPaths) {
      try {
        const listRef = path ? ref(storage, path) : ref(storage);
        const result = await listAll(listRef);
        result.items.forEach(item => {
          uniqueItemsMap.set(item.fullPath, item);
        });
      } catch (err: any) {
        console.warn(`Could not list Storage items in folder path: "${path}"`, err);
        errors.push({ path, error: err });
      }
    }

    // If both failed/threw errors, let's bubble the first or custom error up so the user gets visibility.
    if (uniqueItemsMap.size === 0 && errors.length === targetPaths.length) {
      const firstErr = errors[0].error;
      throw firstErr;
    }

    const items = Array.from(uniqueItemsMap.values());
    
    const imagePromises = items.map(async (itemRef) => {
      try {
        const url = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        
        // Extract optional metadata from custom attributes if saved, otherwise fallbacks
        const customMetadata = metadata.customMetadata || {};
        const tags = customMetadata.tags ? customMetadata.tags.split(',') : [];
        const description = customMetadata.description || "";
        const aspectRatio = customMetadata.aspectRatio ? parseFloat(customMetadata.aspectRatio) : 1.33; // default estimate
        
        return {
          id: itemRef.name, // using filename as ID
          name: customMetadata.name || itemRef.name.replace(/\.[^/.]+$/, ""), // strip extension
          url: url,
          path: itemRef.fullPath,
          size: metadata.size,
          contentType: metadata.contentType || "image/jpeg",
          createdAt: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : Date.now(),
          tags: tags,
          description: description,
          aspectRatio: aspectRatio
        } as GalleryImage;
      } catch (err) {
        console.warn(`Failed to resolve individual file info: ${itemRef.fullPath}`, err);
        return null;
      }
    });

    const images = await Promise.all(imagePromises);
    // Filter out failed resolve attempts and sort by date descending
    return (images.filter(Boolean) as GalleryImage[])
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, folderPath);
    return [];
  }
}

/**
 * Mode 2: Listen to Firestore real-time updates for image metadata.
 * Sets up a subscription listener on the designated Firestore collection.
 */
export function setupFirestoreRealtimeListener(
  firestore: Firestore,
  collectionName: string,
  onUpdate: (images: GalleryImage[]) => void,
  onErr: (error: any) => void
) {
  const q = query(collection(firestore, collectionName), orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const images: GalleryImage[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      images.push({
        id: docSnap.id,
        name: data.name || "Untitled",
        url: data.url || "",
        path: data.path || "",
        size: data.size || 0,
        contentType: data.contentType || "image/jpeg",
        createdAt: data.createdAt || Date.now(),
        tags: data.tags || [],
        description: data.description || "",
        aspectRatio: data.aspectRatio || 1.33
      });
    });
    onUpdate(images);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.GET, collectionName);
    } catch (wrappedError) {
      onErr(wrappedError);
    }
  });
}

/**
 * Uploads a file to Firebase Storage.
 * Optionally writes a Firestore document with the corresponding metadata.
 */
export function uploadImageToFirebase(
  storage: FirebaseStorage,
  firestore: Firestore | null,
  file: File,
  metadata: { name: string; description: string; tags: string[] },
  useFirestore: boolean,
  onProgress: (progress: number) => void
): Promise<GalleryImage> {
  return new Promise((resolve, reject) => {
    // Generate a unique filename using timestamp
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const storagePath = STORAGE_FOLDER_NAME ? `${STORAGE_FOLDER_NAME}/${cleanFileName}` : cleanFileName;
    const storageRef = ref(storage, storagePath);

    // Calculate approximate image aspect ratio using a temporary client-side Image object
    const imgElement = new Image();
    imgElement.src = URL.createObjectURL(file);
    imgElement.onload = () => {
      const computedRatio = imgElement.width / imgElement.height || 1.33;
      
      const uploadMetadata = {
        contentType: file.type,
        customMetadata: {
          name: metadata.name,
          description: metadata.description,
          tags: metadata.tags.join(','),
          aspectRatio: computedRatio.toString()
        }
      };

      const uploadTask = uploadBytesResumable(storageRef, file, uploadMetadata);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }, 
        (error) => {
          handleFirestoreError(error, OperationType.WRITE, storagePath);
          reject(error);
        }, 
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const imageDoc: GalleryImage = {
              id: cleanFileName,
              name: metadata.name,
              url: downloadUrl,
              path: storagePath,
              size: file.size,
              contentType: file.type,
              createdAt: Date.now(),
              tags: metadata.tags,
              description: metadata.description,
              aspectRatio: computedRatio
            };

            if (useFirestore && firestore) {
              const docRef = doc(collection(firestore, 'images'), cleanFileName);
              await setDoc(docRef, { ...imageDoc });
            }

            resolve(imageDoc);
          } catch (err) {
            reject(err);
          }
        }
      );
    };
    imgElement.onerror = () => {
      // fallback
      const uploadMetadata = {
        contentType: file.type,
        customMetadata: {
          name: metadata.name,
          description: metadata.description,
          tags: metadata.tags.join(','),
          aspectRatio: "1.33"
        }
      };
      
      const uploadTask = uploadBytesResumable(storageRef, file, uploadMetadata);
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }, 
        (error) => {
          reject(error);
        }, 
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const imageDoc: GalleryImage = {
              id: cleanFileName,
              name: metadata.name,
              url: downloadUrl,
              path: storagePath,
              size: file.size,
              contentType: file.type,
              createdAt: Date.now(),
              tags: metadata.tags,
              description: metadata.description,
              aspectRatio: 1.33
            };

            if (useFirestore && firestore) {
              const docRef = doc(collection(firestore, 'images'), cleanFileName);
              await setDoc(docRef, { ...imageDoc });
            }

            resolve(imageDoc);
          } catch (err) {
            reject(err);
          }
        }
      );
    };
  });
}

/**
 * Removes an image from storage (and optional Firestore collection).
 */
export async function deleteImageFromFirebase(
  storage: FirebaseStorage,
  firestore: Firestore | null,
  image: GalleryImage,
  useFirestore: boolean
): Promise<void> {
  // Delete from Storage
  try {
    const fileRef = ref(storage, image.path);
    await deleteObject(fileRef);
  } catch (error) {
    console.warn("Storage deletion warning (might already be deleted):", error);
  }

  // Delete from Firestore
  if (useFirestore && firestore) {
    try {
      const docRef = doc(firestore, 'images', image.id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `images/${image.id}`);
    }
  }
}

/**
 * Updates/renames an image's display title in custom metadata and/or Firestore.
 */
export async function renameImageInFirebase(
  storage: FirebaseStorage,
  firestore: Firestore | null,
  image: GalleryImage,
  newName: string,
  useFirestore: boolean
): Promise<void> {
  // Update in Storage metadata
  try {
    const fileRef = ref(storage, image.path);
    const existing = await getMetadata(fileRef);
    const updatedCustom = {
      ...(existing.customMetadata || {}),
      name: newName
    };
    await updateMetadata(fileRef, { customMetadata: updatedCustom });
  } catch (error) {
    console.warn("Storage metadata rename warning:", error);
  }

  // Update in Firestore
  if (useFirestore && firestore) {
    try {
      const docRef = doc(firestore, 'images', image.id);
      await setDoc(docRef, { name: newName }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `images/${image.id}`);
    }
  }
}
