(function () {
  'use strict';
  function init() {
    var profSave = document.getElementById('btn-profile-save');
    if (profSave) {
      profSave.addEventListener('click', function () {
        var btn = profSave;
        var orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Salvo';
        window.setTimeout(function () {
          btn.disabled = false;
          btn.textContent = orig;
        }, 1600);
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
