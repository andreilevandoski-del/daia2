/**
 * Glicose isolada (entrada manual → resultado) — glucose.html
 */
(function () {
  'use strict';

  function init() {
    if (window.DaiaMealGlucose && window.DaiaMealGlucose.bind) {
      window.DaiaMealGlucose.bind({
        inputId: 'input-glucose',
        skipId: 'glucose-skip',
        warningId: 'glucose-warning',
        btnId: 'btn-calc-dose',
        errorId: 'glucose-field-error',
        resultUrl: 'result.html',
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
