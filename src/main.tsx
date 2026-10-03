import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Ask the browser not to evict our IndexedDB (your books) when storage runs low
if (navigator.storage?.persist) {
  navigator.storage.persist().then((granted) => {
    console.log(granted ? 'Persistent storage granted' : 'Persistent storage not granted')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)