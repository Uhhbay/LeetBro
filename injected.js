// == injected.js ==
// Runs in-page to grab your current Monaco editor code.

(function() {
  try {
    const model = monaco.editor.getModels()[0];
    const code = model ? model.getValue() : '';
    window.dispatchEvent(new CustomEvent('LeetBro_Code', { detail: code }));
  } catch (e) {
    console.warn('LeetBro injection failed:', e);
    window.dispatchEvent(new CustomEvent('LeetBro_Code', { detail: '' }));
  }
})();
