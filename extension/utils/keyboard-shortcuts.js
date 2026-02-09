// Keyboard Shortcuts for Ellyn
// Power user features for faster workflows

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.init();
  }

  /**
   * Initialize keyboard shortcuts
   */
  init() {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  /**
   * Register a keyboard shortcut
   * @param {string} key - Key combination (e.g., 'ctrl+enter', 'cmd+e')
   * @param {Function} callback - Function to call when shortcut is triggered
   * @param {string} description - Human-readable description
   */
  register(key, callback, description = '') {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.set(normalizedKey, {
      callback,
      description,
      key: normalizedKey
    });
  }

  /**
   * Unregister a keyboard shortcut
   * @param {string} key - Key combination to remove
   */
  unregister(key) {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.delete(normalizedKey);
  }

  /**
   * Handle key press events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyPress(e) {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in input fields (except Ctrl/Cmd+Enter)
    const isInputField = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
    const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

    if (isInputField && !isCtrlEnter) {
      return;
    }

    const pressedKey = this.getKeyCombo(e);
    const shortcut = this.shortcuts.get(pressedKey);

    if (shortcut) {
      e.preventDefault();
      shortcut.callback(e);
    }
  }

  /**
   * Get key combination from event
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {string} - Normalized key combination
   */
  getKeyCombo(e) {
    const parts = [];

    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    // Normalize key name
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key === 'escape') key = 'esc';

    parts.push(key);

    return parts.join('+');
  }

  /**
   * Normalize key combination string
   * @param {string} key - Key combination
   * @returns {string} - Normalized key combination
   */
  normalizeKey(key) {
    const parts = key.toLowerCase().split('+').map(p => p.trim());
    const modifiers = [];
    let mainKey = '';

    for (const part of parts) {
      if (['ctrl', 'cmd', 'meta', 'control', 'command'].includes(part)) {
        if (!modifiers.includes('ctrl')) modifiers.push('ctrl');
      } else if (part === 'alt' || part === 'option') {
        if (!modifiers.includes('alt')) modifiers.push('alt');
      } else if (part === 'shift') {
        if (!modifiers.includes('shift')) modifiers.push('shift');
      } else {
        mainKey = part;
      }
    }

    modifiers.sort(); // Consistent order
    if (mainKey) modifiers.push(mainKey);

    return modifiers.join('+');
  }

  /**
   * Enable shortcuts
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable shortcuts
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Get all registered shortcuts
   * @returns {Array} - List of shortcuts with descriptions
   */
  getAll() {
    const shortcuts = [];
    for (const [key, data] of this.shortcuts) {
      shortcuts.push({
        key: this.formatKeyDisplay(key),
        description: data.description
      });
    }
    return shortcuts;
  }

  /**
   * Format key combination for display
   * @param {string} key - Normalized key combination
   * @returns {string} - Human-readable format
   */
  formatKeyDisplay(key) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return key
      .split('+')
      .map(part => {
        if (part === 'ctrl') return isMac ? '⌘' : 'Ctrl';
        if (part === 'alt') return isMac ? '⌥' : 'Alt';
        if (part === 'shift') return isMac ? '⇧' : 'Shift';
        if (part === 'esc') return 'Esc';
        if (part === 'space') return 'Space';
        return part.toUpperCase();
      })
      .join(isMac ? '' : '+');
  }

  /**
   * Show shortcuts help overlay
   */
  showHelp() {
    const shortcuts = this.getAll();

    const modal = document.createElement('div');
    modal.className = 'shortcuts-modal';
    modal.innerHTML = `
      <div class="shortcuts-overlay" id="shortcuts-overlay"></div>
      <div class="shortcuts-content">
        <div class="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="shortcuts-close" id="shortcuts-close">×</button>
        </div>
        <div class="shortcuts-list">
          ${shortcuts.map(s => `
            <div class="shortcut-item">
              <span class="shortcut-key">${s.key}</span>
              <span class="shortcut-desc">${s.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    document.getElementById('shortcuts-close').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('shortcuts-overlay').addEventListener('click', () => {
      modal.remove();
    });

    // Esc to close
    const closeOnEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    document.addEventListener('keydown', closeOnEsc);
  }
}

// Export singleton instance
const keyboardShortcuts = new KeyboardShortcuts();

// Register default shortcuts
function registerDefaultShortcuts() {
  // Send via Gmail
  keyboardShortcuts.register('ctrl+enter', () => {
    const sendBtn = document.getElementById('magic-send-gmail');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    }
  }, 'Send via Gmail');

  // Quick edit
  keyboardShortcuts.register('ctrl+e', () => {
    const editBtn = document.getElementById('magic-quick-edit');
    if (editBtn) {
      editBtn.click();
    }
  }, 'Quick edit draft');

  // Copy to clipboard
  keyboardShortcuts.register('ctrl+k', () => {
    const copyBtn = document.getElementById('magic-copy-draft');
    if (copyBtn) {
      copyBtn.click();
    }
  }, 'Copy draft to clipboard');

  // Undo
  keyboardShortcuts.register('ctrl+z', () => {
    const undoBtn = document.getElementById('magic-undo');
    if (undoBtn && !undoBtn.disabled) {
      undoBtn.click();
    }
  }, 'Undo changes');

  // Redo
  keyboardShortcuts.register('ctrl+y', () => {
    const redoBtn = document.getElementById('magic-redo');
    if (redoBtn && !redoBtn.disabled) {
      redoBtn.click();
    }
  }, 'Redo changes');

  // Show shortcuts help
  keyboardShortcuts.register('ctrl+/', () => {
    keyboardShortcuts.showHelp();
  }, 'Show keyboard shortcuts');

  // Escape to close/cancel
  keyboardShortcuts.register('esc', () => {
    const modals = document.querySelectorAll('.modal, .shortcuts-modal');
    if (modals.length > 0) {
      modals[modals.length - 1].remove();
    }
  }, 'Close modal');

  // Run magic workflow
  keyboardShortcuts.register('ctrl+m', () => {
    const magicBtn = document.getElementById('magic-extract-btn');
    if (magicBtn && !magicBtn.disabled) {
      magicBtn.click();
    }
  }, 'Run magic workflow');
}

// Helper to update draft UI (deprecated - now handled in sidepanel.js)
function updateDraftUI(draft) {
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');
  const wordCount = document.getElementById('magic-word-count');
  const charCount = document.getElementById('magic-char-count');

  if (subjectInput) subjectInput.value = draft.subject;
  if (bodyInput) bodyInput.value = draft.body;
  if (wordCount) wordCount.textContent = `${draft.wordCount || 0} words`;
  if (charCount) charCount.textContent = `${draft.charCount || 0} characters`;
}
