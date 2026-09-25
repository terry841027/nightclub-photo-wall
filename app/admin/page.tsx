'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import PhotoCarousel from '@/components/PhotoCarousel';
import { resizeImage } from '@/lib/resizeImage';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  status: string;
  source?: 'guest' | 'staff';
  created_at: string;
}

const STORAGE_KEY = 'photowall_admin_passcode';
const POLL_MS = 5000;
const MAX_CAPTION_LENGTH = 60;

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [pending, setPending] = useState<Photo[]>([]);
  const [approved, setApproved] = useState<Photo[]>([]);
  const [requireApproval, setRequireApproval] = useState(true);
  const [slideDurationMs, setSlideDurationMs] = useState(6000);
  const [captionFontSizePx, setCaptionFontSizePx] = useState(36);
  const [captionPositionPercent, setCaptionPositionPercent] = useState(6);
  const [uploadUrl, setUploadUrl] = useState('');
  const captionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const [libraryFile, setLibraryFile] = useState<File | null>(null);
  const [libraryPreviewUrl, setLibraryPreviewUrl] = useState<string | null>(null);
  const [libraryCaption, setLibraryCaption] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState('');

  const verifyPasscode = useCallback(async (code: string): Promise<boolean> => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: code }),
    });
    return res.ok;
  }, []);

  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      verifyPasscode(saved).then((ok) => {
        if (ok) {
          setPasscode(saved);
          setAuthed(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [verifyPasscode]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    const ok = await verifyPasscode(passcode);
    if (ok) {
      localStorage.setItem(STORAGE_KEY, passcode);
      setAuthed(true);
    } else {
      setLoginError('密碼錯誤');
    }
  }

  const loadPending = useCallback(async (code: string) => {
    const res = await fetch('/api/photos?status=pending', {
      headers: { 'x-admin-passcode': code },
    });
    if (res.ok) {
      const data = await res.json();
      setPending(data.photos);
    }
  }, []);

  const loadApproved = useCallback(async () => {
    const res = await fetch('/api/photos?status=approved', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setApproved(data.photos ?? []);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      setRequireApproval(data.requireApproval);
      if (typeof data.slideDurationMs === 'number') {
        setSlideDurationMs(data.slideDurationMs);
      }
      if (typeof data.captionFontSizePx === 'number') {
        setCaptionFontSizePx(data.captionFontSizePx);
      }
      if (typeof data.captionPositionPercent === 'number') {
        setCaptionPositionPercent(data.captionPositionPercent);
      }
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadPending(passcode);
    loadApproved();
    loadSettings();
    const timer = setInterval(() => {
      loadPending(passcode);
      loadApproved();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [authed, passcode, loadPending, loadApproved, loadSettings]);

  async function toggleRequireApproval() {
    const next = !requireApproval;
    setRequireApproval(next);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ requireApproval: next }),
    });
  }

  async function setSlideDuration(ms: number) {
    setSlideDurationMs(ms);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ slideDurationMs: ms }),
    });
  }

  function updateCaptionSetting(partial: {
    captionFontSizePx?: number;
    captionPositionPercent?: number;
  }) {
    if (captionDebounceRef.current) clearTimeout(captionDebounceRef.current);
    captionDebounceRef.current = setTimeout(() => {
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify(partial),
      });
    }, 400);
  }

  function handleCaptionFontSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setCaptionFontSizePx(v);
    updateCaptionSetting({ captionFontSizePx: v });
  }

  function handleCaptionPositionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setCaptionPositionPercent(v);
    updateCaptionSetting({ captionPositionPercent: v });
  }

  async function approve(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ status: 'approved' }),
    });
    loadApproved();
  }

  async function reject(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-passcode': passcode },
    });
  }

  async function deleteApproved(id: string) {
    setApproved((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-passcode': passcode },
    });
  }

  async function moveApproved(index: number, direction: -1 | 1) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= approved.length) return;

    const a = approved[index];
    const b = approved[otherIndex];
    const next = [...approved];
    next[index] = b;
    next[otherIndex] = a;
    setApproved(next);

    await fetch('/api/photos/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ firstId: a.id, secondId: b.id }),
    });
  }

  function handleLibraryFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLibraryFile(file);
    setLibraryPreviewUrl(URL.createObjectURL(file));
    setLibraryMessage('');
  }

  async function handleLibrarySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!libraryFile) {
      setLibraryMessage('請先選擇一張照片');
      return;
    }
    setLibraryBusy(true);
    setLibraryMessage('');
    try {
      const resized = await resizeImage(libraryFile);
      const formData = new FormData();
      formData.append('photo', resized, 'photo.jpg');
      formData.append('caption', libraryCaption);

      const res = await fetch('/api/admin/photos', {
        method: 'POST',
        headers: { 'x-admin-passcode': passcode },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '上傳失敗');
      }

      setLibraryFile(null);
      setLibraryPreviewUrl(null);
      setLibraryCaption('');
      if (libraryFileInputRef.current) libraryFileInputRef.current.value = '';
      loadApproved();
    } catch (err) {
      setLibraryMessage(err instanceof Error ? err.message : '上傳失敗,請再試一次');
    } finally {
      setLibraryBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="admin-page">
        <p>載入中...</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="admin-page">
        <form className="admin-login" onSubmit={handleLogin}>
          <h1>工作人員登入</h1>
          <input
            type="password"
            inputMode="numeric"
            placeholder="輸入密碼"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          {loginError && <p className="error-text">{loginError}</p>}
          <button className="btn btn-primary" type="submit">
            登入
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-section">
        <h2>目前輪播預覽</h2>
        <PhotoCarousel className="carousel-preview" />
      </section>

      <section className="admin-section">
        <h2>快速連結</h2>
        <div className="quick-links">
          <a className="btn btn-primary" href="/upload" target="_blank" rel="noopener noreferrer">
            開啟觀眾上傳頁
          </a>
          <a className="btn btn-primary" href="/display" target="_blank" rel="noopener noreferrer">
            開啟播放頁(LED)
          </a>
        </div>
      </section>

      <section className="admin-section">
        <h2>上傳網址 QR Code</h2>
        {uploadUrl && (
          <div className="qr-box">
            <QRCodeSVG value={uploadUrl} size={180} />
            <p className="qr-url">{uploadUrl}</p>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="settings-row">
          <span>需要審核才顯示</span>
          <button
            type="button"
            className={`toggle ${requireApproval ? 'on' : 'off'}`}
            onClick={toggleRequireApproval}
          >
            {requireApproval ? '開' : '關'}
          </button>
        </div>
      </section>

      <section className="admin-section">
        <div className="settings-row">
          <span>輪播速度</span>
          <div className="preset-buttons">
            <button
              type="button"
              className={`btn preset-btn ${slideDurationMs === 5000 ? 'active' : ''}`}
              onClick={() => setSlideDuration(5000)}
            >
              輪播5秒
            </button>
            <button
              type="button"
              className={`btn preset-btn ${slideDurationMs === 10000 ? 'active' : ''}`}
              onClick={() => setSlideDuration(10000)}
            >
              輪播10秒
            </button>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2>留言文字設定</h2>
        <div className="slider-row">
          <div className="slider-label">
            <span>文字大小</span>
            <span className="slider-value">{captionFontSizePx}px</span>
          </div>
          <input
            type="range"
            min={16}
            max={96}
            step={2}
            value={captionFontSizePx}
            onChange={handleCaptionFontSizeChange}
          />
        </div>
        <div className="slider-row">
          <div className="slider-label">
            <span>文字高低位置</span>
            <span className="slider-value">{captionPositionPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={85}
            step={1}
            value={captionPositionPercent}
            onChange={handleCaptionPositionChange}
          />
          <div className="slider-hint">
            <span>最上面</span>
            <span>最下面</span>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2>照片庫上傳(預設輪播)</h2>
        <form onSubmit={handleLibrarySubmit}>
          <label className="library-upload-picker">
            {libraryPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={libraryPreviewUrl} alt="預覽" className="preview" />
            ) : (
              <span>點這裡選照片</span>
            )}
            <input
              ref={libraryFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLibraryFileChange}
              hidden
            />
          </label>
          <input
            type="text"
            className="caption-input"
            placeholder="留言(選填)"
            value={libraryCaption}
            maxLength={MAX_CAPTION_LENGTH}
            onChange={(e) => setLibraryCaption(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {libraryMessage && <p className="error-text">{libraryMessage}</p>}
          <button className="btn btn-primary" type="submit" disabled={libraryBusy} style={{ width: '100%' }}>
            {libraryBusy ? '上傳中...' : '加入照片庫'}
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>目前輪播中的照片 ({approved.length})</h2>
        {approved.length === 0 && <p className="empty-text">目前沒有正在輪播的照片</p>}
        <div className="h-scroll-list">
          {approved.map((photo, index) => (
            <div key={photo.id} className="h-scroll-item">
              <div className="h-scroll-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.image_url} alt="" />
                <span className="h-scroll-badge">{photo.source === 'staff' ? '照片庫' : '客人'}</span>
                <button
                  type="button"
                  className="h-scroll-delete"
                  onClick={() => deleteApproved(photo.id)}
                  aria-label="刪除"
                >
                  ×
                </button>
              </div>
              <div className="h-scroll-move-row">
                <button
                  type="button"
                  onClick={() => moveApproved(index, -1)}
                  disabled={index === 0}
                  aria-label="往前移"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => moveApproved(index, 1)}
                  disabled={index === approved.length - 1}
                  aria-label="往後移"
                >
                  ›
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>待審核照片 ({pending.length})</h2>
        {pending.length === 0 && <p className="empty-text">目前沒有待審核的照片</p>}
        <div className="pending-grid">
          {pending.map((photo) => (
            <div key={photo.id} className="pending-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.image_url} alt="" />
              {photo.caption && <p className="pending-caption">{photo.caption}</p>}
              <div className="pending-actions">
                <button type="button" className="btn btn-approve" onClick={() => approve(photo.id)}>
                  通過
                </button>
                <button type="button" className="btn btn-reject" onClick={() => reject(photo.id)}>
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
