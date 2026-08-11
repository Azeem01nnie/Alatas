// Quick validation against real noisy OCR from user's CR
function flatten(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

const text = `
CERTIFICATE OF REGISTRATION —
g L154JX KFS51E7041285 VHIME G1) SPHO4 196 NA
1101230006 32095 enone L3 HONDA
: 2 REDBLACK GAS PRIVATE - (PVT)
NOTARY Eero ADV160AF 265 NA
k SICCCAR
Bl | RICHIE JULS BACALSO
PUROK XULOAN LIB OC CITY CF MAASIN (CAPITAL), SOUTHEMN LEYTE
CR No. 0016563887
LAND TRANSPORTATION OFFICE
`

const flat = flatten(text).toUpperCase()
const plate = (flat.match(/\b([A-Z]{1,3}\d{2,4}[A-Z]{0,3})\b/g) || []).find(c => c.length>=5 && /[A-Z]/.test(c) && /\d/.test(c))
const engine = flat.match(/\b([A-Z]{2,5}\d{1,3}[A-Z]?\d{5,12})\b/)
const honda = /\bHONDA\b/.test(flat)
const series = flat.match(/\b(ADV\d{2,4}[A-Z]?)\b/)
const owner = text.match(/RICHIE\s+JULS\s+BACALSO/i)
const moto = /MOTORCYCLE|SIDECAR|SICCCAR/i.test(text)

console.log({ plate, engine: engine?.[1], honda, series: series?.[1], owner: owner?.[0], moto })
