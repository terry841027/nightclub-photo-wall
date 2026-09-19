'use client';

import { useRef, useState } from 'react';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const MAX_CAPTION_LENGTH = 60;

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height >= width && height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('無法處理圖片'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('無法處理圖片'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取圖片'));
    };
    img.src = url;
  });
}

type Step = 'idle' | 'processing' | 'done' | 'error';

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [message, setMessage] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setMessage('請先選擇一張照片');
      return;
    }
    setStep('processing');
    setMessage('');
    try {
      const resized = await resizeImage(selectedFile);
      const formData = new FormData();
      formData.append('photo', resized, 'photo.jpg');
      formData.append('caption', caption);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || '上傳失敗');
      }

      setStep('done');
      setMessage(
        data.requireApproval
          ? '已送出!審核通過後就會出現在螢幕上 🎉'
          : '上傳成功!馬上就會出現在螢幕上 🎉'
      );
    } catch (err) {
      setStep('error');
      setMessage(err instanceof Error ? err.message : '上傳失敗,請再試一次');
    }
  }

  function resetForm() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setStep('idle');
    setMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (step === 'done') {
    return (
      <main className="upload-page">
        <div className="upload-card">
          <p className="upload-success">{message}</p>
          <button className="btn btn-primary" onClick={resetForm}>
            再上傳一張
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="upload-page">
      <form className="upload-card" onSubmit={handleSubmit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="brand-logo" />
        <h1>上傳你的照片</h1>

        <label className="photo-picker">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="預覽" className="preview" />
          ) : (
            <span>點這裡拍照 / 選照片</span>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />
        </label>

        <input
          type="text"
          className="caption-input"
          placeholder="留言(選填)"
          value={caption}
          maxLength={MAX_CAPTION_LENGTH}
          onChange={(e) => setCaption(e.target.value)}
        />

        {message && <p className="upload-message">{message}</p>}

        <button className="btn btn-primary" type="submit" disabled={step === 'processing'}>
          {step === 'processing' ? '上傳中...' : '送出'}
        </button>
      </form>
    </main>
  );
}
