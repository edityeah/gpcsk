import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import { AppProvider } from './context/AppContext.js'
import { AuthProvider } from './context/AuthContext.js'
import './i18n/index.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>,
)
