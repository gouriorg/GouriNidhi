import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

export type PageChrome = {
  title?: ReactNode
  description?: string
  actions?: ReactNode
}

const PageChromeValueContext = createContext<PageChrome>({})
const PageChromeSetContext = createContext<Dispatch<SetStateAction<PageChrome>> | null>(null)

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome>({})
  const setter = useMemo(() => setChrome, [])
  return (
    <PageChromeSetContext.Provider value={setter}>
      <PageChromeValueContext.Provider value={chrome}>{children}</PageChromeValueContext.Provider>
    </PageChromeSetContext.Provider>
  )
}

export function usePageChrome() {
  return useContext(PageChromeValueContext)
}

/** Pushes title/actions into the fixed admin header when a layout provides chrome. */
export function useRegisterPageChrome(chrome: PageChrome) {
  const setChrome = useContext(PageChromeSetContext)

  useLayoutEffect(() => {
    if (!setChrome) return
    setChrome(chrome)
    return () => setChrome({})
  }, [setChrome, chrome.title, chrome.description, chrome.actions])

  return Boolean(setChrome)
}
