import { describe, expect, it } from 'vitest'
import {
  formatGujaratLocationLabel,
  getGujaratDistrict,
  getGujaratSubdistrict,
  getGujaratSubdistricts,
  GUJARAT_DISTRICTS,
  GUJARAT_LOCATION_SNAPSHOT,
  GUJARAT_SUBDISTRICTS,
  resolveGujaratDistrict,
  resolveGujaratSubdistrict,
} from './gujarat-locations'

const GUJARATI_TEXT = /[\u0A80-\u0AFF]/u

describe('canonical Gujarat locations', () => {
  it('uses the expected LGD snapshot and complete Gujarat counts', () => {
    expect(GUJARAT_LOCATION_SNAPSHOT.date).toBe('2026-05-31')
    expect(GUJARAT_LOCATION_SNAPSHOT.stateCode).toBe('24')
    expect(GUJARAT_DISTRICTS).toHaveLength(34)
    expect(GUJARAT_SUBDISTRICTS).toHaveLength(306)
  })

  it('has unique prefixed LGD keys and valid district relationships', () => {
    const districtKeys = GUJARAT_DISTRICTS.map(({ key }) => key)
    const subdistrictKeys = GUJARAT_SUBDISTRICTS.map(({ key }) => key)
    const knownDistricts = new Set(districtKeys)

    expect(new Set(districtKeys).size).toBe(districtKeys.length)
    expect(new Set(subdistrictKeys).size).toBe(subdistrictKeys.length)
    expect(districtKeys.every((key) => /^district:\d+$/.test(key))).toBe(true)
    expect(subdistrictKeys.every((key) => /^subdistrict:\d+$/.test(key))).toBe(true)
    expect(GUJARAT_SUBDISTRICTS.every(({ districtKey }) => knownDistricts.has(districtKey))).toBe(true)
  })

  it('provides non-empty English and Gujarati labels for every location', () => {
    for (const location of [...GUJARAT_DISTRICTS, ...GUJARAT_SUBDISTRICTS]) {
      expect(location.nameEn.trim()).not.toBe('')
      expect(location.nameGu.trim()).not.toBe('')
      expect(location.nameGu).toMatch(GUJARATI_TEXT)
    }
  })

  it('includes the current Vav-Tharad district and its dependent sub-districts', () => {
    const district = GUJARAT_DISTRICTS.find(({ code }) => code === '789')

    expect(district).toMatchObject({
      key: 'district:789',
      nameEn: 'Vav-Tharad',
      nameGu: 'વાવ-થરાદ',
    })
    expect(getGujaratSubdistricts(district?.key).map(({ nameEn }) => nameEn)).toEqual([
      'Bhabhar',
      'Deodar',
      'Dharnidhar',
      'Lakhani',
      'Raah',
      'Suigam',
      'Tharad',
      'Vav',
    ])
  })

  it('resolves keys, LGD codes, and unambiguous bilingual names', () => {
    expect(getGujaratDistrict('district:438')?.nameEn).toBe('Ahmedabad')
    expect(getGujaratSubdistrict('subdistrict:3780')).toMatchObject({
      districtKey: 'district:438',
      nameEn: 'Sanand',
      nameGu: 'સાણંદ',
    })
    expect(resolveGujaratDistrict('438')?.key).toBe('district:438')
    expect(resolveGujaratDistrict('વાવ-થરાદ')?.key).toBe('district:789')
    expect(resolveGujaratSubdistrict('Sanand', 'district:438')?.key).toBe('subdistrict:3780')
    expect(resolveGujaratSubdistrict('Sanand', 'district:439')).toBeNull()
  })

  it('formats stored canonical keys without exposing raw keys', () => {
    expect(formatGujaratLocationLabel('district:789', 'en')).toBe('Vav-Tharad')
    expect(formatGujaratLocationLabel('district:789', 'gu')).toBe('વાવ-થરાદ')
    expect(formatGujaratLocationLabel('subdistrict:3732')).toBe('વાવ / Vav')
    expect(formatGujaratLocationLabel('legacy free text')).toBe('legacy free text')
  })
})
