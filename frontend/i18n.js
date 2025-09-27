(function(){
  const FALLBACK = 'it';
  const SUPPORTED = ['it', 'en'];
  const LANGUAGE_LABELS = {
    it: 'Italiano',
    en: 'English'
  };

  const STRINGS = {
    it: {
      'language.label': 'Lingua',
      'compendium.windowTitle': 'Compendio — Code & Dragons RPG',
      'compendium.heading': "📜 Compendio dell'Avventuriero",
      'compendium.generatedAt': 'Generato il {datetime}',
      'compendium.button.print': 'Stampa',
      'compendium.progressHeading': '🧭 Progressi',
      'compendium.achievementsHeading': '🏅 Conquiste',
      'compendium.noProfile': 'Nessun profilo trovato.',
      'compendium.noProgress': 'Nessun livello completato.',
      'compendium.profileXP': 'XP'
    },
    en: {
      'language.label': 'Language',
      'language.option.it': 'Italiano',
      'language.option.en': 'English',
      'sidebar.character': '🎭 Character',
      'sidebar.achievements': '🏅 Achievements',
      'buttons.newGame': 'New Game',
      'buttons.save': 'Save',
      'buttons.load': 'Load',
      'buttons.shop': 'Shop',
      'buttons.sidequests': 'Side Quests',
      'buttons.compendium': 'Compendium',
      'main.tagline': 'Turn study into adventure: code, fight, and claim glory.',
      'profileDialog.title': 'Create Your Character',
      'profileDialog.name': 'Name',
      'profileDialog.name.placeholder': 'e.g. Aurora',
      'profileDialog.role': 'Role',
      'buttons.cancel': 'Cancel',
      'buttons.confirmSave': 'Start',
      'buttons.close': 'Close',
      'dialog.load': 'Load',
      'dialog.close': 'Close',
      'ui.noProfile': 'No profile',
      'ui.noAchievements': 'Empty (no achievements).',
      'ui.readyPrompt': 'Ready whenever you are!',
      'ui.runTests': 'Run Tests',
      'ui.loading': 'Running...',
      'ui.networkError': 'Network error. Try again.',
      'ui.invalidSave': 'Invalid save file.',
      'ui.importedSaveTitle': 'Save imported',
      'ui.importedSaveBody': 'Welcome back to the adventure!',
      'ui.extraHintPrefix': 'The scroll whispers:',
      'ui.mirrorReveal': 'The mirror reveals:',
      'ui.lensReveal': 'The lens reveals:',
      'ui.rewardTitle': 'Reward',
      'ui.xpGained': 'XP gained',
      'ui.goldGained': 'Gold coins',
      'ui.nextPrompt': 'Next',
      'ui.levelUpShort': 'Level Up!',
      'ui.levelUpMessage': 'Now you are level {level}.',
      'ui.xpStatus': '{current}/50 XP (missing {remaining})',
      'ui.powerupSingleUse': '1 use available',
      'ui.powerupMultipleUse': '{count} uses available',
      'ui.useItem': 'Use Item',
      'ui.itemAvailableAfterFail': '{name} (available after a failure)',
      'ui.chapterCompleted': '✅ Level completed',
      'ui.nextIntroPrefix': 'Next:',
      'ui.unlockPrevious': 'Complete the previous level to unlock.',
      'sidequests.completed': '✅ Quest completed',
      'sidequests.unlockHint': 'Complete other chapters to unlock this quest.',
      'ui.merchantNoProfileTitle': 'No items available without an active character.',
      'ui.merchantNoProfileMessage': 'Create a character on the main page to tackle optional quests.',
      'shop.title': '🛒 Wonder Emporium',
      'shop.subtitle': 'Spend your gold to purchase consumables with gameplay effects.',
      'shop.button.buy': 'Buy',
      'shop.button.sell': 'Sell',
      'shop.inventory.empty': 'No consumables in inventory.',
      'shop.inventory.inStock': 'In inventory: {count}',
      'shop.message.noGold': 'Not enough coins.',
      'shop.message.purchase': 'Purchase successful: {item}',
      'shop.message.cannotSell': 'This item cannot be sold.',
      'shop.message.noneToSell': 'You have no copies of this consumable to sell.',
      'shop.message.sale': 'Sale successful: {item} (+{gold} coins)',
      'shop.button.back': 'Return to Story',
      'shop.button.sidequests': 'Side Quests',
      'shop.priceLabel': 'Price:',
      'shop.priceSuffix': 'coins',
      'sidequests.title': 'Optional Missions',
      'sidequests.noneAvailable': 'No optional missions available for now.',
      'sidequests.loadError': 'Unable to load optional missions. Try again later.',
      'sidequests.noProfile': 'Create a character on the main page to tackle optional quests.',
      'sidequests.callToAction': 'Complete these quests to earn sigils and extra XP.',
      'sidequests.locked': 'Requires level {level}.',
      'ui.chapterHeading': 'Chapter {number}',
      'ui.profileGold': "Gold coins",
      'ui.profileLevel': 'Level',
      'ui.profileName': 'Name',
      'ui.profileRole': 'Role',
      'shop.inventory.title': '🧾 Inventory',
      'powerups.hint.label': 'Use Hint Scroll',
      'powerups.hint.activating': 'Scroll activating…',
      'powerups.hint.name': 'Hint Scroll',
      'powerups.reveal.label': 'Use Revealing Lens',
      'powerups.reveal.activating': 'Lens activating…',
      'powerups.reveal.name': 'Revealing Lens',
      'powerups.mirror.label': 'Use Omniscient Mirror',
      'powerups.mirror.activating': 'Mirror activating…',
      'powerups.mirror.name': 'Omniscient Mirror',
      'ui.welcomeHeading': 'Welcome, {name} ({role})',
      'ui.levelFallback': 'Level',
      'report.subjectPrefix': '[Report] {level}',
      'report.greeting': 'Hello,',
      'report.problem': 'I am encountering an issue with the level "{level}" (ID: {id}).',
      'report.details': 'Details:',
      'report.linkTitle': 'Report a problem for {level}',
      'report.linkLabel': 'Report issue',
      'shop.item.hint.name': 'Hint Scroll',
      'shop.item.hint.description': 'Consume to receive an extra hint when a level fails.',
      'shop.item.reveal.name': 'Revealing Lens',
      'shop.item.reveal.description': 'Consume to reveal details about failed tests after an attempt.',
      'shop.item.mirror.name': 'Omniscient Mirror',
      'shop.item.mirror.description': 'Consume after a failed attempt to reveal the entire available test suite.',
      'compendium.windowTitle': 'Compendium — Code & Dragons RPG',
      'compendium.heading': "📜 Adventurer's Compendium",
      'compendium.generatedAt': 'Generated on {datetime}',
      'compendium.button.print': 'Print',
      'compendium.progressHeading': '🧭 Progress',
      'compendium.achievementsHeading': '🏅 Achievements',
      'compendium.noProfile': 'No profile found.',
      'compendium.noProgress': 'No levels completed yet.',
      'compendium.profileXP': 'XP'
    }
  };

  function normalize(lang){
    if(!lang) return FALLBACK;
    const lowered = String(lang).toLowerCase();
    const base = lowered.includes('-') ? lowered.split('-')[0] : lowered;
    return SUPPORTED.includes(base) ? base : FALLBACK;
  }

  let current = normalize(localStorage.getItem('pq_language') || (navigator.language || navigator.userLanguage));

  function template(key, fallback){
    const lang = current;
    const collection = STRINGS[lang] || {};
    if(key in collection) return collection[key];
    if(lang !== FALLBACK){
      const base = STRINGS[FALLBACK] || {};
      if(key in base) return base[key];
    }
    return fallback !== undefined ? fallback : key;
  }

  function format(str, params){
    if(!params) return str;
    return str.replace(/\{([^}]+)\}/g, (m, name) => {
      if(Object.prototype.hasOwnProperty.call(params, name)){
        return params[name];
      }
      return m;
    });
  }

  function t(key, fallback, params){
    return format(template(key, fallback), params);
  }

  function getLanguage(){
    return current;
  }

  function setLanguage(lang){
    const norm = normalize(lang);
    if(norm === current) return;
    current = norm;
    localStorage.setItem('pq_language', current);
    document.documentElement.lang = current;
    applyTranslations();
    window.dispatchEvent(new CustomEvent('pq-language-changed', { detail: { language: current } }));
  }

  function availableLanguages(){
    return SUPPORTED.slice();
  }

  function languageLabels(){
    return availableLanguages().reduce((acc, lang) => {
      acc[lang] = t(`language.option.${lang}`, LANGUAGE_LABELS[lang] || lang);
      return acc;
    }, {});
  }

  function applyTranslations(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-i18n-key]').forEach(node => {
      const key = node.getAttribute('data-i18n-key');
      const fallback = node.getAttribute('data-i18n-default') ?? node.textContent;
      node.textContent = t(key, fallback);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
      const key = node.getAttribute('data-i18n-placeholder');
      if(!key) return;
      const fallback = node.getAttribute('data-i18n-placeholder-default') ?? node.getAttribute('placeholder');
      node.setAttribute('placeholder', t(key, fallback));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(node => {
      const key = node.getAttribute('data-i18n-title');
      if(!key) return;
      const fallback = node.getAttribute('data-i18n-title-default') ?? node.getAttribute('title');
      node.setAttribute('title', t(key, fallback));
    });
  }

  function initLanguageSelector(selectEl){
    if(!selectEl) return;
    const options = availableLanguages();
    selectEl.innerHTML = '';
    options.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = t(`language.option.${lang}`, LANGUAGE_LABELS[lang] || lang);
      selectEl.appendChild(opt);
    });
    selectEl.value = current;
    selectEl.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }

  document.documentElement.lang = current;

  window.I18N = {
    t,
    getLanguage,
    setLanguage,
    initLanguageSelector,
    applyTranslations,
    availableLanguages,
    languageLabels,
    normalizeLanguage: normalize
  };
})();
