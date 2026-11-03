import React, { useState, useEffect, useLayoutEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useImageGestures } from '../hooks/useImageGestures';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, initialIndex = 0, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isTouchDevice, setIsTouchDevice] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches));
  const gestures = useImageGestures({ enabled: isOpen, touchDevice: isTouchDevice,
    onTouch: () => setIsTouchDevice(true),
    onSwipe: direction => { if (images.length > 1) setCurrentIndex(index => (index + direction + images.length) % images.length); } });
  const { reset } = gestures;
  useLayoutEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    reset();
  }, [initialIndex, isOpen, images.length, reset]);
  useEffect(() => {
    if (!isOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [isOpen]);
  const nextImage = () => { reset(); setCurrentIndex(index => (index + 1) % images.length); };
  const prevImage = () => { reset(); setCurrentIndex(index => (index - 1 + images.length) % images.length); };
  useEffect(() => {
    if (!isOpen) return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && images.length > 1) nextImage();
      if (event.key === 'ArrowLeft' && images.length > 1) prevImage();
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [isOpen, images.length, onClose, reset]);
  if (!isOpen || images.length === 0) return null;
  const currentUrl = images[currentIndex];
  const handleZoomIn = () => gestures.zoomBy(0.25);
  const handleZoomOut = () => gestures.zoomBy(-0.25);
  const handleRotate = gestures.rotate;
  const handleViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isTouchDevice && event.target === event.currentTarget && gestures.canCloseBackdrop()) onClose();
  };
  return (
    <div
      ref={gestures.rootRef}
      className={'fixed inset-0 z-50 flex items-center justify-center select-none animate-fadeIn ' + (isTouchDevice ? 'bg-black' : 'bg-black/85 backdrop-blur-sm')}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      {/* Touch devices only need a close control; image gestures handle zoom and navigation. */}
      <div className={'absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-full border border-slate-700 shadow-xl ' + (isTouchDevice ? '' : 'backdrop-blur-md')}>
        {!isTouchDevice && (
          <>
            <span className="text-xs font-semibold text-slate-300 mr-2">
              {currentIndex + 1} / {images.length}
            </span>
            <button onClick={handleZoomIn} title="확대 (+)" className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><ZoomIn size={18} /></button>
            <button onClick={handleZoomOut} title="축소 (-)" className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><ZoomOut size={18} /></button>
            <button onClick={handleRotate} title="90도 회전" className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><RotateCw size={18} /></button>
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" title="새 탭에서 원본 보기" className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><ExternalLink size={18} /></a>
            <a href={currentUrl} download={`image_${currentIndex + 1}`} title="다운로드" className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><Download size={18} /></a>
            <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          </>
        )}
        <button onClick={onClose} title="닫기 (ESC)" aria-label="이미지 닫기" className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      {!isTouchDevice && images.length > 1 && (
        <>
          <button onClick={prevImage} aria-label="이전 이미지" className="absolute left-6 z-10 p-3 text-white/70 hover:text-white bg-slate-900/60 hover:bg-slate-900/90 rounded-full border border-slate-700 shadow-xl transition-all hover:scale-110"><ChevronLeft size={28} /></button>
          <button onClick={nextImage} aria-label="다음 이미지" className="absolute right-6 z-10 p-3 text-white/70 hover:text-white bg-slate-900/60 hover:bg-slate-900/90 rounded-full border border-slate-700 shadow-xl transition-all hover:scale-110"><ChevronRight size={28} /></button>
        </>
      )}

      <div
        ref={gestures.viewportRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onClick={handleViewportClick}
        onPointerDown={gestures.pointerDown}
        onPointerMove={gestures.pointerMove}
        onPointerUp={event => gestures.pointerUp(event)}
        onPointerCancel={event => gestures.pointerUp(event, false)}
        onLostPointerCapture={event => gestures.pointerUp(event, false)}
        style={{
          cursor: 'default',
          touchAction: 'none',
        }}
      >
        <img
          ref={gestures.imageRef}
          key={currentUrl}
          src={currentUrl}
          decoding="async"
          onLoad={gestures.paint}
          alt="Preview"
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          style={{
            transform: 'translate3d(0px, 0px, 0) scale(1) rotate(0deg)',
            transition: 'none',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            maxWidth: isTouchDevice ? '100vw' : '90vw',
            maxHeight: isTouchDevice ? '100dvh' : '85vh',
            width: isTouchDevice ? '100vw' : undefined,
            height: isTouchDevice ? '100dvh' : undefined,
            objectFit: 'contain',
            flexShrink: 0,
            borderRadius: isTouchDevice ? 0 : undefined,
          }}
          className={isTouchDevice ? 'object-contain' : 'object-contain rounded-lg shadow-2xl'}
        />
      </div>
    </div>
  );
};

