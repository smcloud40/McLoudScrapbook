'use client';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');

  async function sendLink(e) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus('not-configured');
      return;
    }
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/editor` : undefined },
    });
    setStatus(error ? 'error' : 'sent');
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 48, maxWidth: 420, margin: '0 auto' }}>
      <h1>Sign in</h1>
      <form onSubmit={sendLink}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ padding: '10px 16px' }}>Send magic link</button>
      </form>
      {status === 'sent' && <p>Check your email for a sign-in link.</p>}
      {status === 'error' && <p>Something went wrong sending the link. Try again.</p>}
      {status === 'not-configured' && (
        <p>Auth isn't configured yet — add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings.</p>
      )}
    </main>
  );
}
