// init handled in main()

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k,v);
  }
  for (const c of children){
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  }
  return node;
}


// App metadata fetched from backend
let APP_META = { version: "2.0.0" };

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
const REPORT_EMAIL = 'support@example.com';

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

// --- Avatar helpers: support external sprites in assets/avatars/<role>/<nn>.png ---
function roleSlug(role){
  return canonicalRole(role);
}
// Known alias folders to improve OOTB compatibility (e.g., existing 'mage')
const ROLE_FOLDER_ALIASES = {
  mage: ROLE_ALIASES.mage,
  rogue: ROLE_ALIASES.rogue,
  swordsman: ROLE_ALIASES.swordsman,
  alchemist: ROLE_ALIASES.alchemist,
  ranger: ROLE_ALIASES.ranger
};
function pad2(n){ const v = (Number(n)||0)+1; return v < 9 ? `0${v}` : (v===9? '09' : (v===10? '10' : String(v).padStart(2,'0'))); }
function externalAvatarUrlCandidates(role, variant){
  const r = roleSlug(role);
  const folders = ROLE_FOLDER_ALIASES[r] || [r];
  const nn = pad2((variant%10+10)%10);
  // Try exact role first, then aliases
  const urls = [];
  const seen = new Set();
  for(const f of [r, ...folders]){
    const folder = String(f);
    if(seen.has(folder)) continue; seen.add(folder);
    urls.push(`/static/assets/avatars/${folder}/${nn}.png`);
  }
  return urls;
}
async function probeFirstExisting(urls){
  for(const url of urls){
    try{
      const res = await fetch(url, { method: 'HEAD' });
      if(res && res.ok) return url;
    }catch{ /* ignore */ }
  }
  return null;
}
async function upgradeAvatarElement(imgEl, role, variant){
  const url = await probeFirstExisting(externalAvatarUrlCandidates(role, variant));
  if(url){ imgEl.src = url; }
}
function ensureAvatarData(){ /* placeholder for future caching; kept for main() call */ }

// Procedural pixel avatars per ruolo (10 varianti per ruolo)
function prng(seed){
  let x = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
  return () => (x = Math.imul(x ^ (x>>>15), 0x85EBCA6B) >>> 0) / 0xFFFFFFFF;
}
const ROLE_PALETTES = {
  mage:   ["#3b82f6","#60a5fa","#1e40af"],
  rogue:  ["#22c55e","#4ade80","#166534"],
  swordsman:["#f97316","#fdba74","#7c2d12"],
  alchemist:["#a78bfa","#c4b5fd","#4c1d95"],
  ranger: ["#10b981","#34d399","#065f46"]
};
function pixelIconSVG(role, variant){
  const sz = 8; // 8x8 grid
  const px = 8; // pixel size
  const pad = 2;
  const canon = canonicalRole(role);
  const colors = ROLE_PALETTES[canon] || ROLE_PALETTES[DEFAULT_ROLE];
  const seedChar = canon.charCodeAt(0) || DEFAULT_ROLE.charCodeAt(0);
  const rnd = prng(seedChar*31 + (variant%10));
  let rects = '';
  // symmetric pattern horizontally
  for(let y=0; y<sz; y++){
    for(let x=0; x<Math.ceil(sz/2); x++){
      const on = rnd() > 0.5 || (y<2 && x<2); // ensure face area present
      if(on){
        const c = colors[(x+y)%colors.length];
        const rx = pad + x*px;
        const ry = pad + y*px;
        const mx = pad + (sz-1-x)*px;
        rects += `<rect x="${rx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`;
        if(mx !== rx){ rects += `<rect x="${mx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`; }
      }
    }
  }
  const w = pad*2 + sz*px;
  const h = w;
  const bg = "#0b1020";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect x='0' y='0' width='${w}' height='${h}' fill='${bg}'/>${rects}</svg>`;
}
function avatarDataUrl(role, variant){
  const svg = pixelIconSVG(role, variant);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function roleLabel(role){
  const canon = canonicalRole(role);
  const label = ROLE_LABELS[canon];
  if (label) return label;
  return canon ? canon.charAt(0).toUpperCase() + canon.slice(1) : '';
}

function reportLinkForLevel(level){
  if(!level) return null;
  const email = REPORT_EMAIL;
  if(!email) return null;
  const subjectBase = level.name || level.id || 'Livello';
  const subject = encodeURIComponent(`[Segnalazione] ${subjectBase}`);
  const bodyLines = [
    'Ciao,',
    '',
    `Sto riscontrando un problema con il livello "${subjectBase}" (ID: ${level.id || 'sconosciuto'}).`,
    '',
    'Dettagli:',
    ''
  ];
  const body = encodeURIComponent(bodyLines.join('\n'));
  const href = `mailto:${email}?subject=${subject}&body=${body}`;
  return el('a', {
    class: 'report-link',
    href,
    title: `Segnala un problema per ${subjectBase}`
  }, 'Segnala problema');
}

function initSidebarButtons(){
  const ng = document.getElementById('newGameBtn');
  if(ng) ng.onclick = () => { hardReset(); location.reload(); };

  const exp = document.getElementById('exportBtn');
  if(exp) exp.onclick = () => exportSave();

  const imp = document.getElementById('importInput');
  if(imp) imp.onchange = (e)=>{ if(e.target.files && e.target.files[0]) importSave(e.target.files[0]); };

  const comp = document.getElementById('compendiumBtn');
  if(comp) comp.onclick = () => window.open('/static/compendium.html','_blank');

  const shop = document.getElementById('shopBtn');
  if(shop) shop.onclick = () => { window.location.href = '/static/shop.html'; };

  const sq = document.getElementById('sidequestsBtn');
  if(sq) sq.onclick = () => { window.location.href = '/static/sidequests.html'; };

  const rcb = document.getElementById('rewardCloseBtn');
  if(rcb) rcb.onclick = () => document.getElementById('rewardDialog').close();
}


function hardReset(){
  localStorage.removeItem('pq_profile');
  localStorage.removeItem('pq_progress');
  localStorage.removeItem('pq_achievements');
  localStorage.removeItem('pq_xp');
  localStorage.removeItem('pq_gold');
  localStorage.removeItem('pq_inventory');
}

const store = {
  get progress(){
    try {
      return JSON.parse(localStorage.getItem("pq_progress")||"{}");
    } catch {
      return {};
    }
  },
  set progress(v){
    if (v && typeof v === 'object'){
      localStorage.setItem("pq_progress", JSON.stringify(v));
    } else {
      localStorage.removeItem("pq_progress");
    }
  },
  get profile(){
    try {
      return JSON.parse(localStorage.getItem("pq_profile")||"null");
    } catch {
      return null;
    }
  },
  set profile(v){
    if (!v || typeof v !== 'object'){
      localStorage.removeItem("pq_profile");
      renderProfile();
      renderXP();
      refreshLevels();
      renderAchievements();
      return;
    }
    const canon = canonicalRole(v.role);
    const avatar = (v.avatar && typeof v.avatar === 'object') ? { ...v.avatar } : {};
    if (canonicalRole(avatar.role) !== canon){
      avatar.role = canon;
    }
    if (typeof avatar.variant !== 'number'){
      avatar.variant = 0;
    }
    const profile = {
      ...v,
      role: canon,
      avatar
    };
    localStorage.setItem("pq_profile", JSON.stringify(profile));
    renderProfile();
    renderXP();
    refreshLevels();
    renderAchievements();
  },
  // Achievements storage
  get achievements(){
    try { return JSON.parse(localStorage.getItem('pq_achievements') || '[]'); }
    catch { return []; }
  },
  set achievements(v){ localStorage.setItem('pq_achievements', JSON.stringify(v)); renderAchievements(); },
  get xp(){ return Number(localStorage.getItem("pq_xp")||"0"); },
  set xp(v){ localStorage.setItem("pq_xp", String(v)); renderXP(); renderProfile(); },
  get gold(){ return Number(localStorage.getItem('pq_gold')||'0'); },
  set gold(v){ localStorage.setItem('pq_gold', String(v)); renderProfile(); },
  get inventory(){
    try { return JSON.parse(localStorage.getItem('pq_inventory') || '{}'); }
    catch { return {}; }
  },
  set inventory(v){
    if (v && typeof v === 'object') localStorage.setItem('pq_inventory', JSON.stringify(v));
    else localStorage.removeItem('pq_inventory');
    renderProfile();
  }
};

const SAVE_FORMAT_PREFIX = 'PQSV1:';
const SAVE_OBFUSCATION_KEY = [0x53, 0x19, 0xC7, 0x2D, 0x9B, 0xA4, 0x71, 0xE3, 0x58];
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function scrambleBytes(bytes){
  const key = SAVE_OBFUSCATION_KEY;
  const out = new Uint8Array(bytes.length);
  for(let i = 0; i < bytes.length; i++){
    const k = key[i % key.length];
    out[i] = bytes[i] ^ k ^ (i & 0xff);
  }
  return out;
}

function bytesToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk){
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(str){
  const binary = atob(str);
  const out = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++){
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function obfuscateSavePayload(payload){
  const json = JSON.stringify(payload);
  const bytes = textEncoder.encode(json);
  const scrambled = scrambleBytes(bytes);
  return `${SAVE_FORMAT_PREFIX}${bytesToBase64(scrambled)}`;
}

function unobfuscateSavePayload(text){
  if(!text.startsWith(SAVE_FORMAT_PREFIX)){
    throw new Error('Formato salvataggio sconosciuto');
  }
  const base64 = text.slice(SAVE_FORMAT_PREFIX.length);
  const scrambled = base64ToBytes(base64);
  const bytes = scrambleBytes(scrambled);
  const json = textDecoder.decode(bytes);
  return JSON.parse(json);
}

function adjustInventory(id, delta){
  const inv = { ...store.inventory };
  const next = (Number(inv[id] || 0) + delta);
  if(next > 0) inv[id] = next;
  else delete inv[id];
  store.inventory = inv;
  return next;
}

function inventoryCount(id){
  const inv = store.inventory;
  return Number(inv[id] || 0);
}

const POWERUP_META = {
  hint_token: {
    label: 'Usa Pergamena di Suggerimento',
    activating: 'Pergamena attiva…',
    name: 'Pergamena di Suggerimento',
    icon: '/static/assets/items/suggestion-scroll.png'
  },
  reveal_test: {
    label: 'Usa Lente Rivelatrice',
    activating: 'Lente attiva…',
    name: 'Lente Rivelatrice',
    icon: '/static/assets/items/revealing-lens.png'
  },
  reveal_suite: {
    label: 'Usa Specchio Onnisciente',
    activating: 'Specchio attivo…',
    name: 'Specchio Onnisciente',
    icon: '/static/assets/items/omniscent-mirror.png'
  }
};

function powerupMeta(id){
  return POWERUP_META[id] || {};
}

function setPowerupButtonContent(btn, id){
  if(!btn) return;
  const count = inventoryCount(id);
  const meta = powerupMeta(id);
  const iconOnly = btn.dataset.iconOnly === '1';
  if(!btn.dataset.powerup) btn.dataset.powerup = id;
  if(!btn.dataset.active) btn.dataset.active = '0';
  btn.classList.add('powerup-button');
  btn.classList.toggle('icon-only', iconOnly);
  btn.innerHTML = '';
  if(meta.icon){
    const img = el('img', {
      class: 'powerup-icon',
      src: meta.icon,
      alt: iconOnly ? '' : (meta.name || meta.label || id)
    });
    btn.appendChild(img);
  }
  const labelText = meta.label || 'Usa Oggetto';
  const textContent = iconOnly ? labelText : `${labelText} (${count})`;
  const textSpan = el('span', {class: 'powerup-text'}, textContent);
  btn.appendChild(textSpan);
  btn._powerupText = textSpan;
  if(iconOnly){
    const badge = el('span', {class: 'powerup-badge'}, String(count));
    btn.appendChild(badge);
    btn._powerupBadge = badge;
  } else if(btn._powerupBadge){
    btn._powerupBadge = null;
  }
  btn.dataset.count = String(count);
  const countLabel = count === 1 ? '1 uso disponibile' : `${count} usi disponibili`;
  btn.title = `${labelText} — ${countLabel}`;
  btn.setAttribute('aria-label', `${labelText}. ${countLabel}`);
}

function syncPowerupButtonState(btn){
  if(!btn) return;
  const isActive = btn.dataset.active === '1';
  const isDisabled = !!btn.disabled && !isActive;
  btn.classList.toggle('is-active', isActive);
  btn.classList.toggle('is-disabled', isDisabled);
  if(btn._powerupBadge && !isActive){
    btn._powerupBadge.textContent = btn.dataset.count || '';
  }
}

function updatePowerupButton(btn, id){
  setPowerupButtonContent(btn, id);
  syncPowerupButtonState(btn);
}

function showPowerupStatus(btn, id, message){
  if(!btn) return;
  btn.dataset.active = '1';
  if(btn._powerupText) btn._powerupText.textContent = message;
  if(btn._powerupBadge) btn._powerupBadge.textContent = btn.dataset.count || '';
  btn.disabled = false;
  btn.title = message;
  btn.setAttribute('aria-label', message);
  syncPowerupButtonState(btn);
}

function deselectPowerupButton(btn, id){
  if(!btn) return;
  btn.dataset.active = '0';
  updatePowerupButton(btn, id);
}

function refreshPowerupButton(btn, id, hasFailed){
  if(!btn) return null;
  btn.dataset.active = '0';
  if(inventoryCount(id) <= 0){
    btn.remove();
    return null;
  }
  const requireFailure = btn.dataset.requireFailure === '1';
  updatePowerupButton(btn, id);
  const meta = powerupMeta(id);
  if(requireFailure && !hasFailed){
    const msg = meta.lockedLabel || `${meta.label || 'Oggetto'} (disponibile dopo un fallimento)`;
    btn.disabled = true;
    btn.title = msg;
    btn.setAttribute('aria-label', msg);
  } else {
    btn.disabled = false;
    const count = parseInt(btn.dataset.count || '0', 10);
    const countLabel = count === 1 ? '1 uso disponibile' : `${count} usi disponibili`;
    btn.title = `${meta.label || 'Usa Oggetto'} — ${countLabel}`;
    btn.setAttribute('aria-label', `${meta.label || 'Usa Oggetto'}. ${countLabel}`);
  }
  syncPowerupButtonState(btn);
  return btn;
}

function playerLevel(xp){ return 1 + Math.floor(xp / 50); }
function xpInLevel(xp){ return xp % 50; }
function xpNeeded(xp){ return 50 - xpInLevel(xp); }

function ensureProfile(roles, labels={}){
  if (labels && typeof labels === 'object'){
    ROLE_LABELS = { ...ROLE_LABELS, ...labels };
  }
  let p = store.profile;
  if (!p) {
    const dlg = document.getElementById("profileDialog");
    const roleSel = document.getElementById("playerRole");
    roleSel.innerHTML = roles.map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join("");
    const cancelBtn = document.getElementById('cancelProfileBtn');
    if (cancelBtn && !cancelBtn.dataset.bound){
      cancelBtn.dataset.bound = '1';
      cancelBtn.addEventListener('click', () => {
        if (dlg && dlg.open) dlg.close();
      });
    }
    dlg.showModal();
    // allow loading a save from setup dialog
    const imp = document.getElementById('importInputSetup');
    if(imp){ imp.onchange = (e)=>{ if(e.target.files && e.target.files[0]) { importSave(e.target.files[0]); const dlgEl = document.getElementById('profileDialog'); if(dlgEl && dlgEl.open) dlgEl.close(); initSidebarButtons(); } }; }
    document.getElementById("saveProfileBtn").onclick = (e)=>{
      const name = document.getElementById("playerName").value.trim();
      const role = document.getElementById("playerRole").value;
      if(!name) return;
      hardReset();
      const variant = Math.floor(Math.random()*10);
      store.profile = {name, role, avatar:{ role, variant }};
      // intro narrativa
      api(`/api/intro/${role}`).then(d => {
        const intro = d.intro || "";
        if(intro){
          const rd = document.getElementById("rewardDialog");
          const rc = document.getElementById("rewardContent");
          rc.innerHTML = `<h3>Benvenuto, ${name} (${roleLabel(role)})</h3><p>${intro}</p>`;
          rd.showModal();
        }
      }).catch(()=>{});
      dlg.close();
      initSidebarButtons();
    };
  }
}

function renderProfile(){
  const target = document.getElementById("profileView");
  const p = store.profile;
  const lvl = playerLevel(store.xp);
  if(!p){ target.innerHTML = "<em>Nessun profilo</em>"; return; }
  const av = (p.avatar && typeof p.avatar.variant === 'number') ? p.avatar : {role:p.role, variant:0};
  const imgSrc = avatarDataUrl(av.role, av.variant); // fallback immediate
  target.innerHTML = ``;
  const box = el('div',{class:'avatarBox'});
  const roleName = roleLabel(p.role);
  const img = el('img',{class:'avatar', src: imgSrc, alt: roleName});
  // Try upgrading to external sprite if present
  upgradeAvatarElement(img, av.role, av.variant);
  const info = el('div', {class:'profileInfo'},
    el('div', {html:`<strong>Nome:</strong> ${p.name}`}),
    el('div', {html:`<strong>Ruolo:</strong> ${roleName}`}),
    el('div', {html:`<strong>Livello:</strong> ${lvl}`}),
    el('div', {html:`<strong>Monete d'oro:</strong> ${store.gold}`})
  );
  box.appendChild(img); box.appendChild(info);
  target.appendChild(box);
}

function renderXP(){
  const bar = document.getElementById("xpBar");
  const xp = store.xp;
  const inLvl = xpInLevel(xp);
  const need = xpNeeded(xp);
  const pct = Math.round((inLvl/50)*100);
  bar.innerHTML = `<div class=\"xpbar\"><div class=\"fill\" style=\"width:${pct}%\"></div></div><div class=\"xptext\">${inLvl}/50 XP (mancano ${need})</div>`;
}

// addItem rimosso

// funzione reroll rimossa (seed non più supportato)

function renderAchievements(){
  const ul = document.getElementById("achievementsList");
  const achievements = store.achievements;
  ul.innerHTML = "";
  // achievements
  if(achievements.length === 0){
    ul.appendChild(el("li", {class:"muted"}, "Vuoto (nessuna conquista)."));
  } else {
    achievements.forEach(it => {
      const isSigil = typeof it === 'string' && it.toLowerCase().startsWith('sigillo');
      const icon = isSigil ? '🏵️' : '🏅';
      const li = el("li", { class: isSigil ? 'sigil' : '' }, `${icon} ${it}`);
      ul.appendChild(li);
    });
  }
}

function showRewardDialog(html){
  const rd = document.getElementById("rewardDialog");
  const rc = document.getElementById("rewardContent");
  rc.innerHTML = html;
  rd.showModal();
}

function exportSave(){
  const data = {
    profile: store.profile,
    progress: store.progress,
    achievements: store.achievements,
    xp: store.xp,
    gold: store.gold,
    inventory: store.inventory,
    // items rimossi
    version: APP_META && APP_META.version ? APP_META.version : "2.0.0"
  };
  const encoded = obfuscateSavePayload(data);
  const blob = new Blob([encoded], {type: "application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "python-quest-save.pqs";
  a.click();
  URL.revokeObjectURL(url);
}

function importSave(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = typeof reader.result === 'string' ? reader.result.trim() : '';
      if(!raw || !raw.startsWith(SAVE_FORMAT_PREFIX)){
        throw new Error('Formato salvataggio non riconosciuto');
      }
      const data = unobfuscateSavePayload(raw);
      if(data.profile) store.profile = data.profile;
      if(data.progress) store.progress = data.progress;
      if(data.achievements) store.achievements = data.achievements;
      if(typeof data.xp === "number") store.xp = data.xp;
      if(typeof data.gold === "number") store.gold = data.gold;
      if(data.inventory) store.inventory = data.inventory;
      // items rimossi
      showRewardDialog("<h3>Salvataggio importato</h3><p>Ben tornato in partita!</p>");
      refreshLevels();
    } catch(e) {
      alert("File di salvataggio non valido.");
    }
  };
  reader.readAsText(file);
}

function renderLevel(lv, idx, unlocked, completed, onProgress){
  const card = el("div", {class: "card" + (unlocked ? "" : " locked") + (completed ? " passed" : "")});
  const title = el("h3", {}, (unlocked ? "" : "🔒 ") + lv.name);
  const header = el('div', {class:'level-header'}, title);
  const reportLink = reportLinkForLevel(lv);
  if(reportLink && unlocked){
    header.appendChild(reportLink);
  }
  const prompt = el("p", {}, lv.prompt);
  card.appendChild(header);
  card.appendChild(prompt);

  const wasCompleted = completed;
  const isSidequest = (lv.id || '').startsWith('sq_');
  const powerupsUsed = { hint: false, reveal: false, mirror: false };
  let hintBtn = null;
  let revealBtn = null;
  let mirrorBtn = null;
  let hasFailed = false;
  const powerupButtons = {};
  const applyUsageSelection = (id) => {
    powerupsUsed.hint = false;
    powerupsUsed.reveal = false;
    powerupsUsed.mirror = false;
    if(id === 'hint_token') powerupsUsed.hint = true;
    else if(id === 'reveal_test') powerupsUsed.reveal = true;
    else if(id === 'reveal_suite') powerupsUsed.mirror = true;
  };
  const deselectOtherButtons = (selectedId) => {
    Object.entries(powerupButtons).forEach(([pid, button]) => {
      if(button && pid !== selectedId){
        deselectPowerupButton(button, pid);
      }
    });
  };

  if(completed){
    card.appendChild(el("p", {class:"muted"}, "✅ Capitolo completato"));
    if(lv.next_intro){
      card.appendChild(el("p", {class:"bubble"}, "Prossimo: " + lv.next_intro));
    }
    return card;
  }

  if(!unlocked){
    card.appendChild(el("p", {}, "Completa il livello precedente per sbloccare."));
    return card;
  }

  if(!completed){
    const pow = el('div', {class:'powerups'});
    card.appendChild(pow);

    const attachButton = (id, requireFailure = false) => {
      if(inventoryCount(id) <= 0){
        powerupButtons[id] = null;
        return null;
      }
      const btn = el('button', {class:'secondary'});
      btn.dataset.iconOnly = '1';
      updatePowerupButton(btn, id);
      powerupButtons[id] = btn;
      if(requireFailure){
        btn.dataset.requireFailure = '1';
        if(!hasFailed){
          const meta = powerupMeta(id);
          const msg = meta.lockedLabel || `${meta.label || 'Oggetto'} (disponibile dopo un fallimento)`;
          btn.disabled = true;
          btn.title = msg;
          btn.setAttribute('aria-label', msg);
          syncPowerupButtonState(btn);
        }
      }
      btn.onclick = () => {
        if(btn.disabled) return;
        const wasActive = btn.dataset.active === '1';
        if(wasActive){
          applyUsageSelection(null);
          deselectPowerupButton(btn, id);
          return;
        }
        deselectOtherButtons(id);
        applyUsageSelection(id);
        const activating = powerupMeta(id).activating || powerupMeta(id).label || 'Oggetto attivo…';
        showPowerupStatus(btn, id, activating);
      };
      pow.appendChild(btn);
      return btn;
    };

    hintBtn = attachButton('hint_token', true);
    revealBtn = attachButton('reveal_test', true);
    mirrorBtn = attachButton('reveal_suite', true);

    if(!pow.childNodes.length){ card.removeChild(pow); }
  }

  const editor = el("textarea", {class:"editor"});
  editor.value = lv.signature;
  enableEditorTabSupport(editor);

  const bubble = el("div", {class:"bubble"}, "Pronto quando lo sei tu!");
  const btn = el("button", {}, "Esegui Test");
  const actions = el("div", {class:"actions"}, btn);

  // hint token button if available
  // hint consumabili rimossi

  btn.addEventListener("click", async () => {
    bubble.textContent = "Esecuzione in corso...";
    try{
      const profile = store.profile || {};
      const consumed = [];
      if(powerupsUsed.hint) consumed.push('hint_token');
      if(powerupsUsed.reveal) consumed.push('reveal_test');
      if(powerupsUsed.mirror) consumed.push('reveal_suite');
      const revealSource = consumed.includes('reveal_suite') ? 'mirror' : (consumed.includes('reveal_test') ? 'lens' : null);
      const res = await api(`/api/submit`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({level_id: lv.id, code: editor.value, player_role: profile.role, player_name: profile.name, items_used: consumed})
      });
      const isStub = res.is_stub === true;
      consumed.forEach(id => adjustInventory(id, -1));
      if(!res.passed && !isStub) hasFailed = true;
      hintBtn = refreshPowerupButton(hintBtn, 'hint_token', hasFailed);
      revealBtn = refreshPowerupButton(revealBtn, 'reveal_test', hasFailed);
      mirrorBtn = refreshPowerupButton(mirrorBtn, 'reveal_suite', hasFailed);
      powerupButtons['hint_token'] = hintBtn;
      powerupButtons['reveal_test'] = revealBtn;
      powerupButtons['reveal_suite'] = mirrorBtn;
      applyUsageSelection(null);
      bubble.innerHTML = '';
          if(res.passed || isStub || !Array.isArray(res.feedback_list) || res.feedback_list.length === 0){
        bubble.appendChild(el('p', {}, res.feedback));
      } else {
        const list = el('ul', {class:'feedback-list'});
        res.feedback_list.forEach(msg => list.appendChild(el('li', {}, msg)));
        bubble.appendChild(list);
      }
      if(res.extra_hint){
        bubble.appendChild(el('p', {class:'muted'}, 'La pergamena suggerisce:'));
        bubble.appendChild(el('p', {class:'extra-hint'}, res.extra_hint));
      }
      if(res.reveal_details && res.reveal_details.length){
        const revealLabel = revealSource === 'mirror' ? 'Lo specchio rivela:' : 'La lente rivela:';
        bubble.appendChild(el('p', {class:'muted'}, revealLabel));
        const list = el('ul', {class:'powerup-details'});
        res.reveal_details.forEach(msg => list.appendChild(el('li', {}, msg)));
        bubble.appendChild(list);
      }
      if(res.passed){
        onProgress(lv.id, true);
        if (res.achievement){
          const ach = store.achievements;
          if(!ach.includes(res.achievement)){
            ach.push(res.achievement);
            store.achievements = ach;
          }
        }
        // items rimossi
        // XP e reward
        const before = store.xp;
        const gained = typeof res.xp_gained === "number" ? res.xp_gained : 0;
        store.xp = before + gained;
        const lvlBefore = 1 + Math.floor(before / 50);
        const lvlAfter = 1 + Math.floor(store.xp / 50);
        let goldGain = isSidequest ? 3 : 2;
        if(!wasCompleted && !isSidequest && /_l5$/.test(lv.id || '')) goldGain += 10;
        const goldBefore = store.gold;
        store.gold = goldBefore + goldGain;
        let html = `<h3>Ricompensa</h3>`;
        if(res.achievement){
          html += `<div class="award"><span class="medal">🏅</span><span class="text">${res.achievement}</span></div>`;
        }
        if(gained) html += `<p><strong>XP guadagnati:</strong> +${gained}</p>`;
        if(goldGain) html += `<p><strong>Monete d'oro:</strong> +${goldGain}</p>`;
        if(res.narration) html += `<p>${res.narration}</p>`;
        if(res.next_intro) html += `<p><em>Prossimo:</em> ${res.next_intro}</p>`;
        // items rimossi
        if(lvlAfter > lvlBefore) html += `<p><strong>Level Up!</strong> Ora sei livello ${lvlAfter}.</p>`;
        showRewardDialog(html);
        refreshLevels();
      }
    }catch(e){
      bubble.innerHTML = "Errore di rete. Riprova.";
      if(powerupsUsed.hint && hintBtn){
        hintBtn = refreshPowerupButton(hintBtn, 'hint_token', hasFailed);
        powerupButtons['hint_token'] = hintBtn;
        if(hintBtn && !document.body.contains(hintBtn)){
          hintBtn = null;
          powerupButtons['hint_token'] = null;
        }
      }
      if(powerupsUsed.reveal && revealBtn){
        revealBtn = refreshPowerupButton(revealBtn, 'reveal_test', hasFailed);
        powerupButtons['reveal_test'] = revealBtn;
        if(revealBtn && !document.body.contains(revealBtn)){
          revealBtn = null;
          powerupButtons['reveal_test'] = null;
        }
      }
      if(powerupsUsed.mirror && mirrorBtn){
        mirrorBtn = refreshPowerupButton(mirrorBtn, 'reveal_suite', hasFailed);
        powerupButtons['reveal_suite'] = mirrorBtn;
        if(mirrorBtn && !document.body.contains(mirrorBtn)){
          mirrorBtn = null;
          powerupButtons['reveal_suite'] = null;
        }
      }
      applyUsageSelection(null);
    }
  });

  card.appendChild(editor);
  card.appendChild(actions);
  card.appendChild(bubble);
  return card;
}

function enableEditorTabSupport(editor){
  if(!editor || editor.dataset.tabBound) return;
  editor.dataset.tabBound = '1';
  editor.addEventListener('keydown', (ev) => {
    if(ev.key === 'Tab'){
      ev.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const val = editor.value;
      const indent = '    ';
      editor.value = val.slice(0, start) + indent + val.slice(end);
      const pos = start + indent.length;
      editor.selectionStart = editor.selectionEnd = pos;
    }
  });
}

// Side quests rimosse

async function refreshLevels(){
  const levelsRoot = document.getElementById("levels");
  levelsRoot.innerHTML = "";
  const profile = store.profile || {};
  const role = profile.role ? canonicalRole(profile.role) : null;
  const levels = await api(`/api/levels${role?`?role=${role}`:''}`);
  const progress = store.progress;
  const isUnlocked = (idx) => idx === 0 ? true : !!progress[levels[idx-1].id];
  const isCompleted = (lv) => !!progress[lv.id];

  function onProgress(id, ok){
    progress[id] = ok || progress[id];
    store.progress = progress;
    refreshLevels();
  }

  let currentChapter = null;
  let fallbackChapterNumber = 0;
  levels.forEach((lv, i) => {
    const id = lv.id || '';
    const parts = id.split('_');
    const chapterKey = parts.length >= 3 ? parts[0] + '_' + parts[1] : 'chap_' + i;
    if (currentChapter !== chapterKey){
      currentChapter = chapterKey;
      let chapterNumber = null;
      const chapterPrefix = parts[0] || '';
      const match = chapterPrefix.match(/(\d+)/);
      if (match && match[1]){
        chapterNumber = parseInt(match[1], 10);
        if (!Number.isNaN(chapterNumber)){
          fallbackChapterNumber = Math.max(fallbackChapterNumber, chapterNumber);
        } else {
          chapterNumber = null;
        }
      }
      if (chapterNumber == null){
        fallbackChapterNumber += 1;
        chapterNumber = fallbackChapterNumber;
      }
      const h = el('h2', {class: 'chapter-title'}, `Capitolo ${chapterNumber}`);
      levelsRoot.appendChild(h);
    }
    const unlocked = isUnlocked(i);
    const completed = isCompleted(lv);
    levelsRoot.appendChild(renderLevel(lv, i, unlocked, completed, onProgress));
  });
}

// reward close handled in initSidebarButtons()

async function main(){
  initSidebarButtons();
  // Fetch app metadata (version, etc.)
  try{
    const meta = await api("/api/meta");
    if(meta && meta.version){ APP_META = meta; }
  }catch(e){ /* keep default */ }
  // Show version in header if present
  try{
    const vb = document.getElementById('appVersion');
    if(vb && APP_META && APP_META.version){ vb.textContent = `v ${APP_META.version}`; }
  }catch(e){/* ignore */}
  const rolesData = await api("/api/roles");
  ensureProfile(rolesData.roles, rolesData.labels || {});
  ensureAvatarData();
  renderProfile();
  renderXP();
  renderAchievements();
  if (store.profile){
    await refreshLevels();
  } else {
    const levelsRoot = document.getElementById('levels');
    if(levelsRoot){ levelsRoot.innerHTML = ''; }
  }
  // sidequests moved to dedicated page; button handlers set in initSidebarButtons()
}

document.addEventListener("DOMContentLoaded", main);

// compendium handled in initSidebarButtons()
