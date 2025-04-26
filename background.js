// == background.js ==
// Paste your Gemini API key here
const GEMINI_API_KEY = '';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'query') return;

  const { prompt, context, code } = msg;

  fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `
You are an expert LeetCode tutor.
You will receive a problem description, current code, and a question.
User will ask about strategies or code snippets.
NEVER give the full solution—only hints, explanations, or guiding questions.
`},
            { text: "Problem description:\n\n" + context },
            { text: "Current code:\n\n" + code },
            { text: "User's question:\n\n" + prompt }
          ]
        }]
      })
    }
  )
    .then(r => r.json())
    .then(data => {
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ||
                     '⚠️ Error: no response';
      sendResponse({ answer });
    })
    .catch(err => sendResponse({ answer: '⚠️ Error: ' + err.message }));

  return true; // keep channel open
});
