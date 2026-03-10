document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const tootContent    = $('tootContent');
  const cwInput        = $('cwInput');
  const getlinkBtn     = $('getlinkBtn');
  const tagsBtn        = $('tagsBtn');
  const cwBtn          = $('cwBtn');
  const threadBtn      = $('threadBtn');
  const sendBtn        = $('sendBtn');
  const visibilitySelect = $('visibility');
  const accountSelect  = $('accountSelect');
  const msgDiv         = $('msg');
  const mediaPreview   = $('mediaPreview');
  const tagList        = $('tagList');

  const state = {
    mediaIds: [],
    allAccounts: [],
    lastTootIds: {},
    lastTootCws: {}, 
    isTagsLoaded: false,
    isThreadMode: false,
    currentAccountIdx: null,
  };

  let msgTimer;
  const showMessage = (text, isError = false) => {
    clearTimeout(msgTimer);
    msgDiv.textContent = text;
    msgDiv.className = isError ? 'error' : '';
    msgDiv.style.display = 'block';
    msgTimer = setTimeout(() => { msgDiv.style.display = 'none'; }, 3000);
  };

  const getCurrentAccount = () =>
    state.allAccounts.length ? state.allAccounts[accountSelect.value] : null;

  const getCurrentAccountIdx = () => accountSelect.value;

  const saveDraft = () => {
    chrome.storage.local.set({
      draftToot: tootContent.value,
      draftCw: cwInput.value,
      draftMediaIds: state.mediaIds,
    });
  };

  const clearDraft = () =>
    chrome.storage.local.remove(['draftToot', 'draftCw', 'draftMediaIds']);

  const persistLastTootData = () => {
    chrome.storage.local.set({ 
      lastTootIds: state.lastTootIds,
      lastTootCws: state.lastTootCws 
    });
  };

  const setCwVisible = (visible) => {
    cwInput.style.display = visible ? 'block' : 'none';
    cwBtn.classList.toggle('active', visible);
    tootContent.style.borderRadius = visible ? '0 0 6px 6px' : '6px';
    if (!visible) { cwInput.value = ''; saveDraft(); }
    else cwInput.focus();
  };

  cwBtn.addEventListener('click', () => setCwVisible(cwInput.style.display !== 'block'));

  const setThreadMode = (enabled) => {
    state.isThreadMode = enabled;
    threadBtn.classList.toggle('active', enabled);
  };

  threadBtn.addEventListener('click', () => {
    const idx = getCurrentAccountIdx();
    if (!state.lastTootIds[idx]) {
      showMessage(i18n('msgNoPrevToot'), true);
      return;
    }
    
    const willEnable = !state.isThreadMode;
    setThreadMode(willEnable);
    
    if (willEnable) {
      if (state.lastTootCws[idx] && !cwInput.value) {
        cwInput.value = state.lastTootCws[idx];
        setCwVisible(true);
        saveDraft();
      }
    } else {
      if (state.lastTootCws[idx] && cwInput.value === state.lastTootCws[idx]) {
        setCwVisible(false);
      }
    }

    showMessage(state.isThreadMode ? i18n('msgThreadOn') : i18n('msgThreadOff'));
  });

  const loadFeaturedTags = async (instanceUrl, accessToken) => {
    tagList.textContent = i18n('msgLoading');
    try {
      const r = await fetch(`${instanceUrl}/api/v1/featured_tags`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const tags = r.ok ? await r.json() : [];
      state.isTagsLoaded = true;
      renderTags(tags);
    } catch {
      tagList.textContent = i18n('msgTagsFail');
    }
  };

  const renderTags = (tags) => {
    tagList.innerHTML = '';
    if (!tags.length) { tagList.textContent = i18n('msgNoTags'); return; }
    tags.forEach(({ name }) => {
      const span = document.createElement('span');
      span.className = 'tag-item';
      span.textContent = `#${name}`;
      span.addEventListener('click', () => {
        tootContent.setRangeText(`#${name} `,
          tootContent.selectionStart, tootContent.selectionEnd, 'end');
        tootContent.focus();
        saveDraft();
      });
      tagList.appendChild(span);
    });
  };

  tagsBtn.addEventListener('click', () => {
    const isOpen = tagList.style.display === 'flex';
    tagList.style.display = isOpen ? 'none' : 'flex';
    tagsBtn.classList.toggle('active', !isOpen);

    if (!isOpen && !state.isTagsLoaded) {
      const acc = getCurrentAccount();
      if (acc) loadFeaturedTags(acc.instanceUrl, acc.accessToken);
      else tagList.textContent = i18n('popSelectAcc');
    }
  });

  getlinkBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      tootContent.setRangeText(
        `\n${tab.title}\n${tab.url}`,
        tootContent.selectionStart, tootContent.selectionEnd, 'end'
      );
      tootContent.focus();
      saveDraft();
    });
  });

  const uploadSingleImage = async (file, acc) => {
    const formData = new FormData();
    formData.append('file', file);

    const r = await fetch(`${acc.instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${acc.accessToken}` },
      body: formData,
    });
    
    if (!r.ok) throw new Error('Upload failed');
    const data = await r.json();
    state.mediaIds.push(data.id);
    mediaPreview.textContent = i18n('msgAttached', state.mediaIds.length);
    saveDraft();
  };

  tootContent.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const imageFiles = [];
    
    for (const item of Object.values(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        imageFiles.push(item.getAsFile());
      }
    }

    if (imageFiles.length > 0) {
      const acc = getCurrentAccount();
      if (!acc) { showMessage(i18n('popSelectAcc'), true); return; }

      sendBtn.disabled = true;
      const originalText = sendBtn.textContent;
      sendBtn.textContent = i18n('msgUploading');
      mediaPreview.textContent = i18n('msgUploading');

      try {
        await Promise.all(imageFiles.map(file => uploadSingleImage(file, acc)));
      } catch {
        mediaPreview.textContent = '';
        showMessage(i18n('msgUploadFail'), true);
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;
      }
    }
  });

  const resetAfterSend = () => {
    tootContent.value = '';
    setCwVisible(false);
    state.mediaIds = [];
    mediaPreview.textContent = '';
    tagList.style.display = 'none';
    tagsBtn.classList.remove('active');
    setThreadMode(false);
    clearDraft();
    sendBtn.disabled = false;
    sendBtn.textContent = i18n('popBtnSend');
  };

  sendBtn.addEventListener('click', async () => {
    const acc = getCurrentAccount();
    if (!acc) { showMessage(i18n('popSelectAcc'), true); return; }

    const content = tootContent.value.trim();
    if (!content && state.mediaIds.length === 0) {
      showMessage(i18n('msgEmpty'), true);
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = i18n('msgSending');

    const visibility = visibilitySelect.value;
    chrome.storage.sync.set({ lastVisibility: visibility });

    const payload = { status: content, visibility };
    if (state.mediaIds.length) payload.media_ids = state.mediaIds;

    const cwValue = cwInput.value.trim();
    if (cwInput.style.display === 'block' && cwValue) payload.spoiler_text = cwValue;

    const idx = getCurrentAccountIdx();
    if (state.isThreadMode && state.lastTootIds[idx]) {
      payload.in_reply_to_id = state.lastTootIds[idx];
    }

    try {
      const r = await fetch(`${acc.instanceUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Send failed');
      const data = await r.json();

      state.lastTootIds[idx] = data.id;
      if (cwInput.style.display === 'block' && cwValue) {
        state.lastTootCws[idx] = cwValue;
      } else {
        delete state.lastTootCws[idx];
      }
      persistLastTootData();

      showMessage(i18n('msgSendSuccess'));
      resetAfterSend();
    } catch {
      showMessage(i18n('msgSendFail'), true);
      sendBtn.disabled = false;
      sendBtn.textContent = i18n('popBtnSend');
    }
  });

  tootContent.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendBtn.click();
  });

  tootContent.addEventListener('input', saveDraft);
  cwInput.addEventListener('input', saveDraft);

  accountSelect.addEventListener('change', () => {
    const oldIdx = state.currentAccountIdx;
    state.currentAccountIdx = accountSelect.value;

    state.isTagsLoaded = false;
    tagList.style.display = 'none';
    tagsBtn.classList.remove('active');
    
    if (state.isThreadMode) {
      setThreadMode(false);
      if (state.lastTootCws[oldIdx] && cwInput.value === state.lastTootCws[oldIdx]) {
        setCwVisible(false);
      }
    }

    chrome.storage.sync.set({ lastAccountIdx: state.currentAccountIdx });
  });

  chrome.storage.sync.get(['lastVisibility', 'accounts', 'lastAccountIdx'], (items) => {
    visibilitySelect.value = items.lastVisibility || 'direct';
    state.allAccounts = items.accounts || [];

    if (state.allAccounts.length) {
      accountSelect.innerHTML = '';
      state.allAccounts.forEach((acc, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${acc.name} (${acc.instanceUrl.replace('https://', '')})`;
        accountSelect.appendChild(opt);
      });
      if (items.lastAccountIdx != null && items.lastAccountIdx < state.allAccounts.length) {
        accountSelect.value = items.lastAccountIdx;
      }
      state.currentAccountIdx = accountSelect.value;
    } else {
      accountSelect.innerHTML = `<option value="">${i18n('popSelectAcc')}</option>`;
      sendBtn.disabled = true;
    }
  });

  chrome.storage.local.get(['draftToot', 'draftCw', 'draftMediaIds', 'lastTootIds', 'lastTootCws'], (items) => {
    if (items.draftToot) tootContent.value = items.draftToot;
    if (items.draftCw) {
      cwInput.value = items.draftCw;
      setCwVisible(true);
    }
    if (items.draftMediaIds?.length) {
      state.mediaIds = items.draftMediaIds;
      mediaPreview.textContent = i18n('msgAttachedDraft', state.mediaIds.length);
    }
    if (items.lastTootIds) state.lastTootIds = items.lastTootIds;
    if (items.lastTootCws) state.lastTootCws = items.lastTootCws;
  });
});