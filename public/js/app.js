import { RealtimeSession } from './realtime.js';
import { createPastView, loadRecordsList } from './past.js';
import { createSettingsView } from './settings.js';

const statusPill = document.getElementById('status-pill');
const orbButton = document.getElementById('orb-button');
const orbLabel = document.getElementById('orb-label');
const voicePanel = document.querySelector('.voice-panel');
const endSessionBtn = document.getElementById('end-session-btn');
const discardSessionBtn = document.getElementById('discard-session-btn');
const transcriptEl = document.getElementById('transcript');
const recordsListEl = document.getElementById('records-list');
const recordsMessageEl = document.getElementById('records-message');
const latestSummaryEl = document.getElementById('latest-summary');
const refreshRecordsBtn = document.getElementById('refresh-records-btn');

const state = {
  sessionId: null,
  realtime: null,
  status: 'idle',
  transcript: [],
  pastViewOpen: false,
};

const statusLabels = {
  idle: 'Ready',
  connecting: 'Connecting…',
  ready: 'Your turn',
  recording: 'Recording',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  saving: 'Saving reflection…',
  disconnected: 'Disconnected',
  error: 'Something went wrong',
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isSessionActive() {
  return Boolean(state.sessionId || state.realtime?.active);
}

function setMainSessionBlocked(blocked) {
  orbButton.disabled = blocked || state.pastViewOpen;
  voicePanel.classList.toggle('blocked', blocked);
}

const pastView = createPastView({
  escapeHtml,
  isSessionActive,
  onOpen: () => {
    state.pastViewOpen = true;
    setMainSessionBlocked(true);
    statusPill.textContent = 'Revisiting past';
  },
  onClose: () => {
    state.pastViewOpen = false;
    setMainSessionBlocked(false);
    if (!isSessionActive()) {
      statusPill.textContent = statusLabels.idle;
    }
  },
});

const settingsView = createSettingsView();

function getSavingLabel() {
  return settingsView.getSettings().generateNarrationOnSave
    ? 'Saving reflection, summary, and narration…'
    : 'Saving reflection and summary…';
}

function setSessionControls(enabled) {
  endSessionBtn.disabled = !enabled;
  discardSessionBtn.disabled = !enabled;
}

function resetConnection({ status = 'idle', message = null } = {}) {
  state.realtime = null;
  state.sessionId = null;
  orbButton.disabled = state.pastViewOpen;
  setSessionControls(false);
  setStatus(status);
  if (message) {
    orbLabel.textContent = message;
  }
}

function setStatus(status) {
  state.status = status;
  if (!state.pastViewOpen) {
    statusPill.textContent = statusLabels[status] || status;
  }
  orbButton.className = 'orb';

  if (status === 'ready') {
    orbLabel.textContent = 'Press T to talk — take your time';
  } else if (status === 'recording') {
    orbButton.classList.add('recording');
    orbLabel.textContent = 'Recording… press T again to send';
  } else if (status === 'thinking') {
    orbButton.classList.add('thinking');
    orbLabel.textContent = 'Reflecting on what you shared…';
  } else if (status === 'speaking') {
    orbButton.classList.add('speaking');
    orbLabel.textContent = 'Speaking';
  } else if (status === 'connecting') {
    orbLabel.textContent = 'Warming up the session…';
  } else if (status === 'saving') {
    orbLabel.textContent = getSavingLabel();
  } else if (status === 'disconnected' || status === 'error') {
    orbLabel.textContent = 'Press T to try again';
  } else {
    orbLabel.textContent = 'Press T to begin';
  }
}

function renderTranscript() {
  transcriptEl.innerHTML = state.transcript
    .map(
      (entry) => `
        <article class="message ${entry.role}">
          <span class="message-role">${entry.role}</span>
          <p>${escapeHtml(entry.text)}</p>
        </article>
      `
    )
    .join('');
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

async function saveMessage(role, content) {
  if (!state.sessionId || !content?.trim()) {
    return;
  }

  await fetch(`/api/sessions/${state.sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content: content.trim() }),
  });
}

async function handleTranscript({ role, text, final }) {
  if (!text) {
    return;
  }

  const last = state.transcript[state.transcript.length - 1];
  if (last && last.role === role && !last.final) {
    last.text = text;
    last.final = final;
  } else if (!last || last.role !== role || last.final) {
    state.transcript.push({ role, text, final });
  } else {
    last.text = text;
    last.final = final;
  }

  renderTranscript();

  if (final) {
    await saveMessage(role, text);
  }
}

async function startSession() {
  if (state.realtime || state.pastViewOpen) {
    return;
  }

  const response = await fetch('/api/sessions/start', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to start session');
  }

  const { session } = await response.json();
  state.sessionId = session.id;
  state.transcript = [];
  renderTranscript();
  setSessionControls(true);

  state.realtime = new RealtimeSession({
    sessionId: state.sessionId,
    onStatus: setStatus,
    onTranscript: handleTranscript,
    onError: (message) => {
      resetConnection({ status: 'error', message });
    },
    onDisconnect: (message) => {
      resetConnection({ status: 'disconnected', message });
    },
  });

  await state.realtime.start();
}

async function closeActiveSession({ save }) {
  if (!state.sessionId) {
    return;
  }

  setSessionControls(false);
  orbButton.disabled = true;
  setStatus(save ? 'saving' : 'idle');

  if (state.realtime) {
    await state.realtime.stop();
    state.realtime = null;
  }

  const endpoint = save ? 'end' : 'discard';
  const response = await fetch(`/api/sessions/${state.sessionId}/${endpoint}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    setStatus('error');
    orbLabel.textContent = error.details || error.error || `Failed to ${save ? 'save' : 'discard'} session`;
    orbButton.disabled = state.pastViewOpen;
    setSessionControls(true);
    return false;
  }

  if (save) {
    const { thoughtRecord } = await response.json();
    renderLatestSummary(thoughtRecord);
    await refreshRecords();
  }

  state.sessionId = null;
  state.transcript = [];
  renderTranscript();
  setStatus('idle');
  orbButton.disabled = state.pastViewOpen;
  setSessionControls(false);

  if (!save) {
    orbLabel.textContent = 'Session discarded — press T when ready';
  }

  return true;
}

async function endSession() {
  await closeActiveSession({ save: true });
}

async function discardSession() {
  await closeActiveSession({ save: false });
}

function renderLatestSummary(record) {
  if (!record) {
    latestSummaryEl.className = 'summary-box empty';
    latestSummaryEl.textContent = 'No summary was generated for this session.';
    return;
  }

  latestSummaryEl.className = 'summary-box';
  latestSummaryEl.innerHTML = `
    <h3>${escapeHtml(record.recordDate)}</h3>
    <p>${escapeHtml(record.summary)}</p>
    ${
      record.highlights?.length
        ? `<ul>${record.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : ''
    }
    ${
      record.keywords?.length
        ? `<div class="idea-tags">${record.keywords
            .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
            .join('')}</div>`
        : ''
    }
  `;
}

async function refreshRecords() {
  await loadRecordsList({
    listEl: recordsListEl,
    messageEl: recordsMessageEl,
    escapeHtml,
    isSessionActive,
    onSelect: (recordId) => pastView.openRecord(recordId),
  });
}

async function beginSession() {
  if (state.realtime || state.pastViewOpen) {
    return;
  }

  orbButton.disabled = true;

  try {
    await startSession();
  } catch (error) {
    resetConnection({ status: 'error', message: error.message });
  } finally {
    orbButton.disabled = state.pastViewOpen;
  }
}

orbButton.addEventListener('click', beginSession);

endSessionBtn.addEventListener('click', endSession);
discardSessionBtn.addEventListener('click', discardSession);
refreshRecordsBtn.addEventListener('click', refreshRecords);

function isTypingTarget(target) {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyT' || event.repeat || isTypingTarget(event.target) || state.pastViewOpen) {
    return;
  }

  if (!state.realtime?.active) {
    if (state.status === 'idle' || state.status === 'error' || state.status === 'disconnected') {
      event.preventDefault();
      void beginSession();
    }
    return;
  }

  if (state.status === 'ready') {
    event.preventDefault();
    state.realtime.startRecording();
    return;
  }

  if (state.realtime.isRecording) {
    event.preventDefault();
    state.realtime.stopRecording();
  }
});

refreshRecords();
settingsView.loadSettings();
