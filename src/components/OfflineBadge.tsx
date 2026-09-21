import { WifiOffIcon } from 'lucide-react'

import { useOnlineStatus } from '@/app/pwa'

/** Reassurance, not an error: everything keeps working without a network. */
export function OfflineBadge() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium">
      <WifiOffIcon className="size-3.5" />
      Offline — your data is still here
    </span>
  )
}
