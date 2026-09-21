import { getSupabase } from '@/lib/supabase'
import { notifyDataChanged } from '@/stores/dataVersion'
import { RepositoryError } from '@/repositories/errors'

export const ORGANIZER_PHOTOS_KEY = 'site.organizer_photos'

type PhotoMap = Record<string, string>

function asPhotoMap(value: unknown): PhotoMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const photos: PhotoMap = {}
  for (const [id, dataUrl] of Object.entries(value as Record<string, unknown>)) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) photos[id] = dataUrl
  }
  return photos
}

export const organizersRepository = {
  async listPhotos(): Promise<PhotoMap> {
    const { data, error } = await getSupabase()
      .from('settings')
      .select('value')
      .eq('key', ORGANIZER_PHOTOS_KEY)
      .maybeSingle()
    if (error) return {}
    return asPhotoMap(data?.value)
  },

  async setPhoto(organizerId: string, dataUrl: string | null): Promise<void> {
    const current = await organizersRepository.listPhotos()
    const next = { ...current }
    if (dataUrl) next[organizerId] = dataUrl
    else delete next[organizerId]

    const { error } = await getSupabase().from('settings').upsert({
      key: ORGANIZER_PHOTOS_KEY,
      value: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      throw new RepositoryError(
        error.message.includes('policy') || error.code === '42501'
          ? 'Could not save this photo. Sign in as admin and run the latest setup SQL.'
          : 'Could not save this photo.',
      )
    }
    notifyDataChanged()
  },
}
