import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'

export function NotFoundPage() {
  const session = useSession()
  const home = session?.kind === 'member' ? '/me' : '/'

  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-muted-foreground font-[family-name:var(--font-display)] text-5xl font-bold">
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          That screen does not exist in GouriNidhi.
        </p>
        <Button asChild className="mt-6">
          <Link to={home}>Go to home</Link>
        </Button>
      </div>
    </div>
  )
}
