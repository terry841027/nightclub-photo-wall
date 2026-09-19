'use client';

import { useCallback, useEffect, useState } from 'react';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

const POLL_MS = 5000;
const DEFAULT_SLIDE_MS = 6000;
const DEFAULT_CAPTION_FONT_SIZE_PX = 36;
const DEFAULT_CAPTION_POSITION_PERCENT = 6;

export default function PhotoCarousel({ className = '' }: { className?: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [slideMs, setSlideMs] = useState(DEFAULT_SLIDE_MS);
  const [captionFontSizePx, setCaptionFontSizePx] = useState(DEFAULT_CAPTION_FONT_SIZE_PX);
  const [captionPositionPercent, setCaptionPositionPercent] = useState(
    DEFAULT_CAPTION_POSITION_PERCENT
  );

  const isFullscreen = className.includes('carousel-fullscreen');

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch('/api/photos?status=approved', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch {
      // ignore transient network errors; the next poll will retry
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.slideDurationMs === 'number') {
        setSlideMs(data.slideDurationMs);
      }
      if (typeof data.captionFontSizePx === 'number') {
        setCaptionFontSizePx(data.captionFontSizePx);
      }
      if (typeof data.captionPositionPercent === 'number') {
        setCaptionPositionPercent(data.captionPositionPercent);
      }
    } catch {
      // ignore transient network errors; the next poll will retry
    }
  }, []);

  useEffect(() => {
    loadPhotos();
    loadSettings();
    const timer = setInterval(() => {
      loadPhotos();
      loadSettings();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadPhotos, loadSettings]);

  useEffect(() => {
    if (photos.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, slideMs);
    return () => clearInterval(timer);
  }, [photos.length, slideMs]);

  const captionStyle = isFullscreen
    ? { fontSize: `${captionFontSizePx}px`, top: `${captionPositionPercent}%` }
    : undefined;

  if (photos.length === 0) {
    return (
      <div className={`carousel carousel-empty ${className}`}>
        <p>等待照片上傳...</p>
      </div>
    );
  }

  return (
    <div className={`carousel ${className}`}>
      {photos.map((photo, i) => (
        <div key={photo.id} className={`slide ${i === index % photos.length ? 'active' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.image_url} alt="" />
          {photo.caption && (
            <p className="slide-caption" style={captionStyle}>
              {photo.caption}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
