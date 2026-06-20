export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface GalleryImage {
  id: string;
  name: string;
  url: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: number; // millisecond timestamp
  tags: string[];
  description: string;
  aspectRatio: number; // width / height
}

export type LayoutMode = 'masonry' | 'grid' | 'justify';

export interface FilterOptions {
  search: string;
  tags: string[];
  sortBy: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc';
}
