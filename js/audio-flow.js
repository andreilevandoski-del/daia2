/**
 * Fluxo Áudio — microfone real (getUserMedia + MediaRecorder), depois simulação de análise.
 * Em browsers sem gravação: fallback com duração simulada.
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

  function finishFlow(durationSec, inputArea, transcribing, dots, btn, timerEl, errEl) {
    var sim = window.DaiaSimulation;
    if (!sim || typeof sim.simulateAudioAnalysis !== 'function') {
      transcribing.hidden = true;
      inputArea.style.display = 'flex';
      btn.disabled = false;
      showError(errEl, 'Simulação indisponível. Recarregue a página.');
      return;
    }

    sim
      .simulateAudioAnalysis(durationSec)
      .then(function (analysis) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
        } catch (e) {
          transcribing.hidden = true;
          inputArea.style.display = 'flex';
          btn.disabled = false;
          showError(errEl, 'Não foi possível guardar o resultado.');
          return;
        }
        window.sessionStorage.setItem('analyzeFrom', 'audio');
        window.location.href = 'analyze.html';
      })
      .catch(function () {
        transcribing.hidden = true;
        inputArea.style.display = 'flex';
        btn.disabled = false;
        btn.classList.remove('is-recording');
        btn.setAttribute('aria-pressed', 'false');
        if (timerEl) timerEl.hidden = true;
        dots.forEach(function (dot) {
          dot.classList.toggle('is-active', dot.getAttribute('data-audio-dot') === '1');
        });
        showError(errEl, 'Falha ao processar. Tente gravar de novo.');
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
          'Microfone não disponível. Use HTTPS (ex.: site na Vercel) ou um browser recente.',
        );
        return;
      }
      if (!window.MediaRecorder) {
        showError(errEl, 'Gravação de áudio não suportada neste dispositivo.');
        return;
      }

      var mime = pickMimeType();
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
            finishFlow(durationSec, inputArea, transcribing, dots, btn, timerEl, errEl);
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
