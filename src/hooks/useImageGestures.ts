import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

type Point = { x: number; y: number };
type Transform = { zoom: number; rotation: number; x: number; y: number };
type Gesture =
  | { kind: 'swipe'; start: Point }
  | { kind: 'pan'; start: Point; x: number; y: number }
  | { kind: 'pinch'; distance: number; transform: Transform; center: Point; rect: DOMRect };
const identity = (): Transform => ({ zoom: 1, rotation: 0, x: 0, y: 0 });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const limitZoom = (zoom: number, minimum: number) => Math.min(5, Math.max(minimum, zoom));

export function useImageGestures({ enabled, touchDevice, onTouch, onSwipe }: {
  enabled: boolean;
  touchDevice: boolean;
  onTouch: () => void;
  onSwipe: (direction: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const transform = useRef<Transform>(identity());
  const points = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const mousePointer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const options = useRef({ touchDevice, onTouch, onSwipe });
  options.current = { touchDevice, onTouch, onSwipe };

  // Gesture updates never enter React state. Many pointer events may arrive
  // between paints; render only the latest transform once per animation frame.
  const paint = useCallback(() => {
    const value = transform.current;
    if (imageRef.current) {
      imageRef.current.style.transform = `translate3d(${value.x}px, ${value.y}px, 0) scale(${value.zoom}) rotate(${value.rotation}deg)`;
    }
    if (viewportRef.current) {
      viewportRef.current.style.cursor = options.current.touchDevice || value.zoom <= 1
        ? 'default' : gesture.current?.kind === 'pan' ? 'grabbing' : 'grab';
    }
  }, []);
  const schedulePaint = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => { frame.current = null; paint(); });
  }, [paint]);
  const reset = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    transform.current = identity();
    points.current.clear(); gesture.current = null; mousePointer.current = null;
    paint();
  }, [paint]);
  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, [enabled]);

  const zoomTo = useCallback((zoom: number, anchor = { x: 0, y: 0 }) => {
    const previous = transform.current;
    const nextZoom = limitZoom(zoom, 0.5);
    const ratio = nextZoom / previous.zoom;
    transform.current = { ...previous, zoom: nextZoom,
      x: nextZoom <= 1 ? 0 : anchor.x - (anchor.x - previous.x) * ratio,
      y: nextZoom <= 1 ? 0 : anchor.y - (anchor.y - previous.y) * ratio };
    schedulePaint();
  }, [schedulePaint]);
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation();
      const rect = viewportRef.current?.getBoundingClientRect();
      const anchor = rect ? { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 } : undefined;
      zoomTo(transform.current.zoom * Math.exp(-event.deltaY * 0.0008), anchor);
    };
    root.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => root.removeEventListener('wheel', wheel, true);
  }, [enabled, zoomTo]);

  const beginPinch = (target: HTMLDivElement) => {
    const [a, b] = Array.from(points.current.values());
    if (!a || !b) return;
    gesture.current = { kind: 'pinch', distance: Math.max(1, distance(a, b)),
      transform: { ...transform.current }, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      rect: target.getBoundingClientRect() };
    suppressClickUntil.current = Date.now() + 400;
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      event.preventDefault(); options.current.onTouch();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = { x: event.clientX, y: event.clientY };
      points.current.set(event.pointerId, point);
      if (points.current.size === 2) beginPinch(event.currentTarget);
      else if (points.current.size === 1) {
        const value = transform.current;
        gesture.current = value.zoom > 1 ? { kind: 'pan', start: point, x: value.x, y: value.y } : { kind: 'swipe', start: point };
      }
      schedulePaint(); return;
    }
    if (event.button !== 0 || transform.current.zoom <= 1) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    mousePointer.current = event.pointerId;
    gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, x: transform.current.x, y: transform.current.y };
    schedulePaint();
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (!points.current.has(event.pointerId)) return;
      event.preventDefault();
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.current.size >= 2) {
        if (gesture.current?.kind !== 'pinch') beginPinch(event.currentTarget);
        const initial = gesture.current;
        if (initial?.kind !== 'pinch') return;
        const [a, b] = Array.from(points.current.values());
        const zoom = limitZoom(initial.transform.zoom * distance(a, b) / initial.distance, 1);
        const ratio = zoom / initial.transform.zoom;
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const origin = { x: initial.rect.left + initial.rect.width / 2, y: initial.rect.top + initial.rect.height / 2 };
        transform.current = { ...initial.transform, zoom,
          x: zoom <= 1 ? 0 : center.x - origin.x - (initial.center.x - origin.x - initial.transform.x) * ratio,
          y: zoom <= 1 ? 0 : center.y - origin.y - (initial.center.y - origin.y - initial.transform.y) * ratio };
        schedulePaint(); return;
      }
    } else if (mousePointer.current !== event.pointerId) return;
    const initial = gesture.current;
    if (initial?.kind !== 'pan') return;
    transform.current = { ...transform.current, x: initial.x + event.clientX - initial.start.x, y: initial.y + event.clientY - initial.start.y };
    if (Math.abs(event.clientX - initial.start.x) + Math.abs(event.clientY - initial.start.y) > 3) suppressClickUntil.current = Date.now() + 400;
    schedulePaint();
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>, allowSwipe = true) => {
    const initial = gesture.current;
    if (event.pointerType === 'touch') {
      if (!points.current.has(event.pointerId)) return;
      points.current.delete(event.pointerId);
      if (allowSwipe && initial?.kind === 'swipe') {
        const dx = event.clientX - initial.start.x, dy = event.clientY - initial.start.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          suppressClickUntil.current = Date.now() + 400;
          reset(); options.current.onSwipe(dx < 0 ? 1 : -1);
        }
      }
      if (points.current.size >= 2) beginPinch(event.currentTarget);
      else if (points.current.size === 1 && transform.current.zoom > 1) {
        const remaining = Array.from(points.current.values())[0];
        gesture.current = { kind: 'pan', start: remaining, x: transform.current.x, y: transform.current.y };
      } else gesture.current = null;
    } else if (mousePointer.current === event.pointerId) {
      mousePointer.current = null; gesture.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    schedulePaint();
  };
  return { rootRef, viewportRef, imageRef, paint, reset, pointerDown, pointerMove, pointerUp,
    canCloseBackdrop: () => transform.current.zoom <= 1 && Date.now() >= suppressClickUntil.current,
    zoomBy: (amount: number) => zoomTo(transform.current.zoom + amount),
    rotate: () => { transform.current = { ...transform.current, rotation: (transform.current.rotation + 90) % 360 }; schedulePaint(); } };
}

