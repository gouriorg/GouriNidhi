import { cn } from '@/lib/utils'
import { initialsFromName } from '@/lib/organizerPhoto'

export function OrganizerAvatar({
  name,
  photo,
  className,
}: {
  name: string
  photo?: string
  className?: string
}) {
  const initials = initialsFromName(name)

  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground relative size-20 shrink-0 overflow-hidden rounded-full',
        className,
      )}
      aria-hidden={!photo}
    >
      {photo ? (
        <img src={photo} alt={name} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center font-semibold tracking-wide">{initials}</span>
      )}
    </div>
  )
}
