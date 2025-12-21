import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/ThemeContext.jsx';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import './styles.css';

// Google Sign-In script
const googleScript = document.createElement('script');
googleScript.src = 'https://accounts.google.com/gsi/client';
googleScript.async = true;
googleScript.defer = true;
document.head.appendChild(googleScript);

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem('access_token'));
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AuthRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem('access_token'));
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthRoute>
              <Signup />
            </AuthRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
