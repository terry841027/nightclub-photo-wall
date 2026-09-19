import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '現場照片牆',
  description: '掃碼上傳你的照片,即時輪播在大螢幕上',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
