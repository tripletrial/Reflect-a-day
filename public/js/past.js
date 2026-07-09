export function createPastView({
  escapeHtml,
  isSessionActive,
  onOpen,
  onClose,
  onDelete,
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
  const deleteBtn = document.getElementById('past-delete-btn');

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

  function formatCardDate(recordDate) {
    if (!recordDate) {
      return '';
    }
    const parts = recordDate.split('-');
    if (parts.length === 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return recordDate;
  }

  function renderTranscript(transcript) {
    if (!transcript?.length) {
      transcriptEl.innerHTML = '<p class="overlay-status">No transcript saved for this session.</p>';
      return;
    }

    transcriptEl.innerHTML = transcript
      .map(
        (entry) => `
          <article class="message-block ${entry.role}">
            <span class="message-role">${entry.role === 'user' ? 'User' : 'Assistant'}</span>
            <p>${escapeHtml(entry.content)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderDetail(detail) {
    const { record, transcript } = detail;
    titleEl.textContent = formatCardDate(record.recordDate);
    summaryEl.textContent = record.summary;

    highlightsEl.innerHTML = record.highlights?.length
      ? `<ul>${record.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

    tagsEl.innerHTML = (record.keywords || [])
      .map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
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
      narrationStatus.textContent = 'Press Hear this to generate and save narration.';
    }
    hearBtn.disabled = false;

    renderTranscript(transcript);
    resetQa();
  }

  async function openRecord(recordId) {
    if (isSessionActive()) {
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
    article.className = `message-block ${role}`;
    article.innerHTML = `
      <span class="message-role">${role === 'user' ? 'User' : 'Assistant'}</span>
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

  async function deleteCurrentRecord() {
    if (!state.recordId) {
      return;
    }

    const ok = await deleteRecord(state.recordId);
    if (!ok) {
      return;
    }

    setOpen(false);
    state.recordId = null;
    state.detail = null;
    await onDelete?.();
  }

  closeBtn.addEventListener('click', () => {
    setOpen(false);
    state.recordId = null;
    state.detail = null;
  });

  deleteBtn.addEventListener('click', deleteCurrentRecord);

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

export async function deleteRecord(recordId) {
  if (!window.confirm('Delete this reflection permanently?')) {
    return false;
  }

  const response = await fetch(`/api/records/${recordId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    window.alert(error.details || error.error || 'Could not delete reflection.');
    return false;
  }

  return true;
}

function formatCardDate(recordDate) {
  if (!recordDate) {
    return '';
  }
  const parts = recordDate.split('-');
  if (parts.length === 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return recordDate;
}

export async function loadRecordsList({
  listEl,
  messageEl,
  escapeHtml,
  onSelect,
  onDelete,
  isSessionActive,
}) {
  const response = await fetch('/api/records');
  if (!response.ok) {
    messageEl.textContent = 'Could not load past reflections.';
    messageEl.classList.remove('hidden');
    return;
  }

  const { records } = await response.json();
  if (!records.length) {
    messageEl.textContent = 'No reflections saved yet.';
    messageEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }

  messageEl.classList.add('hidden');
  listEl.innerHTML = records
    .map(
      (record) => `
        <article class="reflection-card" data-record-id="${record.id}">
          <p class="reflection-date">${escapeHtml(formatCardDate(record.recordDate))}</p>
          <p class="reflection-summary">${escapeHtml(record.summary)}</p>
          ${
            record.notableQuotes?.[0]
              ? `<p class="reflection-quote">"${escapeHtml(record.notableQuotes[0])}"</p>`
              : ''
          }
          <div class="tag-row">
            ${record.keywords
              .slice(0, 4)
              .map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`)
              .join('')}
            <button class="tag-pill tag-delete" type="button" data-delete-id="${record.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join('');

  listEl.querySelectorAll('.reflection-card').forEach((card) => {
    card.addEventListener('click', async () => {
      if (isSessionActive()) {
        messageEl.textContent = 'End or discard your live session before opening a past reflection.';
        messageEl.classList.remove('hidden');
        return;
      }

      try {
        await onSelect(card.dataset.recordId);
      } catch (error) {
        messageEl.textContent = error.message;
        messageEl.classList.remove('hidden');
      }
    });
  });

  listEl.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (isSessionActive()) {
        messageEl.textContent = 'End or discard your live session before deleting.';
        messageEl.classList.remove('hidden');
        return;
      }
      await onDelete(button.dataset.deleteId);
    });
  });
}
