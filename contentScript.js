// == contentScript.js ==
(async function() {
  // 1) Overlay injection
  const overlay = document.createElement('div');
  overlay.id = 'leetbro-overlay';
  overlay.innerHTML = `
    <div class="header">LeetBro</div>
    <div class="messages"></div>
    <div class="status">Say “hey bro” to start</div>
    <div class="debug"></div>
  `;
  document.body.appendChild(overlay);

  const messagesDiv = overlay.querySelector('.messages');
  const statusDiv   = overlay.querySelector('.status');
  const debugDiv    = overlay.querySelector('.debug');

  // 2) Fetch problem context via GraphQL
  const problemContext = await getProblemContext();

  // 3) Web Speech API setup
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SR();
  recog.continuous    = true;
  recog.interimResults = true;
  recog.lang           = 'en-US';

  let wakeMode = false;
  let interimTranscript = '';

  recog.onresult = async evt => {
    interimTranscript = Array.from(evt.results)
      .map(r => r[0].transcript)
      .join('')
      .toLowerCase();
    debugDiv.textContent = interimTranscript;

    if (!wakeMode && interimTranscript.includes('hey bro')) {
      wakeMode = true;
      statusDiv.textContent = '🎙 Listening for your question...';
      interimTranscript = '';
      return;
    }

    const last = evt.results[evt.results.length - 1];
    if (wakeMode && last.isFinal) {
      const query = interimTranscript.trim();
      interimTranscript = '';
      wakeMode = false;
      statusDiv.textContent = '🤖 Thinking...';
      appendMessage('You', query);

      // inject code-extraction script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      document.documentElement.appendChild(script);
      script.remove();

      const code = await new Promise(res => {
        window.addEventListener('LeetBro_Code', e => res(e.detail), { once: true });
      });

      const answer = await sendToBackground({
        prompt: query,
        context: problemContext,
        code
      });

      appendMessage('Gemini', answer);
      setTimeout(() => speak(answer), 100);
      statusDiv.textContent = 'Say “hey bro” to start';
    }
  };

  recog.onerror = evt => console.warn('SpeechRecognition error:', evt.error);
  recog.onend   = () => setTimeout(() => recog.start(), 500);

  try { recog.start(); } catch (e) { console.warn(e); }

  // helpers
  function appendMessage(who, txt) {
    const el = document.createElement('div');
    el.innerHTML = `<strong>${who}:</strong> ${txt}`;
    messagesDiv.appendChild(el);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  function speak(txt) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(txt));
  }
  function sendToBackground(data) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type:'query', ...data }, resp => resolve(resp.answer));
    });
  }
})();

// fetch problem title + description
async function getProblemContext() {
  const slug = window.location.pathname.split('/')[2];
  const graphQL = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        content
      }
    }
  `;
  const res = await fetch('https://leetcode.com/graphql', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ query:graphQL, variables:{ titleSlug: slug } })
  });
  const { data } = await res.json();
  const { title, content } = data.question;
  const text = content
    .replace(/<[^>]+>/g,'\n')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&amp;/g,'&')
    .trim();
  return `${title}\n\n${text}`;
}
