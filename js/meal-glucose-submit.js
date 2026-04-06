/**
 * Validação de glicose + navegação para resultado (telas de confirmação de refeição)
 */
(function (global) {
  'use strict';

  function bind(opts) {
    var input = document.getElementById(opts.inputId);
    var skipEl = document.getElementById(opts.skipId);
    var warning = document.getElementById(opts.warningId);
    var btn = document.getElementById(opts.btnId);
    var err = document.getElementById(opts.errorId);

    function readSkip() {
      return skipEl && skipEl.checked;
    }

    if (skipEl && warning) {
      skipEl.addEventListener('change', function () {
        warning.hidden = !readSkip();
      });
    }

    if (btn) {
      btn.addEventListener('click', function () {
        var skipped = readSkip();
        var val = input ? parseFloat(String(input.value).replace(',', '.'), 10) : NaN;
        if (!skipped && (isNaN(val) || val < 20 || val > 600)) {
          if (input) {
            input.classList.add('input-field--error');
            input.setAttribute('aria-invalid', 'true');
          }
          if (err) err.style.display = 'block';
          return;
        }
        if (input) {
          input.classList.remove('input-field--error');
          input.removeAttribute('aria-invalid');
        }
        if (err) err.style.display = 'none';
        window.location.href = opts.resultUrl || 'result.html';
      });
    }
  }

  global.DaiaMealGlucose = { bind: bind };
})(window);
