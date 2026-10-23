import React, { useState, useEffect, useRef } from 'react';
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
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
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setPan({
      x: dragStart.current.panX + e.clientX - dragStart.current.x,
      y: dragStart.current.panY + e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = () => {
    dragStart.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const nextZoom = Math.min(5, Math.max(0.5, zoom * Math.exp(-e.deltaY * 0.0008)));
    setZoom(nextZoom);
    if (nextZoom <= 1) setPan({ x: 0, y: 0 });
  };

  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && zoom <= 1) onClose();
  };

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
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onClick={handleViewportClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      >
        <img
          src={currentUrl}
          alt="Preview"
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-in-out',
            maxWidth: '90vw',
            maxHeight: '85vh',
            flexShrink: 0,
          }}
          className="object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
};
