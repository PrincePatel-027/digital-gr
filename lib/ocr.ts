/**
 * OCR Module — OCR.space API integration (FREE, no billing required)
 *
 * Modes:
 *  1. REAL:  Set OCR_SPACE_API_KEY in .env.local
 *  2. MOCK:  If not set, returns realistic mock GR text
 *
 * OCR.space free tier: 25,000 requests/month
 * Supports: English, Hindi, Gujarati, and 20+ languages
 *
 * Usage:
 *   import { extractText, isOcrMockMode } from '@/lib/ocr'
 *   const { text, mode } = await extractText(imageBuffer)
 */

// ── Types ─────────────────────────────────────────────────────
export interface OcrResult {
  text: string
  mode: 'real' | 'mock'
  confidence?: number
  error?: string
}

// ── Check mode ────────────────────────────────────────────────
export function isOcrMockMode(): boolean {
  return !process.env.OCR_SPACE_API_KEY
}

// ── Call OCR.space API ────────────────────────────────────────
async function callOcrSpace(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) throw new Error('OCR_SPACE_API_KEY not configured')

  const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

  // ── Pass 1: Gujarati + English with Engine 1 ──────────────
  // Engine 1 supports 25+ languages including Gujarati (guj) and Hindi (hin).
  // It automatically picks up English characters in the same document.
  const gujaratiResult = await ocrSpaceRequest(apiKey, base64Image, {
    language: 'guj',    // Gujarati — also reads English in the same image
    engine: '1',
  })

  // ── Pass 2: English-only with Engine 2 (better for handwriting) ──
  const englishResult = await ocrSpaceRequest(apiKey, base64Image, {
    language: 'eng',
    engine: '2',        // Engine 2 is better for handwritten Latin text
  })

  // Merge: use whichever returned more text, show both if significantly different
  const gujText = gujaratiResult.trim()
  const engText = englishResult.trim()

  if (!gujText && !engText) return '(No text detected in image)'
  if (!gujText) return engText
  if (!engText) return gujText

  // If both have results, combine them for maximum coverage
  if (gujText.length > engText.length * 1.3) {
    // Gujarati pass got significantly more — it's likely a Gujarati-heavy document
    return gujText
  } else if (engText.length > gujText.length * 1.3) {
    // English pass got significantly more — it's likely an English-heavy document
    return engText
  }

  // Similar length — combine both with a separator
  return `── Gujarati/Hindi OCR ──\n${gujText}\n\n── English OCR ──\n${engText}`
}

// ── Single OCR.space request helper ───────────────────────────
async function ocrSpaceRequest(
  apiKey: string,
  base64Image: string,
  opts: { language: string; engine: string }
): Promise<string> {
  const formData = new URLSearchParams()
  formData.append('apikey', apiKey)
  formData.append('base64Image', base64Image)
  formData.append('language', opts.language)
  formData.append('isOverlayRequired', 'false')
  formData.append('detectOrientation', 'true')
  formData.append('scale', 'true')
  formData.append('OCREngine', opts.engine)

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OCR.space returned ${res.status}: ${errText}`)
  }

  const data = await res.json()

  if (data.IsErroredOnProcessing) {
    console.warn(`OCR.space error (${opts.language}/${opts.engine}):`, data.ErrorMessage)
    return ''
  }

  const parsedResults = data.ParsedResults || []
  return parsedResults
    .map((r: { ParsedText?: string }) => r.ParsedText || '')
    .join('\n')
    .trim()
}

// ── Mock OCR ──────────────────────────────────────────────────
function generateMockOcrText(): string {
  // Simulates what OCR output from a handwritten GR register looks like
  const mockTexts = [
    `प्रवेश क्रमांक : 1247
विद्यार्थी का नाम : राहुल कुमार
पिता का नाम : श्री सुरेश कुमार पटेल
माता का नाम : श्रीमती सुनीता बेन
उपनाम (Surname) : पटेल
जन्म तारीख : 15/03/2015
प्रवेश तारीख : 01/06/2021
पता : 45, गांधी नगर, मेहसाणा, गुजरात
जाति / वर्ग : General (OBC)
पूर्व शाला : प्राथमिक शाला नं. 3, मेहसाणा

--- Raw OCR Notes ---
GR No. 1247
Name: Rahul Kumar
Father: Suresh Kumar Patel
Mother: Sunita Ben
Surname: Patel
DOB: 15-03-2015
Admission: 01-06-2021
Address: 45, Gandhi Nagar, Mehsana, Gujarat
Caste: OBC
Previous School: Primary School No. 3, Mehsana`,

    `General Register Entry
Sr. No / GR Number: 0853
Student Full Name: Priya Rajeshbhai Sharma
Father's Name: Shri Rajesh Ramanlal Sharma
Mother's Name: Smt. Meena Ben Sharma
Surname: Sharma
Date of Birth: 22/07/2014
Date of Admission: 15/06/2020
Residential Address: 12-B, Sardar Patel
Colony, Ahmedabad - 380015
Caste Category: SC
Previous School: Nutan Primary Vidyalaya, Maninagar

[Handwriting artifacts: some words partially illegible]
Possible alt readings:
- "Rajeshbhai" could be "Rajeshkumar"
- Address number might be 12-B or 128`,

    `क्र.सं. / GR No.: 0456
नाम: अमित विजयभाई मकवाणा
पिताजी: श्री विजय प्रकाश मकवाणा
माताजी: कमला बेन
अटक: मकवाणा
जन्म तिथि: 08.11.2013
प्रवेश दिनांक: 10.06.2019
पता: गामडा रोड, पाटण
जाति: ST
पूर्व विद्यालय: ---

[OCR Confidence: medium-low, handwriting faded in places]`,
  ]

  return mockTexts[Math.floor(Math.random() * mockTexts.length)]
}

// ── Main export ───────────────────────────────────────────────
export async function extractText(imageBuffer: Buffer): Promise<OcrResult> {
  if (isOcrMockMode()) {
    return {
      text: generateMockOcrText(),
      mode: 'mock',
    }
  }

  try {
    const text = await callOcrSpace(imageBuffer)
    return { text, mode: 'real' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      text: '',
      mode: 'real',
      error: `OCR failed: ${message}`,
    }
  }
}
