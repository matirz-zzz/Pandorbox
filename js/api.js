/**
 * API Client - Comunicación con Google Apps Script
 * Todas las llamadas van por POST con Content-Type text/plain para evitar preflight CORS.
 */
window.PandorApi = {

  /**
   * Envía una petición POST a la API.
   * @param {string} action - Nombre de la acción (ping, getDashboard, etc.)
   * @param {object} [payload] - Datos opcionales para la acción
   * @returns {Promise<*>} - El campo "data" de la respuesta si ok:true
   * @throws {Error} - Con el mensaje del servidor si ok:false
   */
  call: async function (action, payload) {
    var token = window.PandorAuth ? window.PandorAuth.getToken() : null;

    var body = { action: action };
    if (token) body.idToken = token;
    if (payload) body.payload = payload;

    var res = await fetch(window.PandorConfig.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error('Error de red: HTTP ' + res.status);
    }

    var json = await res.json();

    if (!json.ok) {
      var msg = json.error || 'Error desconocido';
      // If auth error, let auth module handle it
      if (msg.indexOf('Token') !== -1 || msg.indexOf('token') !== -1 ||
          msg.indexOf('autenticación') !== -1 || msg.indexOf('autorizado') !== -1 ||
          msg.indexOf('expirado') !== -1 || msg.indexOf('inactivo') !== -1) {
        if (window.PandorAuth) {
          window.PandorAuth.handleAuthError(msg);
        }
      }
      throw new Error(msg);
    }

    return json.data;
  },

  getDashboard: function () {
    return this.call('getDashboard');
  },

  getOperaciones: function () {
    return this.call('getOperaciones');
  },

  getHistorial: function () {
    return this.call('getHistorial');
  },

  addOperacion: function (payload) {
    return this.call('addOperacion', payload);
  },

  ping: function () {
    return this.call('ping');
  }
};
