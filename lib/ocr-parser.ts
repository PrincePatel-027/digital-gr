/**
 * OCR Parser — Extract structured GR fields from tabular raw OCR text
 *
 * Designed for Manekrao Prathmik Shala register format where each ROW
 * is a different student. Handles fragmented OCR.space Engine 3 output
 * by grouping lines into student blocks.
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
  religion?: ParsedField
  caste_category?: ParsedField
  date_of_birth?: ParsedField
  dob_in_words?: ParsedField
  birth_place?: ParsedField
  address?: ParsedField
  previous_school?: ParsedField
  admission_date?: ParsedField
  admission_standard?: ParsedField
  progress_and_conduct?: ParsedField
  leaving_date?: ParsedField
  leaving_reason?: ParsedField
  leaving_standard?: ParsedField
  remarks?: ParsedField
}

// ── Indic numeral conversion ───────────────────────────────
const INDIC_DIGITS: Record<string, string> = {
  // Gujarati
  '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4',
  '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
  // Hindi / Devanagari (OCR engine 3 sometimes outputs Hindi)
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  // Common OCR typos
  '<': '8', 
}

function convertIndicNumerals(str: string): string {
  return str.replace(/[૦-૯०-९<]/g, (ch) => INDIC_DIGITS[ch] || ch)
}

// ── Date helpers ──────────────────────────────────────────────
function normalizeDate(match: string): string {
  const parts = match.match(/(\d{1,2})[\/\-.|<](\d{1,2})[\/\-.|<](\d{2,4})/)
  if (!parts) return ''

  let [, dd, mm, yyyy] = parts
  if (yyyy.length === 2) {
    // All these registers are from the 1900s, force 2 digit years to 19xx
    yyyy = `19${yyyy}`
  }
  dd = dd.padStart(2, '0')
  mm = mm.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isValidRecord(record: ParsedGRFields): boolean {
  // A valid student row MUST have a name and at least one date.
  // This strict requirement filters out noise from the English OCR pass and scattered numbers.
  const hasName = !!record.student_name
  const hasDate = !!(record.date_of_birth || record.admission_date || record.leaving_date)

  // Filter out the "નમુનો" (Format/Sample) header which OCR misreads as a student
  if (record.student_name?.value === 'નમુનો' || record.student_name?.value === 'नमुनो') {
    return false
  }

  return hasName && hasDate
}

// ── Tabular Parser (Block grouping) ───────────────────────────

export function parseGRTable(rawText: string): ParsedGRFields[] {
  if (!rawText || rawText.trim().length < 10) return []

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const results: ParsedGRFields[] = []

  let currentRecord: ParsedGRFields | null = null
  let currentBlockText = ''
  let lastGrNumber: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Aggressively skip header rows
    if (line.match(/(?:વિદ્યાર્થી|નામ|તારીખ|ધોરણ|જન્મ|ધર્મ|શાળા|સરનામું|Name|Date|Std|પત્રક|મુખ્ય|વિગતો|પિતા|માતા|પ્રગતિ|વર્તન)/i)) {
      continue
    }

    const latinLine = convertIndicNumerals(line)
    
    // Detect start of a new student record
    // Relaxed logic using sequential anchor heuristics
    // Allow leading punctuation (like |) and trailing punctuation (like .)
    const numMatch = latinLine.match(/^[^a-zA-Z\d]*(\d{1,4})[\s.\-)]*(.*)$/)
    let isNewStudent = false
    
    if (numMatch) {
       const numStr = numMatch[1]
       const num = parseInt(numStr, 10)
       const restOfLine = numMatch[2] || ''

       const hasLetters = !!restOfLine.match(/[a-zA-Z\u0A80-\u0AFF\u0900-\u097F]/)
       const hasDates = !!restOfLine.match(/\b\d{1,2}[\/\-.|<]\d{1,2}/)

       const currentGrNum = parseInt(currentRecord?.gr_number?.value || '0', 10)
       const effectiveLastGr = currentGrNum || lastGrNumber

       // Condition A: Number followed by letters, no dates (Typical GR + Name)
       if (hasLetters && !hasDates) {
           isNewStudent = true
       }
       // Condition B: Number is on its own line, next line is letters
       else if (!restOfLine && i + 1 < lines.length) {
           const nextLatin = convertIndicNumerals(lines[i+1])
           if (nextLatin.match(/^[a-zA-Z\u0A80-\u0AFF\u0900-\u097F]{2,}/)) {
               isNewStudent = true
           }
       }
       // Condition C: Number is part of a sequence (GR n+1 to n+5)
       else if (effectiveLastGr && num > effectiveLastGr && num <= effectiveLastGr + 5) {
           isNewStudent = true
       }
       // Condition D: English Engine 2 tab separated
       else if (line.includes('\t') && hasDates) {
           isNewStudent = true
       }
    }

    if (isNewStudent) {
      // Save the previous student block
      if (currentRecord) {
        extractFromBlock(currentRecord, currentBlockText)
        if (isValidRecord(currentRecord)) {
           results.push(currentRecord)
           lastGrNumber = parseInt(currentRecord.gr_number?.value || '0', 10) || lastGrNumber
        }
      }
      
      // Start new student block
      currentRecord = {}
      currentBlockText = line + ' '
      
      const m = latinLine.match(/^(\d{1,4})\b/)
      if (m) {
         currentRecord.gr_number = { value: m[1], confidence: 'high' }
      }
    } else if (currentRecord) {
      // Append line to current student's block
      currentBlockText += line + ' '
    }
  }

  // Save the final student block
  if (currentRecord) {
    extractFromBlock(currentRecord, currentBlockText)
    if (isValidRecord(currentRecord)) {
       results.push(currentRecord)
    }
  }

  return results
}

function extractFromBlock(record: ParsedGRFields, blockText: string) {
    const latinText = convertIndicNumerals(blockText)
    
    // 1. Dates
    const dates = latinText.match(/\b(\d{1,2}[\/\-.|<]\d{1,2}[\/\-.|<]\d{2,4})\b/g)
    if (dates) {
       if (dates[0]) record.date_of_birth = { value: normalizeDate(dates[0]), confidence: 'high' }
       if (dates[1]) record.admission_date = { value: normalizeDate(dates[1]), confidence: 'high' }
       if (dates[2]) record.leaving_date = { value: normalizeDate(dates[2]), confidence: 'high' }
    }

    // 2. Name Extraction
    // Filter out numbers and dates, get consecutive text words
    const words = blockText.split(/\s+/)
      .filter(w => w.match(/[\u0A80-\u0AFF\u0900-\u097F]/) && w.length >= 2)
      .filter(w => !w.match(/(હિંદુ|મુસલમાન|મુસ્લિમ|ખ્રિસ્તી|પટેલ|રજપૂત|વાણિયા|હરિજન|ઠાકોર|બ્રાહ્મણ)/)) // Remove known non-name keywords
    
    if (words.length >= 1) record.student_name = { value: words[0], confidence: 'medium' }
    if (words.length >= 2) record.fathers_name = { value: words[1], confidence: 'medium' }
    if (words.length >= 3) record.surname = { value: words[2], confidence: 'low' }

    // 3. Religion/Caste
    if (blockText.match(/(હિંદુ|મુસલમાન|મુસ્લિમ|ખ્રિસ્તી|Hindu|Muslim|Christian)/i)) {
      const relMatch = blockText.match(/(હિંદુ|મુસલમાન|મુસ્લિમ|ખ્રિસ્તી|Hindu|Muslim|Christian)/i)
      if (relMatch) record.religion = { value: relMatch[1], confidence: 'high' }
    }
    if (blockText.match(/(પટેલ|રજપૂત|વાણિયા|હરિજન|ઠાકોર|બ્રાહ્મણ|Patel|Rajput|Thakor)/i)) {
      const casteMatch = blockText.match(/(પટેલ|રજપૂત|વાણિયા|હરિજન|ઠાકોર|બ્રાહ્મણ|Patel|Rajput|Thakor)/i)
      if (casteMatch) record.caste_category = { value: casteMatch[1], confidence: 'medium' }
    }

    // 4. Standard
    const stdMatch = latinText.match(/(?:ધો\.?\s*|ધોરણ\s*)?([1-9IVXivx]{1,2})\b/)
    if (stdMatch && stdMatch[1] !== record.gr_number?.value) {
       record.admission_standard = { value: stdMatch[1], confidence: 'medium' }
    }

    // 5. Leaving Reason & Remarks
    // Detect keywords related to leaving the school or removal from register
    if (blockText.match(/(નામ કમી|કમી|ગેરહાજરી|ગેરહાજર|જવાથી|નામનેમી)/i)) {
      const reasonMatch = blockText.match(/(?:નામ કમી|કમી|ગેરહાજરી|ગેરહાજર|જવાથી|નામનેમી).{0,15}/i)
      if (reasonMatch) record.leaving_reason = { value: reasonMatch[0].trim(), confidence: 'medium' }
    }

    // 6. Progress and Conduct
    if (blockText.match(/(પાસ|નાપાસ|નપાસ|સારું|ખરાબ|સંતોષકારક)/i)) {
      const progMatch = blockText.match(/(?:પાસ|નાપાસ|નપાસ|સારું|ખરાબ|સંતોષકારક).{0,15}/i)
      if (progMatch) record.progress_and_conduct = { value: progMatch[0].trim(), confidence: 'medium' }
    }
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
