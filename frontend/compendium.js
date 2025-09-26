(async function(){
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
  const ROLE_LABELS = {
    mage: 'Mago',
    rogue: 'Ladro',
    swordsman: 'Spadaccino',
    alchemist: 'Alchimista',
    ranger: 'Ranger'
  };

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

  // Avatar generator (same logic as app.js, simplified)
  function prng(seed){ let x = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) >>> 0; return () => (x = Math.imul(x ^ (x>>>15), 0x85EBCA6B) >>> 0) / 0xFFFFFFFF; }
  const ROLE_PALETTES = {
    mage:["#3b82f6","#60a5fa","#1e40af"], rogue:["#22c55e","#4ade80","#166534"], swordsman:["#f97316","#fdba74","#7c2d12"], alchemist:["#a78bfa","#c4b5fd","#4c1d95"], ranger:["#10b981","#34d399","#065f46"] };
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
      const res = await fetch(`/api/levels${slug ? `?role=${encodeURIComponent(slug)}` : ''}`);
      if(!res.ok) return map;
      const levels = await res.json();
      levels.forEach(lv => {
        if(!lv || !lv.id) return;
        if(typeof lv.name === 'string' && lv.name.trim()){
          map[lv.id] = lv.name;
          const baseId = lv.id.includes('__') ? lv.id.split('__')[0] : lv.id;
          if(!(baseId in map)) map[baseId] = lv.name;
        }
      });
    }catch{
      // fall back to ids if fetch fails
    }
    return map;
  }

  // External sprite support (same idea as app.js)
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
  // Achievements
  const achievements = getLS('pq_achievements', []);
  const xp = Number(localStorage.getItem('pq_xp') || '0');
  // sidequests rimosse
  // items rimossi
  const lvl = 1 + Math.floor(xp/50);

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

  document.getElementById('generatedAt').textContent = 'Generato il ' + new Date().toLocaleString();

  const prof = document.getElementById('profile');
  if(profile){
    const av = (profile.avatar && typeof profile.avatar.variant === 'number') ? profile.avatar : {role: profile.role, variant:0};
    const label = roleLabel(profile.role);
    const img = `<div class="comp-avatar"><img alt="${esc(label)}" src="${avatarDataUrl(av.role, av.variant)}"/></div>`;
    prof.innerHTML = `${img}<div><strong>Nome:</strong> ${esc(profile.name)}<br/>
                      <strong>Ruolo:</strong> ${esc(label)}<br/>
                      <strong>Livello:</strong> ${lvl}<br/>
                      <strong>XP:</strong> ${xp}</div>`;
    // Upgrade to external sprite if present
    upgradeAvatarInContainer(prof, av.role, av.variant);
  } else {
    prof.innerHTML = '<em>Nessun profilo trovato</em>';
  }

  // Progressi (elenco capitoli completati)
  const progDiv = document.getElementById('progress');
  const completed = Object.keys(progress).filter(k => progress[k]);
  if(completed.length === 0){
    progDiv.innerHTML = '<em>Nessun livello completato</em>';
  } else {
    const ul = document.createElement('ul');
    completed.forEach(id => {
      const li = document.createElement('li');
      li.textContent = '✅ ' + progressLabel(id);
      ul.appendChild(li);
    });
    progDiv.appendChild(ul);
  }

  // Achievements
  const achUL = document.getElementById('achievements');
  if(achievements.length === 0){
    achUL.innerHTML = '<li class="muted">—</li>';
  } else {
    achievements.forEach(a => {
      const li = document.createElement('li');
      li.textContent = a;
      achUL.appendChild(li);
    });
  }

  // Sidequests rimosse

  // Items rimossi

  document.getElementById('printBtn').addEventListener('click', () => window.print());
})();
