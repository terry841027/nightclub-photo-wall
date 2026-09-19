'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  status: string;
  created_at: string;
}

const STORAGE_KEY = 'photowall_admin_passcode';
const POLL_MS = 5000;

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [pending, setPending] = useState<Photo[]>([]);
  const [requireApproval, setRequireApproval] = useState(true);
  const [uploadUrl, setUploadUrl] = useState('');

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

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      setRequireApproval(data.requireApproval);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadPending(passcode);
    loadSettings();
    const timer = setInterval(() => loadPending(passcode), POLL_MS);
    return () => clearInterval(timer);
  }, [authed, passcode, loadPending, loadSettings]);

  async function toggleRequireApproval() {
    const next = !requireApproval;
    setRequireApproval(next);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ requireApproval: next }),
    });
  }

  async function approve(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ status: 'approved' }),
    });
  }

  async function reject(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-passcode': passcode },
    });
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
