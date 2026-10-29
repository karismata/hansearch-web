import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

type Point = { x: number; y: number };
type Gesture =
  | { kind: 'swipe'; startX: number; startY: number }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | {
      kind: 'pinch';
      startDistance: number;
      startZoom: number;
      panX: number;
      panY: number;
      startCenterX: number;
      startCenterY: number;
      viewportCenterX: number;
      viewportCenterY: number;
    };

const distanceBetween = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

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
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    gestureRef.current = null;
    pointersRef.current.clear();
  }, [initialIndex, isOpen]);

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

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    gestureRef.current = null;
    pointersRef.current.clear();
  };

  const showImage = (index: number) => {
    setCurrentIndex(index);
    resetTransform();
  };

  const nextImage = () => showImage((currentIndex + 1) % images.length);
  const prevImage = () => showImage((currentIndex - 1 + images.length) % images.length);

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

  useEffect(() => {
    const root = rootRef.current;
    if (!isOpen || !root) return;

    // React's delegated wheel listener may be passive in some browsers. A native
    // non-passive listener is required to stop the page underneath from scrolling.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const nextZoom = Math.min(5, Math.max(0.5, zoom * Math.exp(-event.deltaY * 0.0008)));
      setZoom(nextZoom);
      if (nextZoom <= 1) setPan({ x: 0, y: 0 });
    };

    root.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => root.removeEventListener('wheel', handleWheel, true);
  }, [isOpen, zoom]);

  if (!isOpen || images.length === 0) return null;

  const currentUrl = images[currentIndex];
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const startPinch = (points: Point[], rect: DOMRect) => {
    const [a, b] = points;
    const centerX = (a.x + b.x) / 2 - rect.left;
    const centerY = (a.y + b.y) / 2 - rect.top;
    gestureRef.current = {
      kind: 'pinch',
      startDistance: Math.max(1, distanceBetween(a, b)),
      startZoom: zoom,
      panX: pan.x,
      panY: pan.y,
      startCenterX: centerX,
      startCenterY: centerY,
      viewportCenterX: rect.width / 2,
      viewportCenterY: rect.height / 2,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = Array.from(pointersRef.current.values());
      if (points.length >= 2) {
        startPinch(points, event.currentTarget.getBoundingClientRect());
      } else {
        gestureRef.current = zoom > 1
          ? { kind: 'pan', startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
          : { kind: 'swipe', startX: event.clientX, startY: event.clientY };
      }
      setIsDragging(zoom > 1);
      return;
    }

    if (event.button !== 0 || zoom <= 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = Array.from(pointersRef.current.values());
      let gesture = gestureRef.current;
      if (points.length >= 2) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (gesture?.kind !== 'pinch') {
          startPinch(points, rect);
          gesture = gestureRef.current;
        }
        if (gesture?.kind === 'pinch') {
          const [a, b] = points;
          const centerX = (a.x + b.x) / 2 - rect.left;
          const centerY = (a.y + b.y) / 2 - rect.top;
          const ratio = distanceBetween(a, b) / gesture.startDistance;
          const nextZoom = Math.min(5, Math.max(1, gesture.startZoom * ratio));
          const appliedRatio = nextZoom / gesture.startZoom;
          setZoom(nextZoom);
          setPan({
            x: gesture.panX + (centerX - gesture.startCenterX) + (gesture.startCenterX - gesture.viewportCenterX - gesture.panX) * (1 - appliedRatio),
            y: gesture.panY + (centerY - gesture.startCenterY) + (gesture.startCenterY - gesture.viewportCenterY - gesture.panY) * (1 - appliedRatio),
          });
        }
        return;
      }

      if (gesture?.kind === 'pan' && points.length === 1) {
        setPan({
          x: gesture.panX + event.clientX - gesture.startX,
          y: gesture.panY + event.clientY - gesture.startY,
        });
      }
      return;
    }

    const gesture = gestureRef.current;
    if (gesture?.kind !== 'pan') return;
    setPan({
      x: gesture.panX + event.clientX - gesture.startX,
      y: gesture.panY + event.clientY - gesture.startY,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>, allowSwipe = true) => {
    const gesture = gestureRef.current;
    if (event.pointerType === 'touch') {
      const point = pointersRef.current.get(event.pointerId);
      pointersRef.current.delete(event.pointerId);
      if (allowSwipe && gesture?.kind === 'swipe' && point) {
        const deltaX = point.x - gesture.startX;
        const deltaY = point.y - gesture.startY;
        if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && images.length > 1) {
          suppressClickUntilRef.current = Date.now() + 400;
          if (deltaX < 0) nextImage();
          else prevImage();
        }
      }
      if (pointersRef.current.size === 1 && zoom > 1) {
        const remaining = Array.from(pointersRef.current.values())[0];
        gestureRef.current = { kind: 'pan', startX: remaining.x, startY: remaining.y, panX: pan.x, panY: pan.y };
      } else if (pointersRef.current.size === 0) {
        gestureRef.current = null;
      }
    } else {
      gestureRef.current = null;
    }
    setIsDragging(false);
  };

  const handleViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntilRef.current) return;
    if (!isTouchDevice && event.target === event.currentTarget && zoom <= 1) onClose();
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm select-none animate-fadeIn"
    >
      {/* Touch devices only need a close control; image gestures handle zoom and navigation. */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
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
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onClick={handleViewportClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => handlePointerUp(event, false)}
        style={{
          cursor: !isTouchDevice && zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
      >
        <img
          src={currentUrl}
          alt="Preview"
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-in-out',
            maxWidth: isTouchDevice ? '100vw' : '90vw',
            maxHeight: isTouchDevice ? '100dvh' : '85vh',
            width: isTouchDevice ? '100vw' : undefined,
            height: isTouchDevice ? '100dvh' : undefined,
            objectFit: 'contain',
            flexShrink: 0,
            borderRadius: isTouchDevice ? 0 : undefined,
          }}
          className="object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
};
