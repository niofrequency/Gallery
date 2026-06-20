import React, { useState, useEffect } from 'react';
import { FirebaseConfig } from '../types';
import { isConfigValid, clearInitializedFirebase } from '../firebase';
import { Settings, Info, Cloud, Wifi, CheckCircle2, AlertTriangle, KeyRound, Database, ArrowRight } from 'lucide-react';
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
      {/* Floating Toggle Button */}
      <button
        id="fb-config-toggle"
        onClick={onTogglePanel}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-3.5 px-6 py-4 rounded-none shadow-none font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all duration-300 border ${
          isFirebaseActive 
            ? 'bg-[#1A1A1A] border-[#313131] text-[#E0E0E0] hover:bg-neutral-900' 
            : 'bg-white hover:bg-[#FA5252] hover:bg-orange-500 text-black hover:text-white border-transparent'
        }`}
      >
        <Settings className={`w-3.5 h-3.5 ${isFirebaseActive ? 'animate-spin-slow text-orange-500' : ''}`} />
        <span>{isFirebaseActive ? 'Setup Active' : 'Setup Firebase'}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseActive ? 'bg-green-400 animate-pulse' : 'bg-orange-500 animate-pulse'}`} />
      </button>

      {/* Slide-out Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for click out */}
            <motion.div
              id="fb-config-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={onTogglePanel}
              className="fixed inset-0 bg-black z-40 cursor-default"
            />

            <motion.div
              id="fb-config-panel-container"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0D0D0D] border-l border-[#222] text-[#E0E0E0] shadow-none z-50 overflow-y-auto font-sans flex flex-col"
            >
              <div className="p-6 border-b border-[#222] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                  <div>
                    <h2 className="text-md uppercase tracking-[0.2em] font-bold text-white">Vantage.Setup</h2>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mt-0.5">Configure Core Bucket Settings</p>
                  </div>
                </div>
                <button 
                  onClick={onTogglePanel}
                  className="p-1.5 px-3 bg-[#151515] hover:bg-neutral-900 rounded-none text-xs text-neutral-400 hover:text-white transition border border-[#333] uppercase tracking-widest font-mono"
                >
                  Close
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col gap-6">
                {/* Status Card */}
                <div className={`p-5 rounded-none border flex flex-col gap-3 transition-all ${
                  isFirebaseActive 
                    ? 'bg-[#151515]/80 border-green-500/20' 
                    : 'bg-[#151515]/80 border-amber-500/20'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-neutral-400">Environment:</span>
                    <span className={`text-[10px] uppercase font-bold tracking-widest ${isFirebaseActive ? 'text-green-400' : 'text-amber-500'}`}>
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
                <div className="bg-[#0A0A0A] p-5 rounded-none border border-[#222] flex flex-col gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-orange-500" /> Integration Model
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onSyncModeChange('storage')}
                      className={`p-3.5 rounded-none border text-left transition ${
                        syncMode === 'storage' 
                          ? 'bg-orange-500/5 border-orange-500/50 text-orange-400' 
                          : 'bg-[#0D0D0D] border-[#333] text-neutral-450 hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <span className="font-bold block mb-1 font-mono uppercase text-[10px] tracking-widest">Bucket Listing</span>
                      <span className="text-[9px] leading-relaxed text-zinc-500 block">List objects directly from Storage. No database needed.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSyncModeChange('firestore')}
                      className={`p-3.5 rounded-none border text-left transition ${
                        syncMode === 'firestore' 
                          ? 'bg-orange-500/5 border-orange-500/50 text-orange-400' 
                          : 'bg-[#0D0D0D] border-[#333] text-neutral-450 hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <span className="font-bold block mb-1 font-mono uppercase text-[10px] tracking-widest">Firestore Sync</span>
                      <span className="text-[9px] leading-relaxed text-zinc-500 block">Real-time database records linked to Storage paths.</span>
                    </button>
                  </div>
                </div>

                {/* Configuration Inputs */}
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[#222] pb-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-orange-500" /> API Configurations
                    </span>
                    {useCustom && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-[9px] text-orange-500 hover:text-white uppercase tracking-widest font-bold"
                      >
                        Reset Credentials
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">API Key *</label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={config.apiKey}
                        onChange={(e) => handleInputChange('apiKey', e.target.value)}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">Project ID *</label>
                      <input
                        type="text"
                        placeholder="your-firebase-project"
                        value={config.projectId}
                        onChange={(e) => handleInputChange('projectId', e.target.value)}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">Storage Bucket URL *</label>
                      <input
                        type="text"
                        placeholder="your-project.appspot.com"
                        value={config.storageBucket}
                        onChange={(e) => handleInputChange('storageBucket', e.target.value)}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">Auth Domain (Optional)</label>
                      <input
                        type="text"
                        placeholder="your-project.firebaseapp.com"
                        value={config.authDomain}
                        onChange={(e) => handleInputChange('authDomain', e.target.value)}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!isCurrentInputValid}
                    className={`w-full py-3.5 font-bold text-xs tracking-[0.2em] uppercase transition rounded-none ${
                      isCurrentInputValid
                        ? 'bg-white text-black hover:bg-orange-500 hover:text-white cursor-pointer shadow-none'
                        : 'bg-[#151515] text-neutral-600 cursor-not-allowed border border-[#222]'
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
                <div className="bg-[#0A0A0A] border border-[#222] p-5 rounded-none flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-neutral-300 font-medium text-xs font-mono uppercase tracking-wider">
                    <Info className="w-4 h-4 text-orange-500" />
                    <span>Cross-Origin Resource Sharing (CORS)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-serif italic">
                    By default, Google Cloud Storage blocks browser uploads/listing from foreign domains. If images fail to render, configure a CORS definition file on your bucket setup:
                  </p>
                  <pre className="p-3 bg-[#050505] font-mono text-[9px] text-orange-400 border border-[#222] rounded-none overflow-x-auto leading-tight">
                    {`[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "x-firebase-storage-metadata"],
    "maxAgeSeconds": 3600
  }
]`}
                  </pre>
                  <p className="text-[9px] text-neutral-500 font-mono">
                    Apply: <code className="text-neutral-300 font-mono bg-[#050505] border border-[#222] px-1 py-0.5 rounded-none">gsutil cors set cors.json gs://your-bucket</code>
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
