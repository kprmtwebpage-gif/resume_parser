// Simple authentication using sessionStorage
// Key: "userLoginAuth" | Value: "true"
// Session clears when browser closes

const authStore = {
  // Check if user is authenticated
  isAuthenticated() {
    return sessionStorage.getItem('userLoginAuth') === 'true';
  },

  // Login with hardcoded credentials
  login(username, password) {
    // Hardcoded credentials
    if (username === 'admin' && password === 'admin') {
      sessionStorage.setItem('userLoginAuth', 'true');
      return { success: true };
    }
    return { success: false, message: 'Invalid credentials' };
  },

  // Logout
  logout() {
    sessionStorage.removeItem('userLoginAuth');
  }
};

export { authStore };
export default authStore;
