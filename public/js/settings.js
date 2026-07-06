export function createSettingsView() {
  const overlay = document.getElementById('settings-overlay');
  const openBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('settings-close-btn');
  const promptEditor = document.getElementById('prompt-editor');
  const promptStatus = document.getElementById('prompt-status');
  const savePromptBtn = document.getElementById('save-prompt-btn');
  const promptTabs = document.querySelectorAll('.prompt-tab');
  const narrationToggle = document.getElementById('generate-narration-toggle');
  const voiceSelect = document.getElementById('tts-voice-select');
  const settingsStatus = document.getElementById('settings-status');

  const FALLBACK_VOICE_OPTIONS = [
    { id: 'alloy', label: 'Alloy' },
    { id: 'ash', label: 'Ash' },
    { id: 'ballad', label: 'Ballad' },
    { id: 'cedar', label: 'Cedar' },
    { id: 'coral', label: 'Coral' },
    { id: 'echo', label: 'Echo' },
    { id: 'marin', label: 'Marin' },
    { id: 'sage', label: 'Sage' },
    { id: 'shimmer', label: 'Shimmer' },
    { id: 'verse', label: 'Verse' },
  ];

  const state = {
    open: false,
    activePrompt: 'interviewer',
    settings: {
      generateNarrationOnSave: true,
      ttsVoice: 'alloy',
    },
    voiceOptions: FALLBACK_VOICE_OPTIONS,
  };

  function setOpen(open) {
    state.open = open;
    overlay.classList.toggle('hidden', !open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function normalizeVoiceOptions(voiceOptions, voices) {
    if (Array.isArray(voiceOptions) && voiceOptions.length) {
      return voiceOptions;
    }

    if (Array.isArray(voices) && voices.length) {
      return voices.map((id) => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
      }));
    }

    return FALLBACK_VOICE_OPTIONS;
  }

  function renderVoiceOptions() {
    const savedVoice = state.settings.ttsVoice || 'alloy';
    const selectedVoice = state.voiceOptions.some((voice) => voice.id === savedVoice)
      ? savedVoice
      : 'alloy';

    voiceSelect.innerHTML = state.voiceOptions
      .map(
        (voice) => `
          <option value="${voice.id}" ${voice.id === selectedVoice ? 'selected' : ''}>
            ${voice.label}
          </option>
        `
      )
      .join('');

    if (!voiceSelect.value && state.voiceOptions.length) {
      voiceSelect.value = state.voiceOptions[0].id;
    }
  }

  async function loadSettings() {
    const response = await fetch('/api/settings');
    if (!response.ok) {
      settingsStatus.textContent = 'Could not load settings.';
      return;
    }

    const { settings, voices, voiceOptions } = await response.json();
    state.settings = settings;
    state.voiceOptions = normalizeVoiceOptions(voiceOptions, voices);
    narrationToggle.checked = Boolean(settings.generateNarrationOnSave);
    renderVoiceOptions();
  }

  async function saveSettings(partial) {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      settingsStatus.textContent = error.error || 'Failed to save settings.';
      return false;
    }

    const { settings, voices, voiceOptions } = await response.json();
    state.settings = settings;
    state.voiceOptions = normalizeVoiceOptions(voiceOptions, voices);
    renderVoiceOptions();
    settingsStatus.textContent = 'Settings saved.';
    return true;
  }

  async function loadPrompt(name) {
    const response = await fetch(`/api/prompts/${name}`);
    if (!response.ok) {
      promptStatus.textContent = 'Could not load prompt.';
      return;
    }

    const prompt = await response.json();
    state.activePrompt = name;
    promptEditor.value = prompt.content;

    promptTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.prompt === name);
    });
  }

  async function savePrompt() {
    const response = await fetch(`/api/prompts/${state.activePrompt}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: promptEditor.value }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      promptStatus.textContent = error.error || 'Failed to save prompt.';
      return;
    }

    const promptMessages = {
      interviewer: 'Interviewer prompt saved. Applies on the next session.',
      extractor: 'Extractor prompt saved. Applies on the next session end.',
      narrator: 'Narrator prompt saved. Applies to new narrations.',
      revisit: 'Revisit prompt saved. Applies on the next past Q&A.',
    };

    promptStatus.textContent = promptMessages[state.activePrompt] || 'Prompt saved.';
  }

  openBtn.addEventListener('click', async () => {
    setOpen(true);
    settingsStatus.textContent = '';
    await loadSettings();
    await loadPrompt(state.activePrompt);
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      setOpen(false);
    }
  });

  narrationToggle.addEventListener('change', async () => {
    const saved = await saveSettings({
      generateNarrationOnSave: narrationToggle.checked,
    });

    if (!saved) {
      narrationToggle.checked = state.settings.generateNarrationOnSave;
    }
  });

  voiceSelect.addEventListener('change', async () => {
    const previousVoice = state.settings.ttsVoice;
    const saved = await saveSettings({
      ttsVoice: voiceSelect.value,
    });

    if (!saved) {
      voiceSelect.value = previousVoice;
    }
  });

  promptTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      loadPrompt(tab.dataset.prompt);
    });
  });

  savePromptBtn.addEventListener('click', savePrompt);

  renderVoiceOptions();

  return {
    isOpen: () => state.open,
    getSettings: () => state.settings,
    loadSettings,
  };
}
