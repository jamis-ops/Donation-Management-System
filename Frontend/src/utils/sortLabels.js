/** Case-insensitive A–Z sort for catalog labels / option strings. */
export function sortLabelsAz(list = []) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }),
  )
}

/** Sort catalog item rows by label A–Z. */
export function sortCatalogItemsAz(items = []) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const la = typeof a === 'string' ? a : (a?.label || '')
    const lb = typeof b === 'string' ? b : (b?.label || '')
    return String(la).localeCompare(String(lb), undefined, { sensitivity: 'base', numeric: true })
  })
}
