// The assistant.
//
// The API contract is the original's, unchanged: POST /chat with the x-api-key
// header, the session id returned by the server persisted in localStorage so a
// conversation survives a reload. The storage keys are namespaced to v2 so the
// two versions can be compared side by side without sharing a conversation.
const Chat = (() => {
  const SESSION_KEY = 'vicolo_v2_session_id';
  const PENDING_KEY = 'vicolo_v2_pending_order';

  // A hung request otherwise spins until the network stack finally gives up,
  // which is a minute or more with nothing on screen but the typing dots. The
  // backend's own worst measured exchange is a few seconds, so 30s is far past
  // "slow" and safely into "not coming back".
  const REQUEST_TIMEOUT_MS = 30000;

  let sessionId = localStorage.getItem(SESSION_KEY);
  let loading = false;
  let isOpen = false;
  let typingEl = null;

  const el = {};

  function cache() {
    el.panel = document.getElementById('assistant');
    el.dock = document.getElementById('dock');
    el.log = document.getElementById('assistant-log');
    el.intro = document.getElementById('assistant-intro');
    el.staged = document.getElementById('assistant-staged');
    el.prompts = document.getElementById('prompt-list');
    el.input = document.getElementById('assistant-input');
    el.send = document.getElementById('assistant-send');
    el.close = document.getElementById('assistant-close');
    el.clear = document.getElementById('assistant-clear');
  }

  function scrollToEnd() {
    el.log.scrollTop = el.log.scrollHeight;
  }

  /**
   * The model answers in Markdown, so a reply that reads "**Total:** $12.99"
   * arrived on screen with the asterisks still in it. This renders just the
   * emphasis — nothing else — by building text nodes and <strong> elements.
   *
   * The model's output is never assigned as HTML: every fragment goes in as a
   * text node, so a reply containing markup cannot become markup.
   */
  function renderRich(target, text) {
    const pattern = /\*\*([^*]+)\*\*|__([^_]+)__/g;
    let cursor = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) {
        target.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }
      const strong = document.createElement('strong');
      strong.textContent = match[1] ?? match[2];
      target.appendChild(strong);
      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      target.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  function addMessage(role, text) {
    if (el.intro && !el.intro.hidden) el.intro.hidden = true;

    const row = document.createElement('div');
    row.className = `msg ${role === 'user' ? 'msg-user' : 'msg-bot'}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    // The visitor's own text is never interpreted; only the assistant's is.
    if (role === 'user') bubble.textContent = text;
    else renderRich(bubble, text);

    row.appendChild(bubble);
    el.log.appendChild(row);
    el.clear.hidden = false;
    scrollToEnd();
  }

  function setLoading(state) {
    loading = state;
    el.send.disabled = state || !el.input.value.trim();
    el.input.disabled = state;

    if (state) {
      typingEl = document.createElement('div');
      typingEl.className = 'msg msg-bot';
      typingEl.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
      typingEl.setAttribute('aria-label', 'The kitchen is typing');
      el.log.appendChild(typingEl);
      scrollToEnd();
    } else if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  /**
   * A failed exchange keeps the visitor's message on screen and offers to send
   * it again, rather than leaving a dead end.
   *
   * The retry re-sends the same text with `echo: false`, so the user bubble is
   * not drawn a second time. The backend only commits a turn to history once
   * the exchange succeeds, so re-sending cannot duplicate it there either.
   */
  function showError(message, retryText) {
    const wrap = document.createElement('div');
    wrap.className = 'notice notice-error assistant-error';
    wrap.setAttribute('role', 'alert');
    wrap.innerHTML = `
      <span class="assistant-error-row">
        <svg class="ico ico-sm" aria-hidden="true"><use href="#i-alert"/></svg>
        <span class="assistant-error-text"></span>
      </span>`;
    wrap.querySelector('.assistant-error-text').textContent = message;

    if (retryText) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'assistant-retry';
      retry.innerHTML = `<svg class="ico ico-sm" aria-hidden="true"><use href="#i-arrow"/></svg>Try again`;
      retry.addEventListener('click', () => {
        if (loading) return;
        wrap.remove(); // one notice at a time, never a stack of failures
        sendMessage(retryText, { echo: false });
      });
      wrap.appendChild(retry);
    }

    el.log.appendChild(wrap);
    scrollToEnd();
  }

  /**
   * @param {string} text
   * @param {object} [options]
   * @param {boolean} [options.echo] draw the user bubble (false when retrying)
   */
  async function sendMessage(text, options = {}) {
    if (!text.trim() || loading) return;
    if (el.intro && !el.intro.hidden) el.intro.hidden = true;
    resetIntro();

    if (options.echo !== false) addMessage('user', text);
    setLoading(true);

    // Aborting is what actually frees the UI: without it the request is still
    // in flight and a late reply would arrive after we had already given up.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      await CONFIG.ready;
      const res = await fetch(`${CONFIG.API_BASE}/chat?include_history=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CONFIG.API_KEY,
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.detail || 'We could not reach the kitchen right now. Please try again in a moment.',
        );
      }

      sessionId = data.session_id;
      localStorage.setItem(SESSION_KEY, sessionId);
      setLoading(false);
      addMessage('assistant', data.message);
      Motion.announce('The kitchen replied.');
    } catch (e) {
      setLoading(false);
      let message;
      if (timedOut) {
        // Deliberately distinct from a dead backend: the kitchen answered the
        // door, it is just taking too long, so trying again is worth doing.
        message = 'The kitchen is taking longer than usual to answer. Please try again.';
      } else if (String(e.message).includes('Failed to fetch')) {
        message = 'We could not reach the kitchen. Is the backend running?';
      } else {
        message = e.message;
      }
      // The visitor's message stays on screen and the notice carries the text
      // forward, so trying again costs one click and never retypes anything.
      showError(message, text);
    } finally {
      clearTimeout(timer);
      el.input.focus();
    }
  }

  function resetIntro() {
    el.staged.hidden = true;
    el.prompts.hidden = false;
  }

  function clearConversation() {
    resetIntro();
    [...el.log.children].forEach((child) => {
      if (child !== el.intro) child.remove();
    });
    el.intro.hidden = false;
    el.clear.hidden = true;
    sessionId = null;
    localStorage.removeItem(SESSION_KEY);
    Motion.announce('Conversation cleared.');
    el.input.focus();
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.handoff] play the longer cart-to-assistant entrance
   */
  function open(options = {}) {
    if (isOpen) {
      el.input.focus();
      return;
    }
    isOpen = true;

    el.panel.classList.toggle('is-handoff', !!options.handoff);
    el.dock.classList.add('is-hidden');
    el.dock.setAttribute('aria-expanded', 'true');

    Overlay.open({
      id: 'assistant',
      layer: el.panel,
      panel: el.panel,
      modal: false, // the page stays usable behind it; this is staff, not a gate
      initialFocus: '#assistant-input',
      onClose: () => {
        isOpen = false;
        el.panel.classList.remove('is-handoff');
        el.dock.classList.remove('is-hidden');
        el.dock.setAttribute('aria-expanded', 'false');
      },
    });

    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_KEY);
      el.input.value = pending;
      el.send.disabled = false;
      // Arriving from the cart, the opening prompts are the wrong offer — the
      // visitor already knows what they want.
      if (el.intro && !el.intro.hidden) {
        el.staged.hidden = false;
        el.prompts.hidden = true;
      }
    }
  }

  function close(options) {
    if (!isOpen) return;
    Overlay.close('assistant', options);
  }

  function toggle() {
    isOpen ? close() : open();
  }

  // Called by the cart when the order is handed over.
  function stageOrder(text) {
    sessionStorage.setItem(PENDING_KEY, text);
  }

  function handleSend() {
    const text = el.input.value.trim();
    if (!text) return;
    el.input.value = '';
    el.send.disabled = true;
    sendMessage(text);
  }

  function init() {
    cache();

    el.dock.addEventListener('click', toggle);
    el.close.addEventListener('click', () => close());
    el.clear.addEventListener('click', clearConversation);
    el.send.addEventListener('click', handleSend);

    el.input.addEventListener('input', () => {
      el.send.disabled = loading || !el.input.value.trim();
    });
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    document.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
    });

    // The dock is redundant while the footer is on screen — the same contact
    // details are right there — and hiding it keeps it off the footer's text.
    const footer = document.getElementById('contact');
    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          if (isOpen) return;
          el.dock.classList.toggle('is-hidden', entry.isIntersecting);
        },
        { threshold: 0.12 },
      ).observe(footer);
    }
  }

  // _renderRich is exposed so the emphasis parser can be exercised directly.
  return { init, open, close, stageOrder, isOpen: () => isOpen, _renderRich: renderRich };
})();
