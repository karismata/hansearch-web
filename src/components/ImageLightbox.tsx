import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && images.length > 1) nextImage();
      if (e.key === 'ArrowLeft' && images.length > 1) prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, currentIndex]);

  if (!isOpen || images.length === 0) return null;

  const currentUrl = images[currentIndex];

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setRotation(0);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm select-none animate-fadeIn">
      {/* Top action toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
        <span className="text-xs font-semibold text-slate-300 mr-2">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={handleZoomIn}
          title="확대 (+)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={handleZoomOut}
          title="축소 (-)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleRotate}
          title="90도 회전"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <RotateCw size={18} />
        </button>
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="새 탭에서 원본 보기"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <ExternalLink size={18} />
        </a>
        <a
          href={currentUrl}
          download={`image_${currentIndex + 1}`}
          title="다운로드"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <Download size={18} />
        </a>
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        <button
          onClick={onClose}
          title="닫기 (ESC)"
          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Prev / Next buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-6 z-10 p-3 text-white/70 hover:text-white bg-slate-900/60 hover:bg-slate-900/90 rounded-full border border-slate-700 shadow-xl transition-all hover:scale-110"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-6 z-10 p-3 text-white/70 hover:text-white bg-slate-900/60 hover:bg-slate-900/90 rounded-full border border-slate-700 shadow-xl transition-all hover:scale-110"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* Image container */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden cursor-zoom-out"
        onClick={onClose}
      >
        <img
          src={currentUrl}
          alt="Preview"
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease-in-out',
          }}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-default"
        />
      </div>
    </div>
  );
};
