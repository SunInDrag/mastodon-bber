document.addEventListener('DOMContentLoaded', () => {
  const accountNameInput = document.getElementById('accountName');
  const instanceUrlInput = document.getElementById('instanceUrl');
  const accessTokenInput = document.getElementById('accessToken');
  const addBtn = document.getElementById('addBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const formTitle = document.getElementById('formTitle');
  const statusDiv = document.getElementById('status');
  const accountList = document.getElementById('accountList');

  let editingIndex = -1;

  const showStatus = (msg, isError = false) => {
    statusDiv.textContent = msg;
    statusDiv.style.color = isError ? '#d9534f' : '#307991';
    setTimeout(() => { statusDiv.textContent = ''; }, 3000);
  };

  const resetForm = () => {
    editingIndex = -1;
    accountNameInput.value = '';
    instanceUrlInput.value = '';
    accessTokenInput.value = '';
    formTitle.textContent = i18n('optAddTitle');
    addBtn.textContent = i18n('optAddBtn');
    cancelBtn.style.display = 'none';
  };

  cancelBtn.addEventListener('click', resetForm);

  const loadAccounts = () => {
    chrome.storage.sync.get(['accounts'], (items) => {
      const accounts = items.accounts || [];
      accountList.innerHTML = '';
      
      if (accounts.length === 0) {
        accountList.innerHTML = `<div style="font-size:12px;color:#888;">${i18n('optNoAccounts')}</div>`;
        return;
      }

      accounts.forEach((acc, index) => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.innerHTML = `
          <div class="account-info">
            <div class="account-name">${acc.name}</div>
            <div class="account-host">${acc.instanceUrl}</div>
          </div>
          <div class="account-actions">
            <button class="list-btn edit-btn" data-index="${index}">${i18n('optEdit')}</button>
            <button class="list-btn delete-btn" data-index="${index}">${i18n('optDelete')}</button>
          </div>
        `;
        accountList.appendChild(item);
      });

      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.getAttribute('data-index'), 10);
          startEdit(idx, accounts[idx]);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.getAttribute('data-index'), 10);
          deleteAccount(idx);
        });
      });
    });
  };

  const startEdit = (index, acc) => {
    editingIndex = index;
    accountNameInput.value = acc.name;
    instanceUrlInput.value = acc.instanceUrl.replace(/^https?:\/\//, '');
    accessTokenInput.value = acc.accessToken;
    
    formTitle.textContent = i18n('optEditTitle');
    addBtn.textContent = i18n('optUpdateBtn');
    cancelBtn.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteAccount = (index) => {
    if(!confirm(i18n('optConfirmDel'))) return;
    
    chrome.storage.sync.get(['accounts'], (items) => {
      let accounts = items.accounts || [];
      accounts.splice(index, 1);
      chrome.storage.sync.set({ accounts }, () => {
        if (editingIndex === index) {
          resetForm();
        } else if (editingIndex > index) {
          editingIndex--;
        }
        loadAccounts();
        showStatus(i18n('optDelSuccess'));
      });
    });
  };

  addBtn.addEventListener('click', () => {
    const name = accountNameInput.value.trim() || 'Account';
    let rawUrl = instanceUrlInput.value.trim();
    const accessToken = accessTokenInput.value.trim();

    if (!rawUrl || !accessToken) {
      return showStatus(i18n('optFillAll'), true);
    }

    rawUrl = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const finalInstanceUrl = `https://${rawUrl}`;

    chrome.storage.sync.get(['accounts'], (items) => {
      let accounts = items.accounts || [];
      
      if (editingIndex > -1) {
        accounts[editingIndex] = { name, instanceUrl: finalInstanceUrl, accessToken };
        chrome.storage.sync.set({ accounts }, () => {
          showStatus(i18n('optUpdateSuccess'));
          resetForm();
          loadAccounts();
        });
      } else {
        accounts.push({ name, instanceUrl: finalInstanceUrl, accessToken });
        chrome.storage.sync.set({ accounts }, () => {
          showStatus(i18n('optAddSuccess'));
          resetForm();
          loadAccounts();
        });
      }
    });
  });

  loadAccounts();
});