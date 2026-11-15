// Copy the locally generated warning analysis prompt. No AI provider is called.
(function () {
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy-warning-prompt]');
    if (!button) return;
    var panel = button.closest('.prompt-panel');
    var prompt = panel && panel.querySelector('[data-warning-prompt]');
    var status = panel && panel.querySelector('[data-prompt-status]');
    if (!prompt) return;
    var text = prompt.textContent || '';
    function copied() {
      button.textContent = 'Copied';
      if (status) status.textContent = 'Prompt copied. Paste it into your preferred AI assistant.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(copied).catch(function () {
        if (status) status.textContent = 'Copy was blocked by the browser. Select and copy the prompt from the preview.';
      });
    } else {
      if (status) status.textContent = 'Clipboard access is unavailable. Open the preview and copy the prompt manually.';
    }
  });
})();
