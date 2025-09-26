const SHOP_ITEMS = [
  {
    id: 'hint_token',
    name: 'Pergamena di Suggerimento',
    description: 'Consuma per ottenere un suggerimento bonus su un livello fallito.',
    price: 15,
    icon: '/static/assets/items/suggestion-scroll.png'
  },
  {
    id: 'reveal_test',
    name: 'Lente Rivelatrice',
    description: 'Consuma per rivelare i dettagli dei test falliti dopo un tentativo.',
    price: 20,
    icon: '/static/assets/items/revealing-lens.png'
  },
  {
    id: 'reveal_suite',
    name: 'Specchio Onnisciente',
    description: 'Consuma dopo un tentativo fallito per rivelare l\'intera suite di test disponibile.',
    price: 35,
    icon: '/static/assets/items/omniscent-mirror.png'
  }
];

function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k,v);
  }
  for (const c of children){
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  }
  return node;
}

function canonicalRole(role){
  try {
    const slug = String(role || '').toLowerCase();
    for (const [id, aliases] of Object.entries(ROLE_ALIASES)){
      if (slug === id || aliases.includes(slug)) return id;
    }
    return DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

const ROLE_ALIASES = {
  mage: ['mage','mago','wizard'],
  rogue: ['rogue','ladro'],
  swordsman: ['swordsman','spadaccino','warrior','fighter'],
  alchemist: ['alchemist','alchimista'],
  ranger: ['ranger']
};
const DEFAULT_ROLE = 'mage';
let ROLE_LABELS = {
  mage: 'Mago',
  rogue: 'Ladro',
  swordsman: 'Spadaccino',
  alchemist: 'Alchimista',
  ranger: 'Ranger'
};

function roleLabel(role){
  const canon = canonicalRole(role);
  const label = ROLE_LABELS[canon];
  if (label) return label;
  return canon ? canon.charAt(0).toUpperCase() + canon.slice(1) : '';
}

function roleSlug(role){
  return canonicalRole(role);
}

const ROLE_FOLDER_ALIASES = {
  mage: ROLE_ALIASES.mage,
  rogue: ROLE_ALIASES.rogue,
  swordsman: ROLE_ALIASES.swordsman,
  alchemist: ROLE_ALIASES.alchemist,
  ranger: ROLE_ALIASES.ranger
};

function pad2(n){
  const v = (Number(n) || 0) + 1;
  if (v < 9) return `0${v}`;
  if (v === 9) return '09';
  if (v === 10) return '10';
  return String(v).padStart(2, '0');
}

function externalAvatarUrlCandidates(role, variant){
  const r = roleSlug(role);
  const folders = ROLE_FOLDER_ALIASES[r] || [r];
  const nn = pad2((variant % 10 + 10) % 10);
  const urls = [];
  const seen = new Set();
  for(const f of [r, ...folders]){
    const folder = String(f);
    if(seen.has(folder)) continue;
    seen.add(folder);
    urls.push(`/static/assets/avatars/${folder}/${nn}.png`);
  }
  return urls;
}

async function probeFirstExisting(urls){
  for(const url of urls){
    try{
      const res = await fetch(url, { method: 'HEAD' });
      if(res && res.ok) return url;
    }catch{}
  }
  return null;
}

async function upgradeAvatarElement(imgEl, role, variant){
  const url = await probeFirstExisting(externalAvatarUrlCandidates(role, variant));
  if(url){ imgEl.src = url; }
}

function prng(seed){
  let x = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
  return () => (x = Math.imul(x ^ (x>>>15), 0x85EBCA6B) >>> 0) / 0xFFFFFFFF;
}

const ROLE_PALETTES = {
  mage:   ['#3b82f6','#60a5fa','#1e40af'],
  rogue:  ['#22c55e','#4ade80','#166534'],
  swordsman:['#f97316','#fdba74','#7c2d12'],
  alchemist:['#a78bfa','#c4b5fd','#4c1d95'],
  ranger: ['#10b981','#34d399','#065f46']
};

function pixelIconSVG(role, variant){
  const sz = 8;
  const px = 8;
  const pad = 2;
  const canon = canonicalRole(role);
  const colors = ROLE_PALETTES[canon] || ROLE_PALETTES[DEFAULT_ROLE];
  const seedChar = canon.charCodeAt(0) || DEFAULT_ROLE.charCodeAt(0);
  const rnd = prng(seedChar * 31 + (variant % 10));
  let rects = '';
  for(let y=0; y<sz; y++){
    for(let x=0; x<Math.ceil(sz/2); x++){
      const on = rnd() > 0.5 || (y < 2 && x < 2);
      if(on){
        const c = colors[(x + y) % colors.length];
        const rx = pad + x * px;
        const ry = pad + y * px;
        const mx = pad + (sz - 1 - x) * px;
        rects += `<rect x="${rx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`;
        if(mx !== rx){
          rects += `<rect x="${mx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`;
        }
      }
    }
  }
  const w = pad * 2 + sz * px;
  const bg = '#0b1020';
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}' viewBox='0 0 ${w} ${w}'><rect x='0' y='0' width='${w}' height='${w}' fill='${bg}'/>${rects}</svg>`;
}

function avatarDataUrl(role, variant){
  const svg = pixelIconSVG(role, variant);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function playerLevel(xp){ return 1 + Math.floor((Number(xp) || 0) / 50); }
function xpInLevel(xp){ return (Number(xp) || 0) % 50; }
function xpNeeded(xp){ return 50 - xpInLevel(xp); }

const store = {
  get profile(){
    try { return JSON.parse(localStorage.getItem('pq_profile') || 'null'); }
    catch { return null; }
  },
  set profile(v){
    if (!v || typeof v !== 'object'){
      localStorage.removeItem('pq_profile');
      renderProfile();
      renderXP();
      return;
    }
    const canon = canonicalRole(v.role);
    const avatar = (v.avatar && typeof v.avatar === 'object') ? { ...v.avatar } : {};
    if (canonicalRole(avatar.role) !== canon){ avatar.role = canon; }
    if (typeof avatar.variant !== 'number'){ avatar.variant = 0; }
    const profile = { ...v, role: canon, avatar };
    localStorage.setItem('pq_profile', JSON.stringify(profile));
    renderProfile();
    renderXP();
  },
  get xp(){ return Number(localStorage.getItem('pq_xp') || '0'); },
  set xp(v){
    localStorage.setItem('pq_xp', String(v));
    renderProfile();
    renderXP();
  },
  get gold(){ return Number(localStorage.getItem('pq_gold') || '0'); },
  set gold(v){ localStorage.setItem('pq_gold', String(v)); renderProfile(); renderShop(); },
  get achievements(){
    try { return JSON.parse(localStorage.getItem('pq_achievements') || '[]'); }
    catch { return []; }
  },
  set achievements(v){ localStorage.setItem('pq_achievements', JSON.stringify(v)); },
  get inventory(){
    try { return JSON.parse(localStorage.getItem('pq_inventory') || '{}'); }
    catch { return {}; }
  },
  set inventory(v){
    if (v && typeof v === 'object') localStorage.setItem('pq_inventory', JSON.stringify(v));
    else localStorage.removeItem('pq_inventory');
    renderInventory();
  }
};

function inventoryCount(id){
  const inv = store.inventory;
  return Number(inv[id] || 0);
}

function adjustInventory(id, delta){
  const inv = { ...store.inventory };
  const next = Number(inv[id] || 0) + delta;
  if(next > 0) inv[id] = next;
  else delete inv[id];
  store.inventory = inv;
  return next;
}

function renderProfile(){
  const target = document.getElementById('profileView');
  if(!target) return;
  const p = store.profile;
  if(!p){
    target.innerHTML = '<em>Nessun profilo</em>';
    const xpBar = document.getElementById('xpBar');
    if(xpBar) xpBar.innerHTML = '<div class="xpbar"><div class="fill" style="width:0%"></div></div><div class="xptext">0/50 XP</div>';
    return;
  }
  const lvl = playerLevel(store.xp);
  const av = (p.avatar && typeof p.avatar.variant === 'number') ? p.avatar : { role: p.role, variant: 0 };
  const roleName = roleLabel(p.role);
  const img = el('img', {
    class: 'avatar',
    src: avatarDataUrl(av.role, av.variant),
    alt: roleName
  });
  upgradeAvatarElement(img, av.role, av.variant);
  const info = el('div', {class:'profileInfo'},
    el('div', {html:`<strong>Nome:</strong> ${p.name}`}),
    el('div', {html:`<strong>Ruolo:</strong> ${roleName}`}),
    el('div', {html:`<strong>Livello:</strong> ${lvl}`}),
    el('div', {html:`<strong>Monete d'oro:</strong> ${store.gold}`})
  );
  const box = el('div', {class:'avatarBox'}, img, info);
  target.innerHTML = '';
  target.appendChild(box);
  renderXP();
}

function renderXP(){
  const bar = document.getElementById('xpBar');
  if(!bar) return;
  const xp = store.xp;
  const inLvl = xpInLevel(xp);
  const need = xpNeeded(xp);
  const pct = Math.round((inLvl/50)*100);
  bar.innerHTML = `<div class="xpbar"><div class="fill" style="width:${pct}%"></div></div><div class="xptext">${inLvl}/50 XP (mancano ${need})</div>`;
}

function renderInventory(){
  const target = document.getElementById('inventoryList');
  if(!target) return;
  target.innerHTML = '';
  const inv = store.inventory;
  const entries = Object.entries(inv);
  if(entries.length === 0){
    target.appendChild(el('li', {class:'muted'}, 'Nessun consumabile in inventario.'));
    return;
  }
  entries.forEach(([id, count]) => {
    const item = SHOP_ITEMS.find(it => it.id === id);
    const name = item ? item.name : id;
    const icon = item && item.icon ? el('img', {class:'item-icon inventory-icon', src: item.icon, alt: name}) : null;
    const label = el('div', {class:'inventory-label'},
      el('span', {class:'inventory-name'}, name),
      el('span', {class:'inventory-count'}, `×${count}`)
    );
    const sellBtn = el('button', {class:'secondary sell-btn'}, 'Vendi');
    sellBtn.onclick = (ev) => {
      ev.preventDefault();
      sellItem(id);
    };
    const actions = el('div', {class:'inventory-actions'}, sellBtn);
    const row = el('li', {class:'inventory-item'}, icon, label, actions);
    target.appendChild(row);
  });
}

function renderShop(){
  const list = document.getElementById('shopList');
  if(!list) return;
  list.innerHTML = '';
  const profile = store.profile;
  if(!profile){
    list.appendChild(el('p', {class:'muted'}, 'Nessun oggetto disponibile senza un personaggio attivo.'));
    return;
  }
  SHOP_ITEMS.forEach(item => {
    const card = el('div', {class:'card shop-item'},
      el('div', {class:'shop-item-header'},
        item.icon ? el('img', {class:'item-icon', src: item.icon, alt: item.name}) : null,
        el('h3', {}, item.name)
      ),
      el('p', {class:'muted'}, item.description),
      el('p', {html:`<strong>Prezzo:</strong> ${item.price} monete`})
    );
    const owned = inventoryCount(item.id);
    if(owned){
      card.appendChild(el('p', {class:'muted'}, `In inventario: ${owned}`));
    }
    const buyBtn = el('button', {}, 'Compra');
    buyBtn.onclick = () => buyItem(item);
    if(store.gold < item.price){ buyBtn.disabled = true; }
    card.appendChild(buyBtn);
    list.appendChild(card);
  });
}

function setShopMessage(msg, success=false){
  const box = document.getElementById('shopMessage');
  if(!box) return;
  box.textContent = msg;
  box.style.color = success ? '#34d399' : '';
}

function buyItem(item){
  if(store.gold < item.price){
    setShopMessage('Non hai abbastanza monete.');
    return;
  }
  store.gold = store.gold - item.price;
  adjustInventory(item.id, 1);
  setShopMessage(`Acquisto riuscito: ${item.name}`, true);
  renderShop();
}

function sellItem(id){
  const count = inventoryCount(id);
  const item = SHOP_ITEMS.find(it => it.id === id);
  if(!item){
    setShopMessage('Questo oggetto non può essere rivenduto.');
    return;
  }
  if(count <= 0){
    setShopMessage('Non hai copie di questo consumabile da rivendere.');
    return;
  }
  adjustInventory(id, -1);
  store.gold = store.gold + item.price;
  setShopMessage(`Vendita riuscita: ${item.name} (+${item.price} monete)`, true);
  renderShop();
}

function initButtons(){
  const back = document.getElementById('backBtn');
  if(back) back.onclick = () => { window.location.href = '/'; };
  const sq = document.getElementById('sidequestsBtn');
  if(sq) sq.onclick = () => { window.location.href = '/static/sidequests.html'; };
}

async function main(){
  initButtons();
  try{
    const rolesData = await fetch('/api/roles').then(r => r.ok ? r.json() : {labels:{}});
    ROLE_LABELS = { ...ROLE_LABELS, ...(rolesData.labels || {}) };
  }catch{}
  renderProfile();
  renderXP();
  renderInventory();
  renderShop();
}

document.addEventListener('DOMContentLoaded', main);
