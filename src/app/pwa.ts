import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<(available: boolean) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    installListeners.forEach((listener) => listener(true))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installListeners.forEach((listener) => listener(false))
  })
}

/** Register the service worker and offer a reload when a new build lands. */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return

  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version of GouriNidhi is ready', {
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: 'Reload',
          onClick: () => updateSW(true),
        },
      })
    },
    onOfflineReady() {
      toast.success('GouriNidhi is ready to work offline')
    },
  })
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(deferredPrompt !== null)

  useEffect(() => {
    installListeners.add(setCanInstall)
    return () => {
      installListeners.delete(setCanInstall)
    }
  }, [])

  async function promptInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      deferredPrompt = null
      setCanInstall(false)
    }
  }

  return { canInstall, promptInstall }
}

/** Offline is an expected state for a local-first app, not an error. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
