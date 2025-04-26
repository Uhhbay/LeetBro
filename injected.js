// runs in page context, read Monaco editor;

(function() {
    try {
      const model = monaco.editor.getModels()[0];
      const code = model ? model.getValue() : '';
      window.dispatchEvent(new CustomEvent('LeetBro_Code', { detail: code }));
    } catch (e) {
      console.warn('LeetSpeak injection failed:', e);
      window.dispatchEvent(new CustomEvent('LeetBro_Code', { detail: '' }));
    }
  })();
