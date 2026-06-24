/**
 * OCR Module — Google Cloud Vision API integration
 *
 * Modes:
 *  1. REAL:  Set GOOGLE_CLOUD_CREDENTIALS_BASE64 in .env.local
 *            (base64-encoded service account JSON)
 *     -OR-   Set GOOGLE_APPLICATION_CREDENTIALS to a file path
 *  2. MOCK:  If neither is set, returns realistic mock GR text
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

interface VisionApiResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string }
    textAnnotations?: Array<{ description: string }>
    error?: { code: number; message: string }
  }>
}

// ── Check mode ────────────────────────────────────────────────
export function isOcrMockMode(): boolean {
  return (
    !process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS
  )
}

// ── Get access token from service account ─────────────────────
async function getAccessToken(): Promise<string> {
  let credentials: {
    client_email: string
    private_key: string
    token_uri?: string
  }

  if (process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
    const json = Buffer.from(
      process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      'base64'
    ).toString('utf-8')
    credentials = JSON.parse(json)
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = await import('fs')
    const json = fs.readFileSync(
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      'utf-8'
    )
    credentials = JSON.parse(json)
  } else {
    throw new Error('No Google Cloud credentials configured')
  }

  // Create a self-signed JWT for the Vision API
  // We use the jose library (available via Next.js) to sign JWTs
  const { SignJWT, importPKCS8 } = await import('jose')

  const now = Math.floor(Date.now() / 1000)
  const privateKey = await importPKCS8(credentials.private_key, 'RS256')

  const jwt = await new SignJWT({
    iss: credentials.client_email,
    sub: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey)

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Token exchange failed: ${errText}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

// ── Call Vision API ───────────────────────────────────────────
async function callVisionApi(imageBuffer: Buffer): Promise<string> {
  const accessToken = await getAccessToken()
  const base64Image = imageBuffer.toString('base64')

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  }

  const res = await fetch(
    'https://vision.googleapis.com/v1/images:annotate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Vision API returned ${res.status}: ${errText}`)
  }

  const data: VisionApiResponse = await res.json()
  const response = data.responses[0]

  if (response.error) {
    throw new Error(
      `Vision API error: ${response.error.message} (code ${response.error.code})`
    )
  }

  // fullTextAnnotation has the best structured result
  if (response.fullTextAnnotation?.text) {
    return response.fullTextAnnotation.text
  }

  // Fallback to first textAnnotation (full page text)
  if (response.textAnnotations?.[0]?.description) {
    return response.textAnnotations[0].description
  }

  return '(No text detected in image)'
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
    const text = await callVisionApi(imageBuffer)
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
