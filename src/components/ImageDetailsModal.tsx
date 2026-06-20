import React, { useState, useEffect } from 'react';
import { GalleryImage } from '../types';
import { formatFileSize, formatDate } from '../utils';
import { X, Download, Trash2, Copy, Check, Calendar, FileText, FolderGit, HardDrive, Eye, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageDetailsModalProps {
  image: GalleryImage | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (image: GalleryImage) => Promise<void>;
  onRename: (image: GalleryImage, newName: string) => Promise<void>;
  onTagClick?: (tag: string) => void;
}

export default function ImageDetailsModal({
  image,
  isOpen,
  onClose,
  onDelete,
  onRename,
  onTagClick
}: ImageDetailsModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for renaming
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Keep state in sync with selected image
  useEffect(() => {
    if (image) {
      setEditedName(image.name);
      setIsEditing(false);
    }
  }, [image?.id]);

  if (!image) return null;

  const handleSaveRename = async () => {
    if (!editedName.trim() || editedName.trim() === image.name) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(image, editedName.trim());
      setIsEditing(false);
    } catch (err) {
      alert("Failed to rename resource. Please verify Firebase permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (_) {
      // fallback
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(image.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (_) {
      // fallback
    }
  };

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(image);
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      alert("Failed to delete resource. Please verify Firebase permissions.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="details-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          {/* Backdrop */}
          <motion.div
            id="details-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#070707] backdrop-blur-none"
          />

          {/* Modal content body */}
          <motion.div
            id="details-modal-box"
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative bg-[#0D0D0D] border border-[#222] text-[#E0E0E0] rounded-none shadow-none w-full max-w-5xl overflow-hidden z-50 flex flex-col md:flex-row h-[90vh] md:h-[80vh]"
          >
            {/* Close trigger button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-neutral-900 border border-[#222] text-neutral-350 hover:text-white transition rounded-none uppercase font-mono text-[10px] tracking-widest"
            >
              <X className="w-4 h-4 text-orange-500" />
            </button>

            {/* Left Column: Huge High-Quality Visual Showcase */}
            <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden h-[40vh] md:h-full p-6 border-b md:border-b-0 md:border-r border-[#222]">
              {image.contentType.startsWith("video/") ? (
                <video
                  src={image.url}
                  className="object-contain w-full h-full max-h-[35vh] md:max-h-full pointer-events-auto"
                  controls
                  autoPlay
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={image.url}
                  alt={image.name}
                  className="object-contain w-full h-full max-h-[35vh] md:max-h-full pointer-events-auto"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute bottom-4 left-4 p-2 bg-[#0A0A0A] text-[9px] uppercase tracking-widest font-mono rounded-none px-3 border border-[#222] flex items-center gap-2">
                <span>Ratio: {image.aspectRatio.toFixed(2)}</span>
              </div>
            </div>

            {/* Right Column: Detailed parameters and properties scroll area */}
            <div className="w-full md:w-[380px] bg-[#0D0D0D] p-6 flex flex-col justify-between h-[50vh] md:h-full overflow-y-auto">
              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRename();
                          } else if (e.key === 'Escape') {
                            setEditedName(image.name);
                            setIsEditing(false);
                          }
                        }}
                        className="w-full bg-[#111] border border-[#333] focus:border-orange-500 focus:outline-none p-2 px-3 text-white font-sans text-xs uppercase tracking-wider font-semibold rounded-none"
                        placeholder="RENAME RECORD"
                        autoFocus
                        disabled={isSaving}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveRename}
                          disabled={isSaving || !editedName.trim()}
                          className="px-3 py-1.5 bg-white hover:bg-orange-500 text-black hover:text-white text-[9px] uppercase tracking-widest font-bold font-mono transition rounded-none cursor-pointer"
                        >
                          {isSaving ? "Saving" : "Apply"}
                        </button>
                        <button
                          onClick={() => {
                            setEditedName(image.name);
                            setIsEditing(false);
                          }}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-[#151515] border border-[#222] text-neutral-400 hover:text-white text-[9px] uppercase tracking-widest font-mono transition rounded-none cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 group/title">
                      <h3 className="text-xl font-light font-serif text-white tracking-wide leading-tight break-all">{image.name}</h3>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1 pt-0.5 text-neutral-500 hover:text-orange-500 transition-colors shrink-0 cursor-pointer"
                        title="Rename record"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-neutral-400 font-serif italic leading-relaxed max-h-[100px] overflow-y-auto pr-1">
                    {image.description || "The composition stands without a written statement."}
                  </p>
                </div>

                {/* Classification Tags */}
                {image.tags && image.tags.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Classifications</span>
                    <div className="flex flex-wrap gap-1.5">
                      {image.tags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (onTagClick) onTagClick(tag);
                            onClose();
                          }}
                          className="text-[9px] uppercase tracking-widest bg-[#151515] hover:bg-orange-500 text-neutral-400 hover:text-white border border-[#222] px-2.5 py-1 rounded-none font-mono transition"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* File breakdown specs */}
                <div className="border-t border-[#222] pt-4.5 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Asset Specs</span>
                  
                  <div className="flex flex-col gap-3.5 text-xs text-neutral-300 font-mono">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-neutral-500 block text-[9px] uppercase font-sans tracking-widest font-bold">Captured Date</span>
                        <span className="truncate text-xs font-sans text-neutral-300 block mt-0.5">{formatDate(image.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <HardDrive className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-neutral-500 block text-[9px] uppercase font-sans tracking-widest font-bold">Dimensions &amp; MIME</span>
                        <span className="truncate text-xs font-mono text-neutral-300 block mt-0.5">{formatFileSize(image.size)} • {image.contentType}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FolderGit className="w-3.5 h-3.5 text-orange-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-neutral-500 block text-[9px] uppercase font-sans tracking-widest font-bold font-semibold">Storage Path</span>
                        <div className="flex items-center gap-1.5 mt-1 font-mono">
                          <span className="truncate bg-[#0A0A0A] p-2.5 px-3 border border-[#222] text-neutral-400 text-[10px] block font-mono flex-1 select-all">{image.path}</span>
                          <button
                            onClick={handleCopyPath}
                            className="p-2.5 bg-[#151515] border border-[#222] hover:border-neutral-500 hover:bg-neutral-900 rounded-none text-neutral-350 hover:text-white transition flex-shrink-0"
                            title="Copy Path"
                          >
                            {copiedPath ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-[#222] pt-4.5 mt-6 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                  {/* Download link button */}
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    download={image.name}
                    className="flex items-center justify-center gap-2 bg-[#151515] hover:bg-neutral-900 text-neutral-300 hover:text-white p-3 rounded-none transition border border-[#222] text-[10px] uppercase font-bold tracking-widest font-sans"
                  >
                    <Download className="w-3.5 h-3.5 text-orange-500" /> Download
                  </a>

                  {/* Copy public url trigger */}
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center justify-center gap-2 bg-[#151515] hover:bg-neutral-900 text-neutral-300 hover:text-white p-3 rounded-none transition border border-[#222] text-[10px] uppercase font-bold tracking-widest font-sans"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-orange-500" /> Public URL
                      </>
                    )}
                  </button>
                </div>

                {/* Threatening Delete trigger */}
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className={`w-full p-3 rounded-none text-[10px] font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 ${
                    confirmDelete 
                      ? 'bg-red-650/10 text-red-400 border border-red-500/30' 
                      : 'bg-[#0A0A0A] hover:bg-[#1A0A0A] text-neutral-500 hover:text-red-400 border border-[#222]'
                  }`}
                >
                  {isDeleting ? (
                    'Deleting from Firebase...'
                  ) : confirmDelete ? (
                    <>
                      <Trash2 className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Confirm Delete
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" /> Delete File
                    </>
                  )}
                </button>
                {confirmDelete && (
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[9px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition text-center underline font-mono cursor-pointer"
                  >
                    Cancel Action
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
