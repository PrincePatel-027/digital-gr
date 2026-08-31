import type { ParsedGRFields } from './ocr-parser'
import type { VoiceGroupDefinition, VoiceGroupId } from './voice-types'

export const VOICE_FIELD_GROUPS = {
  identity: {
    id: 'identity',
    title: 'Identity',
    shortTitle: 'Identity',
    description: 'Register number and the student’s family names.',
    example: 'GR number 1247. Student Jagdish Dixit. Father Ramesh. Mother Sushila.',
    fields: ['gr_number', 'student_name', 'fathers_name', 'mothers_name', 'surname'],
    skippable: false,
  },
  'birth-community': {
    id: 'birth-community',
    title: 'Birth & community',
    shortTitle: 'Birth',
    description: 'Birth date and words, birthplace, community, and address.',
    example: 'Born sixth January two thousand sixteen in Vadodara. Hindu Patel. Address Sayajipura.',
    fields: ['date_of_birth', 'dob_in_words', 'birth_place', 'religion', 'caste_category', 'address'],
    skippable: false,
  },
  admission: {
    id: 'admission',
    title: 'Admission',
    shortTitle: 'Admission',
    description: 'Admission date, entering standard, and previous school.',
    example: 'Admitted tenth June two thousand twenty two in standard one, from Sunrise Primary School.',
    fields: ['admission_date', 'admission_standard', 'previous_school'],
    skippable: false,
  },
  'leaving-notes': {
    id: 'leaving-notes',
    title: 'Leaving & notes',
    shortTitle: 'Leaving',
    description: 'Leaving details, conduct, and remarks. Skip this for a new admission.',
    example: 'Left thirty first March two thousand twenty six from standard five due to transfer. Conduct good.',
    fields: ['leaving_date', 'leaving_standard', 'leaving_reason', 'progress_and_conduct', 'remarks'],
    skippable: true,
  },
} as const satisfies Record<VoiceGroupId, VoiceGroupDefinition>

export const VOICE_GROUP_ORDER: readonly VoiceGroupId[] = [
  'identity',
  'birth-community',
  'admission',
  'leaving-notes',
]

export const VOICE_FIELD_LABELS: Record<keyof ParsedGRFields, string> = {
  gr_number: 'GR number',
  student_name: 'Student name',
  fathers_name: 'Father’s name',
  mothers_name: 'Mother’s name',
  surname: 'Surname',
  religion: 'Religion',
  caste_category: 'Caste / category',
  date_of_birth: 'Date of birth',
  dob_in_words: 'DOB in words',
  birth_place: 'Birth place',
  address: 'Address / village',
  previous_school: 'Previous school',
  admission_date: 'Admission date',
  admission_standard: 'Admission standard',
  progress_and_conduct: 'Progress & conduct',
  leaving_date: 'Leaving date',
  leaving_reason: 'Leaving reason',
  leaving_standard: 'Leaving standard',
  remarks: 'Remarks',
}

const UNIT_WORDS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}

const SMALL_NUMBER_WORDS: Record<string, number> = {
  ...UNIT_WORDS,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

const TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

function tokensOf(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token !== 'and')
}

function parseNumberTokens(tokens: readonly string[]): number | null {
  if (tokens.length === 0) return null

  if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
    return Number(tokens[0])
  }

  // Dictated identifiers are commonly spoken one digit at a time: "one two four
  // seven" means 1247, not fourteen. Cardinal phrases still use the normal parser.
  if (tokens.length > 1 && tokens.every((token) => token in UNIT_WORDS || /^\d$/.test(token))) {
    return Number(tokens.map((token) => /^\d$/.test(token) ? token : UNIT_WORDS[token]).join(''))
  }

  let total = 0
  let current = 0
  let sawNumber = false

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      current += Number(token)
      sawNumber = true
      continue
    }
    if (token in SMALL_NUMBER_WORDS) {
      current += SMALL_NUMBER_WORDS[token]
      sawNumber = true
      continue
    }
    if (token in TENS_WORDS) {
      current += TENS_WORDS[token]
      sawNumber = true
      continue
    }
    if (token in ORDINAL_WORDS) {
      current += ORDINAL_WORDS[token]
      sawNumber = true
      continue
    }
    if (token === 'hundred') {
      current = (current || 1) * 100
      sawNumber = true
      continue
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000
      current = 0
      sawNumber = true
      continue
    }
    if (token === 'million') {
      total += (current || 1) * 1_000_000
      current = 0
      sawNumber = true
      continue
    }
    return null
  }

  return sawNumber ? total + current : null
}

/** Convert a cardinal/ordinal English number phrase or digit sequence to digits. */
export function normalizeSpokenNumber(input: string): string | null {
  const parsed = parseNumberTokens(tokensOf(input))
  return parsed === null || !Number.isSafeInteger(parsed) || parsed < 0 ? null : String(parsed)
}

/** Extract and validate a GR standard/class, returning only 1–12. */
export function normalizeSpokenStandard(input: string): string | null {
  const stripped = input.replace(/\b(?:standard|std|class|grade)\b/gi, ' ')
  const parsed = parseNumberTokens(tokensOf(stripped))
  return parsed !== null && parsed >= 1 && parsed <= 12 ? String(parsed) : null
}

function parseYear(tokens: readonly string[]): number | null {
  if (tokens.length === 1 && /^\d{4}$/.test(tokens[0])) return Number(tokens[0])

  const hasScale = tokens.some((token) => token === 'hundred' || token === 'thousand')
  if (hasScale) {
    const year = parseNumberTokens(tokens)
    return year !== null && year >= 1000 && year <= 9999 ? year : null
  }

  // Years are often spoken as two pairs: "twenty sixteen" or
  // "nineteen ninety nine". Try every split and accept a four-digit year.
  for (let split = 1; split < tokens.length; split += 1) {
    const century = parseNumberTokens(tokens.slice(0, split))
    const remainder = parseNumberTokens(tokens.slice(split))
    if (century !== null && century >= 10 && century <= 99 && remainder !== null && remainder <= 99) {
      const year = century * 100 + remainder
      if (year >= 1000 && year <= 9999) return year
    }
  }

  const whole = parseNumberTokens(tokens)
  return whole !== null && whole >= 1000 && whole <= 9999 ? whole : null
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const value = new Date(Date.UTC(year, month - 1, day))
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!isRealDate(year, month, day)) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parse English spoken dates as day-first Indian dates. Month names and numeric
 * months are accepted; ambiguous numeric speech always treats the first value as
 * the day ("six one twenty sixteen" → 2016-01-06).
 */
export function normalizeSpokenDate(input: string): string | null {
  const tokens = tokensOf(input).filter((token) => token !== 'the' && token !== 'of')
  if (tokens.length < 3) return null

  const namedMonthIndex = tokens.findIndex((token) => token in MONTHS)
  if (namedMonthIndex > 0 && namedMonthIndex < tokens.length - 1) {
    const day = parseNumberTokens(tokens.slice(0, namedMonthIndex))
    const year = parseYear(tokens.slice(namedMonthIndex + 1))
    if (day === null || year === null) return null
    return isoDate(year, MONTHS[tokens[namedMonthIndex]], day)
  }

  // No named month: find a day/month/year split, preserving day-first order.
  for (let dayEnd = 1; dayEnd <= tokens.length - 2; dayEnd += 1) {
    const day = parseNumberTokens(tokens.slice(0, dayEnd))
    if (day === null || day < 1 || day > 31) continue

    for (let monthEnd = dayEnd + 1; monthEnd <= tokens.length - 1; monthEnd += 1) {
      const month = parseNumberTokens(tokens.slice(dayEnd, monthEnd))
      const year = parseYear(tokens.slice(monthEnd))
      if (month === null || month < 1 || month > 12 || year === null) continue
      const result = isoDate(year, month, day)
      if (result) return result
    }
  }

  return null
}

export interface SplitSpokenName {
  student_name: string
  fathers_name?: string
  surname?: string
}

/**
 * Split the register's spoken full-name order: given [father] surname. A two-token
 * name has no inferred father; a one-token name remains just the given name.
 * Original Latin spelling/case is preserved and no transliteration is performed.
 */
export function splitSpokenFullName(input: string): SplitSpokenName | null {
  const parts = input.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { student_name: parts[0] }
  if (parts.length === 2) return { student_name: parts[0], surname: parts[1] }
  return {
    student_name: parts[0],
    fathers_name: parts.slice(1, -1).join(' '),
    surname: parts[parts.length - 1],
  }
}

export function isVoiceGroupId(value: string): value is VoiceGroupId {
  return Object.prototype.hasOwnProperty.call(VOICE_FIELD_GROUPS, value)
}

export function fieldsForVoiceGroup(group: VoiceGroupId): readonly (keyof ParsedGRFields)[] {
  return VOICE_FIELD_GROUPS[group].fields
}
