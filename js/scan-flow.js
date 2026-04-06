/**
 * Fluxo Scan — galeria ou câmera, depois análise.
 * API real: por defeito ativa; ?live=0 ou daia_live_api=0 só simulação.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'daiaMealAnalysis';
  var MAX_BYTES = 12 * 1024 * 1024;

  function fileToSendableDataUrl(file, done) {
    var maxEdge = 1600;
    var jpegQ = 0.82;
    var objectUrl = URL.createObjectURL(file);
    var img = new Image();

    function fallbackReader() {
      var r = new FileReader();
      r.onload = function () {
        done(null, r.result, file.type || 'image/jpeg');
      };
      r.onerror = function () {
        done(new Error('Não foi possível ler o arquivo.'));
      };
      r.readAsDataURL(file);
    }

    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) {
        fallbackReader();
        return;
      }
      var scale = Math.min(1, maxEdge / Math.max(w, h));
      var nw = Math.max(1, Math.round(w * scale));
      var nh = Math.max(1, Math.round(h * scale));
      try {
        var canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          fallbackReader();
          return;
        }
        ctx.drawImage(img, 0, 0, nw, nh);
        var dataUrl = canvas.toDataURL('image/jpeg', jpegQ);
        var b64 = (dataUrl.split(',')[1] || '').replace(/\s/g, '');
        var approx = Math.floor((b64.length * 3) / 4);
        if (approx > 3.2 * 1024 * 1024) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        }
        done(null, dataUrl, 'image/jpeg');
      } catch (e) {
        fallbackReader();
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      fallbackReader();
    };
    img.src = objectUrl;
  }

  function parseFetchBody(res, text) {
    var trimmed = (text || '').trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function useLiveApi() {
    return window.DaiaSimulation && typeof DaiaSimulation.useLiveApi === 'function' && DaiaSimulation.useLiveApi();
  }

  function runAnalysis(selectedFile, errEl, resetUiAfterError) {
    fileToSendableDataUrl(selectedFile, function (readErr, dataUrl, mimeType) {
      if (readErr) {
        resetUiAfterError();
        showError(errEl, readErr.message || 'Não foi possível ler o arquivo.');
        return;
      }

      function saveAndGo(bodyAnalysis) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bodyAnalysis));
        } catch (e) {
          resetUiAfterError();
          showError(errEl, 'Armazenamento cheio — não foi possível salvar o resultado.');
          return;
        }
        window.sessionStorage.setItem('analyzeFrom', 'scan');
        window.location.href = 'analyze.html';
      }

      function runSimPath() {
        var sim = window.DaiaSimulation;
        if (!sim || typeof sim.simulateImageAnalysis !== 'function') {
          resetUiAfterError();
          showError(errEl, 'Simulação indisponível. Recarregue a página.');
          return;
        }
        sim
          .simulateImageAnalysis()
          .then(function (analysis) {
            saveAndGo(analysis);
          })
          .catch(function () {
            resetUiAfterError();
            showError(errEl, 'Falha na análise simulada.');
          });
      }

      function shouldFallbackToSimulation(err) {
        var st = err && err.daiaStatus;
        // 404: rota /api inexistente (ex.: só estático). 504: timeout.
        // NÃO fazer fallback em 502/503: no Render costuma ser chave .env em falta — mostrar erro.
        if (st === 404 || st === 504) {
          return true;
        }
        var msg = String((err && err.message) || '');
        if (msg.indexOf('Failed to fetch') !== -1) return true;
        if (msg.indexOf('NetworkError') !== -1) return true;
        if (msg.indexOf('Load failed') !== -1) return true;
        if (msg.indexOf('Network request failed') !== -1) return true;
        return false;
      }

      if (!useLiveApi()) {
        runSimPath();
        return;
      }

      fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: mimeType || selectedFile.type || 'image/jpeg',
        }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var body = parseFetchBody(res, text);
            if (!res.ok) {
              var errMsg =
                (body && body.error) ||
                (text && text.length < 400 ? text.trim() : '') ||
                res.statusText ||
                'Erro no servidor (' + res.status + ')';
              var httpErr = new Error(errMsg);
              httpErr.daiaStatus = res.status;
              throw httpErr;
            }
            if (!body) {
              var parseErr = new Error('Resposta inválida do servidor (não é JSON).');
              parseErr.daiaStatus = res.status;
              throw parseErr;
            }
            return body;
          });
        })
        .then(function (body) {
          if (!body.analysis) {
            var shapeErr = new Error('Resposta inválida do servidor.');
            shapeErr.daiaStatus = 200;
            throw shapeErr;
          }
          saveAndGo(body.analysis);
        })
        .catch(function (e) {
          if (shouldFallbackToSimulation(e)) {
            try {
              console.warn('[daia] API de análise indisponível — a usar demonstração.');
            } catch (logErr) {
              /* ignore */
            }
            var sim = window.DaiaSimulation;
            if (sim && typeof sim.simulateImageAnalysis === 'function') {
              return sim.simulateImageAnalysis().then(function (analysis) {
                saveAndGo(analysis);
              });
            }
            resetUiAfterError();
            showError(errEl, 'Demonstração indisponível. Recarregue a página.');
            return;
          }
          resetUiAfterError();
          showError(errEl, (e && e.message) || 'Falha na análise.');
        })
        .catch(function () {
          resetUiAfterError();
          showError(errEl, 'Não foi possível concluir a análise. Recarregue e tente de novo.');
        });
    });
  }

  function init() {
    var btn = document.getElementById('btn-scan-analyze');
    var btnCamera = document.getElementById('btn-scan-open-camera');
    var dropzone = document.getElementById('scan-dropzone');
    var analyzing = document.getElementById('scan-analyzing');
    var inputGallery = document.getElementById('scan-file-gallery');
    var inputCamera = document.getElementById('scan-file-camera');
    var dots = document.querySelectorAll('[data-scan-dot]');
    var errEl = document.getElementById('scan-analyze-error');

    if (!btn || !dropzone || !inputGallery || !inputCamera) return;

    var selectedFile = null;

    function setSelectedFromInput(inputEl) {
      var f = inputEl.files && inputEl.files[0];
      selectedFile = f || null;
      if (f && f.size > MAX_BYTES) {
        selectedFile = null;
        inputEl.value = '';
        showError(errEl, 'Imagem demasiado grande. Use até 12 MB.');
        return;
      }
      if (f) {
        showError(errEl, '');
        dropzone.textContent = '';
        var icon = document.createElement('i');
        icon.className = 'ti ti-photo';
        dropzone.appendChild(icon);
        dropzone.appendChild(document.createTextNode(' ' + (f.name || 'Foto')));
      }
    }

    function openGallery() {
      showError(errEl, '');
      inputGallery.click();
    }

    function openCamera() {
      showError(errEl, '');
      inputCamera.click();
    }

    dropzone.addEventListener('click', openGallery);
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGallery();
      }
    });

    if (btnCamera) {
      btnCamera.addEventListener('click', openCamera);
    }

    inputGallery.addEventListener('change', function () {
      setSelectedFromInput(inputGallery);
      inputGallery.value = '';
    });

    inputCamera.addEventListener('change', function () {
      setSelectedFromInput(inputCamera);
      inputCamera.value = '';
    });

    btn.addEventListener('click', function () {
      showError(errEl, '');
      if (!selectedFile) {
        showError(errEl, 'Escolha uma foto na galeria ou tire uma com a câmera.');
        return;
      }

      dropzone.hidden = true;
      if (btnCamera) btnCamera.hidden = true;
      analyzing.hidden = false;
      btn.disabled = true;
      btn.style.opacity = '0.6';

      dots.forEach(function (dot) {
        dot.classList.toggle('is-active', dot.getAttribute('data-scan-dot') === '2');
      });

      function resetUiAfterError() {
        analyzing.hidden = true;
        dropzone.hidden = false;
        if (btnCamera) btnCamera.hidden = false;
        btn.disabled = false;
        btn.style.opacity = '';
        dots.forEach(function (dot) {
          dot.classList.toggle('is-active', dot.getAttribute('data-scan-dot') === '1');
        });
      }

      runAnalysis(selectedFile, errEl, resetUiAfterError);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
