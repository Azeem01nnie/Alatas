/** Split a credit string into unique trimmed names (order preserved). */
export function parsePhotographerNames(...sources) {
  const seen = new Set()
  const names = []

  const push = (raw) => {
    const text = String(raw || '').trim()
    if (!text) return
    for (const part of text.split(/,|;|\||\n/)) {
      const name = part.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      names.push(name)
    }
  }

  for (const source of sources) {
    if (Array.isArray(source)) {
      source.forEach(push)
    } else {
      push(source)
    }
  }

  return names
}

/** Merge existing + new photographer names into a comma-separated credit. */
export function mergePhotographerCredits(...sources) {
  return parsePhotographerNames(...sources).join(', ')
}

/** Collect names from carPhotos (_addedBy + each extra.addedBy) and the column value. */
export function collectPhotographerCredits(carPhotos, columnValue = '') {
  const extras = Array.isArray(carPhotos?.extras)
    ? carPhotos.extras.map((item) => item?.addedBy)
    : []
  return mergePhotographerCredits(columnValue, carPhotos?._addedBy, extras)
}

/** Display label: "Taken by: Name" or "Taken by: Name1, Name2". */
export function formatTakenByLabel(credit) {
  const names = parsePhotographerNames(credit)
  if (!names.length) return ''
  return `Taken by: ${names.join(', ')}`
}
