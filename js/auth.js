/**
 * AUTH - Login con Google Identity Services
 * Token guardado en sessionStorage (nunca localStorage).
 * Si no hay token válido, muestra la pantalla de login y oculta la app.
 */
window.PandorAuth = {

  _tokenKey: 'pandor_id_token',
  _expKey: 'pandor_token_exp',

  /**
   * Decodifica el payload de un JWT sin validar firma (solo para leer exp).
   */
  _decodePayload: function (jwt) {
    try {
      var parts = jwt.split('.');
      if (parts.length !== 3) return null;
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  },

  /**
   * Guarda el token y su vencimiento en sessionStorage.
   */
  _saveToken: function (idToken) {
    var decoded = this._decodePayload(idToken);
    if (!decoded || !decoded.exp) return false;
    sessionStorage.setItem(this._tokenKey, idToken);
    sessionStorage.setItem(this._expKey, String(decoded.exp));
    return true;
  },

  /**
   * Devuelve el idToken si existe y no expiró; null si no.
   */
  getToken: function () {
    var token = sessionStorage.getItem(this._tokenKey);
    var exp = sessionStorage.getItem(this._expKey);
    if (!token || !exp) return null;
    var now = Math.floor(Date.now() / 1000);
    if (now >= Number(exp)) {
      this.logout();
      return null;
    }
    return token;
  },

  /**
   * Devuelve info básica del usuario desde el JWT decodificado.
   */
  getUserInfo: function () {
    var token = sessionStorage.getItem(this._tokenKey);
    if (!token) return null;
    var decoded = this._decodePayload(token);
    if (!decoded) return null;
    return {
      email: decoded.email || '',
      name: decoded.name || decoded.email || '',
      givenName: decoded.given_name || '',
      picture: decoded.picture || ''
    };
  },

  /**
   * Borra sesión y muestra pantalla de login.
   */
  logout: function () {
    sessionStorage.removeItem(this._tokenKey);
    sessionStorage.removeItem(this._expKey);
    this.showLogin();
  },

  /**
   * Llamada cuando la API responde un error de autenticación.
   */
  handleAuthError: function (msg) {
    sessionStorage.removeItem(this._tokenKey);
    sessionStorage.removeItem(this._expKey);
    this.showLogin(msg);
  },

  /**
   * Muestra la pantalla de login y oculta la app.
   */
  showLogin: function (errorMsg) {
    var appEl = document.getElementById('app-main');
    var loginEl = document.getElementById('login-screen');
    var mobileNav = document.querySelector('.mobile-bottom-bar');
    if (appEl) appEl.style.display = 'none';
    if (mobileNav) mobileNav.style.display = 'none';
    if (loginEl) {
      loginEl.style.display = 'flex';
      var errBox = document.getElementById('login-error');
      if (errBox) {
        if (errorMsg) {
          errBox.textContent = errorMsg;
          errBox.style.display = 'block';
        } else {
          errBox.textContent = '';
          errBox.style.display = 'none';
        }
      }
      // Re-render Google button in case the container was hidden
      this._renderGoogleButton();
      // Download the welcome GIF while the user signs in
      if (window.PandorWelcome) window.PandorWelcome.preload();
    }
  },

  /**
   * Oculta la pantalla de login y muestra la app.
   */
  showApp: function () {
    var appEl = document.getElementById('app-main');
    var loginEl = document.getElementById('login-screen');
    var mobileNav = document.querySelector('.mobile-bottom-bar');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    if (mobileNav) mobileNav.style.display = 'flex';

    // Update avatar: chosen Attack on Titan character, or initials as fallback
    var user = this.getUserInfo();
    if (user && window.PandorAvatar) {
      window.PandorAvatar.init(document.getElementById('userAvatar'), user);
    }
  },

  /**
   * Renders the Google sign-in button inside the container.
   */
  _renderGoogleButton: function () {
    var container = document.getElementById('google-btn-container');
    if (!container || typeof google === 'undefined' || !google.accounts) return;
    container.innerHTML = '';
    // Google caps the button at 400px; fit narrower phones
    var width = Math.min(400, container.clientWidth || 400);
    google.accounts.id.renderButton(container, {
      theme: 'filled_blue',
      size: 'large',
      width: width,
      text: 'signin_with',
      shape: 'pill'
    });
  },

  /**
   * Callback when Google returns the credential.
   */
  _onCredentialResponse: function (response) {
    if (!response || !response.credential) {
      this.showLogin('No se recibió un token de Google.');
      return;
    }
    var saved = this._saveToken(response.credential);
    if (!saved) {
      this.showLogin('Token de Google inválido.');
      return;
    }
    this.showApp();
    this._loadWithWelcome();
  },

  /**
   * Shows the welcome screen and loads the app data behind it.
   */
  _loadWithWelcome: function () {
    var welcome = window.PandorWelcome;
    if (welcome) welcome.show(this.getUserInfo());
    var loading = typeof window.cargarDatosApp === 'function' ? window.cargarDatosApp() : null;
    if (welcome) welcome.hideWhen(loading);
  },

  /**
   * Initializes Google Identity Services and checks existing session.
   */
  init: function () {
    var self = this;

    // Wait for the GIS library to load
    function waitForGis() {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: window.PandorConfig.GOOGLE_CLIENT_ID,
          callback: function (resp) { self._onCredentialResponse(resp); },
          auto_select: true
        });

        // Check existing valid token
        if (self.getToken()) {
          self.showApp();
          self._loadWithWelcome();
        } else {
          self.showLogin();
        }
      } else {
        setTimeout(waitForGis, 100);
      }
    }

    waitForGis();
  }
};
