import React, { useState, useEffect, useMemo } from 'react';
import { GalleryImage, FirebaseConfig, LayoutMode } from './types';
import { getStoredConfig, isConfigValid, initializeFirebaseServices } from './firebase';
import { 
  fetchFromStorageBucket, 
  setupFirestoreRealtimeListener, 
  uploadImageToFirebase, 
  deleteImageFromFirebase,
  renameImageInFirebase,
  STORAGE_FOLDER_NAME
} from './firebaseService';
import { getDemoImages, saveDemoImages } from './demoData';
import { formatFileSize } from './utils';

// Components
import FirebaseConfigPanel from './components/FirebaseConfigPanel';
import ImageUploadModal from './components/ImageUploadModal';
import ImageDetailsModal from './components/ImageDetailsModal';

// Icons
import { 
  Search, 
  Plus, 
  Grid, 
  Columns, 
  List, 
  ArrowUpDown, 
  AlertCircle,
  RefreshCw,
  FolderOpen,
  X,
  Settings,
  Image as ImageIcon,
  Film
} from 'lucide-react';

// ==================== PERSISTENCE HELPERS ====================
const getInitialImages = (): GalleryImage[] => {
  try {
    const cached = localStorage.getItem('vantage_cached_images');
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return [];
};

const getInitialFocus = (): GalleryImage | null => {
  try {
    const cached = sessionStorage.getItem('vantage_pinterest_focus');
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return null;
};

export default function App() {
  // Config & State Initialization
  const [config, setConfig] = useState<FirebaseConfig>(getStoredConfig());
  const [syncMode, setSyncMode] = useState<'storage' | 'firestore'>('storage');
  
  const [images, setImages] = useState<GalleryImage[]>(getInitialImages);
  const [pinterestFocus, setPinterestFocus] = useState<GalleryImage | null>(getInitialFocus);
  const [scrollPos, setScrollPos] = useState(0); 
  
  const [loading, setLoading] = useState(images.length === 0);
  const [error, setError] = useState("");
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('masonry');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');

  const isFirebaseActive = isConfigValid(config);

  // ==================== STATE SYNC HOOKS ====================
  useEffect(() => {
    if (images.length > 0) {
      try { localStorage.setItem('vantage_cached_images', JSON.stringify(images)); } catch (e) {}
    }
  }, [images]);

  useEffect(() => {
    if (pinterestFocus) {
      try { sessionStorage.setItem('vantage_pinterest_focus', JSON.stringify(pinterestFocus)); } catch (e) {}
    } else {
      sessionStorage.removeItem('vantage_pinterest_focus');
    }
  }, [pinterestFocus]);

  // ==================== SIMILARITY ENGINE ====================
  const getSimilarImages = (focus: GalleryImage, allImages: GalleryImage[], limit = 24) => {
    if (!focus) return [];

    const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'jpg', 'png', 'jpeg', 'webp', 'img', 'image', 'copy']);

    const tokenize = (text: string) => {
      if (!text) return [];
      return text.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
    };

    const focusTags = focus.tags ? focus.tags.map(t => t.toLowerCase().trim()) : [];
    const focusWords = tokenize(focus.name + " " + (focus.description || ""));

    return allImages
      .filter(img => img.id !== focus.id)
      .map(img => {
        let score = 0;

        const imgTags = img.tags ? img.tags.map(t => t.toLowerCase().trim()) : [];
        const imgWords = tokenize(img.name + " " + (img.description || ""));

        // 1. EXACT Tag Matches
        imgTags.forEach(tag => {
          if (focusTags.includes(tag)) score += 50; 
        });

        // 2. CROSS-MATCHING
        imgTags.forEach(tag => {
          focusWords.forEach(w => {
            if (tag === w) score += 25; 
            else if (tag.length > 3 && w.length > 3 && (tag.includes(w) || w.includes(tag))) score += 10; 
          });
        });
        focusTags.forEach(tag => {
          imgWords.forEach(w => {
            if (tag === w) score += 25;
            else if (tag.length > 3 && w.length > 3 && (tag.includes(w) || w.includes(tag))) score += 10;
          });
        });

        // 3. WORD Substring Matches
        const matchedWords = new Set<string>();
        focusWords.forEach(fWord => {
          imgWords.forEach(iWord => {
            if (!matchedWords.has(fWord)) {
              if (fWord === iWord) {
                score += 15; 
                matchedWords.add(fWord);
              } else if (fWord.length > 3 && iWord.length > 3 && (fWord.includes(iWord) || iWord.includes(fWord))) {
                score += 5; 
                matchedWords.add(fWord);
              }
            }
          });
        });

        return { ...img, similarityScore: score };
      })
      .filter(item => item.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  };

  // Hook up sync & listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (images.length === 0) setLoading(true);
    setError("");

    if (isFirebaseActive) {
      try {
        const services = initializeFirebaseServices(config);
        
        if (syncMode === 'firestore') {
          unsubscribe = setupFirestoreRealtimeListener(
            services.firestore,
            'images',
            (fetchedImages) => {
              setImages(fetchedImages);
              setLoading(false);
              setError("");
            },
            (err) => {
              setError(err.message || "Failed to establish Firestore real-time listener.");
              setLoading(false);
            }
          );
        } else {
          fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME)
            .then((fetchedImages) => {
              setImages(fetchedImages);
              setLoading(false);
              setError("");
            })
            .catch((err) => {
              setError(err.message || "Failed to list Firebase storage folders.");
              setLoading(false);
            });
        }
      } catch (err: any) {
        let visibleError = err?.message || String(err);
        try {
          const parsed = JSON.parse(visibleError);
          if (parsed.error) visibleError = parsed.error;
        } catch (_) {}
        
        setError(visibleError);
        setLoading(false);
      }
    } else {
      const timer = setTimeout(() => {
        setImages(getDemoImages());
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [config, syncMode, isFirebaseActive]);

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setError("");
    if (isFirebaseActive) {
      try {
        const services = initializeFirebaseServices(config);
        if (syncMode === 'firestore') {
          setError("");
        } else {
          const fetched = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
          setImages(fetched);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to refresh list.");
      }
    } else {
      setTimeout(() => {
        setImages(getDemoImages());
      }, 300);
    }
  };

  // ==================== MULTI-UPLOAD HANDLER ====================
  const handleUpload = async (
    files: File | File[], 
    metadata: { name: string; description: string; tags: string[] }
  ) => {
    const fileArray = Array.isArray(files) ? files : [files];

    if (isFirebaseActive) {
      const services = initializeFirebaseServices(config);
      
      await Promise.all(fileArray.map(file => {
        const finalName = fileArray.length > 1 ? file.name : metadata.name;
        
        return uploadImageToFirebase(
          services.storage,
          services.firestore,
          file,
          { ...metadata, name: finalName },
          syncMode === 'firestore',
          (progress) => {}
        );
      }));
      
      if (syncMode === 'storage') {
        const refreshed = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
        setImages(refreshed);
      }
    } else {
      const newDemoImages = await Promise.all(fileArray.map(async (file, index) => {
        return new Promise<GalleryImage>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const finalName = fileArray.length > 1 ? file.name : metadata.name;
            resolve({
              id: `demo-upload-${Date.now()}-${index}`,
              name: finalName,
              url: reader.result as string,
              path: `demo/images/${file.name}`,
              size: file.size,
              contentType: file.type,
              createdAt: Date.now() + index,
              tags: metadata.tags,
              description: metadata.description,
              aspectRatio: 1.33
            });
          };
        });
      }));

      const existingDemo = getDemoImages();
      const updatedDemo = [...newDemoImages, ...existingDemo];
      saveDemoImages(updatedDemo);
      setImages(updatedDemo);
    }
  };

  // Handle Deleting Files
  const handleDelete = async (image: GalleryImage) => {
    if (isFirebaseActive) {
      const services = initializeFirebaseServices(config);
      await deleteImageFromFirebase(
        services.storage,
        services.firestore,
        image,
        syncMode === 'firestore'
      );
      
      if (syncMode === 'storage') {
        const refreshed = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
        setImages(refreshed);
      }
    } else {
      const filtered = getDemoImages().filter(img => img.id !== image.id);
      saveDemoImages(filtered);
      setImages(filtered);
    }
    
    if (pinterestFocus?.id === image.id) setPinterestFocus(null);
    if (selectedImage?.id === image.id) setSelectedImage(null);
  };

  // Handle Renaming Files
  const handleRename = async (image: GalleryImage, newName: string) => {
    if (!newName || newName.trim() === "") return;
    const cleanName = newName.trim();

    if (isFirebaseActive) {
      const services = initializeFirebaseServices(config);
      await renameImageInFirebase(
        services.storage,
        services.firestore,
        image,
        cleanName,
        syncMode === 'firestore'
      );
      
      if (syncMode === 'storage') {
        const refreshed = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
        setImages(refreshed);
      } else {
        setImages(prev => prev.map(img => img.id === image.id ? { ...img, name: cleanName } : img));
      }
    } else {
      const updated = getDemoImages().map(img => 
        img.id === image.id ? { ...img, name: cleanName } : img
      );
      saveDemoImages(updated);
      setImages(updated);
    }

    setSelectedImage(prev => prev && prev.id === image.id ? { ...prev, name: cleanName } : prev);
    setPinterestFocus(prev => prev && prev.id === image.id ? { ...prev, name: cleanName } : prev);
  };

  // NAVIGATION HANDLERS
  const handleImageClick = (image: GalleryImage) => {
    if (!pinterestFocus) {
      setScrollPos(window.scrollY);
    }
    setPinterestFocus(image);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToArchive = () => {
    setPinterestFocus(null);
    setTimeout(() => {
      window.scrollTo({ top: scrollPos, behavior: 'instant' });
    }, 10);
  };

  // Perform client side search & filter
  const filteredAndSortedImages = images
    .filter(img => {
      // 1. Media Type Filter
      if (mediaFilter === 'image' && !img.contentType.startsWith('image/')) return false;
      if (mediaFilter === 'video' && !img.contentType.startsWith('video/')) return false;

      // 2. Search Query Filter
      const matchesSearch = searchQuery.trim() === "" || 
        img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return a.createdAt - b.createdAt;
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'size-desc': return b.size - a.size;
        case 'date-desc':
        default: return b.createdAt - a.createdAt;
      }
    });

  const similarImages = useMemo(() => {
    return pinterestFocus ? getSimilarImages(pinterestFocus, images, 24) : [];
  }, [pinterestFocus, images]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#E0E0E0] font-sans tracking-tight antialiased selection:bg-red-800 selection:text-white">
      
      {/* Remodeled Premium Header */}
      <header className="sticky top-0 z-40 bg-black/70 backdrop-blur-xl border-b border-white/5 px-6 py-4 transition-all duration-300">
        <div className="w-full mx-auto max-w-[2400px] flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={handleBackToArchive}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.8)] group-hover:scale-150 transition-transform duration-500"></div>
            <div>
              <h1 className="text-xl tracking-[0.2em] font-light text-white uppercase">MARK'S<span className="font-bold">Archive</span></h1>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 hover:text-white hover:shadow-[0_0_20px_rgba(185,28,28,0.4)] transition-all duration-300"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Upload</span>
            </button>
            
            {/* Subtle Settings Icon to prevent blocking UI */}
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="relative p-2 text-neutral-500 hover:text-white transition-colors duration-300"
              title="Database Settings"
            >
              <Settings className="w-5 h-5 hover:rotate-90 transition-transform duration-500" />
              <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-black ${isFirebaseActive ? 'bg-green-500' : 'bg-amber-500'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="w-full mx-auto max-w-[2400px] px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-8">
        
        {error && (
          <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs backdrop-blur-md">
            <div className="flex items-start sm:items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
              <div>
                <span className="font-bold block sm:inline mr-1.5">Database Exception:</span>
                <span className="opacity-90">{error}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfigOpen(true)}
                className="text-[11px] bg-red-900/40 hover:bg-red-800 text-red-200 font-bold px-4 py-2 rounded-lg border border-red-800/50 transition-colors cursor-pointer"
              >
                Inspect Setup
              </button>
              <button
                onClick={() => setError("")}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= SIMILARITY DETAIL VIEW ================= */}
        {pinterestFocus && (
          <div className="flex flex-col gap-12 animate-in fade-in duration-700">
            <div className="flex justify-between items-center bg-[#0A0A0A] border border-white/5 rounded-2xl p-3">
               <button
                 onClick={handleBackToArchive}
                 className="px-6 py-3 hover:bg-[#151515] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors"
               >
                 ← Back to Archive
               </button>
               <button
                 onClick={() => setSelectedImage(pinterestFocus)}
                 className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(185,28,28,0.3)] transition-all"
               >
                 View Details & Edit
               </button>
            </div>

            <div className="flex justify-center bg-transparent">
              {pinterestFocus.contentType.startsWith("video/") ? (
                <video src={pinterestFocus.url} className="max-h-[70vh] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] object-contain" controls autoPlay />
              ) : (
                <img src={pinterestFocus.url} alt={pinterestFocus.name} className="max-h-[70vh] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] object-contain" />
              )}
            </div>

            {/* Similarity Grid */}
            <div className="mt-8 border-t border-white/5 pt-12">
              <div className="text-center mb-10">
                <h3 className="text-2xl font-light tracking-[0.2em] uppercase text-white">
                  More like this
                </h3>
              </div>
              
              <div className="columns-2 sm:columns-3 lg:columns-4 min-[1400px]:columns-5 2xl:columns-6 min-[1800px]:columns-7 gap-4 w-full">
                {similarImages.map((image: any) => (
                  <div
                    key={image.id}
                    onClick={() => handleImageClick(image)}
                    className="break-inside-avoid mb-4 relative group rounded-2xl border border-white/5 bg-[#111] overflow-hidden cursor-zoom-in transition-all duration-500 hover:border-red-700/50 hover:shadow-[0_0_30px_rgba(185,28,28,0.15)] hover:-translate-y-1"
                  >
                    {image.contentType.startsWith("video/") ? (
                      <video src={image.url} className="w-full h-auto object-cover block" muted loop autoPlay playsInline />
                    ) : (
                      <img src={image.url} alt={image.name} className="w-full h-auto object-cover block transition-transform duration-700 group-hover:scale-[1.05]" loading="lazy" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                    
                    {image.similarityScore >= 30 && (
                      <div className="absolute top-3 right-3 bg-red-700/90 backdrop-blur-md text-[9px] px-3 py-1.5 rounded-full text-white font-mono tracking-widest border border-red-500/50 shadow-lg">
                        Match
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {similarImages.length === 0 && (
                <p className="text-center text-neutral-600 py-16 font-light tracking-wide">No similar assets found in the archive.</p>
              )}
            </div>
          </div>
        )}

        {/* ================= MAIN FEED VIEW ================= */}
        <div className={pinterestFocus ? 'hidden' : 'flex flex-col gap-8 animate-in fade-in duration-500'}>
            
            {/* Toolbar and Filters */}
            <div className="bg-[#0A0A0A] border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col gap-5">
              <div className="flex flex-col xl:flex-row items-center justify-between gap-5">
                
                {/* Search Box Input */}
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search archive content..."
                    className="w-full bg-[#111] border border-transparent focus:border-red-700 focus:bg-[#151515] focus:outline-none p-3.5 pl-11 rounded-xl text-sm text-zinc-100 tracking-wide transition-all duration-300 font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between w-full xl:w-auto gap-4">
                  
                  {/* Media Type Filter */}
                  <div className="flex items-center bg-[#111] p-1 border border-white/5 rounded-xl">
                    <button
                      onClick={() => setMediaFilter('all')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${mediaFilter === 'all' ? 'bg-[#222] text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setMediaFilter('image')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-1.5 ${mediaFilter === 'image' ? 'bg-[#222] text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      <ImageIcon className="w-3 h-3" /> Images
                    </button>
                    <button
                      onClick={() => setMediaFilter('video')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-1.5 ${mediaFilter === 'video' ? 'bg-[#222] text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      <Film className="w-3 h-3" /> Videos
                    </button>
                  </div>

                  {/* Sort Selection Controls */}
                  <div className="flex items-center bg-[#111] p-1 border border-white/5 rounded-xl">
                    <div className="flex items-center px-3 text-neutral-500">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                    <button
                      onClick={() => setSortBy('date-desc')}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${sortBy === 'date-desc' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      New
                    </button>
                    <button
                      onClick={() => setSortBy('date-asc')}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${sortBy === 'date-asc' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      Old
                    </button>
                    <button
                      onClick={() => setSortBy('name-asc')}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${sortBy === 'name-asc' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      A-Z
                    </button>
                  </div>

                  {/* Layout Mode Selectors */}
                  <div className="bg-[#111] p-1 border border-white/5 flex items-center rounded-xl">
                    <button
                      onClick={() => setLayoutMode('masonry')}
                      className={`p-2 px-3 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 ${layoutMode === 'masonry' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Flow</span>
                    </button>
                    <button
                      onClick={() => setLayoutMode('grid')}
                      className={`p-2 px-3 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 ${layoutMode === 'grid' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                    <button
                      onClick={() => setLayoutMode('list')}
                      className={`p-2 px-3 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 ${layoutMode === 'list' ? 'bg-[#222] text-red-500 shadow-md' : 'text-neutral-500 hover:text-white'}`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">List</span>
                    </button>
                  </div>

                  {/* Sync Button */}
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-2.5 bg-[#111] hover:bg-[#222] border border-white/5 text-neutral-400 hover:text-white transition-all duration-300 rounded-xl flex items-center justify-center cursor-pointer"
                    title="Reload files from Storage"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {loading && images.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1400px]:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 gap-4 py-6 w-full">
                {Array.from({ length: 14 }).map((_, idx) => (
                  <div key={idx} className="bg-[#0A0A0A] border border-white/5 rounded-2xl h-[300px] w-full animate-pulse" />
                ))}
              </div>
            ) : filteredAndSortedImages.length === 0 ? (
              <div className="py-32 flex flex-col items-center justify-center text-center gap-5 rounded-3xl border border-white/5 bg-[#0A0A0A]">
                <div className="p-6 bg-[#111] rounded-full">
                  <FolderOpen className="w-10 h-10 text-red-700" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-light tracking-wide text-white">Archive Empty</h3>
                  <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
                    We couldn't locate any items matching your current filters. Adjust your search or upload new assets.
                  </p>
                </div>
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => { setSearchQuery(""); setMediaFilter('all'); }}
                    className="px-6 py-3 bg-[#111] hover:bg-[#222] text-white rounded-xl transition-colors font-bold uppercase tracking-widest text-[10px]"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-6 py-3 bg-red-700 text-white font-bold rounded-xl transition-all hover:bg-red-600 uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(185,28,28,0.3)]"
                  >
                    Upload Asset
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {layoutMode === 'masonry' && (
                  <div className="columns-2 sm:columns-3 lg:columns-4 min-[1400px]:columns-5 2xl:columns-6 min-[1800px]:columns-7 gap-4 w-full">
                    {filteredAndSortedImages.map((image) => (
                      <div
                         key={image.id}
                         onClick={() => handleImageClick(image)}
                         className="break-inside-avoid mb-4 relative group rounded-2xl border border-white/5 bg-[#111] overflow-hidden cursor-zoom-in transition-all duration-500 hover:border-red-700/50 hover:shadow-[0_0_30px_rgba(185,28,28,0.15)] hover:-translate-y-1"
                      >
                         <div className="relative overflow-hidden w-full h-full">
                           {image.contentType.startsWith("video/") ? (
                             <video src={image.url} className="w-full h-auto object-cover block" muted loop playsInline autoPlay />
                           ) : (
                             <img src={image.url} alt={image.name} className="w-full h-auto object-cover block transition-transform duration-700 group-hover:scale-[1.05]" loading="lazy" />
                           )}
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                         </div>
                      </div>
                    ))}
                  </div>
                )}

                {layoutMode === 'grid' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1400px]:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 gap-4 w-full">
                    {filteredAndSortedImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleImageClick(image)}
                        className="relative group rounded-2xl border border-white/5 bg-[#111] overflow-hidden cursor-zoom-in transition-all duration-500 hover:border-red-700/50 hover:shadow-[0_0_30px_rgba(185,28,28,0.15)] aspect-square"
                      >
                        {image.contentType.startsWith("video/") ? (
                          <video src={image.url} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" muted loop playsInline autoPlay />
                        ) : (
                          <img src={image.url} alt={image.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                      </div>
                    ))}
                  </div>
                )}

                {layoutMode === 'list' && (
                  <div className="flex flex-col gap-4">
                    {filteredAndSortedImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleImageClick(image)}
                        className="group rounded-2xl border border-white/5 bg-[#0A0A0A] p-4 hover:bg-[#111] hover:border-red-700/50 cursor-zoom-in transition-all duration-300 flex gap-6 items-center overflow-hidden"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-900 border border-white/5 flex-shrink-0 flex items-center justify-center">
                          {image.contentType.startsWith("video/") ? (
                            <video src={image.url} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" muted />
                          ) : (
                            <img src={image.url} alt={image.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" loading="lazy" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                          <div className="md:col-span-2">
                            <h4 className="text-base font-medium text-white group-hover:text-red-500 transition-colors truncate">{image.name}</h4>
                            <p className="text-xs text-neutral-500 mt-1 truncate">{image.description || 'No description provided'}</p>
                          </div>

                          <div className="hidden sm:flex flex-col md:items-end gap-1">
                            <div className="flex gap-2">
                              {image.contentType.startsWith("video/") ? <Film className="w-3.5 h-3.5 text-red-700" /> : <ImageIcon className="w-3.5 h-3.5 text-red-700" />}
                              <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">{image.contentType.split('/')[1]?.toUpperCase()}</span>
                            </div>
                            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">{formatFileSize(image.size)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>
      </main>

      <FirebaseConfigPanel
        currentConfig={config}
        onConfigChange={(newConfig) => setConfig(newConfig)}
        syncMode={syncMode}
        onSyncModeChange={(mode) => setSyncMode(mode)}
        isFirebaseActive={isFirebaseActive}
        onTogglePanel={() => setIsConfigOpen(!isConfigOpen)}
        isOpen={isConfigOpen}
      />

      <ImageUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
      />

      <ImageDetailsModal
        image={selectedImage}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        onDelete={handleDelete}
        onRename={handleRename}
        onTagClick={() => {}}
      />
    </div>
  );
}
