import { RealtimeSession } from './realtime.js';
import { createPastView, loadRecordsList, deleteRecord } from './past.js';
import { createSettingsView } from './settings.js';

const sessionColumn = document.getElementById('session-column');
const recordBtn = document.getElementById('record-btn');
const recordActionBtn = document.getElementById('record-action-btn');
const endSessionBtn = document.getElementById('end-session-btn');
const discardSessionBtn = document.getElementById('discard-session-btn');
const transcriptEl = document.getElementById('transcript');
const recordsListEl = document.getElementById('records-list');
const recordsMessageEl = document.getElementById('records-message');
const refreshRecordsBtn = document.getElementById('refresh-records-btn');
const discDateEl = document.getElementById('disc-date');
const discStatusEl = document.getElementById('disc-status');
const discRotateEl = recordBtn.querySelector('.disc-rotate');

const discMotion = {
  angle: 0,
  spinning: false,
  resetting: false,
  rafId: null,
  lastTs: null,
  speed: 90,
};

const state = {
  sessionId: null,
  realtime: null,
  status: 'idle',
  transcript: [],
  pastViewOpen: false,
  userTurnCount: 0,
};

const statusLabels = {
  idle: 'Ready',
  connecting: 'Connecting',
  ready: 'Ready',
  recording: 'Recording',
  thinking: 'Thinking',
  speaking: 'Speaking',
  saving: 'Saving',
  disconnected: 'Disconnected',
  error: 'Error',
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatDiscDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function updateDiscDate() {
  discDateEl.textContent = formatDiscDate();
}

function isSessionActive() {
  return Boolean(state.sessionId || state.realtime?.active);
}

function setMainSessionBlocked(blocked) {
  recordBtn.disabled = blocked || state.pastViewOpen;
  recordActionBtn.disabled = blocked || state.pastViewOpen;
  sessionColumn.classList.toggle('blocked', blocked);
}

const pastView = createPastView({
  escapeHtml,
  isSessionActive,
  onOpen: () => {
    state.pastViewOpen = true;
    setMainSessionBlocked(true);
    updateDiscStatus('Revisiting');
  },
  onClose: () => {
    state.pastViewOpen = false;
    setMainSessionBlocked(false);
    setStatus(state.status);
  },
  onDelete: () => refreshRecords(),
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

function updateDiscStatus(text) {
  discStatusEl.textContent = text;
}

function normalizeDiscAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function applyDiscRotation() {
  discRotateEl.style.transform = `rotate(${discMotion.angle}deg)`;
}

function discMotionLoop(timestamp) {
  if (!discMotion.lastTs) {
    discMotion.lastTs = timestamp;
  }

  const deltaSeconds = (timestamp - discMotion.lastTs) / 1000;
  discMotion.lastTs = timestamp;

  if (discMotion.spinning) {
    discMotion.angle += discMotion.speed * deltaSeconds;
    applyDiscRotation();
    discMotion.rafId = requestAnimationFrame(discMotionLoop);
    return;
  }

  if (discMotion.resetting) {
    const normalized = normalizeDiscAngle(discMotion.angle);
    const reverseDistance = normalized;
    const forwardDistance = normalized === 0 ? 0 : 360 - normalized;
    const useReverse = reverseDistance <= forwardDistance;
    const target = useReverse
      ? discMotion.angle - normalized
      : discMotion.angle + forwardDistance;
    const remaining = Math.abs(target - discMotion.angle);
    const step = discMotion.speed * deltaSeconds;

    if (remaining <= step || remaining < 0.5) {
      discMotion.angle = target;
      discMotion.resetting = false;
      discMotion.rafId = null;
      if (normalizeDiscAngle(discMotion.angle) === 0 || Math.abs(normalizeDiscAngle(discMotion.angle) - 360) < 0.5) {
        discMotion.angle = 0;
      }
      applyDiscRotation();
      return;
    }

    discMotion.angle += useReverse ? -step : step;
    applyDiscRotation();
    discMotion.rafId = requestAnimationFrame(discMotionLoop);
  }
}

function startDiscSpin() {
  discMotion.spinning = true;
  discMotion.resetting = false;
  discMotion.lastTs = null;

  if (!discMotion.rafId) {
    discMotion.rafId = requestAnimationFrame(discMotionLoop);
  }
}

function stopDiscSpinAndReset() {
  discMotion.spinning = false;
  discMotion.resetting = true;
  discMotion.lastTs = null;

  if (!discMotion.rafId) {
    discMotion.rafId = requestAnimationFrame(discMotionLoop);
  }
}

function resetDiscHome({ instant = false } = {}) {
  if (discMotion.rafId) {
    cancelAnimationFrame(discMotion.rafId);
    discMotion.rafId = null;
  }

  discMotion.spinning = false;
  discMotion.resetting = false;
  discMotion.lastTs = null;

  if (instant) {
    discMotion.angle = 0;
    applyDiscRotation();
    return;
  }

  const normalized = normalizeDiscAngle(discMotion.angle);
  if (normalized < 0.5) {
    discMotion.angle = 0;
    applyDiscRotation();
    return;
  }

  stopDiscSpinAndReset();
}

function resetConnection({ status = 'idle' } = {}) {
  state.realtime = null;
  state.sessionId = null;
  state.userTurnCount = 0;
  resetDiscHome({ instant: true });
  recordBtn.disabled = state.pastViewOpen;
  recordActionBtn.disabled = state.pastViewOpen;
  setSessionControls(false);
  setStatus(status);
}

function setStatus(status) {
  const prevStatus = state.status;
  state.status = status;

  recordBtn.className = 'session-disc';
  if (status === 'recording') {
    recordBtn.classList.add('recording');
    if (!discMotion.spinning) {
      startDiscSpin();
    }
  } else if (status === 'speaking') {
    recordBtn.classList.add('speaking');
  } else if (status === 'thinking') {
    recordBtn.classList.add('thinking');
  }

  if (prevStatus === 'recording' && status !== 'recording') {
    stopDiscSpinAndReset();
  }

  if (status === 'idle' || status === 'disconnected' || status === 'error' || status === 'saving') {
    resetDiscHome({ instant: true });
  }

  if (state.pastViewOpen) {
    return;
  }

  if (status === 'ready' && state.userTurnCount > 0) {
    updateDiscStatus(`Record ${state.userTurnCount + 1}`);
  } else if (status === 'recording') {
    updateDiscStatus(`Record ${state.userTurnCount + 1}`);
  } else if (status === 'saving') {
    updateDiscStatus(getSavingLabel());
  } else if (status === 'connecting') {
    updateDiscStatus('Connecting');
  } else if (status === 'thinking') {
    updateDiscStatus('Thinking');
  } else if (status === 'speaking') {
    updateDiscStatus('Speaking');
  } else if (status === 'disconnected' || status === 'error') {
    updateDiscStatus(statusLabels[status]);
  } else {
    updateDiscStatus(statusLabels[status] || status);
  }
}

function renderTranscript() {
  if (!state.transcript.length) {
    transcriptEl.innerHTML = `
      <p class="transcript-placeholder">
        Your conversation with the assistant will appear here. Press <strong>T</strong> to begin a reflection session.
      </p>
    `;
    return;
  }

  transcriptEl.innerHTML = state.transcript
    .map(
      (entry) => `
        <article class="message-block ${entry.role}">
          <span class="message-role">${entry.role === 'user' ? 'User' : 'Assistant'}</span>
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
    if (role === 'user') {
      state.userTurnCount += 1;
      if (state.status === 'ready' || state.status === 'recording') {
        updateDiscStatus(`Record ${state.userTurnCount}`);
      }
    }
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
  state.userTurnCount = 0;
  renderTranscript();
  setSessionControls(true);

  state.realtime = new RealtimeSession({
    sessionId: state.sessionId,
    onStatus: setStatus,
    onTranscript: handleTranscript,
    onError: () => {
      resetConnection({ status: 'error' });
    },
    onDisconnect: () => {
      resetConnection({ status: 'disconnected' });
    },
  });

  await state.realtime.start();
}

async function closeActiveSession({ save }) {
  if (!state.sessionId) {
    return;
  }

  setSessionControls(false);
  recordBtn.disabled = true;
  recordActionBtn.disabled = true;
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
    updateDiscStatus(error.details || error.error || `Failed to ${save ? 'save' : 'discard'} session`);
    recordBtn.disabled = state.pastViewOpen;
    recordActionBtn.disabled = state.pastViewOpen;
    setSessionControls(true);
    return false;
  }

  if (save) {
    await response.json();
    await refreshRecords();
  }

  state.sessionId = null;
  state.transcript = [];
  state.userTurnCount = 0;
  renderTranscript();
  setStatus('idle');
  recordBtn.disabled = state.pastViewOpen;
  recordActionBtn.disabled = state.pastViewOpen;
  setSessionControls(false);

  if (!save) {
    updateDiscStatus('Discarded');
  }

  return true;
}

async function endSession() {
  await closeActiveSession({ save: true });
}

async function discardSession() {
  await closeActiveSession({ save: false });
}

async function refreshRecords() {
  await loadRecordsList({
    listEl: recordsListEl,
    messageEl: recordsMessageEl,
    escapeHtml,
    isSessionActive,
    onSelect: (recordId) => pastView.openRecord(recordId),
    onDelete: async (recordId) => {
      if (isSessionActive()) {
        recordsMessageEl.textContent = 'End or discard your live session before deleting.';
        recordsMessageEl.classList.remove('hidden');
        return;
      }
      const ok = await deleteRecord(recordId);
      if (ok) {
        await refreshRecords();
      }
    },
  });
}

async function beginSession() {
  if (state.realtime || state.pastViewOpen) {
    return;
  }

  recordBtn.disabled = true;
  recordActionBtn.disabled = true;

  try {
    await startSession();
  } catch (error) {
    resetConnection({ status: 'error' });
    updateDiscStatus(error.message);
  } finally {
    recordBtn.disabled = state.pastViewOpen;
    recordActionBtn.disabled = state.pastViewOpen;
  }
}

function handleRecordAction() {
  if (!state.realtime?.active) {
    if (state.status === 'idle' || state.status === 'error' || state.status === 'disconnected') {
      void beginSession();
    }
    return;
  }

  if (state.status === 'ready') {
    state.realtime.startRecording();
    return;
  }

  if (state.realtime.isRecording) {
    state.realtime.stopRecording();
  }
}

recordBtn.addEventListener('click', handleRecordAction);
recordActionBtn.addEventListener('click', handleRecordAction);
endSessionBtn.addEventListener('click', endSession);
discardSessionBtn.addEventListener('click', discardSession);
refreshRecordsBtn.addEventListener('click', refreshRecords);

function isTypingTarget(target) {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target) || state.pastViewOpen || event.repeat) {
    return;
  }

  if (event.code === 'KeyT') {
    event.preventDefault();
    handleRecordAction();
    return;
  }

  if (event.code === 'KeyS' && isSessionActive()) {
    event.preventDefault();
    void endSession();
  }
});

updateDiscDate();
applyDiscRotation();
renderTranscript();
refreshRecords();
settingsView.loadSettings();
