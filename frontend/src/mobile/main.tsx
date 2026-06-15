import React from 'react'
import ReactDOM from 'react-dom/client'
import MobileApp from './MobileApp'
import './mobile.css'
import '../i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
)
