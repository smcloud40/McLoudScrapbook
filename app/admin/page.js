'use client';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';

const CATEGORIES = [
  { value: 'background', label: 'Background / cardstock' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'font', label: 'Font' },
];

// Starter list — the subcategory field also accepts free text, so this is
// just a convenience list of common themes, not a hard constraint.
const SUBCATEGORY_PRESETS = ['fall', 'spring', 'summer', 'winter', 'ocean', 'island', 'holiday', 'everyday', 'travel', 'baby', 'basics'];

function slugify(category, name) {
  const base = `${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

export default function Admin() {
  const [status, setStatus] = useState('checking'); // checking | denied | signed-out | ready
  const [user, setUser] = useState(null);
  const [packs, setPacks] = useState([]);
  const [elements, setElements] = useState([]);
  const [toast, setToast] = useState('');

  // New pack form
  const [category, setCategory] = useState('sticker');
  const [subcategory, setSubcategory] = useState('fall');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [packName, setPackName] = useState('');
  const [price, setPrice] = useState('2.50');
  const [isFree, setIsFree] = useState(false);
  const [isSeasonal, setIsSeasonal] = useState(false);
  const [creatingPack, setCreatingPack] = useState(false);

  // Upload-to-pack form
  const [targetPackId, setTargetPackId] = useState('');
  const [files, setFiles] = useState([]);
  const [fontLabel, setFontLabel] = useState('Sweet memories');
  const [fontFamily, setFontFamily] = useState('Kalam');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setStatus('denied'); return; }
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data?.user;
      if (!u) { setStatus('signed-out'); return; }
      setUser(u);
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', u.id).single();
      if (!profile?.is_admin) { setStatus('denied'); return; }
      setStatus('ready');
      loadCatalog(supabase);
    });
  }, []);

  async function loadCatalog(supabase) {
    const { data: packRows } = await supabase.from('packs').select('*').order('category').order('name');
    const { data: elementRows } = await supabase.from('elements').select('*');
    setPacks(packRows || []);
    setElements(elementRows || []);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function createPack(e) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    setCreatingPack(true);
    const sub = customSubcategory.trim() || subcategory;
    const id = slugify(category, packName);
    const { error } = await supabase.from('packs').insert({
      id, category, subcategory: sub, name: packName,
      price_cents: isFree ? 0 : Math.round(parseFloat(price || '0') * 100),
      is_free: isFree, is_seasonal: isSeasonal,
    });
    setCreatingPack(false);
    if (error) { showToast(error.message); return; }
    showToast(`Created pack "${packName}"`);
    setPackName('');
    setTargetPackId(id);
    loadCatalog(supabase);
  }

  async function uploadElements(e) {
    e.preventDefault();
    if (!targetPackId) { showToast('Choose a pack first.'); return; }
    const supabase = getSupabaseBrowserClient();
    const pack = packs.find((p) => p.id === targetPackId);
    setUploading(true);

    if (pack.category === 'font') {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('elements').insert({ id, pack_id: targetPackId, kind: 'font', font_label: fontLabel, font_family: fontFamily });
      setUploading(false);
      if (error) { showToast(error.message); return; }
      showToast('Font element added.');
      loadCatalog(supabase);
      return;
    }

    if (!files.length) { setUploading(false); showToast('Choose at least one image.'); return; }
    let successCount = 0;
    for (const file of files) {
      const path = `${pack.category}/${pack.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('element-assets').upload(path, file);
      if (uploadError) { showToast(uploadError.message); continue; }
      const { data: pub } = supabase.storage.from('element-assets').getPublicUrl(path);
      const id = crypto.randomUUID();
      const { error: insertError } = await supabase.from('elements').insert({ id, pack_id: targetPackId, kind: 'image', asset_url: pub.publicUrl });
      if (!insertError) successCount++;
    }
    setUploading(false);
    showToast(`Uploaded ${successCount} of ${files.length} image(s).`);
    setFiles([]);
    loadCatalog(supabase);
  }

  async function deleteElement(id) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('elements').delete().eq('id', id);
    loadCatalog(supabase);
  }

  async function deletePack(id) {
    if (!confirm('Delete this pack and all its elements?')) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.from('packs').delete().eq('id', id);
    loadCatalog(supabase);
  }

  if (status === 'checking') return <Shell><p>Checking access…</p></Shell>;
  if (status === 'signed-out') return <Shell><p>You need to <a href="/login">sign in</a> first.</p></Shell>;
  if (status === 'denied') return <Shell><p>This account doesn't have admin access. Ask whoever set up the project to run the grant-admin SQL for your email.</p></Shell>;

  const selectedPack = packs.find((p) => p.id === targetPackId);

  return (
    <Shell>
      <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: 34, marginBottom: 4 }}>Supply shelf admin</h1>
      <p style={{ color: '#5C5644', marginTop: 0 }}>Signed in as {user.email}</p>

      <section style={styles.card}>
        <h2 style={styles.h2}>1. Create a pack</h2>
        <form onSubmit={createPack} style={styles.form}>
          <label style={styles.label}>Type
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label style={styles.label}>Subcategory
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} style={styles.input}>
              {SUBCATEGORY_PRESETS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={styles.label}>Or type a new subcategory
            <input value={customSubcategory} onChange={(e) => setCustomSubcategory(e.target.value)} placeholder="e.g. back-to-school" style={styles.input} />
          </label>
          <label style={styles.label}>Pack name
            <input required value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="e.g. Cozy Autumn" style={styles.input} />
          </label>
          <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} /> Free pack
          </label>
          {!isFree && (
            <label style={styles.label}>Price (USD)
              <input type="number" step="0.25" min="0" value={price} onChange={(e) => setPrice(e.target.value)} style={styles.input} />
            </label>
          )}
          <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={isSeasonal} onChange={(e) => setIsSeasonal(e.target.checked)} /> Seasonal / limited-time
          </label>
          <button type="submit" disabled={creatingPack} style={styles.btnPrimary}>{creatingPack ? 'Creating…' : 'Create pack'}</button>
        </form>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>2. Upload elements into a pack</h2>
        <form onSubmit={uploadElements} style={styles.form}>
          <label style={styles.label}>Pack
            <select required value={targetPackId} onChange={(e) => setTargetPackId(e.target.value)} style={styles.input}>
              <option value="">Choose a pack…</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.subcategory} · {p.name}</option>)}
            </select>
          </label>
          {selectedPack?.category === 'font' ? (
            <>
              <label style={styles.label}>Sample text shown in the app
                <input value={fontLabel} onChange={(e) => setFontLabel(e.target.value)} style={styles.input} />
              </label>
              <label style={styles.label}>Google Font family name
                <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="e.g. Kalam, Pacifico, Dancing Script" style={styles.input} />
              </label>
            </>
          ) : (
            <label style={styles.label}>Image files (PNG with transparent background works best)
              <input type="file" multiple accept="image/*" onChange={(e) => setFiles([...e.target.files])} style={styles.input} />
            </label>
          )}
          <button type="submit" disabled={uploading} style={styles.btnPrimary}>{uploading ? 'Uploading…' : 'Add to pack'}</button>
        </form>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Existing catalog</h2>
        {packs.map((pack) => (
          <div key={pack.id} style={styles.packRow}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{pack.name}</strong>{' '}
                <span style={{ color: '#7C9070', fontSize: 12 }}>{pack.category} · {pack.subcategory} · {pack.is_free ? 'free' : `$${(pack.price_cents / 100).toFixed(2)}`}</span>
              </div>
              <button onClick={() => deletePack(pack.id)} style={styles.btnDanger}>Delete pack</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {elements.filter((e) => e.pack_id === pack.id).map((e) => (
                <div key={e.id} style={styles.elementThumb}>
                  {e.kind === 'font'
                    ? <span style={{ fontSize: 11 }}>{e.font_label}</span>
                    : <img src={e.asset_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                  <span onClick={() => deleteElement(e.id)} style={styles.thumbDelete}>×</span>
                </div>
              ))}
              {elements.filter((e) => e.pack_id === pack.id).length === 0 && <span style={{ fontSize: 12, color: '#A99' }}>No elements yet</span>}
            </div>
          </div>
        ))}
      </section>

      {toast && <div style={styles.toast}>{toast}</div>}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE0', padding: '32px 24px' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'Inter, sans-serif', color: '#2E2A22' }}>{children}</div>
    </div>
  );
}

const styles = {
  card: { background: '#fff', border: '1px solid #E2D6B8', borderRadius: 12, padding: 20, marginTop: 20 },
  h2: { fontSize: 16, marginTop: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 },
  input: { padding: 8, borderRadius: 6, border: '1px solid #D9CDB0', fontSize: 14, fontFamily: 'Inter, sans-serif' },
  btnPrimary: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#B8502E', color: '#fff', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  btnDanger: { padding: '6px 10px', borderRadius: 6, border: '1px solid #B8502E', background: 'transparent', color: '#B8502E', fontSize: 12, cursor: 'pointer' },
  packRow: { borderTop: '1px solid #E2D6B8', paddingTop: 12, marginTop: 12 },
  elementThumb: { width: 56, height: 56, border: '1px solid #E2D6B8', borderRadius: 6, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9F5EA' },
  thumbDelete: { position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#8B7355', color: '#fff', fontSize: 11, lineHeight: '16px', textAlign: 'center', cursor: 'pointer' },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#7C9070', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 },
};
