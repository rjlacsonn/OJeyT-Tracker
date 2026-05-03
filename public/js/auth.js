/* ============================================================
   AUTH — Frontend authentication handler (Supabase)
   ============================================================ */

class Auth {
  constructor() {
    this.user = null;
    this.session = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    // ===== CHECK EXISTING SUPABASE SESSION =====
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      this.user = session.user;
      this.session = session;
      this.isAuthenticated = true;
    }

    // ===== LISTEN FOR AUTH STATE CHANGES =====
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.user = session.user;
        this.session = session;
        this.isAuthenticated = true;
      } else {
        this.user = null;
        this.session = null;
        this.isAuthenticated = false;
      }
    });
  }

  // ===== SIGNUP =====
  async signup(fullName, email, password, confirmPassword, requiredHours) {
    try {
      if (!fullName || !email || !password || !confirmPassword) {
        return { success: false, message: 'All fields are required.' };
      }
      if (password !== confirmPassword) {
        return { success: false, message: 'Passwords do not match.' };
      }
      if (password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            required_hours: requiredHours || 200
          }
        }
      });

      if (error) return { success: false, message: error.message };

      // ===== SAVE PROFILE TO SUPABASE PROFILES TABLE =====
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          email: email,
          required_hours: requiredHours || 200
        });

        this.user = data.user;
        this.session = data.session || this.session;
        this.isAuthenticated = true;
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error) {
      return { success: false, message: 'Signup failed: ' + error.message };
    }
  }

  // ===== LOGIN =====
  async login(email, password) {
    try {
      if (!email || !password) {
        return { success: false, message: 'Email and password are required.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) return { success: false, message: error.message };

      this.user = data.user;
      this.session = data.session || this.session;
      this.isAuthenticated = true;

      return { success: true, message: 'Login successful!' };
    } catch (error) {
      return { success: false, message: 'Login failed: ' + error.message };
    }
  }

  getToken() {
    return this.session?.access_token || null;
  }

  setUser(user) {
    this.user = user;
  }

  // ===== REFRESH / GET CURRENT USER =====

  async refreshUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        this.logout();
        return null;
      }
      this.user = user;
      this.isAuthenticated = true;
      return user;
    } catch (error) {
      console.error('Refresh user error:', error);
      return null;
    }
  }

  // ===== LOGOUT =====
  async logout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.user = null;
      this.isAuthenticated = false;
      // ===== CLEAR ANY OLD LOCALSTORAGE REMNANTS =====
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  // ===== GETTERS =====
  getUser() {
    return this.user;
  }

  getUserName() {
    return this.user?.user_metadata?.full_name || this.user?.email || 'User';
  }

  getUserEmail() {
    return this.user?.email || '';
  }

  getUserId() {
    return this.user?.id || null;
  }
}

// ===== GLOBAL AUTH INSTANCE =====
const auth = new Auth();