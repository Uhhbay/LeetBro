// --- inject overlay ---
const overlay = document.createElement('div');
overlay.id = 'leetspeak-overlay';
overlay.innerHTML = `
  <div class="header">LeetSpeak Assistant</div>
  <div class="messages"></div>
  <div class="status">Say “hey gemini” to start</div>
`;
document.body.appendChild(overlay);

const messagesDiv = overlay.querySelector('.messages');
const statusDiv = overlay.querySelector('.status');

// --- Web Speech API setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recog = new SpeechRecognition();
recog.continuous = true;
recog.interimResults = true;
recog.lang = 'en-US';

let wakeMode = false;
let interimTranscript = '';

recog.onresult = async (evt) => {
  // pull together full transcript
  interimTranscript = Array.from(evt.results)
    .map(r => r[0].transcript)
    .join('')
    .toLowerCase();

  if (!wakeMode && interimTranscript.includes('hey gemini')) {
    wakeMode = true;
    statusDiv.textContent = '🎙 Listening for your question...';
    interimTranscript = '';
    return;
  }

  // once user finishes (final result), send
  const last = evt.results[evt.results.length - 1];
  if (wakeMode && last.isFinal) {
    const query = interimTranscript.trim();
    interimTranscript = '';
    wakeMode = false;
    statusDiv.textContent = '🤖 Thinking...';
    appendMessage('You', query);
    const answer = await sendToBackground(query);
    appendMessage('Gemini', answer);
    speak(answer);
    statusDiv.textContent = 'Say “hey gemini” to start';
  }
};

recog.onerror = () => {
  // keep it alive
  recog.stop();
  setTimeout(() => recog.start(), 500);
};
recog.onend = () => recog.start();
recog.start();

// --- helper: append bubble ---
function appendMessage(who, text) {
  const el = document.createElement('div');
  el.innerHTML = `<strong>${who}:</strong> ${text}`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- helper: TTS ---
function speak(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  window.speechSynthesis.speak(u);
}

// --- helper: proxy to background.js ---
function sendToBackground(promptText) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'query', prompt: promptText },
      resp => resolve(resp.answer)
    );
  });
}
