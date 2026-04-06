/**
 * Simulação de análise nutricional (sem API real).
 * API real: ?live=1 na URL (qualquer host) ou localStorage daia_live_api = 1
 * apenas em localhost — assim a Vercel não herda o modo live por engano.
 */
(function (global) {
  'use strict';

  var PRESETS_IMAGE = [
    {
      items: [
        { name: 'Arroz branco', carbs_g: 52 },
        { name: 'Feijão preto', carbs_g: 20 },
        { name: 'Farofa', carbs_g: 18 },
      ],
      notes_pt: 'Prato feijoada simplificado; porções médias estimadas.',
    },
    {
      items: [
        { name: 'Macarrão ao molho', carbs_g: 48 },
        { name: 'Salada mista', carbs_g: 6 },
      ],
      notes_pt: 'Massa como base principal do prato.',
    },
    {
      items: [
        { name: 'Pão francês (2 un.)', carbs_g: 28 },
        { name: 'Manteiga / requeijão', carbs_g: 2 },
        { name: 'Suco de laranja (copo)', carbs_g: 24 },
      ],
      notes_pt: 'Café da manhã; líquido conta como carboidrato.',
    },
    {
      items: [
        { name: 'Batata frita (porção)', carbs_g: 42 },
        { name: 'Hambúrguer com pão', carbs_g: 36 },
      ],
      notes_pt: 'Refeição rápida; fritura aumenta densidade energética.',
    },
    {
      items: [
        { name: 'Iogurte com fruta', carbs_g: 22 },
        { name: 'Granola', carbs_g: 30 },
      ],
      notes_pt: 'Lanche; açúcares naturais e adicionados possíveis.',
    },
    {
      items: [
        { name: 'Tapioca recheada', carbs_g: 26 },
        { name: 'Queijo coalho', carbs_g: 3 },
      ],
      notes_pt: 'Nordeste típico; recheio pode alterar carboidratos.',
    },
  ];

  var PRESETS_AUDIO = [
    {
      items: [
        { name: 'Strogonoff de frango', carbs_g: 18 },
        { name: 'Arroz branco (2 colheres servir)', carbs_g: 38 },
        { name: 'Batata palha', carbs_g: 14 },
      ],
      notes_pt: 'Interpretado a partir da descrição falada; revise as quantidades.',
    },
    {
      items: [
        { name: 'Sanduíche natural', carbs_g: 32 },
        { name: 'Suco verde (300 ml)', carbs_g: 12 },
      ],
      notes_pt: 'Pão integral estimado; frutas no suco somam carboidratos.',
    },
    {
      items: [
        { name: 'Açaí (500 ml) + granola', carbs_g: 68 },
        { name: 'Banana fatiada', carbs_g: 14 },
      ],
      notes_pt: 'Sobremesa calórica; confiança menor sem peso exato.',
    },
    {
      items: [
        { name: 'Lasanha de bolonhesa', carbs_g: 44 },
        { name: 'Salada de folhas', carbs_g: 4 },
      ],
      notes_pt: 'Porção única descrita em voz.',
    },
  ];

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clonePreset(p) {
    var items = (p.items || []).map(function (it) {
      return {
        name: String(it.name),
        carbs_g: Math.max(0, Math.round((Number(it.carbs_g) + (Math.random() * 6 - 3)) * 10) / 10),
      };
    });
    var total = items.reduce(function (s, it) {
      return s + it.carbs_g;
    }, 0);
    total = Math.round(total * 10) / 10;
    var conf = randomInt(72, 94);
    return {
      items: items,
      total_carbs_g: total,
      confidence_percent: conf,
      notes_pt: p.notes_pt || '',
    };
  }

  function mockMealFromImage() {
    var p = PRESETS_IMAGE[randomInt(0, PRESETS_IMAGE.length - 1)];
    return clonePreset(p);
  }

  function mockMealFromAudio(durationSec) {
    var p = PRESETS_AUDIO[randomInt(0, PRESETS_AUDIO.length - 1)];
    var a = clonePreset(p);
    var d = typeof durationSec === 'number' && durationSec > 0 ? durationSec : 3;
    if (d < 2) {
      a.confidence_percent = Math.min(a.confidence_percent, randomInt(58, 72));
      a.notes_pt =
        (a.notes_pt ? a.notes_pt + ' ' : '') +
        'Gravação curta — confirme os itens na lista.';
    }
    return a;
  }

  function isLocalDevHost() {
    try {
      var h = String(global.location.hostname || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    } catch (e) {
      return false;
    }
  }

  function useLiveApi() {
    try {
      if (/\blive=0\b/.test(global.location.search || '')) {
        return false;
      }
      if (/\blive=1\b/.test(global.location.search || '')) {
        return true;
      }
      if (isLocalDevHost()) {
        if (global.localStorage && global.localStorage.getItem('daia_live_api') === '0') {
          return false;
        }
        return true;
      }
      if (global.localStorage && global.localStorage.getItem('daia_live_api') === '1') {
        return true;
      }
    } catch (e) {
      /* private mode */
    }
    return false;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  function simulateImageAnalysis() {
    var ms = randomInt(1500, 3200);
    return delay(ms).then(function () {
      return mockMealFromImage();
    });
  }

  function simulateAudioAnalysis(durationSec) {
    var base = 900 + Math.min(8, durationSec || 1) * 350;
    var ms = randomInt(base, base + 1800);
    return delay(ms).then(function () {
      return mockMealFromAudio(durationSec);
    });
  }

  global.DaiaSimulation = {
    useLiveApi: useLiveApi,
    isLocalDevHost: isLocalDevHost,
    mockMealFromImage: mockMealFromImage,
    mockMealFromAudio: mockMealFromAudio,
    simulateImageAnalysis: simulateImageAnalysis,
    simulateAudioAnalysis: simulateAudioAnalysis,
  };
})(typeof window !== 'undefined' ? window : this);
