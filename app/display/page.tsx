'use client';

import { useCallback, useEffect, useState } from 'react';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

const POLL_MS = 5000;
const SLIDE_MS = 6000;

export default function DisplayPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);

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

  useEffect(() => {
    loadPhotos();
    const timer = setInterval(loadPhotos, POLL_MS);
    return () => clearInterval(timer);
  }, [loadPhotos]);

  useEffect(() => {
    if (photos.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <main className="display-page display-empty">
        <p>等待照片上傳...</p>
      </main>
    );
  }

  return (
    <main className="display-page">
      {photos.map((photo, i) => (
        <div key={photo.id} className={`slide ${i === index % photos.length ? 'active' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.image_url} alt="" />
          {photo.caption && <p className="slide-caption">{photo.caption}</p>}
        </div>
      ))}
    </main>
  );
}
