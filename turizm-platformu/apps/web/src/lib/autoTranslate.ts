import i18n from '../i18n'

export async function translateUiText(text: string): Promise<string> {
  const target = (i18n.language || 'tr').slice(0, 2)
  if (target === 'tr' || !text.trim()) return text
  try {
    const res = await fetch(
      `/api/v1/translate?${new URLSearchParams({ text, target, source: 'tr' })}`,
    )
    const body = await res.json()
    return body.data?.text || text
  } catch {
    return text
  }
}
