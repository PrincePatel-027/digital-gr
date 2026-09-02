import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARCHIVE_MONTH = 'May2026'
const SNAPSHOT_DATE = '2026-05-31'
const STATE_CODE = '24'
const ARCHIVE_BASE = 'https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1'
const ARCHIVES = [
  'districts',
  'subdistricts',
  'blocks',
  'pri_local_bodies',
  'villages_by_blocks',
]
const CACHE_DIR = join(tmpdir(), 'digital-gr-lgd')
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = resolve(SCRIPT_DIR, '..', 'lib', 'gujarat-locations.ts')
const GUJARATI_RE = /[\u0A80-\u0AFF]/u

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') {
      field += character
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [rawHeaders = [], ...values] = rows
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, '').trim())
  return values
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ''])))
}

function normalizeName(value) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-IN')
    .replace(/&/g, ' and ')
    .replace(/\b(?:taluka|taluk|tehsil|block|district|panchayat)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeBaseName(value) {
  return normalizeName(value.replace(/\b(?:city|rural|urban|east|west|north|south)\b/gi, ' '))
}

function levenshtein(left, right) {
  if (!left) return right.length
  if (!right) return left.length
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

async function downloadArchive(component) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const fileName = `${component}.${ARCHIVE_MONTH}.7z`
  const archivePath = join(CACHE_DIR, fileName)
  if (!existsSync(archivePath)) {
    const url = `${ARCHIVE_BASE}/${fileName}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`)
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()))
  }
  return archivePath
}

function latestCsvMember(archivePath) {
  const members = execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((member) => member.trim())
    .filter((member) => member.endsWith('.csv'))
  const dated = members
    .map((member) => {
      const match = /\.(\d{2})([A-Za-z]{3})(\d{4})\.csv$/.exec(member)
      const month = match ? new Date(`${match[2]} 1, ${match[3]}`).getMonth() + 1 : 0
      return {
        member,
        stamp: match ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1]}` : member,
      }
    })
    .sort((left, right) => left.stamp.localeCompare(right.stamp))
  const latest = dated.at(-1)?.member
  if (!latest) throw new Error(`No CSV member found in ${archivePath}`)
  return latest
}

function readLatestRows(archivePath) {
  const member = latestCsvMember(archivePath)
  const bytes = execFileSync('tar', ['-xOf', archivePath, member], { maxBuffer: 192 * 1024 * 1024 })
  return { member, rows: parseCsv(bytes.toString('utf8')) }
}

function value(row, ...headers) {
  for (const header of headers) {
    if (header in row) return row[header]
  }
  return ''
}

function compactRow(row, fields) {
  return Object.fromEntries(fields.map(([name, headers]) => [name, value(row, ...headers)]))
}

function isGujarati(value) {
  return GUJARATI_RE.test(value)
}

function cleanLocalName(value) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim()
}

const CONSONANTS = [
  ['ksh', 'ક્ષ'], ['chh', 'છ'], ['sh', 'શ'], ['kh', 'ખ'], ['gh', 'ઘ'],
  ['ch', 'ચ'], ['jh', 'ઝ'], ['th', 'થ'], ['dh', 'ધ'], ['ph', 'ફ'], ['bh', 'ભ'],
  ['ng', 'ઙ'], ['ny', 'ઞ'], ['gn', 'જ્ઞ'], ['tr', 'ત્ર'],
  ['k', 'ક'], ['q', 'ક'], ['g', 'ગ'], ['c', 'ક'], ['j', 'જ'], ['t', 'ત'],
  ['d', 'દ'], ['n', 'ન'], ['p', 'પ'], ['b', 'બ'], ['m', 'મ'], ['y', 'ય'],
  ['r', 'ર'], ['l', 'લ'], ['v', 'વ'], ['w', 'વ'], ['s', 'સ'], ['h', 'હ'],
  ['f', 'ફ'], ['z', 'ઝ'], ['x', 'ક્સ'],
]
const VOWELS = [
  ['aa', ['આ', 'ા']], ['ee', ['ઈ', 'ી']], ['ii', ['ઈ', 'ી']], ['oo', ['ઊ', 'ૂ']],
  ['uu', ['ઊ', 'ૂ']], ['ai', ['ઐ', 'ૈ']], ['au', ['ઔ', 'ૌ']],
  ['a', ['અ', '']], ['i', ['ઇ', 'િ']], ['u', ['ઉ', 'ુ']], ['e', ['એ', 'ે']], ['o', ['ઓ', 'ો']],
]

/**
 * Last-resort, dependency-free phonetic rendering for an LGD English label.
 * Identity and relationships always come from LGD codes; this function is never
 * used to invent a location or to replace a land-region code.
 */
function transliterateWord(rawWord) {
  const word = rawWord.toLocaleLowerCase('en-IN')
  let output = ''
  let pendingConsonant = false
  let index = 0

  while (index < word.length) {
    const rest = word.slice(index)
    const vowel = VOWELS.find(([latin]) => rest.startsWith(latin))
    if (vowel) {
      const [latin, [independent, matra]] = vowel
      if (pendingConsonant) {
        output = output.replace(/્$/u, '') + matra
      } else {
        output += independent
      }
      pendingConsonant = false
      index += latin.length
      continue
    }

    const consonant = CONSONANTS.find(([latin]) => rest.startsWith(latin))
    if (consonant) {
      const [latin, gujarati] = consonant
      output += `${gujarati}્`
      pendingConsonant = true
      index += latin.length
      continue
    }

    if (/\d/.test(word[index])) output += word[index]
    pendingConsonant = false
    index += 1
  }

  return output.replace(/્$/u, '')
}

function transliterateLabel(label) {
  const parts = label.match(/[A-Za-z]+|\d+|[^A-Za-z\d]+/g) ?? []
  return parts.map((part) => /^[A-Za-z]+$/.test(part) ? transliterateWord(part) : part).join('')
}

function applyDescriptor(baseLabel, englishName) {
  const suffixes = []
  if (/\bcity\b|city$/i.test(englishName)) suffixes.push('શહેર')
  if (/\brural\b/i.test(englishName)) suffixes.push('ગ્રામ્ય')
  if (/\beast\b/i.test(englishName)) suffixes.push('પૂર્વ')
  if (/\bwest\b/i.test(englishName)) suffixes.push('પશ્ચિમ')
  if (/\bnorth\b/i.test(englishName)) suffixes.push('ઉત્તર')
  if (/\bsouth\b/i.test(englishName)) suffixes.push('દક્ષિણ')
  return suffixes.length > 0 && !suffixes.some((suffix) => baseLabel.includes(suffix))
    ? `${baseLabel} ${suffixes.join(' ')}`
    : baseLabel
}

function uniqueBy(values, getKey) {
  const seen = new Set()
  return values.filter((entry) => {
    const key = getKey(entry)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ts(value) {
  return JSON.stringify(value, null, 2)
}

function generateModule({ districts, subdistricts, sources }) {
  const sourceRows = Object.fromEntries(Object.entries(sources).map(([component, source]) => [component, {
    url: source.url,
    member: source.member,
    sha256: source.sha256,
  }]))
  return `/**
 * GENERATED FILE — run \`node scripts/generate-gujarat-locations.mjs\` to refresh.
 *
 * Identity, hierarchy, and English names are from the Government of India Local
 * Government Directory (LGD) ${SNAPSHOT_DATE} snapshot. Gujarati labels prefer
 * LGD's code-linked local names from development-block/panchayat exports. A
 * deterministic phonetic fallback is used only when LGD publishes no Gujarati
 * label for that land-region name; it never changes or substitutes LGD codes.
 *
 * Official OGD resource: https://www.data.gov.in/resource/local-government-directory-lgd-sub-districts
 * Archive documentation: https://ramseraph.github.io/opendata/lgd/
 */

export type GujaratLocationLabelSource =
  | 'lgd-local-name'
  | 'lgd-code-linked-local-name'
  | 'deterministic-transliteration'

export interface GujaratDistrict {
  key: string
  code: string
  nameEn: string
  nameGu: string
  labelSource: GujaratLocationLabelSource
}

export interface GujaratSubdistrict extends GujaratDistrict {
  districtKey: string
}

export const GUJARAT_LOCATION_SNAPSHOT = ${ts({ date: SNAPSHOT_DATE, stateCode: STATE_CODE, sources: sourceRows })} as const

export const GUJARAT_DISTRICTS = ${ts(districts)} as const satisfies readonly GujaratDistrict[]

export const GUJARAT_SUBDISTRICTS = ${ts(subdistricts)} as const satisfies readonly GujaratSubdistrict[]

const DISTRICT_BY_KEY = new Map<string, GujaratDistrict>(
  GUJARAT_DISTRICTS.map((entry) => [entry.key, entry])
)
const SUBDISTRICT_BY_KEY = new Map<string, GujaratSubdistrict>(
  GUJARAT_SUBDISTRICTS.map((entry) => [entry.key, entry])
)
const SUBDISTRICTS_BY_DISTRICT = new Map<string, GujaratSubdistrict[]>()
for (const entry of GUJARAT_SUBDISTRICTS) {
  const current = SUBDISTRICTS_BY_DISTRICT.get(entry.districtKey) ?? []
  current.push(entry)
  SUBDISTRICTS_BY_DISTRICT.set(entry.districtKey, current)
}

export function normalizeGujaratLocationName(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-IN')
    .replace(/&/g, ' and ')
    .replace(/\\b(?:taluka|taluk|tehsil|district)\\b/g, ' ')
    .replace(/[^\\p{Letter}\\p{Number}]+/gu, '')
}

export function getGujaratDistrict(key: string | null | undefined): GujaratDistrict | null {
  return key ? DISTRICT_BY_KEY.get(key) ?? null : null
}

export function getGujaratSubdistrict(key: string | null | undefined): GujaratSubdistrict | null {
  return key ? SUBDISTRICT_BY_KEY.get(key) ?? null : null
}

export function getGujaratSubdistricts(districtKey: string | null | undefined): readonly GujaratSubdistrict[] {
  return districtKey ? SUBDISTRICTS_BY_DISTRICT.get(districtKey) ?? [] : []
}

export function resolveGujaratDistrict(value: string | null | undefined): GujaratDistrict | null {
  if (!value) return null
  const direct = getGujaratDistrict(value)
  if (direct) return direct
  const normalized = normalizeGujaratLocationName(value)
  const matches = GUJARAT_DISTRICTS.filter((entry) =>
    normalizeGujaratLocationName(entry.nameEn) === normalized ||
    normalizeGujaratLocationName(entry.nameGu) === normalized ||
    entry.code === value
  )
  return matches.length === 1 ? matches[0] : null
}

export function resolveGujaratSubdistrict(
  value: string | null | undefined,
  districtKey?: string | null
): GujaratSubdistrict | null {
  if (!value) return null
  const direct = getGujaratSubdistrict(value)
  if (direct && (!districtKey || direct.districtKey === districtKey)) return direct
  const normalized = normalizeGujaratLocationName(value)
  const candidates = districtKey ? getGujaratSubdistricts(districtKey) : GUJARAT_SUBDISTRICTS
  const matches = candidates.filter((entry) =>
    normalizeGujaratLocationName(entry.nameEn) === normalized ||
    normalizeGujaratLocationName(entry.nameGu) === normalized ||
    entry.code === value
  )
  return matches.length === 1 ? matches[0] : null
}

export function formatGujaratLocationLabel(
  value: string | null | undefined,
  script: 'en' | 'gu' | 'both' = 'both'
): string {
  const location = getGujaratDistrict(value) ?? getGujaratSubdistrict(value)
  if (!location) return value ?? ''
  if (script === 'en') return location.nameEn
  if (script === 'gu') return location.nameGu
  return \`\${location.nameGu} / \${location.nameEn}\`
}
`
}

async function main() {
  const loaded = {}
  const sources = {}

  for (const component of ARCHIVES) {
    const archivePath = await downloadArchive(component)
    const { member, rows } = readLatestRows(archivePath)
    const archiveBytes = readFileSync(archivePath)
    sources[component] = {
      url: `${ARCHIVE_BASE}/${component}.${ARCHIVE_MONTH}.7z`,
      member,
      bytes: archiveBytes.length,
      sha256: createHash('sha256').update(archiveBytes).digest('hex'),
      headers: Object.keys(rows[0] ?? {}),
    }
    loaded[component] = rows.filter((row) => (
      value(row, 'State Code', 'State LGD Code') === STATE_CODE ||
      /^(?:Gujarat)$/i.test(value(row, 'State Name', 'State Name (In English)'))
    ))
  }

  const districtRows = loaded.districts.map((row) => compactRow(row, [
    ['code', ['District Code']],
    ['nameEn', ['District Name(In English)', 'District Name (In English)', 'District Name']],
  ]))
  const subdistrictRows = loaded.subdistricts.map((row) => compactRow(row, [
    ['districtCode', ['District Code']],
    ['districtNameEn', ['District Name', 'District Name (In English)']],
    ['code', ['Sub-district Code', 'Subdistrict Code']],
    ['nameEn', ['Sub-district Name', 'Subdistrict Name']],
  ]))
  const blocks = loaded.blocks.map((row) => compactRow(row, [
    ['districtCode', ['District Code']],
    ['code', ['Development Block Code', 'Block Code']],
    ['nameEn', ['Development Block Name (In English)', 'Block Name (In English)', 'Block Name']],
    ['nameLocal', ['Development Block Name (In Local)', 'Block Name (In Local)']],
  ]))
  const priBodies = loaded.pri_local_bodies.map((row) => compactRow(row, [
    ['typeCode', ['Localbody Type Code']],
    ['typeName', ['Localbody Type Name']],
    ['code', ['Localbody Code']],
    ['nameEn', ['Localbody Name (In English)']],
    ['nameLocal', ['Localbody Name (In Local)']],
    ['parentCode', ['Parent Localbody Code']],
  ]))
  const blockMappings = loaded.villages_by_blocks.map((row) => compactRow(row, [
    ['subdistrictCode', ['Subdistrict Code', 'Sub-district Code']],
    ['blockCode', ['Development Block Code', 'Block Code']],
  ]))

  const districtByCode = new Map(districtRows.map((entry) => [entry.code, entry]))
  const bodyByCode = new Map(priBodies.map((entry) => [entry.code, entry]))
  const districtBodyByCode = new Map(
    priBodies.filter((entry) => /district/i.test(entry.typeName)).map((entry) => [entry.code, entry])
  )
  const districtCodeByName = new Map(districtRows.map((entry) => [normalizeName(entry.nameEn), entry.code]))

  function districtCodeForBody(body) {
    let current = body
    const visited = new Set()
    while (current && !visited.has(current.code)) {
      visited.add(current.code)
      if (districtBodyByCode.has(current.code)) {
        return districtCodeByName.get(normalizeName(current.nameEn)) ?? ''
      }
      current = bodyByCode.get(current.parentCode)
    }
    return ''
  }

  const localBodiesByDistrictAndName = new Map()
  for (const body of priBodies) {
    if (!isGujarati(body.nameLocal)) continue
    const districtCode = districtCodeForBody(body)
    if (!districtCode) continue
    const key = `${districtCode}:${normalizeName(body.nameEn)}`
    if (!localBodiesByDistrictAndName.has(key)) {
      localBodiesByDistrictAndName.set(key, cleanLocalName(body.nameLocal))
    }
  }

  const blocksByCode = new Map(blocks.map((entry) => [entry.code, entry]))
  const blockCodesBySubdistrict = new Map()
  for (const mapping of blockMappings) {
    if (!mapping.subdistrictCode || !mapping.blockCode || mapping.blockCode === '0') continue
    const current = blockCodesBySubdistrict.get(mapping.subdistrictCode) ?? new Set()
    current.add(mapping.blockCode)
    blockCodesBySubdistrict.set(mapping.subdistrictCode, current)
  }

  const localLabelByDistrictAndName = new Map()
  for (const block of blocks) {
    if (!isGujarati(block.nameLocal)) continue
    localLabelByDistrictAndName.set(
      `${block.districtCode}:${normalizeName(block.nameEn)}`,
      cleanLocalName(block.nameLocal)
    )
  }
  for (const [key, label] of localBodiesByDistrictAndName) {
    if (!localLabelByDistrictAndName.has(key)) localLabelByDistrictAndName.set(key, label)
  }

  function codeLinkedBlockLabel(subdistrict) {
    const codes = [...(blockCodesBySubdistrict.get(subdistrict.code) ?? [])]
    const candidates = codes
      .map((code) => blocksByCode.get(code))
      .filter((block) => block && isGujarati(block.nameLocal))
      .map((block) => {
        const target = normalizeBaseName(subdistrict.nameEn)
        const candidate = normalizeBaseName(block.nameEn)
        const distance = levenshtein(target, candidate)
        const ratio = distance / Math.max(target.length, candidate.length, 1)
        return { block, ratio, exactBase: target === candidate }
      })
      .sort((left, right) => Number(right.exactBase) - Number(left.exactBase) || left.ratio - right.ratio)
    const best = candidates[0]
    if (!best || (!best.exactBase && best.ratio > 0.34)) return null
    return cleanLocalName(best.block.nameLocal)
  }

  function labelForDistrict(district) {
    const districtBody = [...districtBodyByCode.values()].find(
      (body) => normalizeName(body.nameEn) === normalizeName(district.nameEn) && isGujarati(body.nameLocal)
    )
    if (districtBody) return { label: cleanLocalName(districtBody.nameLocal), source: 'lgd-local-name' }

    const local = [...localLabelByDistrictAndName.entries()].find(([key]) => (
      key.endsWith(`:${normalizeName(district.nameEn)}`)
    ))?.[1]
    if (local) return { label: local, source: 'lgd-code-linked-local-name' }
    return { label: transliterateLabel(district.nameEn), source: 'deterministic-transliteration' }
  }

  function labelForSubdistrict(subdistrict) {
    const exact = localLabelByDistrictAndName.get(
      `${subdistrict.districtCode}:${normalizeName(subdistrict.nameEn)}`
    )
    if (exact) return { label: exact, source: 'lgd-local-name' }

    const linked = codeLinkedBlockLabel(subdistrict)
    if (linked) return { label: applyDescriptor(linked, subdistrict.nameEn), source: 'lgd-code-linked-local-name' }

    const base = localLabelByDistrictAndName.get(
      `${subdistrict.districtCode}:${normalizeBaseName(subdistrict.nameEn)}`
    )
    if (base) return { label: applyDescriptor(base, subdistrict.nameEn), source: 'lgd-code-linked-local-name' }

    return { label: transliterateLabel(subdistrict.nameEn), source: 'deterministic-transliteration' }
  }

  const districts = districtRows
    .map((entry) => {
      const localized = labelForDistrict(entry)
      return {
        key: `district:${entry.code}`,
        code: entry.code,
        nameEn: entry.nameEn,
        nameGu: localized.label,
        labelSource: localized.source,
      }
    })
    .sort((left, right) => left.nameEn.localeCompare(right.nameEn, 'en-IN'))

  const subdistricts = subdistrictRows
    .map((entry) => {
      if (!districtByCode.has(entry.districtCode)) {
        throw new Error(`Sub-district ${entry.code} references unknown district ${entry.districtCode}`)
      }
      const localized = labelForSubdistrict(entry)
      return {
        key: `subdistrict:${entry.code}`,
        code: entry.code,
        districtKey: `district:${entry.districtCode}`,
        nameEn: entry.nameEn,
        nameGu: localized.label,
        labelSource: localized.source,
      }
    })
    .sort((left, right) => (
      left.districtKey.localeCompare(right.districtKey) ||
      left.nameEn.localeCompare(right.nameEn, 'en-IN')
    ))

  const uniqueDistricts = uniqueBy(districts, (entry) => entry.key)
  const uniqueSubdistricts = uniqueBy(subdistricts, (entry) => entry.key)
  if (uniqueDistricts.length !== districts.length) throw new Error('Duplicate district LGD keys found')
  if (uniqueSubdistricts.length !== subdistricts.length) throw new Error('Duplicate sub-district LGD keys found')
  if (districts.some((entry) => !entry.nameEn || !entry.nameGu)) throw new Error('Blank district label found')
  if (subdistricts.some((entry) => !entry.nameEn || !entry.nameGu)) throw new Error('Blank sub-district label found')

  writeFileSync(OUTPUT_FILE, generateModule({ districts, subdistricts, sources }), 'utf8')

  const labelSources = (entries) => Object.fromEntries(
    [...entries.reduce((counts, entry) => {
      counts.set(entry.labelSource, (counts.get(entry.labelSource) ?? 0) + 1)
      return counts
    }, new Map())]
  )
  process.stdout.write(`${JSON.stringify({
    output: OUTPUT_FILE,
    snapshotDate: SNAPSHOT_DATE,
    counts: { districts: districts.length, subdistricts: subdistricts.length, blocks: blocks.length },
    districtLabelSources: labelSources(districts),
    subdistrictLabelSources: labelSources(subdistricts),
    sources,
  }, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
