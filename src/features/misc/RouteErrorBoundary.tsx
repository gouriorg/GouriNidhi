import { isRouteErrorResponse, useRouteError } from 'react-router'

import { ErrorState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

export function RouteErrorBoundary() {
  const error = useRouteError()

  const description = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error.'

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md">
        <ErrorState
          title="This screen crashed"
          description={description}
          action={
            <Button onClick={() => window.location.reload()}>Reload the app</Button>
          }
        />
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Your data is stored locally in this browser and was not lost.
        </p>
      </div>
    </div>
  )
}
