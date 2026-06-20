import { GalleryImage } from './types';

export const INITIAL_DEMO_IMAGES: GalleryImage[] = [
  {
    id: "demo-1",
    name: "Golden Gate Dawn",
    url: "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?q=80&w=1200&auto=format&fit=crop",
    path: "demo/gate_dawn.jpg",
    size: 2456102,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 10 * 1000, // 10 days ago
    tags: ["Landscape", "Architecture", "Travel"],
    description: "A misty dawn over the iconic suspension bridge, captured in warm morning reflections.",
    aspectRatio: 1.5 // 3:2 landscape
  },
  {
    id: "demo-2",
    name: "Cyberpunk Alleyways",
    url: "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=1200&auto=format&fit=crop",
    path: "demo/cyber_alley.jpg",
    size: 1850394,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 5 * 1000, // 5 days ago
    tags: ["Cyberpunk", "City", "Night"],
    description: "Neo-noir neon lighting reflecting off rainy concrete sidewalks in Tokyo's alleyways.",
    aspectRatio: 0.75 // 3:4 portrait
  },
  {
    id: "demo-3",
    name: "Symmetric Brutalism",
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
    path: "demo/brutalist_concrete.jpg",
    size: 3120400,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 3 * 1000, 
    tags: ["Architecture", "Minimal", "Industrial"],
    description: "An elegant raw-concrete stairwell emphasizing geometric structural form and stark cast shadows.",
    aspectRatio: 1.0 // Square
  },
  {
    id: "demo-4",
    name: "Emerald Forest Canopy",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200&auto=format&fit=crop",
    path: "demo/green_canopy.jpg",
    size: 4501230,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 15 * 1000,
    tags: ["Nature", "Landscape", "Calm"],
    description: "Sunlight slicing through an ancient mossy rainforest, illuminating floating visual dust.",
    aspectRatio: 1.6 // Wide landscape
  },
  {
    id: "demo-5",
    name: "Warm Interior Geometry",
    url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop",
    path: "demo/interior_sunlight.jpg",
    size: 1205931,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 1 * 1000, // 1 day ago
    tags: ["Minimal", "Interior", "Aesthetic"],
    description: "Subtle afternoon light casting high-contrast organic visual frame shadows across minimalist design space.",
    aspectRatio: 0.67 // 2:3 portrait
  },
  {
    id: "demo-6",
    name: "Mountain Monolith",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop",
    path: "demo/mountain_monolith.jpg",
    size: 5120304,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 20 * 1000,
    tags: ["Nature", "Landscape", "Travel"],
    description: "Sharp granite peaks soaring over dynamic low cloud cover in Patagonia during dusk.",
    aspectRatio: 1.4 // Landscape
  },
  {
    id: "demo-7",
    name: "Oceanic Abstraction",
    url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?q=80&w=1200&auto=format&fit=crop",
    path: "demo/ocean_drone.jpg",
    size: 2894103,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 8 * 1000,
    tags: ["Nature", "Minimal", "Aerial"],
    description: "Aerial perspective of clean turquoise water ripples interacting with a sandy coral boundary.",
    aspectRatio: 0.7 // Portrait
  },
  {
    id: "demo-8",
    name: "Icelandic Obsidian Sands",
    url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1200&auto=format&fit=crop",
    path: "demo/iceland_sands.jpg",
    size: 3894201,
    contentType: "image/jpeg",
    createdAt: Date.now() - 3600 * 24 * 12 * 1000,
    tags: ["Landscape", "Travel", "Contrast"],
    description: "A dark beach meeting icy water currents, presenting dramatic natural contrast layers.",
    aspectRatio: 1.5
  }
];

// Helper to load/save custom user-uploaded demo images from localStorage
export const getDemoImages = (): GalleryImage[] => {
  const cached = localStorage.getItem('firebase_gallery_demo_images');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {
      // fallback
    }
  }
  return INITIAL_DEMO_IMAGES;
};

export const saveDemoImages = (images: GalleryImage[]) => {
  localStorage.setItem('firebase_gallery_demo_images', JSON.stringify(images));
};

export const ALL_AVAILABLE_TAGS = [
  "Landscape",
  "Architecture",
  "Nature",
  "Minimal",
  "Cyberpunk",
  "City",
  "Night",
  "Industrial",
  "Interior",
  "Travel",
  "Aesthetic",
  "Aerial",
  "Contrast",
  "Raw",
  "Custom"
];
