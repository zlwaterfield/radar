/**
 * Centralized axios configuration for the application
 * Ensures cookies are sent with all requests
 */
import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;

// Add request interceptor to ensure withCredentials is always set
axios.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axios;