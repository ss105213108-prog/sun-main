(() => {
  const OBJECTIVES = {
    sun_temple: progress => {
      if (!progress.investigatedMural) return '調查神殿壁畫，尋找試煉線索';
      const slateCount = [progress.investigatedMural, progress.torchTaken, progress.investigatedTablet]
        .filter(Boolean).length;
      if (slateCount < 3) return `尋找長廊中的祭壇石板（${slateCount}／3）`;
      if (!progress.puzzleCleared) return '前往四座祭壇，排列祭壇石板';
      if (!progress.sunBadgeTaken) return '調查甦醒的拉神石像，取得太陽徽章';
      return '將太陽徽章放上右側石門';
    },
    judgement_chamber: progress => {
      if (!progress.judgementMuralRead && !progress.scalePuzzleIntroduced) {
        return '探索審判室，尋找天秤試煉的線索';
      }
      if (
        progress.judgementMuralRead
        && !progress.scaleCompartmentOpened
        && !progress.scaleCompartmentSealed
      ) {
        return '查看審判天秤，確認壁畫留下的線索';
      }

      const collectedCount = Object.values(progress.collectedTrialItems || {}).filter(Boolean).length;
      if (collectedCount < 4) return '探索四座祭壇，準備天秤審判';
      if (!progress.scaleCleared) return '完成天秤審判';
      return '通過右側石門，前往法老王墓室';
    },
    pharaoh_tomb: progress => {
      if (!progress.tombMechanismActivated && !progress.priestAmuletActivated) return '調查中央王座的護符凹槽';
      if (!progress.mirrorPuzzleSolved) return '旋轉三面銅鏡，讓光線回到王座';
      if (progress.sunHeartTaken === null || typeof progress.sunHeartTaken === 'undefined') {
        return '前往右側祭壇，決定太陽之心的去留';
      }
      if (progress.tombEscapeActive) return '返回最左側石門，逃離墓室';
      return '試煉完成';
    }
  };

  let lastObjectiveText = '';

  function resolveGame() {
    if (typeof Game !== 'undefined') return Game;
    return window.Game || globalThis.Game;
  }

  function getCurrentObjectiveText(game = resolveGame()) {
    if (!game) return '';
    const resolver = OBJECTIVES[game.currentScene];
    return resolver ? resolver(game.progress || {}) : '';
  }

  function updateCurrentObjective() {
    const game = resolveGame();
    const objective = document.getElementById('current-objective');
    const text = document.getElementById('current-objective-text');
    if (!game || !objective || !text) return;

    const objectiveText = getCurrentObjectiveText(game);
    const shouldHide = !objectiveText
      || game.inCutscene
      || game.state === 'MENU'
      || game.state === 'ENDING'
      || game.state === 'GAME_OVER';

    objective.classList.toggle('hidden', shouldHide);
    if (!shouldHide && objectiveText !== lastObjectiveText) {
      text.textContent = objectiveText;
      lastObjectiveText = objectiveText;
    }
  }

  window.getCurrentObjectiveText = getCurrentObjectiveText;
  window.updateCurrentObjective = updateCurrentObjective;
})();
