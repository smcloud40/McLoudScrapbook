'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import { PACKS } from '../../lib/packs';

const ICONS = {
  star: `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z" fill="#D3A029"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.8-10-9.3C0.4 7.9 2.6 4 6.4 4c2 0 3.6 1.1 4.6 2.7C12 5.1 13.6 4 15.6 4 19.4 4 21.6 7.9 20 11.7 19.5 16.2 12 21 12 21z" fill="#B8502E"/></svg>`,
  tape: `<svg viewBox="0 0 24 24"><rect x="2" y="9" width="20" height="6" rx="1" fill="#D3A029" opacity="0.85"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24"><path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z" fill="#7C9070"/></svg>`,
  flower: `<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="4" fill="#B8502E"/><circle cx="12" cy="18" r="4" fill="#B8502E"/><circle cx="6" cy="12" r="4" fill="#B8502E"/><circle cx="18" cy="12" r="4" fill="#B8502E"/><circle cx="12" cy="12" r="3.4" fill="#D3A029"/></svg>`,
  pumpkin: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="9" ry="7" fill="#B8502E"/><rect x="11" y="3" width="2" height="5" fill="#7C9070"/></svg>`,
  camera: `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" fill="#5C5644"/><circle cx="12" cy="14" r="4.5" fill="#F5EFE0"/></svg>`,
};
const solid = (hex) => `<svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="${hex}"/></svg>`;
const pattern = (h1, h2) => `<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="${h1}"/><circle cx="6" cy="6" r="2" fill="${h2}"/><circle cx="18" cy="6" r="2" fill="${h2}"/><circle cx="6" cy="18" r="2" fill="${h2}"/><circle cx="18" cy="18" r="2" fill="${h2}"/><circle cx="12" cy="12" r="2" fill="${h2}"/></svg>`;

const CATALOG = {
  backgrounds: [
    { id: 'bg-basics', items: [{ id: 'bg1', icon: solid('#F5EFE0') }, { id: 'bg2', icon: solid('#E7DCC0') }, { id: 'bg3', icon: solid('#DCEAE0') }] },
    { id: 'bg-autumn', items: [{ id: 'bg4', icon: pattern('#E9C98F', '#B8502E') }, { id: 'bg5', icon: pattern('#DDBF8C', '#8A3B21') }] },
    { id: 'bg-farmhouse', items: [{ id: 'bg7', icon: pattern('#F3ECDD', '#7C9070') }, { id: 'bg8', icon: pattern('#EDE3CC', '#B8502E') }] },
  ],
  stickers: [
    { id: 'st-everyday', items: [{ id: 's1', icon: ICONS.star }, { id: 's2', icon: ICONS.heart }, { id: 's3', icon: ICONS.tape }] },
    { id: 'st-autumn', items: [{ id: 's4', icon: ICONS.pumpkin }, { id: 's5', icon: ICONS.leaf }] },
    { id: 'st-travel', items: [{ id: 's6', icon: ICONS.camera }, { id: 's7', icon: ICONS.flower }] },
  ],
  fonts: [
    { id: 'ft-basics', items: [{ id: 'f1', label: 'Hello there' }] },
    { id: 'ft-script', items: [{ id: 'f2', label: 'Sweet memories' }] },
  ],
};

function findItemPack(itemId) {
  for (const cat of Object.values(CATALOG)) for (const p of cat) for (const it of p.items) if (it.id === itemId) return p.id;
}

export default function Editor() {
  const pageRef = useRef(null);
  const [activeCat, setActiveCat] = useState('backgrounds');
  const [user, setUser] = useState(null);
  const [ownedPacks, setOwnedPacks] = useState(new Set());
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [creditCount, setCreditCount] = useState(0);
  const [elements, setElements] = useState([]); // placed elements on the single page
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const counterRef = useRef(0);

  // Load auth + ownership state from Supabase (falls back to guest/demo mode
  // if Supabase env vars aren't set yet).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data?.user;
      setUser(u || null);
      if (!u) return;
      const { data: profile } = await supabase.from('profiles').select('is_subscriber').eq('id', u.id).single();
      setIsSubscriber(!!profile?.is_subscriber);
      const { data: owned } = await supabase.from('user_owned_packs').select('pack_id').eq('user_id', u.id);
      setOwnedPacks(new Set((owned || []).map((r) => r.pack_id)));
      const { count } = await supabase
        .from('credits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id)
        .is('redeemed_at', null)
        .gt('expires_at', new Date().toISOString());
      setCreditCount(count || 0);
    });
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  function isOwned(packId) {
    return PACKS[packId]?.free || ownedPacks.has(packId);
  }

  function placeElement(itemId, x, y) {
    const packId = findItemPack(itemId);
    counterRef.current += 1;
    const isFont = CATALOG.fonts.some((p) => p.items.some((i) => i.id === itemId));
    setElements((prev) => [
      ...prev,
      { uid: 'el' + counterRef.current, itemId, packId, x, y, w: isFont ? 140 : 64, h: isFont ? 40 : 64, z: counterRef.current, isFont },
    ]);
  }

  function unownedPacksInUse() {
    const ids = new Set();
    elements.forEach((el) => { if (!isOwned(el.packId)) ids.add(el.packId); });
    return [...ids];
  }

  async function handleExport() {
    const unowned = unownedPacksInUse();
    if (unowned.length === 0) {
      showToast('Exported! Your scrapbook is ready.');
      return;
    }
    if (!user) {
      showToast('Sign in to purchase packs and export.');
      return;
    }
    setCartOpen(true);
  }

  async function handlePurchase(useCredit) {
    const unowned = unownedPacksInUse();
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, packIds: unowned, useCredit }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Stripe Checkout — ownership is granted by the webhook after payment.
    } else {
      showToast(data.error || 'Checkout is not available yet.');
    }
  }

  const unowned = unownedPacksInUse();

  return (
    <div style={styles.app}>
      <style>{fontImport}</style>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>Supply shelf</div>
        <div style={styles.tabs}>
          {['backgrounds', 'stickers', 'fonts'].map((cat) => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              style={{ ...styles.tab, ...(activeCat === cat ? styles.tabActive : {}) }}>
              {cat[0].toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <div style={styles.packs}>
          {CATALOG[activeCat].map((pack) => {
            const owned = isOwned(pack.id);
            const info = PACKS[pack.id];
            return (
              <div key={pack.id} style={styles.pack}>
                <div style={styles.packHead}>
                  <span style={styles.packTitle}>
                    {!owned && <Seal />} {info?.name}
                  </span>
                  <span style={styles.packPrice}>{info?.free ? 'free' : `$${(info.priceCents / 100).toFixed(2)}`}</span>
                </div>
                <div style={styles.packBody}>
                  {pack.items.map((it) =>
                    activeCat === 'fonts' ? (
                      <div key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
                        style={{ ...styles.swatch, ...styles.fontSwatch, opacity: owned ? 1 : 0.55 }}>{it.label}</div>
                    ) : (
                      <div key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
                        style={{ ...styles.swatch, opacity: owned ? 1 : 0.55 }}
                        dangerouslySetInnerHTML={{ __html: it.icon }} />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div style={{ color: '#EDE6D2', fontSize: 13 }}>
            {user ? `Signed in as ${user.email}` : <a href="/login" style={{ color: '#EDE6D2' }}>Sign in to save your work</a>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {unowned.length > 0 && (
              <div style={{ color: '#EDE6D2', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={styles.cartDot}>{unowned.length}</span> unowned packs used
              </div>
            )}
            <button style={styles.btnPrimary} onClick={handleExport}>Save &amp; export</button>
          </div>
        </div>

        <div style={styles.canvasWrap}>
          <div
            ref={pageRef}
            style={styles.page}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const itemId = e.dataTransfer.getData('text/plain');
              const rect = pageRef.current.getBoundingClientRect();
              placeElement(itemId, e.clientX - rect.left - 30, e.clientY - rect.top - 30);
            }}
          >
            {elements.length === 0 && <div style={styles.emptyHint}>Drag something onto the page to get started</div>}
            {elements.map((el) => (
              <PlacedElement key={el.uid} el={el} owned={isOwned(el.packId)}
                onMove={(x, y) => setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, x, y } : p)))}
                onResize={(w, h) => setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, w, h } : p)))}
                onDelete={() => setElements((prev) => prev.filter((p) => p.uid !== el.uid))}
                onFront={() => { counterRef.current += 1; const z = counterRef.current; setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, z } : p))); }}
              />
            ))}
          </div>
        </div>
      </main>

      {cartOpen && (
        <CartModal
          unowned={unowned}
          creditCount={creditCount}
          isSubscriber={isSubscriber}
          onCancel={() => setCartOpen(false)}
          onBuy={(useCredit) => { setCartOpen(false); handlePurchase(useCredit); }}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function Seal() {
  return (
    <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#96721A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" style={{ width: 9, height: 9, fill: '#fff' }}><path d="M6 10V7a6 6 0 1112 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1zm2 0h8V7a4 4 0 00-8 0z" /></svg>
    </span>
  );
}

function PlacedElement({ el, owned, onMove, onResize, onDelete, onFront }) {
  const item = Object.values(CATALOG).flat().flatMap((p) => p.items).find((i) => i.id === el.itemId);
  return (
    <div
      style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, cursor: 'move' }}
      onMouseDown={(e) => {
        onFront();
        const startX = e.clientX, startY = e.clientY, origX = el.x, origY = el.y;
        function move(ev) { onMove(origX + (ev.clientX - startX), origY + (ev.clientY - startY)); }
        function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      }}
    >
      {!owned && (
        <span style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, borderRadius: '50%', background: '#96721A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" style={{ width: 9, height: 9, fill: '#fff' }}><path d="M6 10V7a6 6 0 1112 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1zm2 0h8V7a4 4 0 00-8 0z" /></svg>
        </span>
      )}
      {el.isFont ? (
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 26, whiteSpace: 'nowrap', color: '#2E2A22' }}>{item?.label}</div>
      ) : (
        <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: item?.icon || '' }} />
      )}
      <span onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ position: 'absolute', top: -9, left: -9, width: 18, height: 18, borderRadius: '50%', background: '#8B7355', color: '#fff', border: '2px solid #fff', fontSize: 11, lineHeight: '14px', textAlign: 'center', cursor: 'pointer', fontWeight: 700 }}>x</span>
      <span
        onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX, startY = e.clientY, origW = el.w, origH = el.h;
          function move(ev) { onResize(Math.max(24, origW + (ev.clientX - startX)), Math.max(24, origH + (ev.clientY - startY))); }
          function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
          document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        }}
        style={{ position: 'absolute', bottom: -7, right: -7, width: 14, height: 14, borderRadius: '50%', background: '#B8502E', border: '2px solid #fff', cursor: 'nwse-resize' }}
      />
    </div>
  );
}

function CartModal({ unowned, creditCount, isSubscriber, onCancel, onBuy }) {
  const [useCredit, setUseCredit] = useState(creditCount > 0);
  let total = 0;
  const rows = unowned.map((id, i) => {
    const pack = PACKS[id];
    const applyCredit = useCredit && i === 0 && creditCount > 0;
    const price = applyCredit ? 0 : isSubscriber ? pack.priceCents * 0.5 : pack.priceCents;
    total += price;
    return { id, name: pack.name, orig: pack.priceCents, price, note: applyCredit ? 'credit applied' : isSubscriber ? '50% pro discount' : '' };
  });
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 28, margin: '0 0 4px' }}>Your cart</h2>
        <p style={{ fontSize: 13, color: '#5C5644', margin: '0 0 16px' }}>These packs are used in your design but not owned yet.</p>
        {rows.map((r) => (
          <div key={r.id} style={styles.cartRow}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span>
              {r.note && <span style={{ textDecoration: 'line-through', color: '#A99', marginRight: 6, fontSize: 12 }}>${(r.orig / 100).toFixed(2)}</span>}
              ${(r.price / 100).toFixed(2)} {r.note && <span style={{ fontSize: 11, color: '#7C9070' }}>{r.note}</span>}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 12px', marginTop: 14, fontSize: 12 }}>
          <span>{creditCount} credit{creditCount === 1 ? '' : 's'} available</span>
          <label><input type="checkbox" checked={useCredit} disabled={creditCount < 1} onChange={(e) => setUseCredit(e.target.checked)} /> apply</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 6px', fontWeight: 700, fontSize: 15 }}>
          <span>Total</span><span>${(total / 100).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ ...styles.btnGhostLight, flex: 1 }}>Keep editing</button>
          <button onClick={() => onBuy(useCredit)} style={{ ...styles.btnPrimary, flex: 1 }}>Purchase all</button>
        </div>
      </div>
    </div>
  );
}

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Inter:wght@400;500;600&display=swap');`;

const styles = {
  app: { display: 'flex', height: '100vh', fontFamily: 'Inter, sans-serif', background: '#3E4A3D' },
  sidebar: { width: 260, background: '#C9A876', borderRight: '3px solid #9C7E4E', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '18px 16px 10px', fontFamily: 'Caveat, cursive', fontSize: 26, fontWeight: 700, color: '#2E2A22', borderBottom: '1px dashed #9C7E4E' },
  tabs: { display: 'flex', borderBottom: '1px solid #9C7E4E' },
  tab: { flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: 600, color: '#5C5644', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '3px solid transparent' },
  tabActive: { color: '#8A3B21', borderBottom: '3px solid #B8502E' },
  packs: { flex: 1, overflowY: 'auto', padding: 12 },
  pack: { background: 'rgba(255,255,255,0.35)', border: '1px solid #9C7E4E', borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  packHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px' },
  packTitle: { fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 },
  packPrice: { fontSize: 11, color: '#8A3B21', fontWeight: 600 },
  packBody: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 10px 10px' },
  swatch: { aspectRatio: '1', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', background: '#fff' },
  fontSwatch: { fontFamily: 'Caveat, cursive', fontSize: 20 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#465243' },
  cartDot: { background: '#B8502E', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#B8502E', color: '#fff' },
  btnGhostLight: { fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: '1px solid #9C7E4E', cursor: 'pointer', background: 'transparent' },
  canvasWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 30 },
  page: { width: 600, height: 440, background: '#F5EFE0', position: 'relative', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' },
  emptyHint: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat, cursive', fontSize: 22, color: '#B7A98A' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(20,20,15,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { width: 420, maxHeight: '80vh', overflowY: 'auto', background: '#F5EFE0', borderRadius: 14, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' },
  cartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E2D6B8', fontSize: 13 },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#7C9070', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 },
};
