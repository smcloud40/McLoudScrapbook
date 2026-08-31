'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import { FALLBACK_CATALOG, FALLBACK_PACKS_INFO } from '../../lib/fallbackCatalog';

const CATEGORY_KEY = { background: 'backgrounds', sticker: 'stickers', font: 'fonts' };

// Builds the same {backgrounds:[...], stickers:[...], fonts:[...]} shape the
// UI expects, from the real `packs` + `elements` tables.
function buildCatalog(packRows, elementRows) {
  const catalog = { backgrounds: [], stickers: [], fonts: [] };
  const packsInfo = {};
  const packIndex = {};
  packRows.forEach((p) => {
    const key = CATEGORY_KEY[p.category];
    if (!key) return;
    const entry = { id: p.id, subcategory: p.subcategory, items: [] };
    catalog[key].push(entry);
    packIndex[p.id] = entry;
    packsInfo[p.id] = { name: p.name, priceCents: p.price_cents, free: p.is_free };
  });
  elementRows.forEach((e) => {
    const entry = packIndex[e.pack_id];
    if (!entry) return;
    if (e.kind === 'font') {
      entry.items.push({ id: e.id, label: e.font_label || 'Sample text', fontFamily: e.font_family });
    } else if (e.asset_url) {
      entry.items.push({ id: e.id, assetUrl: e.asset_url });
    }
  });
  return { catalog, packsInfo };
}

function findItemPack(catalog, itemId) {
  for (const cat of Object.values(catalog)) for (const p of cat) for (const it of p.items) if (it.id === itemId) return p.id;
}
function findItem(catalog, itemId) {
  for (const cat of Object.values(catalog)) for (const p of cat) for (const it of p.items) if (it.id === itemId) return it;
}
function isFontItem(catalog, itemId) {
  return catalog.fonts.some((p) => p.items.some((it) => it.id === itemId));
}

export default function Editor() {
  const pageRef = useRef(null);
  const [catalog, setCatalog] = useState({ backgrounds: [], stickers: [], fonts: [] });
  const [packsInfo, setPacksInfo] = useState({});
  const [activeCat, setActiveCat] = useState('backgrounds');
  const [user, setUser] = useState(null);
  const [ownedPacks, setOwnedPacks] = useState(new Set());
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [creditCount, setCreditCount] = useState(0);
  const [elements, setElements] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pageId, setPageId] = useState(null);
  const [scrapbookId, setScrapbookId] = useState(null);
  const [pages, setPages] = useState([]);
  const [saveState, setSaveState] = useState('idle');
  const counterRef = useRef(0);
  const loadedRef = useRef(false);

  // Load the real catalog from Supabase (falls back to demo data if the
  // backend isn't configured, or if the catalog tables are still empty).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function load() {
      if (!supabase) {
        setCatalog(FALLBACK_CATALOG);
        setPacksInfo(FALLBACK_PACKS_INFO);
        return;
      }
      const [{ data: packRows }, { data: elementRows }] = await Promise.all([
        supabase.from('packs').select('*'),
        supabase.from('elements').select('*'),
      ]);
      if (!packRows?.length) {
        setCatalog(FALLBACK_CATALOG);
        setPacksInfo(FALLBACK_PACKS_INFO);
        return;
      }
      const built = buildCatalog(packRows, elementRows || []);
      setCatalog(built.catalog);
      setPacksInfo(built.packsInfo);
    }
    load();
  }, []);

  // Load auth + ownership state, then load-or-create the user's scrapbook
  // pages and restore whatever was placed last time.
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

      let { data: books } = await supabase.from('scrapbooks').select('id').eq('user_id', u.id).limit(1);
      let sbId = books?.[0]?.id;
      if (!sbId) {
        const { data: newBook } = await supabase.from('scrapbooks').insert({ user_id: u.id }).select('id').single();
        sbId = newBook?.id;
      }
      setScrapbookId(sbId);

      let { data: pageRows } = await supabase.from('scrapbook_pages').select('id, page_number').eq('scrapbook_id', sbId).order('page_number', { ascending: true });
      if (!pageRows?.length) {
        const { data: newPage } = await supabase.from('scrapbook_pages').insert({ scrapbook_id: sbId, page_number: 1 }).select('id, page_number').single();
        pageRows = [newPage];
      }
      setPages(pageRows);
      const firstPage = pageRows[0];
      setPageId(firstPage.id);

      const { data: placed } = await supabase.from('scrapbook_elements').select('*').eq('page_id', firstPage.id);
      if (placed?.length) {
        const restored = placed.map((row) => {
          counterRef.current = Math.max(counterRef.current, row.layer_order);
          return { uid: row.id, itemId: row.element_id, x: row.x, y: row.y, w: row.w, h: row.h, z: row.layer_order };
        });
        setElements(restored);
      }
      loadedRef.current = true;

      if (typeof window !== 'undefined' && window.location.search.includes('purchase=success')) {
        showToast('Purchase complete!');
        setTimeout(async () => {
          const { data: owned2 } = await supabase.from('user_owned_packs').select('pack_id').eq('user_id', u.id);
          setOwnedPacks(new Set((owned2 || []).map((r) => r.pack_id)));
          const { count: count2 } = await supabase
            .from('credits')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .is('redeemed_at', null)
            .gt('expires_at', new Date().toISOString());
          setCreditCount(count2 || 0);
        }, 1500);
      }
    });
  }, []);

  // Autosave.
  useEffect(() => {
    if (!loadedRef.current || !pageId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      await supabase.from('scrapbook_elements').delete().eq('page_id', pageId);
      if (elements.length) {
        await supabase.from('scrapbook_elements').insert(
          elements.map((el) => ({ page_id: pageId, element_id: el.itemId, x: el.x, y: el.y, w: el.w, h: el.h, layer_order: el.z }))
        );
      }
      setSaveState('saved');
    }, 800);
    return () => clearTimeout(timer);
  }, [elements, pageId]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  async function switchPage(pid) {
    if (pid === pageId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    loadedRef.current = false;
    setPageId(pid);
    setElements([]);
    const { data: placed } = await supabase.from('scrapbook_elements').select('*').eq('page_id', pid);
    const restored = (placed || []).map((row) => {
      counterRef.current = Math.max(counterRef.current, row.layer_order);
      return { uid: row.id, itemId: row.element_id, x: row.x, y: row.y, w: row.w, h: row.h, z: row.layer_order };
    });
    setElements(restored);
    loadedRef.current = true;
  }

  async function addPage() {
    if (pages.length >= 3 && !isSubscriber) {
      showToast('Free plan is limited to 3 pages — go Pro for unlimited pages.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !scrapbookId) return;
    const nextNumber = Math.max(...pages.map((p) => p.page_number)) + 1;
    const { data: newPage } = await supabase.from('scrapbook_pages').insert({ scrapbook_id: scrapbookId, page_number: nextNumber }).select('id, page_number').single();
    if (newPage) {
      setPages((prev) => [...prev, newPage]);
      switchPage(newPage.id);
    }
  }

  function isOwned(packId) {
    return packsInfo[packId]?.free || ownedPacks.has(packId);
  }

  function placeElement(itemId, x, y) {
    const packId = findItemPack(catalog, itemId);
    if (!packId) return;
    counterRef.current += 1;
    const isFont = isFontItem(catalog, itemId);
    setElements((prev) => [...prev, { uid: 'el' + counterRef.current, itemId, x, y, w: isFont ? 140 : 64, h: isFont ? 40 : 64, z: counterRef.current }]);
  }

  function unownedPacksInUse() {
    const ids = new Set();
    elements.forEach((el) => {
      const packId = findItemPack(catalog, el.itemId);
      if (packId && !isOwned(packId)) ids.add(packId);
    });
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
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Checkout is not available yet.');
    }
  }

  const unowned = unownedPacksInUse();
  const fontFamilies = [...new Set(catalog.fonts.flatMap((p) => p.items).map((i) => i.fontFamily).filter(Boolean))];

  return (
    <div style={styles.app}>
      <style>{fontImport(fontFamilies)}</style>
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
          {catalog[activeCat].map((pack) => {
            const owned = isOwned(pack.id);
            const info = packsInfo[pack.id];
            if (!pack.items.length) return null;
            return (
              <div key={pack.id} style={styles.pack}>
                <div style={styles.packHead}>
                  <span style={styles.packTitle}>
                    {!owned && <Seal />} {info?.name}
                    {pack.subcategory && <span style={styles.subcatTag}>{pack.subcategory}</span>}
                  </span>
                  <span style={styles.packPrice}>{info?.free ? 'free' : `$${((info?.priceCents || 0) / 100).toFixed(2)}`}</span>
                </div>
                <div style={styles.packBody}>
                  {pack.items.map((it) =>
                    activeCat === 'fonts' ? (
                      <div key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
                        style={{ ...styles.swatch, fontFamily: it.fontFamily || 'Caveat, cursive', fontSize: 18, opacity: owned ? 1 : 0.55 }}>{it.label}</div>
                    ) : (
                      <div key={it.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
                        style={{ ...styles.swatch, opacity: owned ? 1 : 0.55, padding: it.assetUrl ? 0 : undefined, overflow: 'hidden' }}>
                        {it.assetUrl
                          ? <img src={it.assetUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: it.icon || '' }} />}
                      </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {pages.map((p) => (
                <button key={p.id} onClick={() => switchPage(p.id)}
                  style={{ ...styles.pageTab, ...(p.id === pageId ? styles.pageTabActive : {}) }}>
                  Page {p.page_number}
                </button>
              ))}
              <button onClick={addPage} style={styles.addPageBtn}>+</button>
            </div>
            <div style={{ color: '#EDE6D2', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              {user ? `Signed in as ${user.email}` : <a href="/login" style={{ color: '#EDE6D2' }}>Sign in to save your work</a>}
              {user && saveState === 'saving' && <span style={{ opacity: 0.6 }}>Saving…</span>}
              {user && saveState === 'saved' && <span style={{ opacity: 0.6 }}>Saved</span>}
            </div>
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
            {elements.map((el) => {
              const item = findItem(catalog, el.itemId);
              const packId = findItemPack(catalog, el.itemId);
              if (!item) return null;
              return (
                <PlacedElement key={el.uid} el={el} item={item} owned={isOwned(packId)}
                  onMove={(x, y) => setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, x, y } : p)))}
                  onResize={(w, h) => setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, w, h } : p)))}
                  onDelete={() => setElements((prev) => prev.filter((p) => p.uid !== el.uid))}
                  onFront={() => { counterRef.current += 1; const z = counterRef.current; setElements((prev) => prev.map((p) => (p.uid === el.uid ? { ...p, z } : p))); }}
                />
              );
            })}
          </div>
        </div>
      </main>

      {cartOpen && (
        <CartModal
          unowned={unowned}
          packsInfo={packsInfo}
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

function PlacedElement({ el, item, owned, onMove, onResize, onDelete, onFront }) {
  const isFont = item.label !== undefined;
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
      {isFont ? (
        <div style={{ fontFamily: item.fontFamily || 'Caveat, cursive', fontSize: 26, whiteSpace: 'nowrap', color: '#2E2A22' }}>{item.label}</div>
      ) : item.assetUrl ? (
        <img src={item.assetUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      ) : (
        <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: item.icon || '' }} />
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

function CartModal({ unowned, packsInfo, creditCount, isSubscriber, onCancel, onBuy }) {
  const [useCredit, setUseCredit] = useState(creditCount > 0);
  let total = 0;
  const rows = unowned.map((id, i) => {
    const pack = packsInfo[id] || { name: id, priceCents: 0 };
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

function fontImport(extraFamilies) {
  const families = ['Caveat:wght@500;700', 'Inter:wght@400;500;600', ...extraFamilies.map((f) => f.replace(/ /g, '+'))];
  return `@import url('https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap');`;
}

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
  subcatTag: { fontSize: 10, fontWeight: 500, color: '#7C9070', fontStyle: 'italic' },
  packPrice: { fontSize: 11, color: '#8A3B21', fontWeight: 600 },
  packBody: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 10px 10px' },
  swatch: { aspectRatio: '1', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', background: '#fff' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#465243' },
  pageTab: { padding: '6px 14px', borderRadius: '6px 6px 0 0', background: 'rgba(255,255,255,0.08)', color: '#EDE6D2', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' },
  pageTabActive: { background: '#F5EFE0', color: '#2E2A22' },
  addPageBtn: { width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#EDE6D2', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 },
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
