/**
 * When CMS text is live but image_url is empty, reuse bundled mock assets
 * matched by slug / name / index so public Partners & Projects keep showing photos.
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function findMockMatch(cmsItem, mockList, { slugKey = 'id', nameKey = 'name' } = {}) {
  if (!Array.isArray(mockList) || !mockList.length) return null
  const meta = cmsItem?.meta || {}
  const slug = meta.slug || meta.id || ''
  const title = cmsItem?.title || cmsItem?.name || ''

  if (slug) {
    const bySlug = mockList.find((m) => norm(m[slugKey]) === norm(slug))
    if (bySlug) return bySlug
  }
  if (title) {
    const byName = mockList.find((m) => norm(m[nameKey]) === norm(title))
    if (byName) return byName
    const byPartial = mockList.find((m) => {
      const n = norm(m[nameKey])
      const t = norm(title)
      return n && t && (n.includes(t) || t.includes(n))
    })
    if (byPartial) return byPartial
  }
  return null
}

export function resolveCmsImage(cmsItem, mockMatch, imageKeys = ['image', 'logo']) {
  const fromCms = cmsItem?.imageUrl || cmsItem?.image || cmsItem?.logo || ''
  if (fromCms) return fromCms
  if (!mockMatch) return null
  for (const key of imageKeys) {
    if (mockMatch[key]) return mockMatch[key]
  }
  return null
}
