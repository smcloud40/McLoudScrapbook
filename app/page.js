import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 48, maxWidth: 560, margin: '0 auto' }}>
      <h1>Scrapbook</h1>
      <p>A digital scrapbook you build with real supplies — drag in backgrounds, stickers,
        and fonts, and buy the packs you fall in love with.</p>
      <p>
        <Link href="/editor">Open the editor</Link> ·{' '}
        <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
