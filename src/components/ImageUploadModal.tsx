import React, { useState, useRef, useEffect } from 'react';
import { ALL_AVAILABLE_TAGS } from '../demoData';
import { UploadCloud, X, PlusCircle, Sparkles, Image as ImageIcon, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    files: File[], 
    metadata: { name: string; description: string; tags: string[] }
  ) => Promise<void>;
}

export default function ImageUploadModal({
  isOpen,
  onClose,
  onUpload
}: ImageUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      setName("");
      setDescription("");
      setSelectedTags([]);
      setCustomTag("");
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFilesChange = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (fileArray.length === 0) {
      setErrorMsg("Please select valid image or video files.");
      return;
    }

    setErrorMsg("");
    
    setSelectedFiles(prev => [...prev, ...fileArray]);
    
    const newUrls = fileArray.map(f => URL.createObjectURL(f));
    setPreviewUrls(prev => [...prev, ...newUrls]);

    // Auto-fill name if it's the first file and name is empty
    if (!name && fileArray.length === 1) {
      setName(fileArray[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    } else if (!name && fileArray.length > 1) {
      setName("Batch Upload");
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[indexToRemove]);
      return prev.filter((_, i) => i !== indexToRemove);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesChange(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTag.trim()) {
      const cleanTag = customTag.trim();
      if (!selectedTags.includes(cleanTag)) {
        setSelectedTags(prev => [...prev, cleanTag]);
      }
      setCustomTag("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMsg("Please select at least one file to upload.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");
    
    // Set up a simulated progress callback
    const fakeTimer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(fakeTimer);
          return prev;
        }
        return prev + Math.floor(Math.random() * 12) + 1;
      });
    }, 120);

    try {
      await onUpload(selectedFiles, {
        name: name || "Untitled Asset",
        description,
        tags: selectedTags
      });
      setUploadProgress(100);
      setTimeout(() => {
        clearInterval(fakeTimer);
        onClose();
      }, 500);
    } catch (err: any) {
      clearInterval(fakeTimer);
      setErrorMsg(err?.message || "Standard upload failed. Check configurations or CORS access rules.");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="upload-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            id="upload-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            onClick={isUploading ? undefined : onClose}
            className="fixed inset-0 bg-black backdrop-blur-none"
          />

          {/* Modal Container */}
          <motion.div
            id="upload-modal-content"
            initial={{ scale: 0.98, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 10, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="relative bg-[#0D0D0D] border border-[#222] text-[#E0E0E0] rounded-none shadow-none w-full max-w-2xl overflow-hidden z-50 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-[#222] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <div>
                  <h2 className="text-md uppercase tracking-[0.2em] font-bold text-white font-sans">Upload New Asset</h2>
                  <p className="text-[9px] uppercase font-mono tracking-wider text-neutral-500 mt-0.5">Submit to secure Vantage.Archive</p>
                </div>
              </div>
              {!isUploading && (
                <button 
                  onClick={onClose}
                  className="p-1 px-2.5 bg-[#151515] hover:bg-neutral-900 border border-[#222] text-neutral-400 hover:text-white transition rounded-none uppercase font-mono text-[10px] tracking-widest"
                >
                  Close
                </button>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Image Drag Zone */}
              {selectedFiles.length === 0 ? (
                <div
                  id="dropzone"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-none p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 group ${
                    isDragActive 
                      ? 'border-orange-500 bg-orange-500/5' 
                      : 'border-[#333] bg-[#0A0A0A] hover:border-neutral-500'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFilesChange(e.target.files)}
                    className="hidden"
                  />
                  <div className="p-3 bg-[#111] border border-[#222] rounded-none text-neutral-400 group-hover:text-orange-500 transition-colors">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-semibold text-neutral-300">
                      Drag and drop files, or <span className="text-orange-500 font-bold underline decoration-orange-500/30 group-hover:decoration-orange-500">browse file directory</span>
                    </p>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono">PNG, JPEG, WEBP, MP4 (MULTIPLE ALLOWED)</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Miniature Previews Grid */}
                  <div className="md:col-span-2 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#888]">Asset Preview ({selectedFiles.length})</span>
                      <button 
                        type="button" 
                        onClick={triggerFileInput}
                        className="text-[9px] text-orange-500 hover:text-white uppercase font-mono tracking-widest transition"
                      >
                        + Add More
                      </button>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && handleFilesChange(e.target.files)}
                        className="hidden"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {previewUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square w-full rounded-none border border-[#222] bg-[#0A0A0A] overflow-hidden flex items-center justify-center p-1 group">
                          {selectedFiles[idx].type.startsWith("video/") ? (
                            <>
                              <Film className="absolute z-10 w-4 h-4 text-white/70" />
                              <video src={url} className="object-cover w-full h-full opacity-60" />
                            </>
                          ) : (
                            <img 
                              src={url} 
                              alt={`preview-${idx}`} 
                              className="object-cover w-full h-full"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            disabled={isUploading}
                            className="absolute top-1 right-1 p-1 bg-[#151515]/90 backdrop-blur-sm border border-[#333] text-white hover:border-red-500 hover:text-red-500 rounded-none transition opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="md:col-span-3 flex flex-col gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">Image Title *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-mono"
                        placeholder="Batch Title or Individual Name"
                        required
                        disabled={isUploading}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono block">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 font-serif italic leading-relaxed"
                        placeholder="Provide details about camera parameters, location data, or visual notes..."
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tag Pickers */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-[#888] font-mono">Classify with Tags</span>
                  
                  {/* Selected Pills */}
                  <div className="flex flex-wrap gap-2 min-h-[30px] p-2.5 bg-[#0A0A0A] rounded-none border border-[#222]">
                    {selectedTags.length === 0 ? (
                      <span className="text-[10px] text-neutral-500 self-center px-1 font-serif italic">No classifications attached. Pick tags below.</span>
                    ) : (
                      selectedTags.map(tag => (
                        <span 
                          key={tag} 
                          className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest bg-orange-500/10 text-orange-400 font-bold px-2.5 py-1 rounded-none border border-orange-500/25 font-mono"
                        >
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => handleTagToggle(tag)}
                            className="text-orange-500 hover:text-white"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add Custom Tag */}
                  <div className="flex gap-2 text-xs mt-0.5">
                    <input
                      type="text"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="Insert customized classification..."
                      className="bg-[#0D0D0D] border border-[#333] hover:border-neutral-700 focus:border-orange-500 focus:outline-none p-3 rounded-none text-zinc-100 flex-1 text-xs font-mono"
                      disabled={isUploading}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTag}
                      className="px-4 bg-[#151515] hover:bg-[#222] text-neutral-300 rounded-none text-[10px] font-bold uppercase tracking-widest border border-[#333] transition flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-orange-500" /> Insert
                    </button>
                  </div>

                  {/* Recommendations */}
                  <span className="text-[10px] text-neutral-500 font-mono mt-1 uppercase tracking-wider">Suggested Classifications:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto pr-1">
                    {ALL_AVAILABLE_TAGS.map(tag => {
                      const isActive = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          disabled={isUploading}
                          onClick={() => handleTagToggle(tag)}
                          className={`text-[9.5px] uppercase tracking-widest px-2.5 py-1 rounded-none font-semibold transition font-mono ${
                            isActive 
                              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/40' 
                              : 'bg-[#151515] hover:bg-[#222] text-neutral-400 border border-[#222]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error messages */}
              {errorMsg && (
                <div className="p-3.5 bg-red-950/20 border border-red-900/30 text-red-400 rounded-none text-xs flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 bg-red-500 flex-shrink-0 animate-pulse" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400 font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#151515] border border-[#222] rounded-none overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-150" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 text-xs pt-4 border-t border-[#222]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isUploading}
                  className="px-5 py-3 bg-transparent hover:bg-[#151515] text-[#888] hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-none transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedFiles.length === 0 || isUploading}
                  className={`px-6 py-3 font-bold transition rounded-none text-[10px] tracking-[0.2em] uppercase ${
                    selectedFiles.length > 0 && !isUploading
                      ? 'bg-white text-black hover:bg-orange-500 hover:text-white cursor-pointer shadow-none'
                      : 'bg-[#151515] text-neutral-600 border border-[#222] cursor-not-allowed'
                  }`}
                >
                  {isUploading ? 'Transferring...' : 'Submit Files'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
