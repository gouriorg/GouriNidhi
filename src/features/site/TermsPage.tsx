import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { LoadingState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { termsPage, type SiteTerms } from '@/content/sitePages'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { formatDisplayDate, todayIso } from '@/lib/dates'
import { toReadableError } from '@/repositories/errors'
import { siteContentRepository } from '@/repositories/siteContentRepository'
import { useIsAdmin } from '@/stores/session'

export function TermsPage() {
  const isAdmin = useIsAdmin()
  const terms = useLiveQuery(() => siteContentRepository.getTerms(), [])

  if (!terms) return <LoadingState label="Loading terms…" />

  return (
    <>
      <PageHeader title={termsPage.title} description={termsPage.description} />
      {isAdmin ? <TermsEditor initial={terms} /> : <TermsView terms={terms} />}
    </>
  )
}

function TermsView({ terms }: { terms: SiteTerms }) {
  return (
    <>
      <p className="text-muted-foreground mb-6 text-xs">{terms.updatedLabel}</p>
      <article className="grid gap-6">
        {terms.sections.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            <h2 className="text-base font-semibold">{section.heading}</h2>
            <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">{section.body}</p>
          </section>
        ))}
      </article>
    </>
  )
}

function TermsEditor({ initial }: { initial: SiteTerms }) {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(initial)
  }, [initial])

  function patchSection(index: number, partial: { heading?: string; body?: string }) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) => (i === index ? { ...section, ...partial } : section)),
    }))
  }

  async function save() {
    setBusy(true)
    try {
      await siteContentRepository.saveTerms({
        updatedLabel: `Last updated: ${formatDisplayDate(todayIso())}`,
        sections: draft.sections
          .map((section) => ({ heading: section.heading.trim(), body: section.body.trim() }))
          .filter((section) => section.heading || section.body),
      })
      toast.success('Terms saved')
    } catch (error) {
      toast.error(toReadableError(error, 'Could not save the terms.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground text-sm">
        Edit on this page. Members and visitors see the saved terms. Saving updates the “last updated” date.
      </p>
      <p className="text-muted-foreground text-xs">{draft.updatedLabel}</p>
      {draft.sections.map((section, index) => (
        <div key={index} className="grid gap-2">
          <div className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor={`terms-heading-${index}`}>Heading</Label>
              <Input
                id={`terms-heading-${index}`}
                value={section.heading}
                onChange={(event) => patchSection(index, { heading: event.target.value })}
              />
            </div>
            {draft.sections.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove section"
                disabled={busy}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sections: current.sections.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </div>
          <Label htmlFor={`terms-body-${index}`}>Content</Label>
          <Textarea
            id={`terms-body-${index}`}
            rows={5}
            value={section.body}
            onChange={(event) => patchSection(index, { body: event.target.value })}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              sections: [...current.sections, { heading: '', body: '' }],
            }))
          }
        >
          <PlusIcon />
          Add section
        </Button>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          Save terms
        </Button>
      </div>
    </div>
  )
}
