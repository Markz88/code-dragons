(async function(){
  const DEFAULT_LANG = 'it';
  const I18N = window.I18N;
  const tr = (key, fallback, params) => {
    if(I18N){
      return I18N.t(key, fallback, params);
    }
    if(typeof fallback !== 'string' || !fallback){
      return key;
    }
    if(params){
      return fallback.replace(/\{([^}]+)\}/g, (_, name) => (name in params ? params[name] : `{${name}}`));
    }
    return fallback;
  };
  const currentLanguage = () => (I18N ? I18N.getLanguage() : DEFAULT_LANG);

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

  async function api(path, opts){
    const finalPath = withLang(path);
    const res = await fetch(finalPath, opts);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  if(I18N){
    I18N.applyTranslations(document);
    document.title = tr('compendium.windowTitle', 'Compendio — Code & Dragons RPG');
    window.addEventListener('pq-language-changed', () => window.location.reload());
  }

  function getLS(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function esc(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

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

  async function loadRoleLabels(){
    try{
      const data = await api('/api/roles');
      if(data && data.labels){
        ROLE_LABELS = { ...ROLE_LABELS, ...data.labels };
      }
    }catch{}
  }

  function canonicalRole(role){
    try {
      const slug = String(role||'').toLowerCase();
      for(const [id, aliases] of Object.entries(ROLE_ALIASES)){
        if (slug === id || aliases.includes(slug)) return id;
      }
      return DEFAULT_ROLE;
    } catch {
      return DEFAULT_ROLE;
    }
  }

  function roleLabel(role){
    const canon = canonicalRole(role);
    return ROLE_LABELS[canon] || canon;
  }

  function prng(seed){ let x = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) >>> 0; return () => (x = Math.imul(x ^ (x>>>15), 0x85EBCA6B) >>> 0) / 0xFFFFFFFF; }
  const ROLE_PALETTES = {
    mage:["#3b82f6","#60a5fa","#1e40af"],
    rogue:["#22c55e","#4ade80","#166534"],
    swordsman:["#f97316","#fdba74","#7c2d12"],
    alchemist:["#a78bfa","#c4b5fd","#4c1d95"],
    ranger:["#10b981","#34d399","#065f46"]
  };
  function pixelIconSVG(role, variant){
    const canon = canonicalRole(role);
    const sz=8, px=8, pad=2;
    const colors=ROLE_PALETTES[canon]||ROLE_PALETTES[DEFAULT_ROLE];
    const seed = (canon.charCodeAt(0)||DEFAULT_ROLE.charCodeAt(0))*31 + (variant%10);
    const rnd=prng(seed);
    let rects='';
    for(let y=0;y<sz;y++){
      for(let x=0;x<Math.ceil(sz/2);x++){
        const on = rnd()>0.5 || (y<2 && x<2);
        if(on){
          const c = colors[(x+y)%colors.length];
          const rx = pad + x*px, ry = pad + y*px, mx = pad + (sz-1-x)*px;
          rects += `<rect x="${rx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`;
          if(mx!==rx){ rects += `<rect x="${mx}" y="${ry}" width="${px}" height="${px}" fill="${c}"/>`; }
        }
      }
    }
    const w = pad*2 + sz*px; const bg = '#0b1020';
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}' viewBox='0 0 ${w} ${w}'><rect x='0' y='0' width='${w}' height='${w}' fill='${bg}'/>${rects}</svg>`;
  }
  function avatarDataUrl(role, variant){ return `data:image/svg+xml;utf8,${encodeURIComponent(pixelIconSVG(role, variant))}`; }

  function fallbackLevelNameFromId(id){
    if(typeof id !== 'string') return String(id);
    return id.replaceAll('_',' ');
  }

  async function fetchLevelNameMap(role){
    const map = {};
    try{
      const slug = role ? canonicalRole(role) : null;
      const query = slug ? `?role=${encodeURIComponent(slug)}` : '';
      const levels = await api(`/api/levels${query}`);
      levels.forEach(lv => {
        if(!lv || !lv.id) return;
        if(typeof lv.name === 'string' && lv.name.trim()){
          map[lv.id] = lv.name;
          const baseId = lv.id.includes('__') ? lv.id.split('__')[0] : lv.id;
          if(!(baseId in map)) map[baseId] = lv.name;
        }
      });
    }catch{}
    return map;
  }

  function roleSlug(role){ return canonicalRole(role); }
  const ROLE_FOLDER_ALIASES = { mage:ROLE_ALIASES.mage, rogue:ROLE_ALIASES.rogue, swordsman:ROLE_ALIASES.swordsman, alchemist:ROLE_ALIASES.alchemist, ranger:ROLE_ALIASES.ranger };
  function pad2(n){ const v=(Number(n)||0)+1; return v<9?`0${v}`:(v===9?'09':(v===10?'10':String(v).padStart(2,'0'))); }
  function externalAvatarUrlCandidates(role, variant){
    const r = roleSlug(role);
    const folders = ROLE_FOLDER_ALIASES[r] || [r];
    const nn = pad2((variant%10+10)%10);
    const urls = []; const seen = new Set();
    [r, ...folders].forEach(f=>{ if(!seen.has(f)){ seen.add(f); urls.push(`/static/assets/avatars/${f}/${nn}.png`);} });
    return urls;
  }
  async function probeFirstExisting(urls){
    for(const url of urls){
      try{ const res = await fetch(url, {method:'HEAD'}); if(res && res.ok) return url; }catch{}
    }
    return null;
  }
  async function upgradeAvatarInContainer(container, role, variant){
    const img = container.querySelector('img');
    if(!img) return;
    const url = await probeFirstExisting(externalAvatarUrlCandidates(role, variant));
    if(url){ img.src = url; }
  }

  const profile = getLS('pq_profile', null);
  const progress = getLS('pq_progress', {});
  const achievements = getLS('pq_achievements', []);
  const xp = Number(localStorage.getItem('pq_xp') || '0');
  const lvl = 1 + Math.floor(xp/50);

  await loadRoleLabels();
  await loadAchievementCatalogs();
  const levelNameMap = await fetchLevelNameMap(profile ? profile.role : null);

  function progressLabel(id){
    if(typeof id !== 'string') return String(id);
    let lookupId = id;
    let suffix = '';
    if(id.includes('__')){
      const [base, role] = id.split('__');
      lookupId = base;
      if(role){
        const label = roleLabel(role);
        suffix = label ? ` (${label})` : '';
      }
    }
    const name = levelNameMap[id] || levelNameMap[lookupId];
    const baseName = (typeof name === 'string' && name.trim()) ? name : fallbackLevelNameFromId(lookupId);
    return `${baseName}${suffix}`;
  }

  const generatedAt = document.getElementById('generatedAt');
  if(generatedAt){
    const timestamp = new Date().toLocaleString(currentLanguage());
    generatedAt.textContent = tr('compendium.generatedAt', 'Generato il {datetime}', { datetime: timestamp });
  }

  const prof = document.getElementById('profile');
  if(profile && prof){
    const av = (profile.avatar && typeof profile.avatar.variant === 'number') ? profile.avatar : {role: profile.role, variant:0};
    const label = roleLabel(profile.role);
    const img = `<div class="comp-avatar"><img alt="${esc(label)}" src="${avatarDataUrl(av.role, av.variant)}"/></div>`;
    const xpLabel = tr('compendium.profileXP', 'XP');
    prof.innerHTML = `${img}<div><strong>${tr('ui.profileName', 'Nome')}:</strong> ${esc(profile.name)}<br/>
                      <strong>${tr('ui.profileRole', 'Ruolo')}:</strong> ${esc(label)}<br/>
                      <strong>${tr('ui.profileLevel', 'Livello')}:</strong> ${lvl}<br/>
                      <strong>${xpLabel}:</strong> ${xp}</div>`;
    upgradeAvatarInContainer(prof, av.role, av.variant);
  } else if(prof){
    prof.innerHTML = `<em>${tr('compendium.noProfile', 'Nessun profilo trovato.')}</em>`;
  }

  const progDiv = document.getElementById('progress');
  if(progDiv){
    const completed = Object.keys(progress).filter(k => progress[k]);
    if(completed.length === 0){
      progDiv.innerHTML = `<em>${tr('compendium.noProgress', 'Nessun livello completato.')}</em>`;
    } else {
      const ul = document.createElement('ul');
      completed.forEach(id => {
        const li = document.createElement('li');
        li.textContent = '✅ ' + progressLabel(id);
        ul.appendChild(li);
      });
      progDiv.appendChild(ul);
    }
  }

  const achUL = document.getElementById('achievements');
  if(achUL){
    achUL.innerHTML = '';
    const achievementLabels = achievements
      .map(item => normalizeAchievementEntry(item))
      .map(item => presentAchievement(item))
      .filter(label => typeof label === 'string' && label.trim().length > 0);
    if(achievementLabels.length === 0){
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = '—';
      achUL.appendChild(empty);
    } else {
      achievementLabels.forEach(label => {
        const li = document.createElement('li');
        li.textContent = label;
        achUL.appendChild(li);
      });
    }
  }

  const printBtn = document.getElementById('printBtn');
  if(printBtn){
    printBtn.addEventListener('click', () => window.print());
  }
})();
