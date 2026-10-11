/* MAPHEL: captura UTMs da visita e envia junto com a aplicacao. */
(function () {
  'use strict';

  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var storageKey = 'maphel_campaign_utms';
  var params = new URLSearchParams(window.location.search);
  var values = {};

  try {
    var stored = JSON.parse(window.sessionStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      keys.forEach(function (key) {
        if (typeof stored[key] === 'string') values[key] = stored[key];
      });
    }
  } catch (error) {
    // A captura continua funcionando mesmo se o armazenamento estiver bloqueado.
  }

  // Uma nova campanha substitui a anterior, sem misturar UTMs de origens distintas.
  if (keys.some(function (key) { return params.has(key); })) {
    values = {};
    keys.forEach(function (key) { values[key] = params.get(key) || ''; });
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch (error) {
      // A URL atual ainda pode ser usada para preencher os campos.
    }
  }

  function populateForm() {
    var form = document.querySelector('form[name="aplicacao-maphel"]');
    if (!form) return;
    keys.forEach(function (key) {
      var input = form.querySelector('input[type="hidden"][name="' + key + '"]');
      if (input) input.value = values[key] || '';
    });
  }

  // Preserva as UTMs nos CTAs internos mesmo quando o visitante navega por links.
  document.querySelectorAll('a[href]').forEach(function (anchor) {
    var url;
    try { url = new URL(anchor.href, window.location.href); } catch (error) { return; }
    if (url.origin !== window.location.origin || !/^\/formulario\/?(?:index\.html)?$/.test(url.pathname)) return;
    keys.forEach(function (key) {
      if (values[key] && !url.searchParams.has(key)) url.searchParams.set(key, values[key]);
    });
    anchor.href = url.pathname + url.search + url.hash;
  });

  populateForm();
  var form = document.querySelector('form[name="aplicacao-maphel"]');
  if (form) form.addEventListener('submit', populateForm);
})();
