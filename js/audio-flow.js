/**
 * Fluxo Áudio — microfone (getUserMedia + MediaRecorder).
 * Com API: POST /api/analyze-meal-audio (Gemini). Sem API: simulação (DaiaSimulation).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'daiaMealAnalysis';
  var MIN_RECORD_MS = 600;

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function formatMs(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function pickMimeType() {
    var types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    for (var i = 0; i < types.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) {
        return types[i];
      }
    }
    return '';
  }

  function useLiveApi() {
    return (
      window.DaiaSimulation &&
      typeof DaiaSimulation.useLiveApi === 'function' &&
      DaiaSimulation.useLiveApi()
    );
  }

  function parseFetchBody(res, text) {
    var trimmed = (text || '').trim();
    if (!trimmed) return null;
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function shouldFallbackToSimulation(err) {
    var st = err && err.daiaStatus;
    if (st === 404 || st === 504) return true;
    var msg = String((err && err.message) || '');
    if (msg.indexOf('Failed to fetch') !== -1) return true;
    if (msg.indexOf('NetworkError') !== -1) return true;
    if (msg.indexOf('Load failed') !== -1) return true;
    if (msg.indexOf('Network request failed') !== -1) return true;
    return false;
  }

  function resetAfterRecord(inputArea, transcribing, dots, btn, timerEl) {
    transcribing.hidden = true;
    inputArea.style.display = 'flex';
    btn.disabled = false;
    btn.classList.remove('is-recording');
    btn.setAttribute('aria-pressed', 'false');
    if (timerEl) timerEl.hidden = true;
    dots.forEach(function (dot) {
      dot.classList.toggle('is-active', dot.getAttribute('data-audio-dot') === '1');
    });
  }

  function finishFlowSimulation(durationSec, inputArea, transcribing, dots, btn, timerEl, errEl) {
    var sim = window.DaiaSimulation;
    if (!sim || typeof sim.simulateAudioAnalysis !== 'function') {
      resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
      showError(errEl, 'Simulação indisponível. Recarregue a página.');
      return;
    }

    sim
      .simulateAudioAnalysis(durationSec)
      .then(function (analysis) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
        } catch (e) {
          resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
          showError(errEl, 'Não foi possível guardar o resultado.');
          return;
        }
        window.sessionStorage.setItem('analyzeFrom', 'audio');
        window.location.href = 'analyze.html';
      })
      .catch(function () {
        resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
        showError(errEl, 'Falha ao processar. Tente gravar de novo.');
      });
  }

  function blobToDataUrl(blob, done) {
    var r = new FileReader();
    r.onload = function () {
      done(null, r.result, blob.type || '');
    };
    r.onerror = function () {
      done(new Error('Não foi possível ler a gravação.'));
    };
    r.readAsDataURL(blob);
  }

  function finishFlowLive(blob, mimeHint, durationSec, inputArea, transcribing, dots, btn, timerEl, errEl) {
    blobToDataUrl(blob, function (readErr, dataUrl, blobType) {
      if (readErr) {
        resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
        showError(errEl, readErr.message || 'Erro ao ler o áudio.');
        return;
      }

      var mime = mimeHint || blobType || 'audio/webm';

      fetch('/api/analyze-meal-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: dataUrl,
          mimeType: mime,
        }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var body = parseFetchBody(res, text);
            if (!res.ok) {
              var errMsg =
                (body && body.error) ||
                (text && text.length < 500 ? text.trim() : '') ||
                res.statusText ||
                'Erro no servidor (' + res.status + ')';
              var httpErr = new Error(errMsg);
              httpErr.daiaStatus = res.status;
              throw httpErr;
            }
            if (!body || !body.analysis) {
              var shapeErr = new Error('Resposta inválida do servidor.');
              shapeErr.daiaStatus = res.status;
              throw shapeErr;
            }
            return body.analysis;
          });
        })
        .then(function (analysis) {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
          } catch (e) {
            resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
            showError(errEl, 'Não foi possível guardar o resultado.');
            return;
          }
          window.sessionStorage.setItem('analyzeFrom', 'audio');
          window.location.href = 'analyze.html';
        })
        .catch(function (e) {
          if (shouldFallbackToSimulation(e)) {
            try {
              console.warn('[daia] API de áudio indisponível — a usar demonstração.');
            } catch (logErr) {
              /* ignore */
            }
            finishFlowSimulation(durationSec, inputArea, transcribing, dots, btn, timerEl, errEl);
            return;
          }
          resetAfterRecord(inputArea, transcribing, dots, btn, timerEl);
          showError(errEl, (e && e.message) || 'Falha na análise do áudio.');
        });
    });
  }

  function init() {
    var btn = document.getElementById('btn-audio-record');
    var inputArea = document.getElementById('audio-input-area');
    var transcribing = document.getElementById('audio-transcribing');
    var dots = document.querySelectorAll('[data-audio-dot]');
    var errEl = document.getElementById('audio-error');
    var timerEl = document.getElementById('audio-timer');
    var hintEl = document.getElementById('audio-hint');

    if (!btn || !inputArea || !transcribing) return;

    var mediaStream = null;
    var recorder = null;
    var chunks = [];
    var recordStart = 0;
    var tickId = null;
    var chosenMime = '';

    function stopTick() {
      if (tickId) {
        clearInterval(tickId);
        tickId = null;
      }
    }

    function cleanupStream() {
      stopTick();
      if (mediaStream) {
        mediaStream.getTracks().forEach(function (t) {
          t.stop();
        });
        mediaStream = null;
      }
      recorder = null;
      chunks = [];
    }

    function startRecording() {
      showError(errEl, '');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError(
          errEl,
          'Microfone não disponível. Use HTTPS (ex.: site no Render) ou um browser recente.',
        );
        return;
      }
      if (!window.MediaRecorder) {
        showError(errEl, 'Gravação de áudio não suportada neste dispositivo.');
        return;
      }

      var mime = pickMimeType();
      chosenMime = mime;
      btn.disabled = true;
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          mediaStream = stream;
          chunks = [];
          try {
            recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          } catch (e) {
            recorder = new MediaRecorder(stream);
          }

          recorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorder.onstop = function () {
            var elapsed = Math.max(0, Date.now() - recordStart) / 1000;
            var mimeForBlob =
              (recorder && recorder.mimeType) || chosenMime || 'audio/webm';
            var snapshotChunks = chunks.slice();
            cleanupStream();
            btn.classList.remove('is-recording');
            btn.setAttribute('aria-pressed', 'false');
            if (timerEl) timerEl.hidden = true;
            if (hintEl) {
              hintEl.textContent =
                'Toque no microfone para gravar (requer HTTPS no site publicado).';
            }

            inputArea.style.display = 'none';
            transcribing.hidden = false;
            dots.forEach(function (dot) {
              dot.classList.toggle('is-active', dot.getAttribute('data-audio-dot') === '2');
            });

            if (elapsed * 1000 < MIN_RECORD_MS) {
              transcribing.hidden = true;
              inputArea.style.display = 'flex';
              dots.forEach(function (dot) {
                dot.classList.toggle('is-active', dot.getAttribute('data-audio-dot') === '1');
              });
              showError(errEl, 'Gravação demasiado curta. Grave pelo menos cerca de 1 segundo.');
              btn.disabled = false;
              return;
            }

            var durationSec = Math.max(elapsed, MIN_RECORD_MS / 1000);
            var blob = new Blob(snapshotChunks, { type: mimeForBlob });
            var outMime = blob.type || mimeForBlob;

            if (useLiveApi()) {
              finishFlowLive(blob, outMime, durationSec, inputArea, transcribing, dots, btn, timerEl, errEl);
            } else {
              finishFlowSimulation(durationSec, inputArea, transcribing, dots, btn, timerEl, errEl);
            }
          };

          recordStart = Date.now();
          recorder.start(200);
          btn.disabled = false;
          btn.classList.add('is-recording');
          btn.setAttribute('aria-pressed', 'true');
          if (hintEl) hintEl.textContent = 'A gravar… toque de novo para parar.';
          if (timerEl) {
            timerEl.hidden = false;
            timerEl.textContent = '0:00';
            tickId = setInterval(function () {
              timerEl.textContent = formatMs(Date.now() - recordStart);
            }, 500);
          }
        })
        .catch(function (err) {
          btn.disabled = false;
          var name = err && err.name;
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            showError(errEl, 'Permissão do microfone negada. Ative nas definições do browser.');
          } else if (name === 'NotFoundError') {
            showError(errEl, 'Nenhum microfone encontrado.');
          } else {
            showError(errEl, 'Não foi possível aceder ao microfone.');
          }
        });
    }

    function stopRecording() {
      if (recorder && recorder.state === 'recording') {
        btn.disabled = true;
        recorder.stop();
      } else {
        cleanupStream();
        btn.classList.remove('is-recording');
        btn.setAttribute('aria-pressed', 'false');
        if (timerEl) timerEl.hidden = true;
      }
    }

    btn.addEventListener('click', function () {
      if (recorder && recorder.state === 'recording') {
        stopRecording();
        return;
      }
      startRecording();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
