import React, { useState, useEffect } from 'react';
import { FirebaseConfig } from '../types';
import { isConfigValid, clearInitializedFirebase } from '../firebase';
import { Info, CheckCircle2, KeyRound, Database, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FirebaseConfigPanelProps {
  currentConfig: FirebaseConfig;
  onConfigChange: (newConfig: FirebaseConfig) => void;
  syncMode: 'storage' | 'firestore';
  onSyncModeChange: (mode: 'storage' | 'firestore') => void;
  isFirebaseActive: boolean;
  onTogglePanel: () => void;
  isOpen: boolean;
}

export default function FirebaseConfigPanel({
  currentConfig,
  onConfigChange,
  syncMode,
  onSyncModeChange,
  isFirebaseActive,
  onTogglePanel,
  isOpen
}: FirebaseConfigPanelProps) {
  const [config, setConfig] = useState<FirebaseConfig>({ ...currentConfig });
  const [useCustom, setUseCustom] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setConfig({ ...currentConfig });
    // Check if configuration exists in localStorage
    const saved = localStorage.getItem('firebase_gallery_config');
    setUseCustom(!!saved);
  }, [currentConfig, isOpen]);

  const handleInputChange = (field: keyof FirebaseConfig, val: string) => {
    setConfig(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfigValid(config)) {
      localStorage.setItem('firebase_gallery_config', JSON.stringify(config));
      clearInitializedFirebase();
      onConfigChange(config);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      alert("Please fill in at least the API Key, Project ID, and Storage Bucket.");
    }
  };

  const handleClear = () => {
    localStorage.removeItem('firebase_gallery_config');
    clearInitializedFirebase();
    onConfigChange({
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    });
    setUseCustom(false);
  };

  const isCurrentInputValid = isConfigValid(config);

  return (
    <>
      {/* Slide-out Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for click out */}
            <motion.div
              id="fb-config-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={onTogglePanel}
              className="fixed inset-0 bg-black z-50 cursor-default backdrop-blur-sm"
            />

            <motion.div
              id="fb-config-panel-container"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0A0A0A]/95 backdrop-blur-2xl border-l border-white/5 text-[#E0E0E0] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 overflow-y-auto font-sans flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse"></div>
                  <div>
                    <h2 className="text-md uppercase tracking-[0.2em] font-bold text-white">Vantage.Setup</h2>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mt-0.5">Configure Core Bucket Settings</p>
                  </div>
                </div>
                <button 
                  onClick={onTogglePanel}
                  className="p-2 bg-[#111] hover:bg-[#222] rounded-lg text-neutral-400 hover:text-white transition-colors border border-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col gap-8">
                {/* Status Card */}
                <div className={`p-5 rounded-2xl border flex flex-col gap-3 transition-all ${
                  isFirebaseActive 
                    ? 'bg-green-950/10 border-green-500/20 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' 
                    : 'bg-amber-950/10 border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-neutral-400">Environment:</span>
                    <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${isFirebaseActive ? 'text-green-500' : 'text-amber-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isFirebaseActive ? 'bg-green-500' : 'bg-amber-500'}`} />
                      {isFirebaseActive ? "CONNECTED" : "DEMO PLAYGROUND"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed font-serif italic">
                    {isFirebaseActive 
                      ? "The application is successfully interacting with your custom Firebase Storage bucket. Uploads and deletions are live."
                      : "Currently demonstrating visual masonry grids, filtering, and mock image uploads. Enter your bucket keys below to connect your real asset storage."}
                  </p>
                </div>

                {/* Synchronization Model */}
                <div className="bg-[#111] p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-red-500" /> Integration Model
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onSyncModeChange('storage')}
                      className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                        syncMode === 'storage' 
                          ? 'bg-red-900/20 border-red-700/50 text-red-400 shadow-[inset_0_0_15px_rgba(185,28,28,0.1)]' 
                          : 'bg-[#151515] border-transparent text-neutral-500 hover:bg-[#1A1A1A] hover:text-neutral-300'
                      }`}
                    >
                      <span className="font-bold block mb-1.5 font-mono uppercase text-[10px] tracking-widest">Bucket Listing</span>
                      <span className="text-[9px] leading-relaxed opacity-80 block">List objects directly from Storage. No database needed.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSyncModeChange('firestore')}
                      className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                        syncMode === 'firestore' 
                          ? 'bg-red-900/20 border-red-700/50 text-red-400 shadow-[inset_0_0_15px_rgba(185,28,28,0.1)]' 
                          : 'bg-[#151515] border-transparent text-neutral-500 hover:bg-[#1A1A1A] hover:text-neutral-300'
                      }`}
                    >
                      <span className="font-bold block mb-1.5 font-mono uppercase text-[10px] tracking-widest">Firestore Sync</span>
                      <span className="text-[9px] leading-relaxed opacity-80 block">Real-time database records linked to Storage paths.</span>
                    </button>
                  </div>
                </div>

                {/* Configuration Inputs */}
                <form onSubmit={handleSave} className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-red-500" /> API Configurations
                    </span>
                    {useCustom && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-[9px] text-red-500 hover:text-red-400 uppercase tracking-widest font-bold transition-colors"
                      >
                        Reset Credentials
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block ml-1">API Key *</label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={config.apiKey}
                        onChange={(e) => handleInputChange('apiKey', e.target.value)}
                        className="w-full bg-[#111] border border-transparent focus:border-red-700 focus:bg-[#151515] hover:border-white/5 focus:outline-none p-3.5 rounded-xl text-zinc-100 font-mono text-xs transition-all duration-300"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block ml-1">Project ID *</label>
                      <input
                        type="text"
                        placeholder="your-firebase-project"
                        value={config.projectId}
                        onChange={(e) => handleInputChange('projectId', e.target.value)}
                        className="w-full bg-[#111] border border-transparent focus:border-red-700 focus:bg-[#151515] hover:border-white/5 focus:outline-none p-3.5 rounded-xl text-zinc-100 font-mono text-xs transition-all duration-300"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block ml-1">Storage Bucket URL *</label>
                      <input
                        type="text"
                        placeholder="your-project.appspot.com"
                        value={config.storageBucket}
                        onChange={(e) => handleInputChange('storageBucket', e.target.value)}
                        className="w-full bg-[#111] border border-transparent focus:border-red-700 focus:bg-[#151515] hover:border-white/5 focus:outline-none p-3.5 rounded-xl text-zinc-100 font-mono text-xs transition-all duration-300"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block ml-1">Auth Domain (Optional)</label>
                      <input
                        type="text"
                        placeholder="your-project.firebaseapp.com"
                        value={config.authDomain}
                        onChange={(e) => handleInputChange('authDomain', e.target.value)}
                        className="w-full bg-[#111] border border-transparent focus:border-red-700 focus:bg-[#151515] hover:border-white/5 focus:outline-none p-3.5 rounded-xl text-zinc-100 font-mono text-xs transition-all duration-300"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!isCurrentInputValid}
                    className={`w-full py-4 mt-2 font-bold text-[10px] tracking-[0.2em] uppercase transition-all duration-300 rounded-xl ${
                      isCurrentInputValid
                        ? 'bg-white text-black hover:bg-red-700 hover:text-white cursor-pointer shadow-[0_0_20px_rgba(185,28,28,0.2)]'
                        : 'bg-[#111] text-neutral-600 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    {savedSuccess ? (
                      <span className="flex items-center justify-center gap-2 tracking-[0.1em]">
                        <CheckCircle2 className="w-4 h-4 text-green-500" /> Settings Saved
                      </span>
                    ) : (
                      "Apply Credentials"
                    )}
                  </button>
                 </form>

                {/* CORS Guide / Helpful hints */}
                <div className="bg-[#111] border border-white/5 p-5 rounded-2xl flex flex-col gap-3 mt-auto">
                  <div className="flex items-center gap-2 text-neutral-300 font-medium text-xs font-mono uppercase tracking-wider">
                    <Info className="w-4 h-4 text-red-500" />
                    <span>Cross-Origin Resource Sharing (CORS)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-serif italic">
                    By default, Google Cloud Storage blocks browser uploads/listing from foreign domains. If images fail to render, configure a CORS definition file on your bucket setup:
                  </p>
                  <pre className="p-4 bg-[#0A0A0A] font-mono text-[9px] text-red-400 border border-white/5 rounded-xl overflow-x-auto leading-tight shadow-inner">
                    {`[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "x-firebase-storage-metadata"],
    "maxAgeSeconds": 3600
  }
]`}
                  </pre>
                  <p className="text-[9px] text-neutral-500 font-mono mt-1">
                    Apply: <code className="text-neutral-300 font-mono bg-[#0A0A0A] border border-white/5 px-1.5 py-1 rounded-md">gsutil cors set cors.json gs://your-bucket</code>
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
