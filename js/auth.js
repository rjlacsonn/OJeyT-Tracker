/* ============================================================
   AUTH — Frontend authentication handler
   ============================================================ */

class Auth {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.isAuthenticated = !!this.token;
  }

  async signup(fullName, email, password, confirmPassword, requiredHours) {
    try {
      const result = await API.signup(fullName, email, password, confirmPassword, requiredHours);
      if (result.success) {
        this.setToken(result.token);
        if (result.refreshToken) this.setRefreshToken(result.refreshToken);
        this.setUser(result.user);
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: 'Signup failed: ' + error.message };
    }
  }

  async login(email, password) {
    try {
      const result = await API.login(email, password);
      if (result.success) {
        this.setToken(result.token);
        if (result.refreshToken) this.setRefreshToken(result.refreshToken);
        this.setUser(result.user);
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: 'Login failed: ' + error.message };
    }
  }

  async refreshUser() {
    if (!this.token) return null;
    try {
      const result = await API.getMe(this.token);
      if (result.success) {
        this.setUser(result.user);
        return result.user;
      } else {
        this.logout();
        return null;
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      return null;
    }
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
    this.isAuthenticated = true;
  }

  setUser(user) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  setRefreshToken(refreshToken) {
    this.refreshToken = refreshToken;
    localStorage.setItem('refreshToken', refreshToken);
  }

  logout() {
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    this.isAuthenticated = false;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }
}

// ===== GLOBAL AUTH INSTANCE =====
const auth = new Auth();
