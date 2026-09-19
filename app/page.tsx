import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="landing-card">
        <h1>現場照片牆</h1>
        <p>拍一張照片,留句話,馬上出現在大螢幕上</p>
        <Link className="btn btn-primary" href="/upload">
          開始上傳
        </Link>
      </div>
    </main>
  );
}
