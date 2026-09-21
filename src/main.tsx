import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { DatabaseGate } from '@/app/DatabaseGate'
import { AppProviders } from '@/app/providers'
import { registerServiceWorker } from '@/app/pwa'
import { AppRouter } from '@/app/router'

import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <DatabaseGate>
        <AppRouter />
      </DatabaseGate>
    </AppProviders>
  </StrictMode>,
)

registerServiceWorker()
