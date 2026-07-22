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

  // Compare arrays
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Add actual result
  addResult(actualColor) {
    const pred = this.currentPrediction;
    const isCorrect = (pred && pred.color) ? (pred.color === actualColor) : null;

    const newGame = {
      id: Math.random().toString(36).substr(2, 9),
      actual: actualColor,
      predicted: (pred && pred.color) ? pred.color : null,
      correct: isCorrect
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
    const rawActuals = this.history.map(g => g.actual);
    this.history = [];
    this.currentPrediction = null;

    for (const actual of rawActuals) {
      // Make prediction based on accumulated history so far
      const pred = this.predictNext();
      const isCorrect = (pred && pred.color) ? (pred.color === actual) : null;

      this.history.push({
        id: Math.random().toString(36).substr(2, 9),
        actual: actual,
        predicted: (pred && pred.color) ? pred.color : null,
        correct: isCorrect
      });

      // Update current prediction to be the latest prediction for the NEXT game
      this.currentPrediction = this.predictNext();
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
    this.currentPrediction = this.predictNext();
  }

  // Load from array of raw outcomes ('R' or 'B')
  loadRawSequence(sequence) {
    this.history = sequence.map(color => ({
      id: Math.random().toString(36).substr(2, 9),
      actual: color,
      predicted: null,
      correct: null
    }));
    this.rebuildChronologicalHistory();
  }

  // Get statistics
  getStats() {
    const total = this.history.length;
    const withPrediction = this.history.filter(g => g.predicted !== null);
    const predictedCount = withPrediction.length;
    const correctCount = withPrediction.filter(g => g.correct === true).length;
    const winrate = predictedCount > 0 ? Math.round((correctCount / predictedCount) * 100) : 0;

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
      outcomeStreak: outcomeStreak > 0 ? { count: outcomeStreak, type: outcomeType } : null
    };
  }
}

// --- STORAGE MANAGER ---
class StorageManager {
  static SAVE_KEY = 'aetherpredict_data';
  static DEPTH_KEY = 'aetherpredict_depth';
  static GEMINI_KEY = 'aetherpredict_geminikey';

  static save(history, depth) {
    const rawActuals = history.map(g => g.actual);
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
      return {
        rawSequence: saved ? JSON.parse(saved) : [],
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
    this.engine.addResult(color);
    this.saveState();
    this.render();
    
    // Provide tactile toast feedback on correctness
    const lastGame = this.engine.history[this.engine.history.length - 1];
    if (lastGame && lastGame.correct !== null) {
      if (lastGame.correct) {
        this.showToast('Prediction Correct! 🔥', 'success');
      } else {
        this.showToast('Prediction Incorrect', 'error');
      }
    } else {
      this.showToast(`Added ${color === 'R' ? 'Red' : 'Blue'} result`, 'info');
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
      value.textContent = isRed ? 'RED' : 'BLUE';
      percentage.textContent = `${prediction.confidence}%`;
      percentage.style.display = 'inline-block';
    }

    // --- UPDATE SPLIT PROBABILITY BAR ---
    const redPercent = prediction ? prediction.redPercent : 50;
    const bluePercent = prediction ? prediction.bluePercent : 50;

    document.getElementById('prob-red-percent').textContent = `${redPercent}%`;
    document.getElementById('prob-blue-percent').textContent = `${bluePercent}%`;
    
    const fillRed = document.getElementById('prob-fill-red');
    const fillBlue = document.getElementById('prob-fill-blue');
    
    fillRed.style.width = `${redPercent}%`;
    fillBlue.style.width = `${bluePercent}%`;

    // --- UPDATE STATS GRID ---
    document.getElementById('stat-total-games').textContent = stats.total;
    document.getElementById('stat-predicted-games').textContent = stats.predictedCount;
    document.getElementById('stat-correct-predict').textContent = stats.correctCount;
    document.getElementById('stat-winrate-gauge').textContent = `${stats.winrate}%`;

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
        node.textContent = game.actual;
        node.title = `Game result: ${game.actual === 'R' ? 'Red' : 'Blue'}. Click to delete.`;

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
        badgeAct.textContent = game.actual === 'R' ? 'Red' : 'Blue';
        tdActual.appendChild(badgeAct);
        tr.appendChild(tdActual);

        // Prediction badge
        const tdPred = document.createElement('td');
        if (game.predicted) {
          const badgePred = document.createElement('span');
          badgePred.className = `cell-badge ${game.predicted === 'R' ? 'badge-red' : 'badge-blue'}`;
          badgePred.textContent = game.predicted === 'R' ? 'Red' : 'Blue';
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
