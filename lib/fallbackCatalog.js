// Used only when Supabase env vars aren't set yet, so the editor still has
// something to show in guest/demo mode. Once Supabase is configured, the
// editor loads the real catalog from the `packs` and `elements` tables instead.

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

export const FALLBACK_PACKS_INFO = {
  'bg-basics':    { name: 'Basics',            priceCents: 0,   free: true },
  'bg-autumn':    { name: 'Cozy autumn',       priceCents: 300, free: false },
  'bg-farmhouse': { name: 'Farmhouse florals', priceCents: 250, free: false },
  'st-everyday':  { name: 'Everyday',          priceCents: 0,   free: true },
  'st-autumn':    { name: 'Cozy autumn',       priceCents: 300, free: false },
  'st-travel':    { name: 'Travel',            priceCents: 250, free: false },
  'ft-basics':    { name: 'Basics',            priceCents: 0,   free: true },
  'ft-script':    { name: 'Script pack',       priceCents: 200, free: false },
};

export const FALLBACK_CATALOG = {
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
