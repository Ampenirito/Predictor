// AetherPredict: Core Application Logic

// --- PATTERN RECOGNITION ENGINE ---
class PatternEngine {
  constructor(maxDepth = 6) {
    this.maxDepth = maxDepth;
    this.history = []; // Array of { id, actual, predicted, correct }
    this.currentPrediction = null; // { color, confidence, breakdown }
  }

  // Set the max search depth for patterns
  setDepth(depth) {
    this.maxDepth = Math.max(1, Math.min(12, depth));
    this.updatePrediction();
  }

  // Scan history to predict the next outcome
  predictNext() {
    const totalGames = this.history.length;
    if (totalGames === 0) {
      return { color: null, confidence: 50, redPercent: 50, bluePercent: 50, breakdown: [] };
    }

    const actualSequence = this.history.map(g => g.actual);
    let weightedRedScore = 0;
    let weightedBlueScore = 0;
    const breakdown = [];

    // Loop through pattern lengths from 1 to maxDepth
    for (let L = 1; L <= this.maxDepth; L++) {
      if (actualSequence.length < L) break;

      // Suffix of length L (current pattern we are matching)
      const currentSuffix = actualSequence.slice(-L);
      
      let countR = 0;
      let countB = 0;

      // Scan history for occurrences of currentSuffix (excluding the very last elements since we need the succeeding element)
      for (let i = 0; i <= actualSequence.length - L - 1; i++) {
        const slice = actualSequence.slice(i, i + L);
        if (this.arraysEqual(slice, currentSuffix)) {
          const nextVal = actualSequence[i + L];
          if (nextVal === 'R') countR++;
          if (nextVal === 'B') countB++;
        }
      }

      const totalMatches = countR + countB;
      if (totalMatches > 0) {
        // Calculate probability for this level
        const probR = countR / totalMatches;
        const probB = countB / totalMatches;

        // Weight = L^2 * totalMatches. 
        // Longer patterns get quadratic weight. Patterns that match more often get linear weight.
        const weight = Math.pow(L, 2) * totalMatches;

        weightedRedScore += probR * weight;
        weightedBlueScore += probB * weight;

        breakdown.push({
          length: L,
          pattern: currentSuffix,
          matches: totalMatches,
          nextR: countR,
          nextB: countB,
          probR: Math.round(probR * 100),
          probB: Math.round(probB * 100),
          weight: Math.round(weight * 10) / 10
        });
      }
    }

    const totalWeight = weightedRedScore + weightedBlueScore;
    let redPercent = 50;
    let bluePercent = 50;

    if (totalWeight > 0) {
      redPercent = Math.round((weightedRedScore / totalWeight) * 100);
      bluePercent = 100 - redPercent;
    } else {
      // Fallback: Overall distribution in history
      let globalR = 0;
      let globalB = 0;
      actualSequence.forEach(val => {
        if (val === 'R') globalR++;
        if (val === 'B') globalB++;
      });
      const globalTotal = globalR + globalB;
      if (globalTotal > 0) {
        redPercent = Math.round((globalR / globalTotal) * 100);
        bluePercent = 100 - redPercent;
      }
    }

    // Determine predicted color
    let predictedColor = null;
    let confidence = 50;

    if (redPercent > bluePercent) {
      predictedColor = 'R';
      confidence = redPercent;
    } else if (bluePercent > redPercent) {
      predictedColor = 'B';
      confidence = bluePercent;
    } else {
      // If exactly 50/50, predict the last result to follow trends
      predictedColor = actualSequence[actualSequence.length - 1] || 'R';
      confidence = 50;
    }

    return {
      color: predictedColor,
      confidence: confidence,
      redPercent: redPercent,
      bluePercent: bluePercent,
      breakdown: breakdown.reverse() // Longest patterns first
    };
  }

  // Scan history to predict Tone for a specific side ('leftTone' or 'rightTone')
  predictSideTone(sideKey = 'leftTone') {
    const totalGames = this.history.length;
    if (totalGames === 0) {
      return { tone: 'dark', confidence: 33, darkPercent: 33, lightPercent: 33, samePercent: 34 };
    }

    const toneSequence = this.history.map(g => g[sideKey] || 'dark');
    let weightedDarkScore = 0;
    let weightedLightScore = 0;
    let weightedSameScore = 0;

    for (let L = 1; L <= this.maxDepth; L++) {
      if (toneSequence.length < L) break;

      const currentSuffix = toneSequence.slice(-L);
      let countD = 0;
      let countL = 0;
      let countS = 0;

      for (let i = 0; i <= toneSequence.length - L - 1; i++) {
        const slice = toneSequence.slice(i, i + L);
        if (this.arraysEqual(slice, currentSuffix)) {
          const nextVal = toneSequence[i + L];
          if (nextVal === 'dark') countD++;
          if (nextVal === 'light') countL++;
          if (nextVal === 'same') countS++;
        }
      }

      const totalMatches = countD + countL + countS;
      if (totalMatches > 0) {
        const probD = countD / totalMatches;
        const probL = countL / totalMatches;
        const probS = countS / totalMatches;
        const weight = Math.pow(L, 2) * totalMatches;

        weightedDarkScore += probD * weight;
        weightedLightScore += probL * weight;
        weightedSameScore += probS * weight;
      }
    }

    const totalWeight = weightedDarkScore + weightedLightScore + weightedSameScore;
    let darkPercent = 33;
    let lightPercent = 33;
    let samePercent = 34;

    if (totalWeight > 0) {
      darkPercent = Math.round((weightedDarkScore / totalWeight) * 100);
      lightPercent = Math.round((weightedLightScore / totalWeight) * 100);
      samePercent = 100 - darkPercent - lightPercent;
    } else {
      let globalD = 0;
      let globalL = 0;
      let globalS = 0;
      toneSequence.forEach(val => {
        if (val === 'dark') globalD++;
        if (val === 'light') globalL++;
        if (val === 'same') globalS++;
      });
      const globalTotal = globalD + globalL + globalS;
      if (globalTotal > 0) {
        darkPercent = Math.round((globalD / globalTotal) * 100);
        lightPercent = Math.round((globalL / globalTotal) * 100);
        samePercent = 100 - darkPercent - lightPercent;
      }
    }

    let predictedTone = 'dark';
    let confidence = darkPercent;

    if (lightPercent > darkPercent && lightPercent >= samePercent) {
      predictedTone = 'light';
      confidence = lightPercent;
    } else if (samePercent > darkPercent && samePercent > lightPercent) {
      predictedTone = 'same';
      confidence = samePercent;
    } else {
      predictedTone = 'dark';
      confidence = darkPercent;
    }

    return {
      tone: predictedTone,
      confidence: confidence,
      darkPercent: darkPercent,
      lightPercent: lightPercent,
      samePercent: samePercent
    };
  }

  // Compare arrays
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Add actual result with Left and Right Tones
  addResult(actualColor, leftTone = 'dark', rightTone = 'dark') {
    const pred = this.currentPrediction;
    const isCorrectColor = (pred && pred.color) ? (pred.color === actualColor) : null;
    const isCorrectLeftTone = (pred && pred.leftTone) ? (pred.leftTone === leftTone) : null;
    const isCorrectRightTone = (pred && pred.rightTone) ? (pred.rightTone === rightTone) : null;

    const newGame = {
      id: Math.random().toString(36).substr(2, 9),
      actual: actualColor,
      leftTone: leftTone || 'dark',
      rightTone: rightTone || 'dark',
      predicted: (pred && pred.color) ? pred.color : null,
      predictedLeftTone: (pred && pred.leftTone) ? pred.leftTone : null,
      predictedRightTone: (pred && pred.rightTone) ? pred.rightTone : null,
      correct: isCorrectColor,
      correctLeftTone: isCorrectLeftTone,
      correctRightTone: isCorrectRightTone
    };

    this.history.push(newGame);
    this.updatePrediction();
  }

  // Delete result by ID
  deleteResult(id) {
    const index = this.history.findIndex(g => g.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.rebuildChronologicalHistory();
    }
  }

  // Re-run the simulation chronologically to ensure absolute consistency
  rebuildChronologicalHistory() {
    const rawActuals = this.history.map(g => ({
      actual: g.actual,
      leftTone: g.leftTone || g.tone || 'dark',
      rightTone: g.rightTone || 'dark'
    }));
    this.history = [];
    this.currentPrediction = null;

    for (const item of rawActuals) {
      // Make prediction based on accumulated history so far
      const colorPred = this.predictNext();
      const leftTonePred = this.predictSideTone('leftTone');
      const rightTonePred = this.predictSideTone('rightTone');

      const isCorrectColor = (colorPred && colorPred.color) ? (colorPred.color === item.actual) : null;
      const isCorrectLeftTone = (leftTonePred && leftTonePred.tone) ? (leftTonePred.tone === item.leftTone) : null;
      const isCorrectRightTone = (rightTonePred && rightTonePred.tone) ? (rightTonePred.tone === item.rightTone) : null;

      this.history.push({
        id: Math.random().toString(36).substr(2, 9),
        actual: item.actual,
        leftTone: item.leftTone,
        rightTone: item.rightTone,
        predicted: (colorPred && colorPred.color) ? colorPred.color : null,
        predictedLeftTone: (leftTonePred && leftTonePred.tone) ? leftTonePred.tone : null,
        predictedRightTone: (rightTonePred && rightTonePred.tone) ? rightTonePred.tone : null,
        correct: isCorrectColor,
        correctLeftTone: isCorrectLeftTone,
        correctRightTone: isCorrectRightTone
      });

      // Update current prediction to be the latest prediction for the NEXT game
      this.updatePrediction();
    }

    this.updatePrediction();
  }

  // Clear all data
  clearAll() {
    this.history = [];
    this.currentPrediction = null;
    this.updatePrediction();
  }

  // Recalculate predictions
  updatePrediction() {
    const colorPred = this.predictNext();
    const leftTonePred = this.predictSideTone('leftTone');
    const rightTonePred = this.predictSideTone('rightTone');

    this.currentPrediction = {
      color: colorPred.color,
      confidence: colorPred.confidence,
      redPercent: colorPred.redPercent,
      bluePercent: colorPred.bluePercent,
      breakdown: colorPred.breakdown,
      leftTone: leftTonePred.tone,
      leftConfidence: leftTonePred.confidence,
      leftDark: leftTonePred.darkPercent,
      leftLight: leftTonePred.lightPercent,
      leftSame: leftTonePred.samePercent,
      rightTone: rightTonePred.tone,
      rightConfidence: rightTonePred.confidence,
      rightDark: rightTonePred.darkPercent,
      rightLight: rightTonePred.lightPercent,
      rightSame: rightTonePred.samePercent
    };
  }

  // Load from array of raw outcomes ('R' or 'B' or objects { actual, tone })
  loadRawSequence(sequence) {
    this.history = sequence.map(item => {
      const color = typeof item === 'string' ? item : item.actual;
      const tone = typeof item === 'object' && item.tone ? item.tone : 'dark';
      return {
        id: Math.random().toString(36).substr(2, 9),
        actual: color,
        tone: tone,
        predicted: null,
        predictedTone: null,
        correct: null,
        correctTone: null
      };
    });
    this.rebuildChronologicalHistory();
  }

  // Get statistics
  getStats() {
    const total = this.history.length;
    const withPrediction = this.history.filter(g => g.predicted !== null);
    const predictedCount = withPrediction.length;
    const correctCount = withPrediction.filter(g => g.correct === true).length;
    const winrate = predictedCount > 0 ? Math.round((correctCount / predictedCount) * 100) : 0;

    // Helper for computing winrates for tone prediction
    const computeToneStats = (predicate) => {
      const matched = this.history.filter(predicate);
      const wins = matched.filter(g => g.correct === true);
      const totalCount = matched.length;
      const winCount = wins.length;
      const rate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;
      return { total: totalCount, wins: winCount, rate };
    };

    // Left Side Tone Win Rates
    const leftDark = computeToneStats(g => (g.leftTone === 'dark' || g.leftTone === 'darker') && g.predicted !== null);
    const leftLight = computeToneStats(g => g.leftTone === 'light' && g.predicted !== null);
    const leftSame = computeToneStats(g => g.leftTone === 'same' && g.predicted !== null);

    // Right Side Tone Win Rates
    const rightDark = computeToneStats(g => (g.rightTone === 'dark' || g.rightTone === 'darker') && g.predicted !== null);
    const rightLight = computeToneStats(g => g.rightTone === 'light' && g.predicted !== null);
    const rightSame = computeToneStats(g => g.rightTone === 'same' && g.predicted !== null);

    // Overall Tone Win Rates (Left + Right combined)
    const overallDarkCount = leftDark.total + rightDark.total;
    const overallDarkWins = leftDark.wins + rightDark.wins;
    const overallDarkRate = overallDarkCount > 0 ? Math.round((overallDarkWins / overallDarkCount) * 100) : 0;

    const overallLightCount = leftLight.total + rightLight.total;
    const overallLightWins = leftLight.wins + rightLight.wins;
    const overallLightRate = overallLightCount > 0 ? Math.round((overallLightWins / overallLightCount) * 100) : 0;

    const overallSameCount = leftSame.total + rightSame.total;
    const overallSameWins = leftSame.wins + rightSame.wins;
    const overallSameRate = overallSameCount > 0 ? Math.round((overallSameWins / overallSameCount) * 100) : 0;

    let currentStreak = 0;
    let streakType = null; // 'win' or 'loss'

    // Walk backwards to find active prediction streak
    for (let i = this.history.length - 1; i >= 0; i--) {
      const g = this.history[i];
      if (g.correct === null) continue;
      
      const type = g.correct ? 'win' : 'loss';
      if (streakType === null) {
        streakType = type;
        currentStreak = 1;
      } else if (streakType === type) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Actual Outcome Streaks (e.g. Red streak or Blue streak)
    let outcomeStreak = 0;
    let outcomeType = null;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const actual = this.history[i].actual;
      if (outcomeType === null) {
        outcomeType = actual;
        outcomeStreak = 1;
      } else if (outcomeType === actual) {
        outcomeStreak++;
      } else {
        break;
      }
    }

    return {
      total,
      predictedCount,
      correctCount,
      winrate,
      predictionStreak: currentStreak > 0 ? { count: currentStreak, type: streakType } : null,
      outcomeStreak: outcomeStreak > 0 ? { count: outcomeStreak, type: outcomeType } : null,
      overallDark: { rate: overallDarkRate, wins: overallDarkWins, total: overallDarkCount },
      overallLight: { rate: overallLightRate, wins: overallLightWins, total: overallLightCount },
      overallSame: { rate: overallSameRate, wins: overallSameWins, total: overallSameCount },
      leftDark,
      leftLight,
      leftSame,
      rightDark,
      rightLight,
      rightSame
    };
  }
}

// --- STORAGE MANAGER ---
class StorageManager {
  static SAVE_KEY = 'aetherpredict_data';
  static DEPTH_KEY = 'aetherpredict_depth';
  static GEMINI_KEY = 'aetherpredict_geminikey';

  static save(history, depth) {
    const rawActuals = history.map(g => ({
      actual: g.actual,
      leftTone: g.leftTone || g.tone || 'dark',
      rightTone: g.rightTone || 'dark'
    }));
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(rawActuals));
    localStorage.setItem(this.DEPTH_KEY, depth.toString());
  }

  static saveGeminiKey(key) {
    localStorage.setItem(this.GEMINI_KEY, key);
  }

  static getGeminiKey() {
    return localStorage.getItem(this.GEMINI_KEY) || '';
  }

  static load() {
    try {
      const saved = localStorage.getItem(this.SAVE_KEY);
      const depth = localStorage.getItem(this.DEPTH_KEY);
      let parsed = saved ? JSON.parse(saved) : [];
      parsed = parsed.map(item => {
        if (typeof item === 'string') return { actual: item, leftTone: 'dark', rightTone: 'dark' };
        return {
          actual: item.actual,
          leftTone: item.leftTone || item.tone || 'dark',
          rightTone: item.rightTone || 'dark'
        };
      });
      return {
        rawSequence: parsed,
        depth: depth ? parseInt(depth) : 6
      };
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
      return { rawSequence: [], depth: 6 };
    }
  }

  static clear() {
    localStorage.removeItem(this.SAVE_KEY);
    localStorage.removeItem(this.DEPTH_KEY);
  }
}

// --- UI CONTROLLER ---
class UIController {
  constructor() {
    this.engine = new PatternEngine();
    this.currentImageBase64 = null;
    this.currentImageMime = 'image/png';
    this.detectedSequence = [];
    this.selectedLeftTone = 'dark';
    this.selectedRightTone = 'dark';
    this.init();
  }

  init() {
    // Load saved data
    const loadedData = StorageManager.load();
    this.engine.maxDepth = loadedData.depth;
    
    // Set active select index
    const depthSelect = document.getElementById('pattern-depth');
    if (depthSelect) {
      depthSelect.value = loadedData.depth.toString();
    }

    // Populate saved Gemini Key
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) {
      keyInput.value = StorageManager.getGeminiKey();
    }

    if (loadedData.rawSequence && loadedData.rawSequence.length > 0) {
      this.engine.loadRawSequence(loadedData.rawSequence);
      this.showToast('Data loaded from storage', 'info');
    } else {
      this.engine.updatePrediction();
    }

    this.registerEventListeners();
    this.render();
  }

  registerEventListeners() {
    // Outcomes buttons
    document.getElementById('btn-outcome-red').addEventListener('click', () => this.addOutcome('R'));
    document.getElementById('btn-outcome-blue').addEventListener('click', () => this.addOutcome('B'));

    // Left Side Tone Toggle Buttons
    ['dark', 'light', 'same'].forEach(tone => {
      document.getElementById(`btn-left-${tone}`)?.addEventListener('click', () => {
        this.selectedLeftTone = tone;
        ['dark', 'light', 'same'].forEach(t => {
          document.getElementById(`btn-left-${t}`)?.classList.toggle('active', t === tone);
        });
      });
    });

    // Right Side Tone Toggle Buttons
    ['dark', 'light', 'same'].forEach(tone => {
      document.getElementById(`btn-right-${tone}`)?.addEventListener('click', () => {
        this.selectedRightTone = tone;
        ['dark', 'light', 'same'].forEach(t => {
          document.getElementById(`btn-right-${t}`)?.classList.toggle('active', t === tone);
        });
      });
    });

    // Keyboard hotkeys
    document.addEventListener('keydown', (e) => {
      // Avoid hotkeys when typing in input/textarea fields
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'r' || e.key === 'R' || e.key === 'ArrowLeft') {
        this.addOutcome('R');
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'ArrowRight') {
        this.addOutcome('B');
      }
    });

    // --- IMAGE & SCREENSHOT PATTERN SCANNER LISTENERS ---
    const dropZone = document.getElementById('image-drop-zone');
    const fileInput = document.getElementById('image-file-input');

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleImageFile(e.target.files[0]);
        }
      });

      // Drag and Drop
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.add('drop-zone-active');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.remove('drop-zone-active');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Global Clipboard Paste Listener (Ctrl+V / Cmd+V)
    window.addEventListener('paste', (e) => {
      // Ignore if user is pasting text into an input or textarea
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            this.handleImageFile(file);
            this.showToast('Pasted screenshot from clipboard! 📋', 'success');
          }
        }
      }
    });

    // Image removal button
    document.getElementById('btn-remove-image')?.addEventListener('click', () => {
      this.clearImagePreview();
    });

    // Scan Image button
    document.getElementById('btn-scan-image')?.addEventListener('click', () => {
      this.scanImageWithVisionAI();
    });

    // Import detected outcomes button
    document.getElementById('btn-import-detected')?.addEventListener('click', () => {
      this.importDetectedSequence();
    });

    // Gemini API Key Save Button
    document.getElementById('btn-save-gemini-key').addEventListener('click', () => {
      const val = document.getElementById('gemini-api-key-input').value.trim();
      StorageManager.saveGeminiKey(val);
      this.showToast('Gemini API key saved locally!', 'success');
    });

    // Ask Gemini AI Button
    document.getElementById('btn-ask-gemini').addEventListener('click', () => this.askGemini());

    // Timeline limit select
    document.getElementById('timeline-limit-select')?.addEventListener('change', (e) => {
      this.timelineLimit = e.target.value;
      this.render();
    });

    // Pattern depth select
    document.getElementById('pattern-depth').addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      this.engine.setDepth(val);
      this.saveState();
      this.render();
      this.showToast(`Max Pattern Depth set to ${val}`, 'info');
    });

    // Utility actions
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all data and start fresh?')) {
        this.engine.clearAll();
        StorageManager.clear();
        this.render();
        this.showToast('All patterns cleared!', 'success');
      }
    });

    document.getElementById('btn-demo-alt').addEventListener('click', () => {
      const seq = ['R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B'];
      this.engine.loadRawSequence(seq);
      this.saveState();
      this.render();
      this.showToast('Alternating demo sequence loaded!', 'success');
    });

    document.getElementById('btn-demo-streak').addEventListener('click', () => {
      const seq = ['R', 'R', 'R', 'R', 'B', 'B', 'B', 'B', 'R', 'R', 'R', 'R', 'B', 'B', 'B', 'B', 'R', 'R', 'R', 'R'];
      this.engine.loadRawSequence(seq);
      this.saveState();
      this.render();
      this.showToast('Streak demo sequence loaded!', 'success');
    });

    document.getElementById('btn-demo-doublet').addEventListener('click', () => {
      const seq = ['R', 'R', 'B', 'B', 'R', 'R', 'B', 'B', 'R', 'R', 'B', 'B', 'R', 'R', 'B', 'B'];
      this.engine.loadRawSequence(seq);
      this.saveState();
      this.render();
      this.showToast('Doublet demo sequence loaded!', 'success');
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
      const rawActuals = this.engine.history.map(g => g.actual);
      if (rawActuals.length === 0) {
        this.showToast('No data to export', 'error');
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawActuals));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aetherpredict_data_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Exported successfully!', 'success');
    });

    document.getElementById('btn-import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed) && parsed.every(item => item === 'R' || item === 'B')) {
            this.engine.loadRawSequence(parsed);
            this.saveState();
            this.render();
            this.showToast(`Imported ${parsed.length} items!`, 'success');
          } else {
            this.showToast('Invalid file format. Must be JSON array containing only "R" and "B"', 'error');
          }
        } catch (err) {
          this.showToast('Error reading file. Ensure it is valid JSON.', 'error');
        }
      };
      reader.readAsText(file);
      // Clear input so same file can be selected again
      e.target.value = '';
    });

    document.getElementById('btn-import-text').addEventListener('click', () => {
      const rawText = prompt("Paste your outcome sequence (e.g. RRBRBBR or R, B, R, B):");
      if (rawText === null) return; // cancelled

      // Clean the input to find all occurrences of R, B, Red, Blue (case insensitive)
      const cleanSeq = [];
      const cleanedInput = rawText.toUpperCase().replace(/[^RB]/g, '');
      
      for (const char of cleanedInput) {
        if (char === 'R') cleanSeq.push('R');
        if (char === 'B') cleanSeq.push('B');
      }

      if (cleanSeq.length > 0) {
        this.engine.loadRawSequence(cleanSeq);
        this.saveState();
        this.render();
        this.showToast(`Imported ${cleanSeq.length} records from text!`, 'success');
      } else {
        this.showToast('Could not find any "R" or "B" in the text.', 'error');
      }
    });
  }

  async askGemini() {
    const rawActuals = this.engine.history.map(g => g.actual);
    if (rawActuals.length === 0) {
      this.showToast('Add some outcomes before asking Gemini AI!', 'error');
      return;
    }

    const btn = document.getElementById('btn-ask-gemini');
    const box = document.getElementById('gemini-response-box');
    const badge = document.getElementById('gemini-predicted-badge');
    const reasoningText = document.getElementById('gemini-reasoning-text');
    const userApiKey = StorageManager.getGeminiKey();

    btn.disabled = true;
    btn.innerHTML = '⏳ Gemini is analyzing patterns...';

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: rawActuals,
          userApiKey: userApiKey
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze with Gemini AI');
      }

      const pred = data.prediction;
      const isRed = pred.predictedColor === 'R';
      
      badge.className = `cell-badge ${isRed ? 'badge-red' : 'badge-blue'}`;
      badge.textContent = `${isRed ? 'RED' : 'BLUE'} (${pred.confidencePercent}%)`;
      reasoningText.textContent = pred.reasoning;

      box.style.display = 'block';
      this.showToast('Gemini AI analysis complete!', 'success');

    } catch (err) {
      console.error(err);
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '✨ Analyze Sequence with Gemini AI';
    }
  }

  // --- IMAGE PATTERN SCANNER METHODS ---
  handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file', 'error');
      return;
    }

    this.currentImageMime = file.type || 'image/png';
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentImageBase64 = e.target.result;

      // Update UI preview
      const previewContainer = document.getElementById('image-preview-container');
      const previewImg = document.getElementById('image-preview-element');
      const scanBtn = document.getElementById('btn-scan-image');
      const dropZone = document.getElementById('image-drop-zone');

      if (previewImg && previewContainer) {
        previewImg.src = this.currentImageBase64;
        previewContainer.style.display = 'flex';
        dropZone.style.display = 'none';
        if (scanBtn) scanBtn.style.display = 'flex';
      }

      this.showToast('Image loaded! Click "Extract Sequence" to scan.', 'info');
    };
    reader.readAsDataURL(file);
  }

  clearImagePreview() {
    this.currentImageBase64 = null;
    this.detectedSequence = [];

    const previewContainer = document.getElementById('image-preview-container');
    const scanBtn = document.getElementById('btn-scan-image');
    const dropZone = document.getElementById('image-drop-zone');
    const resultsBox = document.getElementById('detected-results-box');

    if (previewContainer) previewContainer.style.display = 'none';
    if (dropZone) dropZone.style.display = 'flex';
    if (scanBtn) scanBtn.style.display = 'none';
    if (resultsBox) resultsBox.style.display = 'none';

    const fileInput = document.getElementById('image-file-input');
    if (fileInput) fileInput.value = '';
  }

  async scanImageWithVisionAI() {
    if (!this.currentImageBase64) {
      this.showToast('No image loaded to scan!', 'error');
      return;
    }

    const btn = document.getElementById('btn-scan-image');
    const resultsBox = document.getElementById('detected-results-box');
    const userApiKey = StorageManager.getGeminiKey();

    btn.disabled = true;
    btn.innerHTML = '⏳ Scanning Image with Vision AI...';

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'vision',
          imageBase64: this.currentImageBase64,
          mimeType: this.currentImageMime,
          userApiKey: userApiKey
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Vision extraction failed.');
      }

      this.detectedSequence = data.detectedSequence || [];
      
      if (this.detectedSequence.length === 0) {
        this.showToast('No Red/Blue outcomes detected in this image. Try another screenshot.', 'error');
      } else {
        this.renderDetectedChips(data.summary);
        resultsBox.style.display = 'flex';
        this.showToast(`Extracted ${this.detectedSequence.length} outcomes!`, 'success');
      }

    } catch (err) {
      console.error(err);
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔍 Extract Sequence from Image with Vision AI';
    }
  }

  renderDetectedChips(summary) {
    const container = document.getElementById('detected-chips-container');
    const summaryEl = document.getElementById('detected-summary-text');
    if (!container) return;

    if (summaryEl) {
      summaryEl.textContent = summary || `Extracted ${this.detectedSequence.length} outcomes`;
    }

    container.innerHTML = '';
    this.detectedSequence.forEach((val, idx) => {
      const badge = document.createElement('span');
      badge.className = `cell-badge ${val === 'R' ? 'badge-red' : 'badge-blue'}`;
      badge.style.cursor = 'pointer';
      badge.style.userSelect = 'none';
      badge.title = 'Click to toggle RED / BLUE, right-click to delete';
      badge.textContent = `${idx + 1}. ${val === 'R' ? 'Red' : 'Blue'}`;

      // Left click -> toggle Red / Blue
      badge.addEventListener('click', () => {
        this.detectedSequence[idx] = this.detectedSequence[idx] === 'R' ? 'B' : 'R';
        this.renderDetectedChips(summary);
      });

      // Right click -> delete chip
      badge.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.detectedSequence.splice(idx, 1);
        this.renderDetectedChips(summary);
      });

      container.appendChild(badge);
    });
  }

  importDetectedSequence() {
    if (!this.detectedSequence || this.detectedSequence.length === 0) {
      this.showToast('No detected outcomes to import!', 'error');
      return;
    }

    // Append to existing sequence
    const currentActuals = this.engine.history.map(g => g.actual);
    const combined = [...currentActuals, ...this.detectedSequence];
    
    this.engine.loadRawSequence(combined);
    this.saveState();
    this.render();
    
    this.showToast(`Added ${this.detectedSequence.length} outcomes to database!`, 'success');
    this.clearImagePreview();
  }

  addOutcome(color) {
    this.engine.addResult(color, this.selectedLeftTone, this.selectedRightTone);
    this.saveState();
    this.render();
    
    // Provide tactile toast feedback on correctness
    const lastGame = this.engine.history[this.engine.history.length - 1];
    const getSymbol = (t) => t === 'light' ? '☀️' : t === 'same' ? '🔄' : '🌑';
    const leftSymbol = getSymbol(this.selectedLeftTone);
    const rightSymbol = getSymbol(this.selectedRightTone);

    if (lastGame && lastGame.correct !== null) {
      if (lastGame.correct) {
        this.showToast(`Prediction Correct! (${color === 'R' ? 'Red' : 'Blue'} L:${leftSymbol} R:${rightSymbol}) 🔥`, 'success');
      } else {
        this.showToast('Prediction Incorrect', 'error');
      }
    } else {
      this.showToast(`Added ${color === 'R' ? 'Red' : 'Blue'} (Left:${leftSymbol} Right:${rightSymbol})`, 'info');
    }
  }

  deleteOutcome(id) {
    this.engine.deleteResult(id);
    this.saveState();
    this.render();
    this.showToast('Result deleted, predictions updated', 'info');
  }

  saveState() {
    StorageManager.save(this.engine.history, this.engine.maxDepth);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Fade and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  render() {
    const stats = this.engine.getStats();
    const prediction = this.engine.currentPrediction;

    // --- UPDATE TOP-LEVEL STATS OVERVIEW ---
    document.getElementById('overview-total-games').textContent = stats.total;
    document.getElementById('overview-winrate').textContent = `${stats.winrate}%`;
    
    const streakEl = document.getElementById('overview-streak');
    if (stats.predictionStreak) {
      const colorClass = stats.predictionStreak.type === 'win' ? 'text-green-streak' : 'text-red-streak';
      streakEl.className = `value highlight`;
      streakEl.textContent = `${stats.predictionStreak.count} ${stats.predictionStreak.type === 'win' ? 'W' : 'L'}`;
    } else {
      streakEl.className = 'value';
      streakEl.textContent = '0';
    }

    // --- UPDATE PREDICTION ORB ---
    const orb = document.getElementById('prediction-orb');
    const label = document.getElementById('prediction-label');
    const value = document.getElementById('prediction-value');
    const percentage = document.getElementById('prediction-percentage');

    // Reset orb classes
    orb.className = 'prediction-orb';

    if (stats.total === 0 || !prediction || !prediction.color) {
      orb.classList.add('predict-none');
      label.textContent = 'Awaiting';
      value.textContent = 'DATA';
      percentage.textContent = '0%';
      percentage.style.display = 'none';
    } else {
      const isRed = prediction.color === 'R';
      orb.classList.add(isRed ? 'predict-red' : 'predict-blue');
      label.textContent = 'Next Predict';
      value.textContent = `${isRed ? '🔴 RED' : '🔵 BLUE'}`;
      percentage.textContent = `${prediction.confidence}%`;
      percentage.style.display = 'inline-block';
    }

    // --- UPDATE DUAL TONE FORECAST BADGES ---
    const leftBadge = document.getElementById('prediction-left-tone-badge');
    const rightBadge = document.getElementById('prediction-right-tone-badge');

    const formatBadge = (badgeEl, title, tone, conf) => {
      if (!badgeEl) return;
      if (stats.total === 0 || !tone) {
        badgeEl.textContent = `${title}: Awaiting Data`;
        badgeEl.style.background = 'rgba(255, 255, 255, 0.05)';
        badgeEl.style.color = 'var(--text-muted)';
      } else {
        const symbol = tone === 'light' ? '☀️ Light' : tone === 'same' ? '🔄 Same' : '🌑 Dark';
        badgeEl.textContent = `${title}: ${symbol} (${conf}%)`;
        if (tone === 'light') {
          badgeEl.style.background = 'rgba(234, 179, 8, 0.2)';
          badgeEl.style.color = '#fde047';
        } else if (tone === 'same') {
          badgeEl.style.background = 'rgba(14, 165, 233, 0.2)';
          badgeEl.style.color = '#38bdf8';
        } else {
          badgeEl.style.background = 'rgba(255, 255, 255, 0.08)';
          badgeEl.style.color = '#cbd5e1';
        }
      }
    };

    formatBadge(leftBadge, '🔴 Left Tone', prediction?.leftTone, prediction?.leftConfidence);
    formatBadge(rightBadge, '🔵 Right Tone', prediction?.rightTone, prediction?.rightConfidence);

    // --- UPDATE COLOR SPLIT PROBABILITY BAR ---
    const redPercent = prediction ? prediction.redPercent : 50;
    const bluePercent = prediction ? prediction.bluePercent : 50;

    document.getElementById('prob-red-percent').textContent = `${redPercent}%`;
    document.getElementById('prob-blue-percent').textContent = `${bluePercent}%`;
    
    const fillRed = document.getElementById('prob-fill-red');
    const fillBlue = document.getElementById('prob-fill-blue');
    
    fillRed.style.width = `${redPercent}%`;
    fillBlue.style.width = `${bluePercent}%`;

    // --- UPDATE LEFT TONE SPLIT PROBABILITY BAR ---
    const leftDark = prediction ? prediction.leftDark : 33;
    const leftLight = prediction ? prediction.leftLight : 33;
    const leftSame = prediction ? (prediction.leftSame !== undefined ? prediction.leftSame : 34) : 34;

    document.getElementById('prob-left-dark').textContent = `${leftDark}%`;
    document.getElementById('prob-left-light').textContent = `${leftLight}%`;
    document.getElementById('prob-left-same').textContent = `${leftSame}%`;
    
    document.getElementById('prob-fill-left-dark').style.width = `${leftDark}%`;
    document.getElementById('prob-fill-left-light').style.width = `${leftLight}%`;
    document.getElementById('prob-fill-left-same').style.width = `${leftSame}%`;

    // --- UPDATE RIGHT TONE SPLIT PROBABILITY BAR ---
    const rightDark = prediction ? prediction.rightDark : 33;
    const rightLight = prediction ? prediction.rightLight : 33;
    const rightSame = prediction ? (prediction.rightSame !== undefined ? prediction.rightSame : 34) : 34;

    document.getElementById('prob-right-dark').textContent = `${rightDark}%`;
    document.getElementById('prob-right-light').textContent = `${rightLight}%`;
    document.getElementById('prob-right-same').textContent = `${rightSame}%`;
    
    document.getElementById('prob-fill-right-dark').style.width = `${rightDark}%`;
    document.getElementById('prob-fill-right-light').style.width = `${rightLight}%`;
    document.getElementById('prob-fill-right-same').style.width = `${rightSame}%`;

    // --- UPDATE STATS GRID ---
    document.getElementById('stat-total-games').textContent = stats.total;
    document.getElementById('stat-predicted-games').textContent = stats.predictedCount;
    document.getElementById('stat-correct-predict').textContent = stats.correctCount;
    document.getElementById('stat-winrate-gauge').textContent = `${stats.winrate}%`;

    // --- UPDATE TONE WIN RATE ANALYTICS CARD ---
    const setStatText = (valId, ratioId, statObj) => {
      const valEl = document.getElementById(valId);
      const ratioEl = document.getElementById(ratioId);
      if (valEl && statObj) valEl.textContent = `${statObj.rate}%`;
      if (ratioEl && statObj) ratioEl.textContent = `(${statObj.wins}/${statObj.total})`;
    };

    setStatText('stat-overall-dark-winrate', 'stat-overall-dark-ratio', stats.overallDark);
    setStatText('stat-overall-light-winrate', 'stat-overall-light-ratio', stats.overallLight);
    setStatText('stat-overall-same-winrate', 'stat-overall-same-ratio', stats.overallSame);

    setStatText('stat-left-dark-winrate', 'stat-left-dark-ratio', stats.leftDark);
    setStatText('stat-left-light-winrate', 'stat-left-light-ratio', stats.leftLight);
    setStatText('stat-left-same-winrate', 'stat-left-same-ratio', stats.leftSame);

    setStatText('stat-right-dark-winrate', 'stat-right-dark-ratio', stats.rightDark);
    setStatText('stat-right-light-winrate', 'stat-right-light-ratio', stats.rightLight);
    setStatText('stat-right-same-winrate', 'stat-right-same-ratio', stats.rightSame);

    // Current trend streak
    const trendEl = document.getElementById('stat-trend-streak');
    if (stats.outcomeStreak) {
      const typeStr = stats.outcomeStreak.type === 'R' ? 'RED' : 'BLUE';
      const colorVal = stats.outcomeStreak.type === 'R' ? 'var(--color-red)' : 'var(--color-blue)';
      trendEl.textContent = `${stats.outcomeStreak.count} × ${typeStr}`;
      trendEl.style.color = colorVal;
    } else {
      trendEl.textContent = 'None';
      trendEl.style.color = 'inherit';
    }

    // --- UPDATE TIMELINE VISUALIZER ---
    const timelineScroll = document.getElementById('timeline-scroll');
    timelineScroll.innerHTML = '';

    if (this.engine.history.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'timeline-empty';
      emptyMsg.textContent = 'No records. Start clicking outcomes above to populate timeline.';
      timelineScroll.appendChild(emptyMsg);
    } else {
      // Determine slice count based on limit selector
      let recentHistory = this.engine.history;
      const limit = this.timelineLimit || '30';

      if (limit !== 'all') {
        const count = parseInt(limit) || 30;
        recentHistory = this.engine.history.slice(-count);
      }

      recentHistory.forEach(game => {
        const node = document.createElement('div');
        node.className = `timeline-node ${game.actual === 'R' ? 'node-red' : 'node-blue'}`;
        node.style.position = 'relative';
        node.textContent = game.actual;

        const getSym = (t) => t === 'light' ? '☀️' : t === 'same' ? '🔄' : '🌑';
        const lSym = getSym(game.leftTone);
        const rSym = getSym(game.rightTone);

        node.title = `Game result: ${game.actual === 'R' ? 'Red' : 'Blue'} | Left Tone: ${game.leftTone || 'dark'}, Right Tone: ${game.rightTone || 'dark'}. Click to delete.`;

        // Small dual tone indicator overlay
        const toneInd = document.createElement('span');
        toneInd.style.position = 'absolute';
        toneInd.style.top = '-5px';
        toneInd.style.left = '-4px';
        toneInd.style.fontSize = '8px';
        toneInd.style.lineHeight = '1';
        toneInd.style.pointerEvents = 'none';
        toneInd.textContent = `${lSym}${rSym}`;
        node.appendChild(toneInd);

        // Check if prediction was made for this
        if (game.predicted) {
          const status = document.createElement('div');
          status.className = `node-prediction-status ${game.correct ? 'status-correct' : 'status-incorrect'}`;
          status.textContent = game.correct ? 'Win' : 'Loss';
          node.appendChild(status);
        }

        // Click to delete
        node.addEventListener('click', () => {
          if (confirm(`Remove this record?`)) {
            this.deleteOutcome(game.id);
          }
        });

        timelineScroll.appendChild(node);
      });

      // Scroll timeline to the bottom (newest items)
      setTimeout(() => {
        timelineScroll.scrollTop = timelineScroll.scrollHeight;
      }, 50);
    }

    // --- UPDATE PATTERN BREAKDOWN LIST ---
    const patternList = document.getElementById('pattern-breakdown-list');
    patternList.innerHTML = '';

    if (!prediction || prediction.breakdown.length === 0) {
      patternList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; font-style: italic; text-align: center; padding: 20px 0;">No matching patterns in history yet. Continue playing.</div>';
    } else {
      prediction.breakdown.forEach(pat => {
        const patItem = document.createElement('div');
        patItem.className = 'pattern-item';

        // Pattern representation (sequence chips)
        const seqContainer = document.createElement('div');
        seqContainer.className = 'pattern-sequence';
        
        pat.pattern.forEach(color => {
          const chip = document.createElement('div');
          chip.className = `seq-chip ${color === 'R' ? 'chip-r' : 'chip-b'}`;
          chip.textContent = color;
          seqContainer.appendChild(chip);
        });

        // Matches count info
        const info = document.createElement('div');
        info.className = 'pattern-info';
        info.innerHTML = `L${pat.length} matches: <strong>${pat.matches}</strong>`;

        // Stats percentages
        const statsWrap = document.createElement('div');
        statsWrap.className = 'pattern-stats';
        statsWrap.innerHTML = `
          <span class="pat-red">R: ${pat.probR}%</span>
          <span class="pat-blue">B: ${pat.probB}%</span>
        `;

        patItem.appendChild(seqContainer);
        patItem.appendChild(info);
        patItem.appendChild(statsWrap);
        patternList.appendChild(patItem);
      });
    }

    // --- UPDATE MANAGEMENT TABLE ---
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';

    if (this.engine.history.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="4" style="text-align: center; color: var(--text-muted); font-style: italic;">No records found.</td>`;
      tbody.appendChild(row);
    } else {
      const getSym = (t) => t === 'light' ? '☀️' : t === 'same' ? '🔄' : '🌑';
      
      // Show games in reverse chronological order
      const displayList = [...this.engine.history].reverse();
      displayList.forEach((game, idx) => {
        const rowIndex = this.engine.history.length - idx;
        const tr = document.createElement('tr');

        // Game number
        const tdNum = document.createElement('td');
        tdNum.textContent = `#${rowIndex}`;
        tr.appendChild(tdNum);

        // Actual outcome badge
        const tdActual = document.createElement('td');
        const badgeAct = document.createElement('span');
        badgeAct.className = `cell-badge ${game.actual === 'R' ? 'badge-red' : 'badge-blue'}`;
        const lActSym = getSym(game.leftTone);
        const rActSym = getSym(game.rightTone);
        badgeAct.textContent = `${game.actual === 'R' ? 'Red' : 'Blue'} (L:${lActSym} R:${rActSym})`;
        tdActual.appendChild(badgeAct);
        tr.appendChild(tdActual);

        // Prediction badge
        const tdPred = document.createElement('td');
        if (game.predicted) {
          const badgePred = document.createElement('span');
          badgePred.className = `cell-badge ${game.predicted === 'R' ? 'badge-red' : 'badge-blue'}`;
          const lPredSym = getSym(game.predictedLeftTone);
          const rPredSym = getSym(game.predictedRightTone);
          badgePred.textContent = `${game.predicted === 'R' ? 'Red' : 'Blue'} (L:${lPredSym} R:${rPredSym})`;
          tdPred.appendChild(badgePred);
        } else {
          tdPred.innerHTML = '<span class="cell-badge badge-neutral">-</span>';
        }
        tr.appendChild(tdPred);

        // Evaluation badge & delete controls
        const tdEval = document.createElement('td');
        tdEval.style.display = 'flex';
        tdEval.style.justifyContent = 'space-between';
        tdEval.style.alignItems = 'center';

        if (game.predicted) {
          const badgeStatus = document.createElement('span');
          badgeStatus.className = `cell-badge ${game.correct ? 'badge-success' : 'badge-danger'}`;
          badgeStatus.textContent = game.correct ? 'Correct' : 'Incorrect';
          tdEval.appendChild(badgeStatus);
        } else {
          tdEval.innerHTML = '<span class="cell-badge badge-neutral">No prediction</span>';
        }

        // Delete button
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete-row';
        btnDelete.innerHTML = '🗑️';
        btnDelete.title = 'Delete record';
        btnDelete.addEventListener('click', () => {
          if (confirm(`Delete game #${rowIndex}?`)) {
            this.deleteOutcome(game.id);
          }
        });
        tdEval.appendChild(btnDelete);
        tr.appendChild(tdEval);

        tbody.appendChild(tr);
      });
    }
  }
}

// Instantiate UI controller when DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  window.appController = new UIController();
});
