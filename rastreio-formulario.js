/* MAPHEL — rastreio das perguntas do formulário de aplicação.
   Só observa: não mexe no envio, na planilha nem no evento Lead.
   Qualquer erro aqui é engolido, para nunca travar o formulário.

   Pixel da Meta (eventos personalizados, não interferem na otimização das campanhas por Lead):
     - FormPergunta     a cada pergunta respondida (pergunta, total, campo, seção)
     - PerfilAplicacao  depois do envio confirmado, com as respostas de perfil
       (sem nome, e-mail, celular, segmento digitado nem faturamento)
   Microsoft Clarity (projeto z4sh1nla98):
     - eventos pergunta_1_segmento ... e aplicacao_enviada
     - marcações (set) com as respostas de perfil, inclusive faturamento, para filtrar gravações */
(function () {
  'use strict';

  // Respostas que nunca saem da página (dados pessoais ou texto livre)
  var NUNCA = { nome: 1, email: 1, celular: 1, 'bot-field': 1, 'form-name': 1 };
  // Só para o Clarity (fica fora da Meta)
  var SO_CLARITY = { faturamento: 1, segmento: 1 };

  function pixel(nome, dados) {
    try { if (typeof window.fbq === 'function') window.fbq('trackCustom', nome, dados); } catch (e) { /* segue */ }
  }
  function clarity() {
    try { if (typeof window.clarity === 'function') window.clarity.apply(null, arguments); } catch (e) { /* segue */ }
  }
  function nomeDoCampo(field) {
    var el = field && field.querySelector('input,select,textarea');
    return el ? String(el.name || '').replace(/\[\]$/, '') : '';
  }
  function curto(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 80); }

  window.maphelRastreio = {
    // chamada quando a pessoa avança: n = número da pergunta respondida (1, 2, 3...)
    pergunta: function (n, total, field) {
      try {
        var campo = nomeDoCampo(field);
        // a introdução não tem campo: marca só o começo do formulário
        if (!campo) { pixel('FormInicio', {}); clarity('event', 'formulario_iniciado'); return; }
        // numera só as perguntas de verdade (sem a introdução)
        var perguntas = Array.prototype.filter.call(document.querySelectorAll('.step .field'), function (f) { return !!f.querySelector('input,select,textarea'); });
        n = perguntas.indexOf(field) + 1 || n; total = perguntas.length || total;
        var secao = field && field.closest('.step') && field.closest('.step').querySelector('h2');
        pixel('FormPergunta', { pergunta: n, total: total, campo: campo, secao: secao ? curto(secao.textContent.replace(/^\d+\.\s*/, '')) : '' });
        clarity('event', 'pergunta_' + n + (campo ? '_' + campo : ''));
      } catch (e) { /* segue */ }
    },
    // chamada só depois que a planilha confirmou o envio
    perfil: function (data) {
      try {
        var meta = {};
        Object.keys(data || {}).forEach(function (k) {
          var chave = k.replace(/\[\]$/, '');
          if (NUNCA[chave]) return;
          var v = Array.isArray(data[k]) ? data[k].map(curto).join(' | ') : curto(data[k]);
          if (!v) return;
          clarity('set', chave, v);
          if (!SO_CLARITY[chave] && !/^utm_/.test(chave)) meta[chave] = v;
        });
        pixel('PerfilAplicacao', meta);
        clarity('event', 'aplicacao_enviada');
      } catch (e) { /* segue */ }
    }
  };
})();
