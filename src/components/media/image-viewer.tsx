'use client';

import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageViewerProps {
  images: { url: string; type: string }[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex, isOpen, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Touch tracking for swipe-to-close and swipe-to-navigate
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchDistRef = useRef(0);
  const initialPinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setMounted(true);
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      document.body.style.overflow = '';
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((i) => i + 1);
      setScale(1);
    }
  }, [currentIndex, images.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setScale(1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      touchDistRef.current = 0;
    }
    // Pinch to zoom
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pinch to zoom
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(0.5, Math.min(4, dist / initialPinchDistRef.current));
      setScale(newScale);
    }
    // Track single-finger swipe distance
    if (e.touches.length === 1 && touchStartRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      touchDistRef.current = dx;
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;

    if (touchStartRef.current) {
      const dx = touchDistRef.current;
      const elapsed = Date.now() - touchStartRef.current.time;

      // Swipe thresholds
      if (Math.abs(dx) > 60 && elapsed < 400) {
        if (dx > 0) {
          goPrev();
        } else {
          goNext();
        }
      }

      // Swipe down to close (check vertical)
      // Not implemented with touchDistRef tracking horizontal only; use X button instead
    }

    touchStartRef.current = null;
    touchDistRef.current = 0;

    // Reset scale if pinched below 1
    if (scale < 1) setScale(1);
  };

  if (!mounted) return null;

  const imageFiles = images.filter((f) => f.type !== 'video');
  const current = imageFiles[currentIndex];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dark backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black transition-opacity duration-300',
          visible ? 'opacity-95' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[70] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors safe-top"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Image counter */}
      {imageFiles.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] bg-white/10 backdrop-blur-sm text-white text-sm font-medium px-3 py-1 rounded-full safe-top">
          {currentIndex + 1} / {imageFiles.length}
        </div>
      )}

      {/* Image container */}
      <div
        className={cn(
          'fixed inset-0 flex items-center justify-center transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{
            transform: `scale(${scale})`,
            transition: scale === 1 ? 'transform 0.2s ease-out' : 'none',
          }}
        >
          <Image
            src={current.url}
            alt=""
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>
      </div>

      {/* Navigation arrows */}
      {imageFiles.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-[70] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < imageFiles.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-[70] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[70] flex gap-2 safe-bottom">
            {imageFiles.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); setScale(1); }}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentIndex ? 'bg-primary scale-125' : 'bg-white/40'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
