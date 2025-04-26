// == contentScript.js ==

(async function() {
  // 1) Inject the overlay
  const overlay = document.createElement('div');
  overlay.id = 'leetbro-overlay';
  overlay.innerHTML = `
    <div class="header">LeetBro</div>
    <div class="messages"></div>
    <div class="status">Say “Hey Bro” to start</div>
    <div class="debug"></div>
  `;
  document.body.appendChild(overlay);

  const messagesDiv = overlay.querySelector('.messages');
  const statusDiv   = overlay.querySelector('.status');
  const debugDiv    = overlay.querySelector('.debug');

  // 2) Pull the problem statement once
  const problemContext = await getProblemContext();

  // 3) Setup SpeechRecognition
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SR();
  recog.continuous    = true;
  recog.interimResults = true;
  recog.lang           = 'en-US';

  let wakeMode = false;

  recog.onresult = async evt => {
    // For debug: show any interim transcript
    const interim = Array.from(evt.results)
      .filter(r => !r.isFinal)
      .map(r => r[0].transcript)
      .join('');
    debugDiv.textContent = interim;

    // Process only final results
    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const result = evt.results[i];
      if (!result.isFinal) continue;

      const text = result[0].transcript.trim().toLowerCase();

      // 3.a) Wake-word detection
      if (!wakeMode && text.includes('hey bro')) {
        wakeMode = true;
        statusDiv.textContent = '🎙 Listening for your question...';
        return;  // wait for the NEXT final result
      }

      // 3.b) Capture exactly one question after wake
      if (wakeMode) {
        // Stop listening while we fetch
        recog.stop();

        const query = text.replace('Hey Bro', '').trim();
        appendMessage('You', query);
        statusDiv.textContent = '🤖 Thinking...';

        // inject code-extraction script
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        document.documentElement.appendChild(script);
        script.remove();

        // wait for the code payload
        const code = await new Promise(res => {
          window.addEventListener('LeetBro_Code', e => res(e.detail), { once: true });
        });

        // call the background
        const answer = await sendToBackground({ prompt: query, context: problemContext, code });

        appendMessage('LeetBro', answer);
        speak(answer);

        // Reset UI and mode, then restart recog
        wakeMode = false;
        statusDiv.textContent = 'Say “Hey Bro” to start';
        setTimeout(() => recog.start(), 500);
        return;
      }
    }
  };

  recog.onerror = evt => console.warn('SpeechRecognition error:', evt.error);
  recog.onend   = () => {
    // If ever stops without catching a question, restart
    if (!wakeMode) setTimeout(() => recog.start(), 500);
  };

  // Kick off recognition
  try { recog.start(); }
  catch(e) { console.warn('Could not start recog:', e); }

  // ——— Helpers ———

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

// == Fetch LeetCode problem via GraphQL ==
async function getProblemContext() {
  const slug = window.location.pathname.split('/')[2];
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) { title content }
    }
  `;
  const res = await fetch('https://leetcode.com/graphql', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ query, variables:{ titleSlug: slug } })
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
