/**
 * 關鍵素材預載與解碼。
 * 開場只等待第一場景與人物；第二、三場景會在背景預載，進場前再確認完成。
 */
(function setupAssetPreloader() {
  const assetGroups = {
    startup: [
      'assets/backgrounds/wall_48_9.png',
      'assets/backgrounds/floor.png',
      'assets/items/mural.png',
      'assets/items/torch.png',
      'assets/道具/石堆.png',
      'assets/items/door_closed.png',
      'assets/道具/開啟的石門.png',
      'assets/items/statue_closed.png',
      'assets/items/statue_opened.png',
      'assets/道具/太陽徽章.png',
      'assets/items/石碑.png',
      'assets/items/altars4.png',
      'assets/items/slates4.png',
      'assets/characters/aaron_design.png',
      'assets/characters/aaron/走路動畫/0.2倍數.gif',
      'assets/characters/aaron/idle/idle_01.png',
      'assets/characters/aaron/idle/idle_02.png',
      'assets/characters/aaron/idle/idle_03.png',
      'assets/characters/aaron/idle/idle_04.png',
      'assets/characters/aaron/idle_right/idle_01right.png',
      'assets/characters/aaron/idle_right/idle_02right.png',
      'assets/characters/aaron/idle_right/idle_03right.png',
      'assets/characters/aaron/idle_right/idle_04right.png'
    ],
    judgement: [
      'assets/道具/最新的牆壁.png',
      'assets/backgrounds/floor.png',
      'assets/道具/天秤.png',
      'assets/道具/暗格打開的天秤.png',
      'assets/道具/放面具的.png',
      'assets/道具/放羽毛的祭壇.png',
      'assets/道具/放心臟.png',
      'assets/道具/放聖甲蟲.png',
      'assets/道具/面具.png',
      'assets/道具/羽毛.png',
      'assets/道具/石頭心臟.png',
      'assets/道具/聖甲蟲.png',
      'assets/道具/關上的石門.png',
      'assets/道具/開啟的石門.png',
      'assets/道具/往法老大廳的門.png',
      'assets/道具/打開的門.png',
      'assets/items/torch.png',
      'assets/道具/護符.png'
    ],
    tomb: [
      'assets/道具/法老王墓室太陽月亮柱子.png',
      'assets/道具/祭壇愛心.png',
      'assets/道具/愛心祭壇沒有愛心.png',
      'assets/道具/往法老大廳的門.png',
      'assets/道具/銅鏡.png',
      'assets/items/torch.png'
    ]
  };

  const assetPromises = new Map();
  const groupPromises = new Map();
  const groupProgress = new Map();
  let activeLoadingGroup = null;

  function updateLoadingOverlay(message, completed = 0, total = 0) {
    const overlay = document.getElementById('loading-overlay');
    const label = document.getElementById('loading-label');
    const progress = document.getElementById('loading-progress');
    if (overlay) overlay.classList.remove('hidden');
    if (label) label.textContent = message;
    if (progress) {
      const percent = total > 0 ? Math.round(completed / total * 100) : 0;
      progress.style.width = `${percent}%`;
      progress.parentElement?.setAttribute('aria-valuenow', String(percent));
    }
  }

  function hideLoadingOverlay() {
    activeLoadingGroup = null;
    document.getElementById('loading-overlay')?.classList.add('hidden');
  }

  function preloadImage(url) {
    if (assetPromises.has(url)) return assetPromises.get(url);

    const promise = new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = async ok => {
        if (settled) return;
        settled = true;
        if (ok && typeof image.decode === 'function') {
          try { await image.decode(); } catch (error) {}
        }
        resolve({ url, ok });
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = url;
      if (image.complete) finish(Boolean(image.naturalWidth));
    });

    assetPromises.set(url, promise);
    return promise;
  }

  function preloadAssetGroup(groupName, message = '正在整理古墓中的影像……', showOverlay = true) {
    if (groupPromises.has(groupName)) {
      const progress = groupProgress.get(groupName) || { completed: 0, total: 0 };
      if (showOverlay) {
        activeLoadingGroup = groupName;
        updateLoadingOverlay(message, progress.completed, progress.total);
      }
      return groupPromises.get(groupName);
    }
    const urls = [...new Set(assetGroups[groupName] || [])];
    let completed = 0;
    groupProgress.set(groupName, { completed, total: urls.length });
    if (showOverlay) {
      activeLoadingGroup = groupName;
      updateLoadingOverlay(message, completed, urls.length);
    }

    const promise = Promise.all(urls.map(url => preloadImage(url).then(result => {
      completed += 1;
      groupProgress.set(groupName, { completed, total: urls.length });
      if (showOverlay || activeLoadingGroup === groupName) {
        updateLoadingOverlay(message, completed, urls.length);
      }
      return result;
    })));
    groupPromises.set(groupName, promise);
    return promise;
  }

  async function preloadGameAssets(targetScene = 'sun_temple', options = {}) {
    const showOverlay = typeof options === 'boolean' ? options : options.showOverlay !== false;
    await preloadAssetGroup('startup', '正在載入神殿與探險者……', showOverlay);

    if (targetScene === 'judgement_chamber') {
      await preloadAssetGroup('judgement', '正在準備審判室……', showOverlay);
    } else if (targetScene === 'pharaoh_tomb') {
      await preloadAssetGroup('tomb', '正在準備法老王墓室……', showOverlay);
    }

    if (showOverlay) hideLoadingOverlay();

    // 進入目標場景後，再利用遊玩時間準備尚未使用的場景。
    preloadAssetGroup('judgement', '正在準備審判室……', false);
    preloadAssetGroup('tomb', '正在準備法老王墓室……', false);
  }

  async function preloadSceneAssets(groupName, message) {
    await preloadAssetGroup(groupName, message);
    hideLoadingOverlay();
  }

  window.preloadGameAssets = preloadGameAssets;
  window.preloadSceneAssets = preloadSceneAssets;
  window.hideGameLoadingOverlay = hideLoadingOverlay;
  window.gameAssetGroups = assetGroups;
})();
