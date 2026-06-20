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
  X
} from 'lucide-react';

export default function App() {
  // Config & State Initialization
  const [config, setConfig] = useState<FirebaseConfig>(getStoredConfig());
  const [syncMode, setSyncMode] = useState<'storage' | 'firestore'>('storage');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [pinterestFocus, setPinterestFocus] = useState<GalleryImage | null>(null);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('masonry');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  const isFirebaseActive = isConfigValid(config);

  // ==================== SIMILARITY ENGINE (BAG OF WORDS) ====================
  const getSimilarImages = (focus: GalleryImage, allImages: GalleryImage[], limit = 24) => {
    if (!focus) return [];

    // Helper to clean and extract useful keywords (ignores tiny words like 'a', 'is')
    const extractWords = (text: string) => {
      if (!text) return [];
      return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    };

    const focusTags = focus.tags ? focus.tags.map(t => t.toLowerCase().trim()) : [];
    const focusWords = new Set([
      ...extractWords(focus.name),
      ...extractWords(focus.description || ""),
      ...focusTags
    ]);

    return allImages
      .filter(img => img.id !== focus.id)
      .map(img => {
        let score = 0;

        // 1. Direct Tag Matches (Highest Value)
        const imgTags = img.tags ? img.tags.map(t => t.toLowerCase().trim()) : [];
        imgTags.forEach(tag => {
          if (focusTags.includes(tag)) score += 20;
          else if (focusWords.has(tag)) score += 10;
        });

        // 2. Keyword Matches in Title & Description
        const imgWords = [
          ...extractWords(img.name),
          ...extractWords(img.description || "")
        ];

        // Score unique shared words
        const uniqueImgWords = new Set(imgWords);
        uniqueImgWords.forEach(word => {
          if (focusWords.has(word)) score += 5;
        });

        return { ...img, similarityScore: score };
      })
      .filter(item => item.similarityScore > 0) // Remove items with 0 shared keywords
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  };

  // Hook up sync & listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    setLoading(true);
    setError("");

    if (isFirebaseActive) {
      try {
        const services = initializeFirebaseServices(config);
        
        if (syncMode === 'firestore') {
          // Firestore Realtime Sync Mode
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
          // Storage Bucket Listing Mode
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
      // Demo Mode
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
    setLoading(true);
    setError("");
    if (isFirebaseActive) {
      try {
        const services = initializeFirebaseServices(config);
        if (syncMode === 'firestore') {
          setError("");
          setLoading(false);
        } else {
          const fetched = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
          setImages(fetched);
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to refresh list.");
        setLoading(false);
      }
    } else {
      setTimeout(() => {
        setImages(getDemoImages());
        setLoading(false);
      }, 300);
    }
  };

  // Handle uploading files
  const handleUpload = async (
    file: File, 
    metadata: { name: string; description: string; tags: string[] }
  ) => {
    if (isFirebaseActive) {
      const services = initializeFirebaseServices(config);
      await uploadImageToFirebase(
        services.storage,
        services.firestore,
        file,
        metadata,
        syncMode === 'firestore',
        (progress) => {}
      );
      
      if (syncMode === 'storage') {
        const refreshed = await fetchFromStorageBucket(services.storage, STORAGE_FOLDER_NAME);
        setImages(refreshed);
      }
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          const computedRatio = 1.33; // Mock default ratio
          const demoImage: GalleryImage = {
            id: `demo-upload-${Date.now()}`,
            name: metadata.name,
            url: reader.result as string,
            path: `demo/images/${file.name}`,
            size: file.size,
            contentType: file.type,
            createdAt: Date.now(),
            tags: metadata.tags,
            description: metadata.description,
            aspectRatio: 1.33
          };

          const existingDemo = getDemoImages();
          const updatedDemo = [demoImage, ...existingDemo];
          saveDemoImages(updatedDemo);
          setImages(updatedDemo);
          resolve();
        };
      });
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

  const handleImageClick = (image: GalleryImage) => {
    setPinterestFocus(image);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Perform client side search
  const filteredAndSortedImages = images
    .filter(img => {
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

  // Memoized similar images for better performance
  const similarImages = useMemo(() => {
    return pinterestFocus ? getSimilarImages(pinterestFocus, images, 24) : [];
  }, [pinterestFocus, images]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#E0E0E0] font-sans tracking-tight antialiased selection:bg-orange-500 selection:text-white">
      
      {/* Sticky Main Header (Full width fluid) */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#222] px-4 sm:px-6 md:px-8 py-5">
        <div className="w-full mx-auto flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div 
            className="flex items-center gap-4 cursor-pointer" 
            onClick={() => setPinterestFocus(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-widest uppercase italic font-serif text-white">Vantage.Archive</h1>
              <p className="text-[9px] uppercase tracking-[0.25em] font-mono text-neutral-500 mt-0.5">Firebase Asset Registry</p>
            </div>
          </div>

          {/* Connection Pill and Action buttons */}
          <div className="flex items-center gap-4">
            
            {/* Context Mode Pill Indicator */}
            <div 
              onClick={() => setIsConfigOpen(true)}
              className={`hidden md:flex items-center gap-2.5 bg-[#1A1A1A] px-4 py-2 rounded-none border text-[10px] uppercase font-bold tracking-wider cursor-pointer select-none transition ${
                isFirebaseActive 
                  ? 'border-[#333] text-[#E0E0E0] hover:text-white hover:border-neutral-500' 
                  : 'border-amber-500/30 text-amber-500 hover:border-amber-500'
              }`}
            >
              <span className="text-neutral-500">Firebase Status:</span>
              {isFirebaseActive ? (
                <span className="text-green-400">Connected</span>
              ) : (
                <span className="text-amber-500">Playground</span>
              )}
            </div>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 bg-white text-black font-bold px-5 py-2.5 text-xs rounded-none border border-transparent hover:bg-orange-500 hover:text-white tracking-[0.2em] uppercase transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Upload</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Workspace (Full width fluid) */}
      <main className="w-full mx-auto px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-6">
        
        {/* Connection Failure Error Banner */}
        {error && (
          <div className="p-4 bg-red-950/25 border border-red-900/40 text-red-400 rounded-2xl flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs shadow-lg shadow-red-500/5">
            <div className="flex items-start sm:items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
              <div>
                <span className="font-bold block sm:inline mr-1.5">Database Exception:</span>
                <span className="opacity-90">{error}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfigOpen(true)}
                className="text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold px-3 py-1.5 rounded-lg border border-red-500/20 transition cursor-pointer"
              >
                Inspect Setup
              </button>
              <button
                onClick={() => setError("")}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {pinterestFocus ? (
          /* Similarity Detail View */
          <div className="flex flex-col gap-10 animate-in fade-in duration-500">
            {/* View Header controls */}
            <div className="flex justify-between items-center bg-[#0A0A0A] border border-[#222] p-4">
               <button
                 onClick={() => setPinterestFocus(null)}
                 className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#222] text-white border border-[#333] font-bold text-[10px] uppercase tracking-widest transition"
               >
                 ← Back to Archive
               </button>
               <button
                 onClick={() => setSelectedImage(pinterestFocus)}
                 className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase tracking-widest transition"
               >
                 View Details & Edit
               </button>
            </div>

            {/* Main Focus Image */}
            <div className="flex justify-center bg-transparent">
              {pinterestFocus.contentType.startsWith("video/") ? (
                <video src={pinterestFocus.url} className="max-h-[65vh] rounded-2xl shadow-2xl object-contain" controls autoPlay />
              ) : (
                <img src={pinterestFocus.url} alt={pinterestFocus.name} className="max-h-[65vh] rounded-2xl shadow-2xl object-contain" />
              )}
            </div>

            {/* Similarity Grid */}
            <div className="mt-8 border-t border-[#222] pt-8">
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold tracking-widest uppercase italic font-serif text-white">
                  More like this
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Based on tags and visual keywords
                </p>
              </div>
              <div className="columns-2 sm:columns-3 lg:columns-4 min-[1400px]:columns-5 2xl:columns-6 min-[1800px]:columns-7 gap-3 sm:gap-4 w-full">
                {similarImages.map((image: any) => (
                  <div
                    key={image.id}
                    onClick={() => handleImageClick(image)}
                    className="break-inside-avoid mb-3 sm:mb-4 relative group rounded-2xl border border-[#222] bg-[#0A0A0A] overflow-hidden cursor-zoom-in transition-all duration-300 hover:border-neutral-500 hover:-translate-y-1"
                  >
                    {image.contentType.startsWith("video/") ? (
                      <video 
                        src={image.url} 
                        className="w-full h-auto object-cover block" 
                        muted 
                        loop 
                        autoPlay 
                        playsInline 
                      />
                    ) : (
                      <img 
                        src={image.url} 
                        alt={image.name} 
                        className="w-full h-auto object-cover block transition-transform duration-700 group-hover:scale-[1.03]" 
                        loading="lazy" 
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                    
                    {image.similarityScore > 15 && (
                      <div className="absolute top-3 right-3 bg-black/70 text-[10px] px-2.5 py-1 rounded-full text-orange-400 font-mono tracking-widest">
                        Strong Match
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {similarImages.length === 0 && (
                <p className="text-center text-neutral-500 py-12">No similar images found. Try adding more descriptive tags.</p>
              )}
            </div>
          </div>
        ) : (
          /* Main Feed View */
          <>
            {/* Toolbar and Filters */}
            <div className="bg-[#0A0A0A] border border-[#222] p-6 rounded-none flex flex-col gap-5">
              <div className="flex flex-col xl:flex-row items-center justify-between gap-5">
                
                {/* Search Box Input */}
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search archive content..."
                    className="w-full bg-[#0D0D0D] border border-[#333] focus:border-orange-500 hover:border-neutral-700 focus:outline-none p-3 pl-10 rounded-none text-xs text-neutral-300 tracking-wide transition font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orange-500 hover:text-white text-xs font-bold leading-none py-0.5 uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Layout and Sort Slices */}
                <div className="flex flex-wrap items-center justify-between w-full xl:w-auto gap-5">
                  
                  {/* Sort Selection Controls */}
                  <div className="flex flex-wrap items-center gap-4 text-xs tracking-wider uppercase font-medium text-neutral-400">
                    <span className="text-neutral-500 flex items-center gap-2 font-bold text-[10px] uppercase font-mono tracking-widest"><ArrowUpDown className="w-3.5 h-3.5 text-orange-500" /> Sort</span>
                    
                    <div className="flex items-center bg-[#0D0D0D] p-0.5 border border-[#333]">
                      <button
                        onClick={() => setSortBy('date-desc')}
                        className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-mono transition cursor-pointer ${
                          sortBy === 'date-desc' 
                            ? 'bg-neutral-800 text-orange-500 font-bold' 
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Newest
                      </button>
                      <button
                        onClick={() => setSortBy('date-asc')}
                        className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-mono transition cursor-pointer ${
                          sortBy === 'date-asc' 
                            ? 'bg-neutral-800 text-orange-500 font-bold' 
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Oldest
                      </button>
                    </div>

                    <div className="flex items-center bg-[#0D0D0D] p-0.5 border border-[#333]">
                      <button
                        onClick={() => setSortBy('name-asc')}
                        className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-mono transition cursor-pointer ${
                          sortBy === 'name-asc' 
                            ? 'bg-neutral-800 text-orange-500 font-bold' 
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        A - Z
                      </button>
                      <button
                        onClick={() => setSortBy('name-desc')}
                        className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-mono transition cursor-pointer ${
                          sortBy === 'name-desc' 
                            ? 'bg-neutral-800 text-orange-500 font-bold' 
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Z - A
                      </button>
                    </div>
                  </div>

                  {/* Layout Mode Selectors */}
                  <div className="bg-[#0D0D0D] p-1 border border-[#333] flex items-center">
                    <button
                      onClick={() => setLayoutMode('masonry')}
                      className={`p-1.5 px-3 rounded-none text-[10px] uppercase tracking-widest font-semibold flex items-center gap-2 transition select-none ${
                        layoutMode === 'masonry' 
                          ? 'bg-neutral-800 text-orange-500 font-bold' 
                          : 'text-neutral-500 hover:text-white'
                      }`}
                      title="Pinterest layout"
                    >
                      <Columns className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="hidden sm:inline">Pinterest</span>
                    </button>

                    <button
                      onClick={() => setLayoutMode('grid')}
                      className={`p-1.5 px-3 rounded-none text-[10px] uppercase tracking-widest font-semibold flex items-center gap-2 transition select-none ${
                        layoutMode === 'grid' 
                          ? 'bg-neutral-800 text-orange-500 font-bold' 
                          : 'text-neutral-500 hover:text-white'
                      }`}
                      title="Strict Grid ratio"
                    >
                      <Grid className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>

                    <button
                      onClick={() => setLayoutMode('list')}
                      className={`p-1.5 px-3 rounded-none text-[10px] uppercase tracking-widest font-semibold flex items-center gap-2 transition select-none ${
                        layoutMode === 'list' 
                          ? 'bg-neutral-800 text-orange-500 font-bold' 
                          : 'text-neutral-500 hover:text-white'
                      }`}
                      title="Spread list columns"
                    >
                      <List className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  </div>

                  {/* Manual Synchronization Refetch button */}
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-2.5 px-3.5 bg-[#0D0D0D] hover:bg-neutral-950 border border-[#333] text-[#E0E0E0] hover:text-white transition flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold cursor-pointer"
                    title="Reload files from Storage"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Loading skeletons or active dashboard results */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1400px]:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 gap-3 sm:gap-4 py-6 font-sans w-full">
                {Array.from({ length: 14 }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className="bg-[#0A0A0A] border border-[#222] rounded-none h-[280px] w-full flex flex-col gap-4 p-4 overflow-hidden animate-pulse"
                  >
                    <div className="flex-1 bg-neutral-900 rounded-none w-full" />
                    <div className="h-4 bg-neutral-900 rounded-none w-2/3" />
                    <div className="flex gap-2">
                      <div className="h-3.5 bg-neutral-900 rounded-none w-1/4" />
                      <div className="h-3.5 bg-neutral-900 rounded-none w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAndSortedImages.length === 0 ? (
              
              /* Elegant Empty State Illustration */
              <div className="py-24 border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-center gap-5 rounded-none">
                <div className="p-5 bg-[#0D0D0D] border border-[#222] text-neutral-500 rounded-none">
                  <FolderOpen className="w-8 h-8 text-orange-500" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-light font-serif text-white tracking-wide">Archive Empty</h3>
                  <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                    We couldn't locate any items matching your current criteria. Filter differently or upload a new record to Vantage.Archive.
                  </p>
                </div>
                <div className="flex gap-3 text-xs mt-3">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                    }}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-none transition border border-[#333] cursor-pointer font-bold uppercase tracking-widest text-[10px]"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-5 py-2.5 bg-white text-black font-bold rounded-none transition cursor-pointer hover:bg-orange-500 hover:text-white uppercase tracking-widest text-[10px]"
                  >
                    Upload First File
                  </button>
                </div>
              </div>
            ) : (
              
              /* Gallery Results Grid layouts */
              <div className="py-2.5">
                {layoutMode === 'masonry' && (
                  <div className="columns-2 sm:columns-3 lg:columns-4 min-[1400px]:columns-5 2xl:columns-6 min-[1800px]:columns-7 gap-3 sm:gap-4 w-full">
                    {filteredAndSortedImages.map((image) => (
                      <div
                         key={image.id}
                         onClick={() => handleImageClick(image)}
                         className="break-inside-avoid mb-3 sm:mb-4 relative group rounded-2xl border border-[#222] bg-[#0A0A0A] overflow-hidden cursor-zoom-in shadow-none transition-all duration-300 hover:border-neutral-500 flex flex-col hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1"
                      >
                         <div className="relative overflow-hidden w-full bg-neutral-900">
                           {image.contentType.startsWith("video/") ? (
                             <video
                               src={image.url}
                               className="w-full h-auto object-cover block"
                               muted
                               loop
                               playsInline
                               autoPlay
                             />
                           ) : (
                             <img
                               src={image.url}
                               alt={image.name}
                               className="w-full h-auto object-cover block transition-transform duration-700 group-hover:scale-[1.03]"
                               loading="lazy"
                               referrerPolicy="no-referrer"
                             />
                           )}
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                         </div>
                      </div>
                    ))}
                  </div>
                )}

                {layoutMode === 'grid' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 min-[1400px]:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 gap-3 sm:gap-4 w-full">
                    {filteredAndSortedImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleImageClick(image)}
                        className="relative group rounded-none border border-[#222] bg-[#0A0A0A] overflow-hidden cursor-zoom-in shadow-none transition duration-350 hover:border-neutral-500 aspect-square flex flex-col justify-end"
                      >
                        {/* Image underlay */}
                        {image.contentType.startsWith("video/") ? (
                          <video
                            src={image.url}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                        ) : (
                          <img
                            src={image.url}
                            alt={image.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        {/* Uniform gradient drop shadows */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent transition-all duration-300 opacity-0 group-hover:opacity-100" />

                        {/* Header values */}
                        <div className="relative p-5 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="flex items-center justify-between text-[10px] font-mono text-orange-500 tracking-wider">
                            <span>{formatFileSize(image.size)}</span>
                            <span>{image.contentType.split('/')[1]?.toUpperCase()}</span>
                          </div>
                          <h4 className="text-sm font-medium text-white transition truncate">{image.name}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {layoutMode === 'list' && (
                  <div className="flex flex-col gap-3.5">
                    {filteredAndSortedImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => handleImageClick(image)}
                        className="group rounded-none border border-[#222] bg-[#0A0A0A] p-4 hover:bg-[#151515] hover:border-neutral-700 cursor-zoom-in transition flex gap-5 items-center overflow-hidden"
                      >
                        {/* Tiny visual thumb preview */}
                        <div className="w-16 h-16 rounded-none overflow-hidden bg-neutral-900 border border-[#222] flex-shrink-0 flex items-center justify-center">
                          {image.contentType.startsWith("video/") ? (
                            <video
                              src={image.url}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              muted
                            />
                          ) : (
                            <img
                              src={image.url}
                              alt={image.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>

                        {/* Metadata columns */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium text-white group-hover:text-orange-400 transition truncate font-sans">{image.name}</h4>
                          </div>

                          <div className="hidden sm:block text-xs font-mono text-neutral-400 md:text-right">
                            <p className="text-[8px] text-neutral-500 uppercase tracking-[0.2em] font-sans font-bold mb-0.5">Specifications</p>
                            <span>{formatFileSize(image.size)} • {image.contentType.split('/')[1]?.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating configurations and panels */}
      <FirebaseConfigPanel
        currentConfig={config}
        onConfigChange={(newConfig) => setConfig(newConfig)}
        syncMode={syncMode}
        onSyncModeChange={(mode) => setSyncMode(mode)}
        isFirebaseActive={isFirebaseActive}
        onTogglePanel={() => setIsConfigOpen(!isConfigOpen)}
        isOpen={isConfigOpen}
      />

      {/* Upload trigger popups */}
      <ImageUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
      />

      {/* Full-screen Lightbox Details modal */}
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
