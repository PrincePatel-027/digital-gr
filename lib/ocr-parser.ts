/**
 * OCR Parser — Extract structured GR fields from raw OCR text
 *
 * Supports English, Hindi (हिंदी), and Gujarati (ગુજરાતી) field labels.
 * Each field returns a value + confidence level.
 */

export interface ParsedField {
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ParsedGRFields {
  gr_number?: ParsedField
  student_name?: ParsedField
  fathers_name?: ParsedField
  mothers_name?: ParsedField
  surname?: ParsedField
  date_of_birth?: ParsedField
  admission_date?: ParsedField
  address?: ParsedField
  caste_category?: ParsedField
  previous_school?: ParsedField
}

// ── Date helpers ──────────────────────────────────────────────
const DATE_PATTERN = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g

function normalizeDate(match: string): string {
  const parts = match.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!parts) return ''

  let [, dd, mm, yyyy] = parts
  // Handle 2-digit year
  if (yyyy.length === 2) {
    const num = parseInt(yyyy)
    yyyy = num > 50 ? `19${yyyy}` : `20${yyyy}`
  }
  // Pad day/month
  dd = dd.padStart(2, '0')
  mm = mm.padStart(2, '0')
  // Return as YYYY-MM-DD for HTML date input
  return `${yyyy}-${mm}-${dd}`
}

// ── Field extraction patterns ─────────────────────────────────
// Each pattern group: [regex, confidence_boost]
// We try multiple patterns per field and pick the best match

interface FieldPattern {
  keywords: RegExp
  extractor: (text: string, keywordMatch: RegExpMatchArray) => string
}

function extractAfterKeyword(text: string, match: RegExpMatchArray): string {
  const idx = match.index! + match[0].length
  const rest = text.slice(idx)
  
  // Stop at newline or tab (leading space/colon is optional)
  const lineMatch = rest.match(/^[\s:：\-—–]*([^\t\r\n]+)/)
  if (!lineMatch) return ''
  
  let value = lineMatch[1].trim()
  
  // If OCR merged columns without tabs, stop if we hit another field label
  const nextLabelIdx = value.search(/(?:\b(?:Student|Father's|Mother's|Surname|Date of Birth|DOB|Admission|Address|Previous|Caste|Category|GR|Name)\b|पिता|माता|नाम|पता|जन्म|जाति)/i)
  
  if (nextLabelIdx > 2) { // only cut if the label isn't part of the current word
    value = value.substring(0, nextLabelIdx).trim()
  }
  
  return value
}

function extractDateNearKeyword(text: string, match: RegExpMatchArray): string {
  // Look for a date within ~80 chars of the keyword
  const start = Math.max(0, match.index! - 20)
  const end = Math.min(text.length, match.index! + match[0].length + 80)
  const region = text.slice(start, end)
  
  const dateMatch = region.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  return dateMatch ? normalizeDate(dateMatch[0]) : ''
}

// ── Field definitions ─────────────────────────────────────────

const FIELD_PATTERNS: Record<keyof ParsedGRFields, FieldPattern[]> = {
  gr_number: [
    {
      keywords: /(?:GR\s*(?:No|Number|क्रमांक|નંબર)\.?|प्रवेश\s*क्रमांक|Sr\.?\s*No\.?|क्र\.?\s*सं\.?)/i,
      extractor: (text, match) => {
        const after = extractAfterKeyword(text, match)
        // Extract just the number/ID part
        const numMatch = after.match(/^[#:]?\s*([A-Z]*\-?\d+[\w\-]*)/i)
        return numMatch ? numMatch[1].trim() : after.split(/\s/)[0] || ''
      },
    },
  ],

  student_name: [
    {
      keywords: /(?:Student\s*(?:Full\s*)?Name|विद्यार्थी\s*(?:का|की)\s*नाम|નામ|Name\s*(?:of\s*(?:Student|Pupil))?)\s*(?![:\s]*(?:Father|Mother|पिता|माता|પિતા|માતા))/i,
      extractor: extractAfterKeyword,
    },
    {
      // Fallback: "नाम:" at start of line
      keywords: /^(?:नाम|Name)\s*[:：]/im,
      extractor: extractAfterKeyword,
    },
  ],

  fathers_name: [
    {
      keywords: /(?:Father'?s?\s*(?:Full\s*)?Name|पिता\s*(?:का\s*नाम|जी)?|પિતા(?:નું\s*નામ)?|पिताजी)/i,
      extractor: extractAfterKeyword,
    },
  ],

  mothers_name: [
    {
      keywords: /(?:Mother'?s?\s*(?:Full\s*)?Name|माता\s*(?:का\s*नाम|जी)?|માતા(?:નું\s*નામ)?|माताजी)/i,
      extractor: extractAfterKeyword,
    },
  ],

  surname: [
    {
      keywords: /(?:Surname|उपनाम|अटक|અટક|Family\s*Name)/i,
      extractor: extractAfterKeyword,
    },
  ],

  date_of_birth: [
    {
      keywords: /(?:Date\s*of\s*Birth|DOB|जन्म\s*(?:तारीख|तिथि|दिनांक)|જન્મ\s*તારીખ)/i,
      extractor: extractDateNearKeyword,
    },
  ],

  admission_date: [
    {
      keywords: /(?:Date\s*of\s*Admission|Admission\s*(?:Date)?|प्रवेश\s*(?:तारीख|दिनांक)|પ્રવેશ\s*(?:તારીખ|દિનાંક))/i,
      extractor: extractDateNearKeyword,
    },
  ],

  address: [
    {
      keywords: /(?:(?:Residential\s*)?Address|पता|સરનામું)/i,
      extractor: (text, match) => {
        const idx = match.index! + match[0].length
        const rest = text.slice(idx).replace(/^[\s:：\-—–]+/, '')
        
        // Split by lines and take until we hit a line that looks like another field label
        const lines = rest.split(/\r?\n/)
        let addressLines = []
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          // If this line starts with or contains another field label, stop!
          if (line.match(/^(?:Student|Father's|Mother's|Surname|Date of Birth|DOB|Admission|Previous|Caste|Category|GR Number|Name|Signatures|Admin Entries)\b/i)) {
            break
          }
          
          // Stop if the line has tabs and the left side of the tab is a label
          if (line.includes('\t') && line.split('\t')[0].match(/(?:Student|Father's|Mother's|Surname|Date of Birth|DOB|Admission|Previous|Caste|Category|GR Number|Name)/i)) {
             break
          }

          addressLines.push(line.replace(/\t/g, ' ').trim())
          
          // Stop if it gets too long (addresses are usually <= 4 lines)
          if (addressLines.length >= 4) break
        }
        
        return addressLines.join(' ')
      },
    },
  ],

  caste_category: [
    {
      keywords: /(?:Caste\s*(?:Category|\/\s*Category)?|Category|जाति\s*(?:\/\s*वर्ग)?|વર્ગ|જાતિ)/i,
      extractor: extractAfterKeyword,
    },
  ],

  previous_school: [
    {
      keywords: /(?:Previous\s*School|पूर्व\s*(?:शाला|विद्यालय)|અગાઉની\s*શાળા)/i,
      extractor: extractAfterKeyword,
    },
  ],
}

// ── Main parser ───────────────────────────────────────────────
export function parseGRFields(rawText: string): ParsedGRFields {
  if (!rawText || rawText.trim().length < 10) return {}

  const result: ParsedGRFields = {}
  const fieldKeys = Object.keys(FIELD_PATTERNS) as (keyof ParsedGRFields)[]

  for (const field of fieldKeys) {
    const patterns = FIELD_PATTERNS[field]

    for (const pattern of patterns) {
      const match = rawText.match(pattern.keywords)
      if (!match) continue

      const value = pattern.extractor(rawText, match)
      if (!value || value.length < 1) continue

      // Determine confidence based on value quality
      let confidence: 'high' | 'medium' | 'low' = 'medium'

      if (field === 'date_of_birth' || field === 'admission_date') {
        // Dates that parse correctly are high confidence
        confidence = value.match(/^\d{4}-\d{2}-\d{2}$/) ? 'high' : 'low'
      } else if (field === 'gr_number') {
        confidence = value.match(/^\d+$/) ? 'high' : 'medium'
      } else {
        // Longer text values with proper words → higher confidence
        confidence = value.length > 3 ? 'high' : 'low'
      }

      result[field] = { value, confidence }
      break // Use first matching pattern
    }
  }

  return result
}

// ── Utility: count filled fields ─────────────────────────────
export function countParsedFields(parsed: ParsedGRFields): {
  total: number
  high: number
  medium: number
  low: number
} {
  const fields = Object.values(parsed).filter(Boolean)
  return {
    total: fields.length,
    high: fields.filter((f) => f!.confidence === 'high').length,
    medium: fields.filter((f) => f!.confidence === 'medium').length,
    low: fields.filter((f) => f!.confidence === 'low').length,
  }
}
