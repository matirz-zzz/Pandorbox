/**
 * AVATARS - Attack on Titan character picker
 *
 * Each user picks a character (anime or manga version) as their avatar.
 * The choice is stored in this browser's localStorage, keyed by email.
 * Images live in img/avatars/<id>-<version>.webp.
 */
window.PandorAvatar = {
  _storagePrefix: 'pandor_avatar_',

  characters: [
    { id: 'eren', name: 'Eren' },
    { id: 'mikasa', name: 'Mikasa' },
    { id: 'armin', name: 'Armin' },
    { id: 'levi', name: 'Levi' },
    { id: 'erwin', name: 'Erwin' },
    { id: 'hange', name: 'Hange' },
    { id: 'jean', name: 'Jean' },
    { id: 'connie', name: 'Connie' },
    { id: 'sasha', name: 'Sasha' },
    { id: 'historia', name: 'Historia' },
    { id: 'ymir', name: 'Ymir' },
    { id: 'reiner', name: 'Reiner' },
    { id: 'bertolt', name: 'Bertolt' },
    { id: 'annie', name: 'Annie' },
    { id: 'zeke', name: 'Zeke' },
    { id: 'pieck', name: 'Pieck' },
    { id: 'porco', name: 'Porco' },
    { id: 'falco', name: 'Falco' },
    { id: 'gabi', name: 'Gabi' }
  ],

  titans: [
    { id: 'titan-ataque', name: 'Ataque' },
    { id: 'titan-fundador', name: 'Fundador' },
    { id: 'titan-colosal', name: 'Colosal' },
    { id: 'titan-acorazado', name: 'Acorazado' },
    { id: 'titan-hembra', name: 'Hembra' },
    { id: 'titan-bestia', name: 'Bestia' },
    { id: 'titan-mandibula', name: 'Mandíbula' },
    { id: 'titan-carguero', name: 'Carguero' },
    { id: 'titan-martillo', name: 'Martillo de Guerra' }
  ],

  versions: [
    { id: 'anime', label: 'Anime' },
    { id: 'manga', label: 'Manga' }
  ],

  _src: function (key) {
    return 'img/avatars/' + key + '.webp';
  },

  /**
   * Returns true if key is "<known id>-<known version>".
   */
  _isValidKey: function (key) {
    if (typeof key !== 'string') return false;
    var all = this.characters.concat(this.titans);
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < this.versions.length; j++) {
        if (key === all[i].id + '-' + this.versions[j].id) return true;
      }
    }
    return false;
  },

  getChosen: function (email) {
    try {
      var key = localStorage.getItem(this._storagePrefix + email);
      return this._isValidKey(key) ? key : null;
    } catch (e) {
      return null;
    }
  },

  setChosen: function (email, key) {
    if (!this._isValidKey(key)) return;
    try {
      localStorage.setItem(this._storagePrefix + email, key);
    } catch (e) {
      // Storage unavailable: the choice only lasts for this page load
    }
  },

  /**
   * Paints the avatar element: chosen character, or initials as fallback.
   */
  render: function (avatarEl, user, keyOverride) {
    if (!avatarEl || !user) return;
    var parts = (user.name || '').trim().split(' ');
    var initials = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();

    avatarEl.textContent = initials || '?';
    avatarEl.title = 'Elegir avatar';

    var key = keyOverride || this.getChosen(user.email);
    if (!key) return;
    var img = document.createElement('img');
    img.className = 'user-avatar-img';
    img.alt = user.name || '';
    img.src = this._src(key);
    // If the image fails to load, keep the initials
    img.onload = function () {
      avatarEl.textContent = '';
      avatarEl.appendChild(img);
    };
  },

  /**
   * Wires the avatar element to open the picker.
   */
  init: function (avatarEl, user) {
    if (!avatarEl || !user) return;
    var self = this;
    this.render(avatarEl, user);
    avatarEl.onclick = function () {
      self.openPicker(user, function (key) {
        self.setChosen(user.email, key);
        self.render(avatarEl, user, key);
      });
    };
  },

  /**
   * Builds and shows the picker modal.
   */
  openPicker: function (user, onSelect) {
    var self = this;
    var current = this.getChosen(user.email);
    var version = current && /-manga$/.test(current) ? 'manga' : 'anime';

    var overlay = document.createElement('div');
    overlay.className = 'avatar-picker-overlay';

    var modal = document.createElement('div');
    modal.className = 'avatar-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Elegir avatar');

    var header = document.createElement('div');
    header.className = 'avatar-picker-header';
    var title = document.createElement('h2');
    title.className = 'avatar-picker-title';
    title.textContent = 'Elegí tu avatar';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'avatar-picker-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Cerrar';
    closeBtn.textContent = '✕';
    header.appendChild(title);
    header.appendChild(closeBtn);

    var tabs = document.createElement('div');
    tabs.className = 'avatar-picker-tabs';
    var tabButtons = this.versions.map(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'avatar-picker-tab';
      b.textContent = v.label;
      b.onclick = function () {
        version = v.id;
        paint();
      };
      tabs.appendChild(b);
      return { el: b, id: v.id };
    });

    var body = document.createElement('div');
    body.className = 'avatar-picker-body';

    modal.appendChild(header);
    modal.appendChild(tabs);
    modal.appendChild(body);
    overlay.appendChild(modal);

    function close() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    function section(label, items) {
      var h = document.createElement('h3');
      h.className = 'avatar-picker-section';
      h.textContent = label;
      body.appendChild(h);

      var grid = document.createElement('div');
      grid.className = 'avatar-picker-grid';
      items.forEach(function (item) {
        var key = item.id + '-' + version;
        var opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'avatar-option' + (key === current ? ' selected' : '');
        opt.title = item.name;

        var img = document.createElement('img');
        img.src = self._src(key);
        img.alt = item.name;
        img.loading = 'lazy';

        var name = document.createElement('span');
        name.className = 'avatar-option-name';
        name.textContent = item.name;

        opt.appendChild(img);
        opt.appendChild(name);
        opt.onclick = function () {
          onSelect(key);
          close();
        };
        grid.appendChild(opt);
      });
      body.appendChild(grid);
    }

    function paint() {
      tabButtons.forEach(function (t) {
        t.el.classList.toggle('active', t.id === version);
      });
      body.textContent = '';
      section('Personajes', self.characters);
      section('Titanes', self.titans);
    }

    closeBtn.onclick = close;
    overlay.onclick = function (e) {
      if (e.target === overlay) close();
    };
    document.addEventListener('keydown', onKey);

    paint();
    document.body.appendChild(overlay);
    closeBtn.focus();
  }
};
