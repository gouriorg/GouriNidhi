import { SearchIcon, type LucideIcon } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type MenuCommand = {
  to: string
  label: string
  icon: LucideIcon
  keywords?: string[]
}

const MenuSearchContext = createContext<{ open: () => void; shortcut: string } | null>(null)

function matches(command: MenuCommand, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [command.label, ...(command.keywords ?? [])].join(' ').toLowerCase()
  return needle.split(/\s+/).every((part) => haystack.includes(part))
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
}

export function MenuSearchProvider({
  commands,
  placeholder = 'Search menus…',
  children,
}: {
  commands: MenuCommand[]
  placeholder?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const shortcut = isMac() ? '⌘K' : 'Ctrl+K'

  const results = useMemo(() => commands.filter((command) => matches(command, query)), [commands, query])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey
      const isK = event.key.toLowerCase() === 'k'
      const isSpace = event.code === 'Space'
      if (meta && (isK || isSpace)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <MenuSearchContext.Provider value={{ open: () => setOpen(true), shortcut }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(index - 1, 0))
            }
            if (event.key === 'Enter' && results[active]) {
              event.preventDefault()
              go(results[active].to)
            }
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search menus</DialogTitle>
            <DialogDescription>Jump to a page by name, like Spotlight on a Mac.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="text-muted-foreground size-4 shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="h-12 border-0 shadow-none focus-visible:ring-0"
              autoComplete="off"
            />
          </div>
          <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
            {results.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">No matching menu.</li>
            ) : (
              results.map((command, index) => {
                const Icon = command.icon
                return (
                  <li key={`${command.to}:${command.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/15 hover:text-accent-foreground',
                        index === active && 'bg-accent/15 text-accent-foreground',
                      )}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(command.to)}
                    >
                      <Icon className="size-4 shrink-0" />
                      {command.label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <p className="text-muted-foreground border-t px-3 py-2 text-[11px]">
            Type to filter · ↑↓ to move · Enter to open · {shortcut} or ⌘Space to toggle
          </p>
        </DialogContent>
      </Dialog>
    </MenuSearchContext.Provider>
  )
}

export function MenuSearchButton({ className }: { className?: string }) {
  const search = useContext(MenuSearchContext)
  if (!search) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('text-muted-foreground h-9 gap-2 px-2.5', className)}
      onClick={search.open}
      aria-label="Search menus"
    >
      <SearchIcon className="size-4" />
      <span className="hidden sm:inline">Search menus</span>
      <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline">
        {search.shortcut}
      </kbd>
    </Button>
  )
}
