/**
 * WELCOME - Full-screen greeting shown while the portfolio loads.
 *
 * Shows "Bienvenido, <name>" with a GIF background right after login
 * (or on page load with a saved session) and hides it once the data arrives.
 */
window.PandorWelcome = {
  GIF_SRC: 'img/welcome.gif',
  MIN_VISIBLE_MS: 2500,
  MAX_VISIBLE_MS: 15000,

  // Google first name -> name shown in the greeting
  nicknames: {
    'Matias': 'Mati',
    'Matías': 'Mati',
    'Raul': 'Raúl'
  },

  _shownAt: 0,
  _maxTimer: null,

  /**
   * Starts downloading the GIF early (called from the login screen).
   */
  preload: function () {
    var img = new Image();
    img.src = this.GIF_SRC;
  },

  _displayName: function (user) {
    var first = (user.givenName || (user.name || '').trim().split(' ')[0] || '').trim();
    return this.nicknames[first] || first;
  },

  show: function (user) {
    var el = document.getElementById('welcome-screen');
    if (!el || !user) return;

    var name = this._displayName(user);
    var title = document.getElementById('welcomeTitle');
    if (title) title.textContent = name ? 'Bienvenido, ' + name : 'Bienvenido';

    var avatar = document.getElementById('welcomeAvatar');
    if (avatar && window.PandorAvatar) {
      window.PandorAvatar.render(avatar, user);
      avatar.title = '';
    }

    el.classList.remove('welcome-hiding');
    el.style.display = 'flex';
    this._shownAt = Date.now();

    // Safety net: never block the app if loading hangs
    var self = this;
    clearTimeout(this._maxTimer);
    this._maxTimer = setTimeout(function () { self.hide(); }, this.MAX_VISIBLE_MS);
  },

  /**
   * Hides the screen once `promise` settles, keeping it visible MIN_VISIBLE_MS.
   */
  hideWhen: function (promise) {
    var self = this;
    var done = function () {
      var wait = Math.max(0, self.MIN_VISIBLE_MS - (Date.now() - self._shownAt));
      setTimeout(function () { self.hide(); }, wait);
    };
    Promise.resolve(promise).then(done, done);
  },

  hide: function () {
    var el = document.getElementById('welcome-screen');
    clearTimeout(this._maxTimer);
    if (!el || el.style.display === 'none') return;
    el.classList.add('welcome-hiding');
    setTimeout(function () {
      el.style.display = 'none';
      el.classList.remove('welcome-hiding');
    }, 400);
  }
};
