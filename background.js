// replace with your own key or wire up chrome.storage + popup UI
const OPENAI_API_KEY = '';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'query') {
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              "You are an expert programming coach.",
              "User will propose an approach to a LeetCode problem.",
              "Evaluate *all* possible solution paths.",
              "If their idea is viable, confirm and explain why; if not, provide a small hint toward a better approach.",
              "Do NOT give the full solution."
            ].join(' ')
          },
          { role: 'user', content: msg.prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    })
    .then(r => r.json())
    .then(data => {
      const answer = data.choices[0].message.content.trim();
      sendResponse({ answer });
    })
    .catch(err => sendResponse({ answer: '⚠️ Error: ' + err.message }));
    // keep channel open for async
    return true;
  }
});
