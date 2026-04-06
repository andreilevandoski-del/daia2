/**
 * Marca a aba inferior conforme data-nav no <body>
 * Aviso se a app foi aberta em file:// (links e API falham em muitos cenários)
 */
(function () {
  'use strict';

  if (window.location.protocol === 'file:') {
    var app = document.querySelector('.app');
    var topbar = document.querySelector('.app > .topbar');
    if (app && topbar) {
      var bar = document.createElement('div');
      bar.className = 'daia-file-protocol-warning';
      bar.setAttribute('role', 'alert');
      bar.textContent =
        'Abra pelo servidor local (npm run dev → http://localhost:3000) ou publique o site (ex.: Vercel em HTTPS). Em file:// o microfone e os links costumam falhar.';
      if (topbar.nextSibling) {
        app.insertBefore(bar, topbar.nextSibling);
      } else {
        app.appendChild(bar);
      }
    }
  }

  var page = document.body.getAttribute('data-nav');
  if (!page) return;
  var links = document.querySelectorAll('.bottom-nav .nav-link[data-nav]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var isActive = a.getAttribute('data-nav') === page;
    a.classList.toggle('nav-link--active', isActive);
    if (isActive) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
})();
