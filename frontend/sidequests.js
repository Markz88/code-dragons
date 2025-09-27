const I18N = window.I18N;
const tr = (key, fallback, params) => I18N ? I18N.t(key, fallback, params) : (fallback ?? key);
const currentLanguage = () => (I18N ? I18N.getLanguage() : 'it');

function withLang(path){
  if(!path || typeof path !== 'string') return path;
  try{
    const url = new URL(path, window.location.origin);
    if(!url.searchParams.has('lang')){
      url.searchParams.set('lang', currentLanguage());
    }
    return url.pathname + url.search;
  }catch{
    return path;
  }
}

async function api(path, opts) {
  const finalPath = withLang(path);
  const res = await fetch(finalPath, opts);
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

const ACHIEVEMENT_CATALOGS = {};
const ACHIEVEMENT_LABEL_LOOKUP = {};

function achievementKey(entry){
  if(entry === null || entry === undefined) return null;
  if(typeof entry === 'string') return entry;
  if(typeof entry !== 'object') return null;
  if(entry.id) return entry.id;
  if(entry.level_id){
    const role = entry.role ?? '';
    return role ? `${entry.level_id}:${role}` : entry.level_id;
  }
  if(entry.label) return entry.label;
  return null;
}

function buildAchievementLookup(lang, catalog){
  const lookup = {};
  ['by_chapter', 'sidequests'].forEach(section => {
    const source = catalog[section] || {};
    Object.entries(source).forEach(([levelId, value]) => {
      if(value && typeof value === 'object' && !Array.isArray(value)){
        Object.entries(value).forEach(([role, label]) => {
          if(typeof label === 'string'){
            lookup[label.trim().toLowerCase()] = { level_id: levelId, role, lang };
          }
        });
      } else if(typeof value === 'string'){
        lookup[value.trim().toLowerCase()] = { level_id: levelId, role: null, lang };
      }
    });
  });
  ACHIEVEMENT_LABEL_LOOKUP[lang] = lookup;
}

async function ensureAchievementCatalog(lang){
  const key = (typeof lang === 'string' && lang) ? lang : currentLanguage();
  if(ACHIEVEMENT_CATALOGS[key]) return ACHIEVEMENT_CATALOGS[key];
  try{
    const data = await api(`/api/achievements?lang=${encodeURIComponent(key)}`);
    const catalog = {
      by_chapter: (data && data.by_chapter) || {},
      sidequests: (data && data.sidequests) || {}
    };
    ACHIEVEMENT_CATALOGS[key] = catalog;
    buildAchievementLookup(key, catalog);
    return catalog;
  }catch{
    const empty = { by_chapter: {}, sidequests: {} };
    ACHIEVEMENT_CATALOGS[key] = empty;
    ACHIEVEMENT_LABEL_LOOKUP[key] = {};
    return empty;
  }
}

async function loadAchievementCatalogs(){
  const lang = currentLanguage();
  await ensureAchievementCatalog(lang);
  if(lang !== 'it'){
    await ensureAchievementCatalog('it');
  }
}

function achievementLabelFromCatalog(levelId, role, lang = currentLanguage()){
  if(!levelId) return null;
  const catalog = ACHIEVEMENT_CATALOGS[lang];
  if(!catalog) return null;
  const source = (catalog.by_chapter && catalog.by_chapter[levelId])
    || (catalog.sidequests && catalog.sidequests[levelId]);
  if(!source) return null;
  if(typeof source === 'string') return source;
  if(role && typeof source === 'object'){
    const label = source[role];
    if(typeof label === 'string') return label;
  }
  if(typeof source === 'object'){
    const values = Object.values(source).filter(v => typeof v === 'string');
    if(values.length === 1) return values[0];
  }
  return null;
}

function lookupAchievementByLabel(label){
  if(typeof label !== 'string') return null;
  const needle = label.trim().toLowerCase();
  if(!needle) return null;
  for(const [lang, mapping] of Object.entries(ACHIEVEMENT_LABEL_LOOKUP)){
    const match = mapping[needle];
    if(match){
      const id = match.role ? `${match.level_id}:${match.role}` : match.level_id;
      return { id, level_id: match.level_id, role: match.role, lang };
    }
  }
  return null;
}

function normalizeAchievementEntry(entry){
  if(entry === null || entry === undefined) return null;
  if(typeof entry === 'string'){
    const info = lookupAchievementByLabel(entry);
    if(info){
      const localized = achievementLabelFromCatalog(info.level_id, info.role) || entry;
      return {
        id: info.id,
        level_id: info.level_id,
        role: info.role,
        label: localized,
        lang: localized === entry ? info.lang : currentLanguage()
      };
    }
    return entry;
  }
  if(typeof entry !== 'object') return null;
  const levelId = entry.level_id || entry.levelId || null;
  const role = entry.role ?? entry.player_role ?? null;
  let id = entry.id || entry.key || null;
  if(!id && levelId){
    id = role ? `${levelId}:${role}` : levelId;
  }
  let label = typeof entry.label === 'string' ? entry.label : null;
  let lang = typeof entry.lang === 'string' ? entry.lang : null;
  const catalogLabel = achievementLabelFromCatalog(levelId, role);
  if(catalogLabel){
    label = catalogLabel;
    lang = currentLanguage();
  }
  const normalized = {};
  if(id) normalized.id = id;
  if(levelId) normalized.level_id = levelId;
  if(role) normalized.role = role;
  if(label) normalized.label = label;
  if(lang) normalized.lang = lang;
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeAchievementList(list){
  if(!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach(item => {
    const normalized = normalizeAchievementEntry(item);
    if(normalized === null || normalized === undefined) return;
    const key = achievementKey(normalized) ?? `anon-${out.length}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function hasAchievement(list, entry){
  if(!entry || !Array.isArray(list)) return false;
  const key = achievementKey(entry);
  if(!key) return false;
  return list.some(item => achievementKey(item) === key);
}

function presentAchievement(entry){
  if(!entry) return '';
  if(typeof entry === 'string'){
    const normalized = normalizeAchievementEntry(entry);
    if(normalized && typeof normalized !== 'string'){
      return presentAchievement(normalized);
    }
    return entry;
  }
  if(typeof entry !== 'object') return '';
  return entry.label || achievementLabelFromCatalog(entry.level_id, entry.role) || entry.id || '';
}

function achievementIconFor(label){
  if(typeof label !== 'string') return '🏅';
  const lower = label.toLowerCase();
  if(lower.includes('sigillo') || lower.includes('sigil') || lower.includes('seal')) return '🏵️';
  return '🏅';
}

function normalizeStoredAchievements(){
  try{
    const raw = JSON.parse(localStorage.getItem('pq_achievements') || '[]');
    const normalized = normalizeAchievementList(raw);
    localStorage.setItem('pq_achievements', JSON.stringify(normalized));
  }catch{}
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

function pad2(n){ const v = (Number(n)||0)+1; return v < 9 ? `0${v}` : (v===9? '09' : (v===10? '10' : String(v).padStart(2,'0'))); }

function externalAvatarUrlCandidates(role, variant){
  const r = roleSlug(role);
  const folders = ROLE_FOLDER_ALIASES[r] || [r];
  const nn = pad2((variant%10+10)%10);
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
  mage:   ["#3b82f6","#60a5fa","#1e40af"],
  rogue:  ["#22c55e","#4ade80","#166534"],
  swordsman:["#f97316","#fdba74","#7c2d12"],
  alchemist:["#a78bfa","#c4b5fd","#4c1d95"],
  ranger: ["#10b981","#34d399","#065f46"]
};
function pixelIconSVG(role, variant){
  const sz = 8;
  const px = 8;
  const pad = 2;
  const canon = canonicalRole(role);
  const colors = ROLE_PALETTES[canon] || ROLE_PALETTES[DEFAULT_ROLE];
  const seedChar = canon.charCodeAt(0) || DEFAULT_ROLE.charCodeAt(0);
  const rnd = prng(seedChar*31 + (variant%10));
  let rects = '';
  for(let y=0; y<sz; y++){
    for(let x=0; x<Math.ceil(sz/2); x++){
      const on = rnd() > 0.5 || (y<2 && x<2);
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
  const bg = "#0b1020";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}' viewBox='0 0 ${w} ${w}'><rect x='0' y='0' width='${w}' height='${w}' fill='${bg}'/>${rects}</svg>`;
}
function avatarDataUrl(role, variant){
  const svg = pixelIconSVG(role, variant);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function reportLinkForLevel(level){
  if(!level) return null;
  const email = REPORT_EMAIL;
  if(!email) return null;
  const subjectBase = level.name || level.id || tr('ui.levelFallback', 'Missione');
  const subjectTemplate = tr('report.subjectPrefix', `[Segnalazione] {level}`, { level: subjectBase });
  const subject = encodeURIComponent(subjectTemplate);
  const bodyLines = [
    tr('report.greeting', 'Ciao,'),
    '',
    tr('report.problem', `Sto riscontrando un problema con la missione "${subjectBase}" (ID: ${level.id || 'sconosciuto'}).`, { level: subjectBase, id: level.id || 'sconosciuto' }),
    '',
    tr('report.details', 'Dettagli:'),
    ''
  ];
  const body = encodeURIComponent(bodyLines.join('\n'));
  const href = `mailto:${email}?subject=${subject}&body=${body}`;
  return el('a', {
    class: 'report-link',
    href,
    title: tr('report.linkTitle', `Segnala un problema per ${subjectBase}`, { level: subjectBase })
  }, tr('report.linkLabel', 'Segnala problema'));
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

const store = {
  get progress(){
    try { return JSON.parse(localStorage.getItem("pq_progress")||"{}"); }
    catch { return {}; }
  },
  set progress(v){
    if (v && typeof v === 'object') localStorage.setItem("pq_progress", JSON.stringify(v));
    else localStorage.removeItem("pq_progress");
  },
  get profile(){
    try { return JSON.parse(localStorage.getItem("pq_profile")||"null"); }
    catch { return null; }
  },
  set profile(v){
    if (!v || typeof v !== 'object'){
      localStorage.removeItem("pq_profile");
      renderProfile();
      renderXP();
      renderAchievements();
      return;
    }
    const canon = canonicalRole(v.role);
    const avatar = (v.avatar && typeof v.avatar === 'object') ? { ...v.avatar } : {};
    if (canonicalRole(avatar.role) !== canon){ avatar.role = canon; }
    if (typeof avatar.variant !== 'number'){ avatar.variant = 0; }
    const profile = { ...v, role: canon, avatar };
    localStorage.setItem("pq_profile", JSON.stringify(profile));
    renderProfile();
    renderXP();
    renderAchievements();
  },
  get achievements(){
    try {
      const data = JSON.parse(localStorage.getItem('pq_achievements') || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  set achievements(v){
    const list = Array.isArray(v) ? v : [];
    const normalized = normalizeAchievementList(list);
    localStorage.setItem('pq_achievements', JSON.stringify(normalized));
    renderAchievements();
  },
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

function adjustInventory(id, delta){
  const inv = { ...store.inventory };
  const next = Number(inv[id] || 0) + delta;
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
    labelKey: 'powerups.hint.label',
    activating: 'Pergamena attiva…',
    activatingKey: 'powerups.hint.activating',
    name: 'Pergamena di Suggerimento',
    nameKey: 'powerups.hint.name',
    icon: '/static/assets/items/suggestion-scroll.png'
  },
  reveal_test: {
    label: 'Usa Lente Rivelatrice',
    labelKey: 'powerups.reveal.label',
    activating: 'Lente attiva…',
    activatingKey: 'powerups.reveal.activating',
    name: 'Lente Rivelatrice',
    nameKey: 'powerups.reveal.name',
    icon: '/static/assets/items/revealing-lens.png'
  },
  reveal_suite: {
    label: 'Usa Specchio Onnisciente',
    labelKey: 'powerups.mirror.label',
    activating: 'Specchio attivo…',
    activatingKey: 'powerups.mirror.activating',
    name: 'Specchio Onnisciente',
    nameKey: 'powerups.mirror.name',
    icon: '/static/assets/items/omniscent-mirror.png'
  }
};

function powerupMeta(id){
  return POWERUP_META[id] || {};
}

function powerupLabel(meta){
  return tr(meta.labelKey || '', meta.label || tr('ui.useItem', 'Usa Oggetto'));
}

function powerupName(meta){
  return tr(meta.nameKey || '', meta.name || powerupLabel(meta));
}

function powerupActivating(meta){
  return tr(meta.activatingKey || '', meta.activating || powerupLabel(meta));
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
      alt: iconOnly ? '' : (powerupName(meta) || powerupLabel(meta) || id)
    });
    btn.appendChild(img);
  }
  const labelText = powerupLabel(meta);
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
  const countLabel = count === 1
    ? tr('ui.powerupSingleUse', '1 uso disponibile')
    : tr('ui.powerupMultipleUse', `${count} usi disponibili`, { count });
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
    const fallbackName = meta.label || tr('ui.useItem', 'Oggetto');
    const msg = meta.lockedLabel || tr('ui.itemAvailableAfterFail', `${fallbackName} (disponibile dopo un fallimento)`, { name: fallbackName });
    btn.disabled = true;
    btn.title = msg;
    btn.setAttribute('aria-label', msg);
  } else {
    btn.disabled = false;
    const count = parseInt(btn.dataset.count || '0', 10);
    const labelText = powerupLabel(meta);
    const countLabel = count === 1
      ? tr('ui.powerupSingleUse', '1 uso disponibile')
      : tr('ui.powerupMultipleUse', `${count} usi disponibili`, { count });
    btn.title = `${labelText} — ${countLabel}`;
    btn.setAttribute('aria-label', `${labelText}. ${countLabel}`);
  }
  syncPowerupButtonState(btn);
  return btn;
}

function playerLevel(xp){ return 1 + Math.floor(xp / 50); }
function xpInLevel(xp){ return xp % 50; }
function xpNeeded(xp){ return 50 - xpInLevel(xp); }

function renderProfile(){
  const target = document.getElementById("profileView");
  const p = store.profile;
  const lvl = playerLevel(store.xp);
  if(!target) return;
  if(!p){ target.innerHTML = `<em>${tr('ui.noProfile', 'Nessun profilo')}</em>`; return; }
  const av = (p.avatar && typeof p.avatar.variant === 'number') ? p.avatar : {role:p.role, variant:0};
  const imgSrc = avatarDataUrl(av.role, av.variant);
  target.innerHTML = "";
  const box = el('div',{class:'avatarBox'});
  const roleName = roleLabel(p.role);
  const img = el('img',{class:'avatar', src: imgSrc, alt: roleName});
  upgradeAvatarElement(img, av.role, av.variant);
  const info = el('div', {class:'profileInfo'},
    el('div', {html:`<strong>${tr('ui.profileName', 'Nome')}:</strong> ${p.name}`}),
    el('div', {html:`<strong>${tr('ui.profileRole', 'Ruolo')}:</strong> ${roleName}`}),
    el('div', {html:`<strong>${tr('ui.profileLevel', 'Livello')}:</strong> ${lvl}`}),
    el('div', {html:`<strong>${tr('ui.profileGold', "Monete d'oro")}:</strong> ${store.gold}`})
  );
  box.appendChild(img);
  box.appendChild(info);
  target.appendChild(box);
}

function renderXP(){
  const bar = document.getElementById("xpBar");
  if(!bar) return;
  const xp = store.xp;
  const inLvl = xpInLevel(xp);
  const need = xpNeeded(xp);
  const pct = Math.round((inLvl/50)*100);
  bar.innerHTML = `<div class=\"xpbar\"><div class=\"fill\" style=\"width:${pct}%\"></div></div><div class=\"xptext\">${tr('ui.xpStatus', `${inLvl}/50 XP (mancano ${need})`, { current: inLvl, remaining: need })}</div>`;
}

function renderAchievements(){
  const ul = document.getElementById("achievementsList");
  if(!ul) return;
  const achievements = store.achievements;
  ul.innerHTML = "";
  if(achievements.length === 0){
    ul.appendChild(el("li", {class:"muted"}, tr('ui.noAchievements', 'Vuoto (nessuna conquista).')));
  } else {
    achievements.forEach(item => {
      const label = presentAchievement(item);
      if(!label) return;
      const icon = achievementIconFor(label);
      const li = el("li", { class: icon === '🏵️' ? 'sigil' : '' }, `${icon} ${label}`);
      ul.appendChild(li);
    });
  }
}

function showRewardDialog(html){
  const rd = document.getElementById("rewardDialog");
  const rc = document.getElementById("rewardContent");
  if(!rd || !rc) return;
  rc.innerHTML = html;
  rd.showModal();
}

function renderLevel(lv, idx, unlocked, completed, onProgress){
  const card = el("div", {class: "card" + (unlocked ? "" : " locked") + (completed ? " passed" : "")});
  const title = el("h3", {}, (unlocked ? "" : "🔒 ") + lv.name);
  const header = el('div', {class:'level-header'}, title);
  const reportLink = reportLinkForLevel(lv);
  if(reportLink){ header.appendChild(reportLink); }
  const prompt = el("p", {}, lv.prompt);
  card.appendChild(header);
  card.appendChild(prompt);

  const wasCompleted = completed;
  const levelId = lv.id || '';
  const baseLevelId = levelId.includes('__') ? levelId.split('__')[0] : levelId;
  const isSidequest = baseLevelId.startsWith('sq_');
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
    card.appendChild(el("p", {class:"muted"}, tr('sidequests.completed', '✅ Missione completata')));
    if(lv.next_intro){
      card.appendChild(el("p", {class:"bubble"}, `${tr('ui.nextIntroPrefix', 'Prossimo:')} ${lv.next_intro}`));
    }
    return card;
  }

  if(!unlocked){
    card.appendChild(el("p", {}, tr('sidequests.unlockHint', 'Completa altri capitoli per sbloccare questa missione.')));
    return card;
  }

  const pow = el('div', {class:'powerups'});
  const attachButton = (id, requireFailure=false) => {
    if(inventoryCount(id) <= 0){
      powerupButtons[id] = null;
      return null;
    }
    const btn = el('button', {class:'secondary'});
    btn.dataset.iconOnly = '1';
    updatePowerupButton(btn, id);
    powerupButtons[id] = btn;
    if(requireFailure) btn.dataset.requireFailure = '1';
    if(requireFailure && !hasFailed){
      const meta = powerupMeta(id);
      const msg = meta.lockedLabel || `${meta.label || 'Oggetto'} (disponibile dopo un fallimento)`;
      btn.disabled = true;
      btn.title = msg;
      btn.setAttribute('aria-label', msg);
      syncPowerupButtonState(btn);
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
      const metaInfo = powerupMeta(id);
      const activating = powerupActivating(metaInfo);
      showPowerupStatus(btn, id, activating);
    };
    pow.appendChild(btn);
    return btn;
  };
  hintBtn = attachButton('hint_token', true);
  revealBtn = attachButton('reveal_test', true);
  mirrorBtn = attachButton('reveal_suite', true);
  if(pow.childNodes.length){ card.appendChild(pow); }

  const editor = el("textarea", {class:"editor"});
  editor.value = lv.signature;
  enableEditorTabSupport(editor);

  const bubble = el("div", {class:"bubble"}, tr('ui.readyPrompt', 'Pronto quando lo sei tu!'));
  const btn = el("button", {}, tr('ui.runTests', 'Esegui Test'));
  const actions = el("div", {class:"actions"}, btn);

  btn.addEventListener("click", async () => {
    bubble.textContent = tr('ui.loading', 'Esecuzione in corso...');
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
        body: JSON.stringify({level_id: lv.id, code: editor.value, player_role: profile.role, player_name: profile.name, items_used: consumed, language: currentLanguage()})
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
        bubble.appendChild(el('p', {class:'muted'}, tr('ui.extraHintPrefix', 'La pergamena suggerisce:')));
        bubble.appendChild(el('p', {class:'extra-hint'}, res.extra_hint));
      }
      if(res.reveal_details && res.reveal_details.length){
        const revealLabel = revealSource === 'mirror'
          ? tr('ui.mirrorReveal', 'Lo specchio rivela:')
          : tr('ui.lensReveal', 'La lente rivela:');
        bubble.appendChild(el('p', {class:'muted'}, revealLabel));
        const list = el('ul', {class:'powerup-details'});
        res.reveal_details.forEach(msg => list.appendChild(el('li', {}, msg)));
        bubble.appendChild(list);
      }
      if(res.passed){
        onProgress(lv.id, true);
        let rewardAchievementLabel = '';
        if (res.achievement){
          const normalizedAchievement = normalizeAchievementEntry(res.achievement);
          const currentAchievements = store.achievements;
          if(normalizedAchievement && typeof normalizedAchievement !== 'string'){
            if(!hasAchievement(currentAchievements, normalizedAchievement)){
              currentAchievements.push(normalizedAchievement);
              store.achievements = currentAchievements;
            } else {
              store.achievements = currentAchievements;
            }
            rewardAchievementLabel = presentAchievement(normalizedAchievement);
          } else {
            if(!hasAchievement(currentAchievements, res.achievement)){
              currentAchievements.push(res.achievement);
              store.achievements = currentAchievements;
            }
            rewardAchievementLabel = presentAchievement(res.achievement);
          }
        }
        const before = store.xp;
        const gained = typeof res.xp_gained === "number" ? res.xp_gained : 0;
        store.xp = before + gained;
        const lvlBefore = 1 + Math.floor(before / 50);
        const lvlAfter = 1 + Math.floor(store.xp / 50);
        let goldGain = isSidequest ? 3 : 2;
        if(!wasCompleted && !isSidequest && /_l5$/.test(baseLevelId)) goldGain += 5;
        const goldBefore = store.gold;
        store.gold = goldBefore + goldGain;
        let html = `<h3>${tr('ui.rewardTitle', 'Ricompensa')}</h3>`;
        if(rewardAchievementLabel){
          const rewardIcon = achievementIconFor(rewardAchievementLabel);
          html += `<div class="award"><span class="medal">${rewardIcon}</span><span class="text">${rewardAchievementLabel}</span></div>`;
        }
        if(gained) html += `<p><strong>${tr('ui.xpGained', 'XP guadagnati')}:</strong> +${gained}</p>`;
        if(goldGain) html += `<p><strong>${tr('ui.goldGained', "Monete d'oro")}:</strong> +${goldGain}</p>`;
        if(res.narration) html += `<p>${res.narration}</p>`;
        if(res.next_intro) html += `<p><em>${tr('ui.nextPrompt', 'Prossimo')}:</em> ${res.next_intro}</p>`;
        if(lvlAfter > lvlBefore) html += `<p><strong>${tr('ui.levelUpShort', 'Level Up!')}</strong> ${tr('ui.levelUpMessage', 'Ora sei livello {level}.', { level: lvlAfter })}</p>`;
        showRewardDialog(html);
        renderSidequests();
      }
    }catch(e){
      bubble.innerHTML = tr('ui.networkError', 'Errore di rete. Riprova.');
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

async function renderSidequests(){
  const container = document.getElementById('sidequests');
  if(!container) return;
  const profile = store.profile;
  const intro = document.getElementById('sidequestIntro');
  if(!profile){
    container.innerHTML = '';
    if(intro) intro.textContent = tr('sidequests.noProfile', 'Crea un personaggio nella pagina principale per affrontare le missioni opzionali.');
    return;
  }
  const lvl = playerLevel(store.xp);
  if(intro) intro.textContent = tr('sidequests.callToAction', 'Completa queste missioni per ottenere sigilli e XP extra.');
  const role = profile.role ? canonicalRole(profile.role) : null;
  const query = `/api/sidequests?player_level=${lvl}${role ? `&role=${role}` : ''}`;
  try{
    const quests = await api(query);
    container.innerHTML = '';
    if(!Array.isArray(quests) || quests.length === 0){
      container.appendChild(el('p', {class:'muted'}, tr('sidequests.noneAvailable', 'Nessuna missione opzionale disponibile al momento.')));
      return;
    }
    const progress = store.progress;
    const rerender = () => renderSidequests();
    quests.forEach((quest, idx) => {
      const unlock = typeof quest.unlock_level === 'number' ? quest.unlock_level : parseInt(quest.unlock_level, 10) || 1;
      const unlocked = lvl >= unlock;
      const completed = !!progress[quest.id];
      if(!unlocked){
        const card = el('div', {class:'card locked'},
          el('h3', {}, `🔒 ${quest.name}`),
          el('p', {class:'muted'}, tr('sidequests.locked', `Richiede livello ${unlock}.`, { level: unlock }))
        );
        container.appendChild(card);
      } else {
        const card = renderLevel(quest, idx, true, completed, (id, ok) => {
          progress[id] = ok || progress[id];
          store.progress = progress;
          rerender();
          renderAchievements();
        });
        container.appendChild(card);
      }
    });
  }catch(e){
    container.innerHTML = '';
    container.appendChild(el('p', {class:'muted'}, tr('sidequests.loadError', 'Impossibile caricare le missioni opzionali. Riprova piu tardi.')));
  }
}

function initPageButtons(){
  const back = document.getElementById('backBtn');
  if(back) back.onclick = () => { window.location.href = '/'; };

  const comp = document.getElementById('compendiumBtn');
  if(comp) comp.onclick = () => window.open('/static/compendium.html','_blank');

  const shop = document.getElementById('shopBtn');
  if(shop) shop.onclick = () => { window.location.href = '/static/shop.html'; };

  const close = document.getElementById('rewardCloseBtn');
  if(close) close.onclick = () => document.getElementById('rewardDialog').close();
}

async function main(){
  initPageButtons();
  if(I18N){
    const selector = document.getElementById('languageSelect');
    I18N.initLanguageSelector(selector);
    I18N.applyTranslations(document);
  }
  try{
    const rolesData = await api('/api/roles');
    ROLE_LABELS = { ...ROLE_LABELS, ...(rolesData.labels || {}) };
  }catch{}
  await loadAchievementCatalogs();
  normalizeStoredAchievements();
  renderProfile();
  renderXP();
  renderAchievements();
  await renderSidequests();
}

document.addEventListener("DOMContentLoaded", main);

window.addEventListener('pq-language-changed', async () => {
  try{
    const rolesData = await api('/api/roles');
    ROLE_LABELS = { ...ROLE_LABELS, ...(rolesData.labels || {}) };
  }catch{}
  await loadAchievementCatalogs();
  normalizeStoredAchievements();
  if(I18N){
    const selector = document.getElementById('languageSelect');
    if(selector) selector.value = currentLanguage();
    I18N.applyTranslations(document);
  }
  renderProfile();
  renderXP();
  renderAchievements();
  await renderSidequests();
});
