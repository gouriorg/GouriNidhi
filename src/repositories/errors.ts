/** Domain-level failure that should be shown to the admin as a readable message. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export function toReadableError(error: unknown, fallback: string): string {
  if (error instanceof RepositoryError) return error.message
  if (error instanceof Error) {
    if (error.name === 'ConstraintError') {
      return 'That value already exists. Please use a different one.'
    }
    return error.message || fallback
  }
  return fallback
}
