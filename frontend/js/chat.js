const Chat = (() => {
  const SESSION_KEY = 'vicolo_session_id';
  let sessionId = localStorage.getItem(SESSION_KEY);
  let loading = false;

  const panel = document.getElementById('chat-panel');
  const trigger = document.getElementById('chat-trigger');
  const iconOpen = trigger.querySelector('.chat-icon-open');
  const iconClose = trigger.querySelector('.chat-icon-close');
  const messagesEl = document.getElementById('chat-messages');
  const welcomeEl = document.getElementById('chat-welcome');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const closeBtn = document.getElementById('chat-close-btn');
  const clearBtn = document.getElementById('chat-clear-btn');

  let isOpen = false;

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessageEl(role, text) {
    if (welcomeEl && !welcomeEl.hidden) welcomeEl.hidden = true;
    const bubble = document.createElement('div');
    bubble.className = `chat-row ${role === 'user' ? 'chat-row-user' : 'chat-row-bot'}`;
    const inner = document.createElement('div');
    inner.className = `chat-bubble ${role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}`;
    inner.textContent = text;
    bubble.appendChild(inner);
    messagesEl.appendChild(bubble);
    clearBtn.hidden = false;
    scrollToBottom();
  }

  let typingEl = null;
  function setLoading(state) {
    loading = state;
    sendBtn.disabled = state || !input.value.trim();
    if (state) {
      typingEl = document.createElement('div');
      typingEl.className = 'chat-row chat-row-bot';
      typingEl.innerHTML = '<div class="chat-bubble chat-bubble-bot chat-typing"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(typingEl);
      scrollToBottom();
    } else if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function showError(message) {
    const el = document.createElement('div');
    el.className = 'chat-error-wrap';
    el.innerHTML = `<p class="chat-error">${message}</p>`;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    addMessageEl('user', text);
    setLoading(true);

    try {
      await CONFIG.ready;
      const res = await fetch(`${CONFIG.API_BASE}/chat?include_history=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CONFIG.API_KEY,
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

      sessionId = data.session_id;
      localStorage.setItem(SESSION_KEY, sessionId);
      setLoading(false);
      addMessageEl('assistant', data.message);
    } catch (e) {
      setLoading(false);
      const message = e.message.includes('Failed to fetch')
        ? 'Could not reach the assistant. Is the backend running?'
        : e.message;
      showError(message);
    }
  }

  function clearConversation() {
    messagesEl.innerHTML = '';
    messagesEl.appendChild(welcomeEl);
    welcomeEl.hidden = false;
    clearBtn.hidden = true;
    sessionId = null;
    localStorage.removeItem(SESSION_KEY);
  }

  function open() {
    isOpen = true;
    panel.hidden = false;
    iconOpen.hidden = true;
    iconClose.hidden = false;
    input.focus();

    const pending = sessionStorage.getItem('pending_order');
    if (pending) {
      sessionStorage.removeItem('pending_order');
      input.value = pending;
      sendBtn.disabled = false;
    }
  }

  function close() {
    isOpen = false;
    panel.hidden = true;
    iconOpen.hidden = false;
    iconClose.hidden = true;
  }

  function toggle() {
    isOpen ? close() : open();
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    sendMessage(text);
  }

  function init() {
    trigger.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);
    clearBtn.addEventListener('click', clearConversation);
    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('input', () => {
      sendBtn.disabled = loading || !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    document.querySelectorAll('.suggestion-btn').forEach((btn) => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.suggestion));
    });
  }

  return { init, open, close };
})();
