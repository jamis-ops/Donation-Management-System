import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/auth.css'
import './styles/portal.css'
import './styles/certificate.css'
import './styles/home.css'
import './styles/allocation-distribution.css'
import './admin.css'
import './styles/enhancements.css'
import App from './App.jsx'

// Leaflet default marker fix for bundlers
import 'leaflet/dist/leaflet.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
