/**
 * Fluxo da página analyze.html — Confirmar refeição + glicose
 * Suporta contexto de scan (?from=scan, padrão) e áudio (?from=audio).
 * Resultado da IA (scan): sessionStorage daiaMealAnalysis
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'daiaMealAnalysis';

  function renderMealFromAnalysis(analysis) {
    var confEl = document.getElementById('analyze-confidence');
    var listEl = document.getElementById('analyze-flow-list');
    var totalEl = document.getElementById('analyze-total-carbs');
    var notesEl = document.getElementById('analyze-notes');
    if (!confEl || !listEl || !totalEl) return;

    var conf = typeof analysis.confidence_percent === 'number' ? analysis.confidence_percent : 0;
    confEl.innerHTML =
      '<i class="ti ti-brain icon-tabler-sm" aria-hidden="true"></i> Confiança ' + conf + '%';

    listEl.innerHTML = '';
    var items = analysis.items || [];
    if (items.length === 0) {
      var liEmpty = document.createElement('li');
      var spanEmpty = document.createElement('span');
      spanEmpty.className = 'muted';
      spanEmpty.textContent = 'Nenhum alimento identificado';
      liEmpty.appendChild(spanEmpty);
      listEl.appendChild(liEmpty);
    } else {
      items.forEach(function (it) {
        var li = document.createElement('li');
        var strong = document.createElement('strong');
        strong.textContent = it.name || 'Item';
        var span = document.createElement('span');
        span.className = 'muted';
        var g = typeof it.carbs_g === 'number' ? it.carbs_g : 0;
        span.textContent = (g % 1 === 0 ? String(g) : g.toFixed(1)) + ' g carb';
        li.appendChild(strong);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(span);
        listEl.appendChild(li);
      });
    }

    var total =
      typeof analysis.total_carbs_g === 'number'
        ? analysis.total_carbs_g
        : items.reduce(function (s, it) {
            return s + (Number(it.carbs_g) || 0);
          }, 0);
    total = Math.round(total * 10) / 10;
    var totalStr = total % 1 === 0 ? String(total) : total.toFixed(1);
    totalEl.textContent = 'Total: ' + totalStr + ' g carb';

    if (notesEl) {
      var n = analysis.notes_pt && String(analysis.notes_pt).trim();
      if (n) {
        notesEl.textContent = n;
        notesEl.style.display = 'block';
      } else {
        notesEl.textContent = '';
        notesEl.style.display = 'none';
      }
    }
  }

  function init() {
    var fromAudio = window.sessionStorage.getItem('analyzeFrom') === 'audio';
    try {
      window.sessionStorage.removeItem('analyzeFrom');
    } catch (e) {
      /* ignore */
    }

    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        var analysis = JSON.parse(raw);
        if (analysis && Array.isArray(analysis.items)) {
          renderMealFromAnalysis(analysis);
        }
      }
    } catch (e) {
      /* manter conteúdo estático da página */
    }

    // Botão "Reenviar" — contextual por origem
    var rescanBtn = document.getElementById('btn-rescan-photo');
    if (rescanBtn) {
      if (fromAudio) {
        rescanBtn.innerHTML =
          '<i class="ti ti-microphone icon-tabler-btn" aria-hidden="true"></i> Reenviar áudio';
        rescanBtn.addEventListener('click', function () {
          window.location.href = 'audio.html';
        });
      } else {
        rescanBtn.addEventListener('click', function () {
          window.location.href = 'scan.html';
        });
      }
    }

    // Botão voltar no topbar — contextual por origem
    var back = document.getElementById('topbar-back');
    if (back) {
      back.href = fromAudio ? 'audio.html' : 'scan.html';
      back.setAttribute('aria-label', fromAudio ? 'Voltar ao áudio' : 'Voltar ao scan');
    }

    // Validação de glicose + navegação para resultado
    if (window.DaiaMealGlucose && window.DaiaMealGlucose.bind) {
      window.DaiaMealGlucose.bind({
        inputId: 'analyze-input-glucose',
        skipId:  'analyze-glucose-skip',
        warningId: 'analyze-glucose-warning',
        btnId:   'btn-analyze-calc-dose',
        errorId: 'analyze-glucose-error',
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
