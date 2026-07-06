export function createPastView({
  escapeHtml,
  isSessionActive,
  onOpen,
  onClose,
}) {
  const overlay = document.getElementById('past-overlay');
  const closeBtn = document.getElementById('past-close-btn');
  const titleEl = document.getElementById('past-title');
  const summaryEl = document.getElementById('past-summary');
  const highlightsEl = document.getElementById('past-highlights');
  const tagsEl = document.getElementById('past-tags');
  const hearBtn = document.getElementById('hear-this-btn');
  const narrationStatus = document.getElementById('narration-status');
  const narrationScript = document.getElementById('narration-script');
  const askCheckbox = document.getElementById('ask-past-checkbox');
  const qaSection = document.getElementById('past-qa');
  const qaMessages = document.getElementById('past-qa-messages');
  const qaForm = document.getElementById('past-qa-form');
  const qaInput = document.getElementById('past-qa-input');
  const transcriptEl = document.getElementById('past-transcript');

  const state = {
    recordId: null,
    detail: null,
    qaHistory: [],
    audio: null,
    open: false,
  };

  function setOpen(open) {
    state.open = open;
    overlay.classList.toggle('hidden', !open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      onOpen?.();
    } else {
      stopAudio();
      onClose?.();
    }
  }

  function stopAudio() {
    if (state.audio) {
      state.audio.pause();
      state.audio = null;
    }
  }

  function resetQa() {
    state.qaHistory = [];
    askCheckbox.checked = false;
    qaSection.classList.add('hidden');
    qaMessages.innerHTML = '';
    qaInput.value = '';
  }

  function renderTranscript(transcript) {
    if (!transcript?.length) {
      transcriptEl.innerHTML = '<p class="card-copy">No transcript saved for this session.</p>';
      return;
    }

    transcriptEl.innerHTML = transcript
      .map(
        (entry) => `
          <article class="message ${entry.role}">
            <span class="message-role">${entry.role}</span>
            <p>${escapeHtml(entry.content)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderDetail(detail) {
    const { record, transcript } = detail;
    titleEl.textContent = record.recordDate;
    summaryEl.textContent = record.summary;

    highlightsEl.innerHTML = record.highlights?.length
      ? `<ul>${record.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

    tagsEl.innerHTML = (record.keywords || [])
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');

    if (record.narrationScript) {
      narrationScript.textContent = record.narrationScript;
      narrationScript.classList.remove('hidden');
      narrationStatus.textContent = record.narrationVoice
        ? 'Saved narration ready — press Hear this to listen.'
        : 'Saved script ready — first playback will cache the audio.';
    } else {
      narrationScript.classList.add('hidden');
      narrationScript.textContent = '';
      narrationStatus.textContent = 'No saved narration yet — Hear this will generate and save it once.';
    }
    hearBtn.disabled = false;

    renderTranscript(transcript);
    resetQa();
  }

  async function openRecord(recordId) {
    if (isSessionActive()) {
      narrationStatus.textContent = 'End or discard your current session before revisiting the past.';
      return;
    }

    const response = await fetch(`/api/records/${recordId}`);
    if (!response.ok) {
      throw new Error('Could not load this reflection');
    }

    state.recordId = recordId;
    state.detail = await response.json();
    renderDetail(state.detail);
    setOpen(true);
  }

  async function playNarration() {
    if (!state.recordId) {
      return;
    }

    stopAudio();
    hearBtn.disabled = true;
    const hasSavedScript = Boolean(state.detail?.record?.narrationScript);
    const hasCachedAudio = Boolean(state.detail?.record?.narrationVoice);
    narrationStatus.textContent = hasCachedAudio
      ? 'Loading saved audio…'
      : hasSavedScript
        ? 'Generating audio for saved script…'
        : 'Generating narration once, then saving…';

    const response = await fetch(`/api/records/${state.recordId}/narrate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      narrationStatus.textContent = error.details || error.error || 'Narration failed.';
      hearBtn.disabled = false;
      return;
    }

    const { script, audioBase64, mimeType, scriptCached, audioCached, voice } = await response.json();
    narrationScript.textContent = script;
    narrationScript.classList.remove('hidden');
    if (state.detail?.record) {
      state.detail.record.narrationScript = script;
      state.detail.record.narrationVoice = voice;
    }

    if (audioCached) {
      narrationStatus.textContent = 'Playing saved audio…';
    } else if (scriptCached) {
      narrationStatus.textContent = 'Playing audio — saved for instant replay.';
    } else {
      narrationStatus.textContent = 'Playing newly saved narration…';
    }

    state.audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    state.audio.addEventListener('ended', () => {
      narrationStatus.textContent = 'Finished. Press Hear this to listen again.';
      hearBtn.disabled = false;
    });
    state.audio.addEventListener('error', () => {
      narrationStatus.textContent = 'Could not play audio.';
      hearBtn.disabled = false;
    });

    try {
      await state.audio.play();
    } catch {
      narrationStatus.textContent = 'Press Hear this again to play.';
      hearBtn.disabled = false;
    }
  }

  function appendQaMessage(role, content) {
    const article = document.createElement('article');
    article.className = `message ${role}`;
    article.innerHTML = `
      <span class="message-role">${role}</span>
      <p>${escapeHtml(content)}</p>
    `;
    qaMessages.appendChild(article);
    qaMessages.scrollTop = qaMessages.scrollHeight;
  }

  async function submitQuestion(event) {
    event.preventDefault();

    const question = qaInput.value.trim();
    if (!question || !state.recordId) {
      return;
    }

    appendQaMessage('user', question);
    qaInput.value = '';
    qaInput.disabled = true;

    const response = await fetch(`/api/records/${state.recordId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        history: state.qaHistory,
      }),
    });

    qaInput.disabled = false;

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      appendQaMessage('assistant', error.details || error.error || 'Something went wrong.');
      return;
    }

    const { answer } = await response.json();
    state.qaHistory.push({ role: 'user', content: question });
    state.qaHistory.push({ role: 'assistant', content: answer });
    appendQaMessage('assistant', answer);
  }

  closeBtn.addEventListener('click', () => {
    setOpen(false);
    state.recordId = null;
    state.detail = null;
  });

  hearBtn.addEventListener('click', playNarration);

  askCheckbox.addEventListener('change', () => {
    qaSection.classList.toggle('hidden', !askCheckbox.checked);
    if (askCheckbox.checked) {
      qaInput.focus();
    }
  });

  qaForm.addEventListener('submit', submitQuestion);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      setOpen(false);
      state.recordId = null;
      state.detail = null;
    }
  });

  return {
    isOpen: () => state.open,
    openRecord,
  };
}

export async function loadRecordsList({
  listEl,
  messageEl,
  escapeHtml,
  onSelect,
  isSessionActive,
}) {
  const response = await fetch('/api/records');
  if (!response.ok) {
    messageEl.textContent = 'Could not load past reflections.';
    return;
  }

  const { records } = await response.json();
  if (!records.length) {
    messageEl.textContent = 'No reflections saved yet. Finish a session to build your archive.';
    listEl.innerHTML = '';
    return;
  }

  messageEl.textContent = `${records.length} saved reflection${records.length === 1 ? '' : 's'} — click to revisit.`;
  listEl.innerHTML = records
    .map(
      (record) => `
        <button class="idea-card idea-card-btn" type="button" data-record-id="${record.id}">
          <div class="idea-date">${escapeHtml(record.recordDate)}</div>
          <div class="idea-highlight">${escapeHtml(record.highlights[0] || record.summary)}</div>
          ${
            record.notableQuotes?.[0]
              ? `<p class="card-copy">“${escapeHtml(record.notableQuotes[0])}”</p>`
              : ''
          }
          <div class="idea-tags">
            ${record.keywords.slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </button>
      `
    )
    .join('');

  listEl.querySelectorAll('[data-record-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (isSessionActive()) {
        messageEl.textContent = 'End or discard your live session before opening a past reflection.';
        return;
      }

      try {
        await onSelect(button.dataset.recordId);
      } catch (error) {
        messageEl.textContent = error.message;
      }
    });
  });
}
