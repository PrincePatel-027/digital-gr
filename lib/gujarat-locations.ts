/**
 * GENERATED FILE — run `node scripts/generate-gujarat-locations.mjs` to refresh.
 *
 * Identity, hierarchy, and English names are from the Government of India Local
 * Government Directory (LGD) 2026-05-31 snapshot. Gujarati labels prefer
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

export const GUJARAT_LOCATION_SNAPSHOT = {
  "date": "2026-05-31",
  "stateCode": "24",
  "sources": {
    "districts": {
      "url": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/districts.May2026.7z",
      "member": "districts.31May2026.csv",
      "sha256": "1c03d384c7beb1c82aaa501b79f0f2be7199c16fc90782bf5387c5a1b35f41e2"
    },
    "subdistricts": {
      "url": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/subdistricts.May2026.7z",
      "member": "subdistricts.31May2026.csv",
      "sha256": "9ee7fc0e331173f2fc1d8094483cb2569b71243d7da442f4240c7089e0a2cc73"
    },
    "blocks": {
      "url": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/blocks.May2026.7z",
      "member": "blocks.31May2026.csv",
      "sha256": "5ff72458aeba3debc8a87f4ef338f7b1d7f268a306a4c1651f95e9533bed768f"
    },
    "pri_local_bodies": {
      "url": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/pri_local_bodies.May2026.7z",
      "member": "pri_local_bodies.31May2026.csv",
      "sha256": "49b8a035a40afe48ffae4af13bff9a1464d191292d269974865c78652a29f4a9"
    },
    "villages_by_blocks": {
      "url": "https://github.com/ramSeraph/opendata/releases/download/lgd-archive-extra1/villages_by_blocks.May2026.7z",
      "member": "villages_by_blocks.31May2026.csv",
      "sha256": "4eef76ed2d46dc7d0a11261c3e684092aa15562bf77a572e3a933452e78c9e71"
    }
  }
} as const

export const GUJARAT_DISTRICTS = [
  {
    "key": "district:438",
    "code": "438",
    "nameEn": "Ahmedabad",
    "nameGu": "અહ્મેદબદ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "district:439",
    "code": "439",
    "nameEn": "Amreli",
    "nameGu": "અમરેલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:440",
    "code": "440",
    "nameEn": "Anand",
    "nameGu": "આણંદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:672",
    "code": "672",
    "nameEn": "Arvalli",
    "nameGu": "અરવલ્લી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:441",
    "code": "441",
    "nameEn": "Banas Kantha",
    "nameGu": "બનાસકાંઠા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:442",
    "code": "442",
    "nameEn": "Bharuch",
    "nameGu": "ભરૂચ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:443",
    "code": "443",
    "nameEn": "Bhavnagar",
    "nameGu": "ભાવનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:676",
    "code": "676",
    "nameEn": "Botad",
    "nameGu": "બોટાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:668",
    "code": "668",
    "nameEn": "Chhotaudepur",
    "nameGu": "છોપઉદેપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:445",
    "code": "445",
    "nameEn": "Dahod",
    "nameGu": "દાહોદ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "district:444",
    "code": "444",
    "nameEn": "Dangs",
    "nameGu": "દઙ્સ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "district:674",
    "code": "674",
    "nameEn": "Devbhumi Dwarka",
    "nameGu": "દેવભૂમિ દ્વારકા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:446",
    "code": "446",
    "nameEn": "Gandhinagar",
    "nameGu": "ગાંધીનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:675",
    "code": "675",
    "nameEn": "Gir Somnath",
    "nameGu": "ગીર સોમનાથ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:447",
    "code": "447",
    "nameEn": "Jamnagar",
    "nameGu": "જામનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:448",
    "code": "448",
    "nameEn": "Junagadh",
    "nameGu": "જુનાગઢ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:449",
    "code": "449",
    "nameEn": "Kachchh",
    "nameGu": "કચ્છ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:450",
    "code": "450",
    "nameEn": "Kheda",
    "nameGu": "ખેડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:451",
    "code": "451",
    "nameEn": "Mahesana",
    "nameGu": "મહેસાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:669",
    "code": "669",
    "nameEn": "Mahisagar",
    "nameGu": "મહીસાગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:673",
    "code": "673",
    "nameEn": "Morbi",
    "nameGu": "મોરબી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:452",
    "code": "452",
    "nameEn": "Narmada",
    "nameGu": "નર્મદા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:453",
    "code": "453",
    "nameEn": "Navsari",
    "nameGu": "નવસારી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:454",
    "code": "454",
    "nameEn": "Panch Mahals",
    "nameGu": "પંચમહાલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:455",
    "code": "455",
    "nameEn": "Patan",
    "nameGu": "પાટણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:456",
    "code": "456",
    "nameEn": "Porbandar",
    "nameGu": "પોરબંદર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:457",
    "code": "457",
    "nameEn": "Rajkot",
    "nameGu": "રાજકોટ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:458",
    "code": "458",
    "nameEn": "Sabar Kantha",
    "nameGu": "સાબરકાંઠા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:459",
    "code": "459",
    "nameEn": "Surat",
    "nameGu": "સુરત",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:460",
    "code": "460",
    "nameEn": "Surendranagar",
    "nameGu": "સુરેન્દ્રનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:641",
    "code": "641",
    "nameEn": "Tapi",
    "nameGu": "તાપી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:461",
    "code": "461",
    "nameEn": "Vadodara",
    "nameGu": "વડોદરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:462",
    "code": "462",
    "nameEn": "Valsad",
    "nameGu": "વલસાડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "district:789",
    "code": "789",
    "nameEn": "Vav-Tharad",
    "nameGu": "વાવ-થરાદ",
    "labelSource": "lgd-local-name"
  }
] as const satisfies readonly GujaratDistrict[]

export const GUJARAT_SUBDISTRICTS = [
  {
    "key": "subdistrict:6512",
    "code": "6512",
    "districtKey": "district:438",
    "nameEn": "Asarva",
    "nameGu": "અસર્વ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3784",
    "code": "3784",
    "districtKey": "district:438",
    "nameEn": "Bavla",
    "nameGu": "બાવળા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3782",
    "code": "3782",
    "districtKey": "district:438",
    "nameEn": "Daskroi",
    "nameGu": "દસક્રોઇ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3778",
    "code": "3778",
    "districtKey": "district:438",
    "nameEn": "Detroj-Rampura",
    "nameGu": "દેત્રોજ - રામપુરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3787",
    "code": "3787",
    "districtKey": "district:438",
    "nameEn": "Dhandhuka",
    "nameGu": "ધંધુકા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6167",
    "code": "6167",
    "districtKey": "district:438",
    "nameEn": "Dholera",
    "nameGu": "ધોલેરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3783",
    "code": "3783",
    "districtKey": "district:438",
    "nameEn": "Dholka",
    "nameGu": "ધોળકા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6513",
    "code": "6513",
    "districtKey": "district:438",
    "nameEn": "Ghatlodiya",
    "nameGu": "ઘત્લોદિય",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3777",
    "code": "3777",
    "districtKey": "district:438",
    "nameEn": "Mandal",
    "nameGu": "માંડલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6515",
    "code": "6515",
    "districtKey": "district:438",
    "nameEn": "Maninagar",
    "nameGu": "મનિનગર",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3781",
    "code": "3781",
    "districtKey": "district:438",
    "nameEn": "Sabarmati",
    "nameGu": "સબર્મતિ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3780",
    "code": "3780",
    "districtKey": "district:438",
    "nameEn": "Sanand",
    "nameGu": "સાણંદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6516",
    "code": "6516",
    "districtKey": "district:438",
    "nameEn": "Vatva",
    "nameGu": "વત્વ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:6514",
    "code": "6514",
    "districtKey": "district:438",
    "nameEn": "Vejalpur",
    "nameGu": "વેજલ્પુર",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3779",
    "code": "3779",
    "districtKey": "district:438",
    "nameEn": "Viramgam",
    "nameGu": "વીરમગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3843",
    "code": "3843",
    "districtKey": "district:439",
    "nameEn": "Amreli",
    "nameGu": "અમરેલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7432",
    "code": "7432",
    "districtKey": "district:439",
    "nameEn": "Amreli-City",
    "nameGu": "અમરેલી શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3840",
    "code": "3840",
    "districtKey": "district:439",
    "nameEn": "Babra",
    "nameGu": "બાબરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3844",
    "code": "3844",
    "districtKey": "district:439",
    "nameEn": "Bagasara",
    "nameGu": "બગસરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3845",
    "code": "3845",
    "districtKey": "district:439",
    "nameEn": "Dhari",
    "nameGu": "ધારી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3848",
    "code": "3848",
    "districtKey": "district:439",
    "nameEn": "Jafrabad",
    "nameGu": "જાફરાબાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3847",
    "code": "3847",
    "districtKey": "district:439",
    "nameEn": "Khambha",
    "nameGu": "ખાંભા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3839",
    "code": "3839",
    "districtKey": "district:439",
    "nameEn": "Kunkavav Vadia",
    "nameGu": "કુકાવાવ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3841",
    "code": "3841",
    "districtKey": "district:439",
    "nameEn": "Lathi",
    "nameGu": "લાઠી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3842",
    "code": "3842",
    "districtKey": "district:439",
    "nameEn": "Lilia",
    "nameGu": "લીલીયા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3849",
    "code": "3849",
    "districtKey": "district:439",
    "nameEn": "Rajula",
    "nameGu": "રાજુલા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3846",
    "code": "3846",
    "districtKey": "district:439",
    "nameEn": "Savar Kundla",
    "nameGu": "સાવરકુંડલા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6530",
    "code": "6530",
    "districtKey": "district:440",
    "nameEn": "Anand City",
    "nameGu": "આણંદ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3864",
    "code": "3864",
    "districtKey": "district:440",
    "nameEn": "Anand Rural",
    "nameGu": "આણંદ ગ્રામ્ય",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3868",
    "code": "3868",
    "districtKey": "district:440",
    "nameEn": "Anklav",
    "nameGu": "આંકલાવ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3867",
    "code": "3867",
    "districtKey": "district:440",
    "nameEn": "Borsad",
    "nameGu": "બોરસદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3866",
    "code": "3866",
    "districtKey": "district:440",
    "nameEn": "Khambhat",
    "nameGu": "ખંભાત",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3865",
    "code": "3865",
    "districtKey": "district:440",
    "nameEn": "Petlad",
    "nameGu": "પેેટલાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3862",
    "code": "3862",
    "districtKey": "district:440",
    "nameEn": "Sojitra",
    "nameGu": "સોજીત્રા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3861",
    "code": "3861",
    "districtKey": "district:440",
    "nameEn": "Tarapur",
    "nameGu": "તારાપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3863",
    "code": "3863",
    "districtKey": "district:440",
    "nameEn": "Umreth",
    "nameGu": "ઉમરેઠ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3736",
    "code": "3736",
    "districtKey": "district:441",
    "nameEn": "Amirgadh",
    "nameGu": "અમીરગઢ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3737",
    "code": "3737",
    "districtKey": "district:441",
    "nameEn": "Danta",
    "nameGu": "દાંતા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3735",
    "code": "3735",
    "districtKey": "district:441",
    "nameEn": "Dantiwada",
    "nameGu": "દાંતીવાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3740",
    "code": "3740",
    "districtKey": "district:441",
    "nameEn": "Deesa",
    "nameGu": "ડીસા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7437",
    "code": "7437",
    "districtKey": "district:441",
    "nameEn": "Deesa City",
    "nameGu": "ડીસા શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3734",
    "code": "3734",
    "districtKey": "district:441",
    "nameEn": "Dhanera",
    "nameGu": "ધાનેરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7555",
    "code": "7555",
    "districtKey": "district:441",
    "nameEn": "Hadad",
    "nameGu": "હડાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3743",
    "code": "3743",
    "districtKey": "district:441",
    "nameEn": "Kankrej",
    "nameGu": "કાંકરેેેજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7557",
    "code": "7557",
    "districtKey": "district:441",
    "nameEn": "Ogad",
    "nameGu": "ઓગડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3739",
    "code": "3739",
    "districtKey": "district:441",
    "nameEn": "Palanpur",
    "nameGu": "પાલનપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7436",
    "code": "7436",
    "districtKey": "district:441",
    "nameEn": "Palanpur City",
    "nameGu": "પાલનપુર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3738",
    "code": "3738",
    "districtKey": "district:441",
    "nameEn": "Vadgam",
    "nameGu": "વડગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3914",
    "code": "3914",
    "districtKey": "district:442",
    "nameEn": "Amod",
    "nameGu": "આમોદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3918",
    "code": "3918",
    "districtKey": "district:442",
    "nameEn": "Anklesvar",
    "nameGu": "અંકલેશ્વર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3916",
    "code": "3916",
    "districtKey": "district:442",
    "nameEn": "Bharuch",
    "nameGu": "ભરૂચ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7597",
    "code": "7597",
    "districtKey": "district:442",
    "nameEn": "Bharuch City",
    "nameGu": "ભરૂચ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3919",
    "code": "3919",
    "districtKey": "district:442",
    "nameEn": "Hansot",
    "nameGu": "હાંસોટ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3913",
    "code": "3913",
    "districtKey": "district:442",
    "nameEn": "Jambusar",
    "nameGu": "જંબુસર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3917",
    "code": "3917",
    "districtKey": "district:442",
    "nameEn": "Jhagadia",
    "nameGu": "ઝગડીઆ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6170",
    "code": "6170",
    "districtKey": "district:442",
    "nameEn": "Netrang",
    "nameGu": "નેત્રંગ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3915",
    "code": "3915",
    "districtKey": "district:442",
    "nameEn": "Vagra",
    "nameGu": "વાગરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3920",
    "code": "3920",
    "districtKey": "district:442",
    "nameEn": "Valia",
    "nameGu": "વાલીયા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3854",
    "code": "3854",
    "districtKey": "district:443",
    "nameEn": "Bhavnagar",
    "nameGu": "ભાવનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7444",
    "code": "7444",
    "districtKey": "district:443",
    "nameEn": "Bhavnagar City",
    "nameGu": "ભાવનગર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3857",
    "code": "3857",
    "districtKey": "district:443",
    "nameEn": "Gariadhar",
    "nameGu": "ગારીયાધાર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3855",
    "code": "3855",
    "districtKey": "district:443",
    "nameEn": "Ghogha",
    "nameGu": "ઘોઘા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6203",
    "code": "6203",
    "districtKey": "district:443",
    "nameEn": "Jesar",
    "nameGu": "જેસર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3860",
    "code": "3860",
    "districtKey": "district:443",
    "nameEn": "Mahuva",
    "nameGu": "મહુવા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3858",
    "code": "3858",
    "districtKey": "district:443",
    "nameEn": "Palitana",
    "nameGu": "પાલીતાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3856",
    "code": "3856",
    "districtKey": "district:443",
    "nameEn": "Sihor",
    "nameGu": "સીહોર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3859",
    "code": "3859",
    "districtKey": "district:443",
    "nameEn": "Talaja",
    "nameGu": "તળાજા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3853",
    "code": "3853",
    "districtKey": "district:443",
    "nameEn": "Umrala",
    "nameGu": "ઉમરાળા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3851",
    "code": "3851",
    "districtKey": "district:443",
    "nameEn": "Vallabhipur",
    "nameGu": "વલ્લભીપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3921",
    "code": "3921",
    "districtKey": "district:444",
    "nameEn": "Ahwa",
    "nameGu": "આહવા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6024",
    "code": "6024",
    "districtKey": "district:444",
    "nameEn": "Subir",
    "nameGu": "સુબીર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6023",
    "code": "6023",
    "districtKey": "district:444",
    "nameEn": "Waghai",
    "nameGu": "વધઈ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3895",
    "code": "3895",
    "districtKey": "district:445",
    "nameEn": "Devgadbaria",
    "nameGu": "દેવગઢ બારીયા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3896",
    "code": "3896",
    "districtKey": "district:445",
    "nameEn": "Dhanpur",
    "nameGu": "ધાનપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3893",
    "code": "3893",
    "districtKey": "district:445",
    "nameEn": "Dohad",
    "nameGu": "દોહદ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3890",
    "code": "3890",
    "districtKey": "district:445",
    "nameEn": "Fatepura",
    "nameGu": "ફતેપુરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3894",
    "code": "3894",
    "districtKey": "district:445",
    "nameEn": "Garbada",
    "nameGu": "ગરબાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7554",
    "code": "7554",
    "districtKey": "district:445",
    "nameEn": "Govindguru Limdi",
    "nameGu": "ગોવિંદગુરુ લીમડી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3891",
    "code": "3891",
    "districtKey": "district:445",
    "nameEn": "Jhalod",
    "nameGu": "ઝાલોદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3892",
    "code": "3892",
    "districtKey": "district:445",
    "nameEn": "Limkheda",
    "nameGu": "લીમખેડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6204",
    "code": "6204",
    "districtKey": "district:445",
    "nameEn": "Sanjeli",
    "nameGu": "સંજેલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6480",
    "code": "6480",
    "districtKey": "district:445",
    "nameEn": "Singvad",
    "nameGu": "સીંગવડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7549",
    "code": "7549",
    "districtKey": "district:445",
    "nameEn": "Sukhsar",
    "nameGu": "સુખસર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3776",
    "code": "3776",
    "districtKey": "district:446",
    "nameEn": "Dehgam",
    "nameGu": "દેહગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3775",
    "code": "3775",
    "districtKey": "district:446",
    "nameEn": "Gandhinagar",
    "nameGu": "ગાંધીનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7438",
    "code": "7438",
    "districtKey": "district:446",
    "nameEn": "Kalol City",
    "nameGu": "કલોલ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3773",
    "code": "3773",
    "districtKey": "district:446",
    "nameEn": "Kalol Gandhinagar",
    "nameGu": "કલોલ ગન્ધિનગર",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3774",
    "code": "3774",
    "districtKey": "district:446",
    "nameEn": "Mansa",
    "nameGu": "માણસા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3816",
    "code": "3816",
    "districtKey": "district:447",
    "nameEn": "Dhrol",
    "nameGu": "ધ્રોલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3821",
    "code": "3821",
    "districtKey": "district:447",
    "nameEn": "Jamjodhpur",
    "nameGu": "જામજોધપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6525",
    "code": "6525",
    "districtKey": "district:447",
    "nameEn": "Jamnagar City",
    "nameGu": "જામનગર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3814",
    "code": "3814",
    "districtKey": "district:447",
    "nameEn": "Jamnagar Rural",
    "nameGu": "જામનગર ગ્રામ્ય",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3815",
    "code": "3815",
    "districtKey": "district:447",
    "nameEn": "Jodiya",
    "nameGu": "જોડીયા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3817",
    "code": "3817",
    "districtKey": "district:447",
    "nameEn": "Kalavad",
    "nameGu": "કાલાવાડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3818",
    "code": "3818",
    "districtKey": "district:447",
    "nameEn": "Lalpur",
    "nameGu": "લાલપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3828",
    "code": "3828",
    "districtKey": "district:448",
    "nameEn": "Bhesan",
    "nameGu": "ભેસાણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3827",
    "code": "3827",
    "districtKey": "district:448",
    "nameEn": "Junagadh",
    "nameGu": "જુનાગઢ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6517",
    "code": "6517",
    "districtKey": "district:448",
    "nameEn": "Junagadh City",
    "nameGu": "જુનાગઢ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3831",
    "code": "3831",
    "districtKey": "district:448",
    "nameEn": "Keshod",
    "nameGu": "કેશોદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3833",
    "code": "3833",
    "districtKey": "district:448",
    "nameEn": "Malia Hatina",
    "nameGu": "મલિઅ હતિન",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3825",
    "code": "3825",
    "districtKey": "district:448",
    "nameEn": "Manavadar",
    "nameGu": "માણાવદર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3832",
    "code": "3832",
    "districtKey": "district:448",
    "nameEn": "Mangrol",
    "nameGu": "માંગરોળ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3830",
    "code": "3830",
    "districtKey": "district:448",
    "nameEn": "Mendarda",
    "nameGu": "મેંદરડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3826",
    "code": "3826",
    "districtKey": "district:448",
    "nameEn": "Vanthali",
    "nameGu": "વંથલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3829",
    "code": "3829",
    "districtKey": "district:448",
    "nameEn": "Visavadar",
    "nameGu": "વીસાવદર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3728",
    "code": "3728",
    "districtKey": "district:449",
    "nameEn": "Abdasa",
    "nameGu": "અબડાસા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3725",
    "code": "3725",
    "districtKey": "district:449",
    "nameEn": "Anjar",
    "nameGu": "અંજાર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3724",
    "code": "3724",
    "districtKey": "district:449",
    "nameEn": "Bhachau",
    "nameGu": "ભચાઉ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3726",
    "code": "3726",
    "districtKey": "district:449",
    "nameEn": "Bhuj",
    "nameGu": "ભુજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3731",
    "code": "3731",
    "districtKey": "district:449",
    "nameEn": "Gandhidham",
    "nameGu": "ગાંધીધામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3722",
    "code": "3722",
    "districtKey": "district:449",
    "nameEn": "Lakhpat",
    "nameGu": "લખપત",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3729",
    "code": "3729",
    "districtKey": "district:449",
    "nameEn": "Mandvi",
    "nameGu": "માંડવી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3730",
    "code": "3730",
    "districtKey": "district:449",
    "nameEn": "Mundra",
    "nameGu": "મુંદ્રા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3727",
    "code": "3727",
    "districtKey": "district:449",
    "nameEn": "Nakhatrana",
    "nameGu": "નખત્રાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3723",
    "code": "3723",
    "districtKey": "district:449",
    "nameEn": "Rapar",
    "nameGu": "રાપર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7558",
    "code": "7558",
    "districtKey": "district:450",
    "nameEn": "Fagvel",
    "nameGu": "ફાગવેલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6025",
    "code": "6025",
    "districtKey": "district:450",
    "nameEn": "Galteshwar",
    "nameGu": "ગલતેશ્વર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3869",
    "code": "3869",
    "districtKey": "district:450",
    "nameEn": "Kapadvanj",
    "nameGu": "કપડવંજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3872",
    "code": "3872",
    "districtKey": "district:450",
    "nameEn": "Kathlal",
    "nameGu": "કઠલાલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3874",
    "code": "3874",
    "districtKey": "district:450",
    "nameEn": "Kheda",
    "nameGu": "ખેડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3877",
    "code": "3877",
    "districtKey": "district:450",
    "nameEn": "Mahudha",
    "nameGu": "મહુધા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3875",
    "code": "3875",
    "districtKey": "district:450",
    "nameEn": "Matar",
    "nameGu": "માતર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3873",
    "code": "3873",
    "districtKey": "district:450",
    "nameEn": "Mehmedabad",
    "nameGu": "મહેમદાબાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3876",
    "code": "3876",
    "districtKey": "district:450",
    "nameEn": "Nadiad",
    "nameGu": "નડીઆદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6531",
    "code": "6531",
    "districtKey": "district:450",
    "nameEn": "Nadiad City",
    "nameGu": "નડીઆદ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3878",
    "code": "3878",
    "districtKey": "district:450",
    "nameEn": "Thasra",
    "nameGu": "ઠાસરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6034",
    "code": "6034",
    "districtKey": "district:450",
    "nameEn": "Vaso",
    "nameGu": "વસો",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3758",
    "code": "3758",
    "districtKey": "district:451",
    "nameEn": "Becharaji",
    "nameGu": "બેચરાજી",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6021",
    "code": "6021",
    "districtKey": "district:451",
    "nameEn": "Jotana",
    "nameGu": "જોટાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3759",
    "code": "3759",
    "districtKey": "district:451",
    "nameEn": "Kadi",
    "nameGu": "કડી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3752",
    "code": "3752",
    "districtKey": "district:451",
    "nameEn": "Kheralu",
    "nameGu": "ખેરાલુ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3757",
    "code": "3757",
    "districtKey": "district:451",
    "nameEn": "Mahesana",
    "nameGu": "મહેસાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7441",
    "code": "7441",
    "districtKey": "district:451",
    "nameEn": "Mahesana City",
    "nameGu": "મહેસાણા શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3751",
    "code": "3751",
    "districtKey": "district:451",
    "nameEn": "Satlasana",
    "nameGu": "સતલાસણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3753",
    "code": "3753",
    "districtKey": "district:451",
    "nameEn": "Unjha",
    "nameGu": "ઉંઝા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3755",
    "code": "3755",
    "districtKey": "district:451",
    "nameEn": "Vadnagar",
    "nameGu": "વડનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3756",
    "code": "3756",
    "districtKey": "district:451",
    "nameEn": "Vijapur",
    "nameGu": "વિજાપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3754",
    "code": "3754",
    "districtKey": "district:451",
    "nameEn": "Visnagar",
    "nameGu": "વિસનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7545",
    "code": "7545",
    "districtKey": "district:452",
    "nameEn": "Chikada",
    "nameGu": "ચીકદા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3911",
    "code": "3911",
    "districtKey": "district:452",
    "nameEn": "Dediapada",
    "nameGu": "દેડીયાપાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6029",
    "code": "6029",
    "districtKey": "district:452",
    "nameEn": "Garudeshwar",
    "nameGu": "ગરૂડેશ્વર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3910",
    "code": "3910",
    "districtKey": "district:452",
    "nameEn": "Nandod",
    "nameGu": "નાંદોદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3912",
    "code": "3912",
    "districtKey": "district:452",
    "nameEn": "Sagbara",
    "nameGu": "સાગરબારા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3909",
    "code": "3909",
    "districtKey": "district:452",
    "nameEn": "Tilakwada",
    "nameGu": "તીલકવાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3926",
    "code": "3926",
    "districtKey": "district:453",
    "nameEn": "Bansda",
    "nameGu": "વાંસદા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3925",
    "code": "3925",
    "districtKey": "district:453",
    "nameEn": "Chikhli",
    "nameGu": "ચીખલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3924",
    "code": "3924",
    "districtKey": "district:453",
    "nameEn": "Gandevi",
    "nameGu": "ગણદેવી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3923",
    "code": "3923",
    "districtKey": "district:453",
    "nameEn": "Jalalpore",
    "nameGu": "જલાલપોર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6195",
    "code": "6195",
    "districtKey": "district:453",
    "nameEn": "Khergam",
    "nameGu": "ખેરગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3922",
    "code": "3922",
    "districtKey": "district:453",
    "nameEn": "Navsari",
    "nameGu": "નવસારી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3887",
    "code": "3887",
    "districtKey": "district:454",
    "nameEn": "Ghoghamba",
    "nameGu": "ઘોઘંબા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7598",
    "code": "7598",
    "districtKey": "district:454",
    "nameEn": "Godharacity",
    "nameGu": "ગોધરકિત્ય",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3885",
    "code": "3885",
    "districtKey": "district:454",
    "nameEn": "Godhra",
    "nameGu": "ગોધરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3888",
    "code": "3888",
    "districtKey": "district:454",
    "nameEn": "Halol",
    "nameGu": "હાલોલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3889",
    "code": "3889",
    "districtKey": "district:454",
    "nameEn": "Jambughoda",
    "nameGu": "જાંબુઘોડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3886",
    "code": "3886",
    "districtKey": "district:454",
    "nameEn": "Kalol",
    "nameGu": "કાલોલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3884",
    "code": "3884",
    "districtKey": "district:454",
    "nameEn": "Morwa (Hadaf)",
    "nameGu": "મોરવા(હડફ)",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3883",
    "code": "3883",
    "districtKey": "district:454",
    "nameEn": "Shehera",
    "nameGu": "શહેરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3750",
    "code": "3750",
    "districtKey": "district:455",
    "nameEn": "Chanasma",
    "nameGu": "ચાણસ્મા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3748",
    "code": "3748",
    "districtKey": "district:455",
    "nameEn": "Harij",
    "nameGu": "હારીજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3747",
    "code": "3747",
    "districtKey": "district:455",
    "nameEn": "Patan",
    "nameGu": "પાટણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7433",
    "code": "7433",
    "districtKey": "district:455",
    "nameEn": "Patan City",
    "nameGu": "પાટણ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3745",
    "code": "3745",
    "districtKey": "district:455",
    "nameEn": "Radhanpur",
    "nameGu": "રાધનપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3749",
    "code": "3749",
    "districtKey": "district:455",
    "nameEn": "Sami",
    "nameGu": "સમી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3744",
    "code": "3744",
    "districtKey": "district:455",
    "nameEn": "Santalpur",
    "nameGu": "સાંતલપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6196",
    "code": "6196",
    "districtKey": "district:455",
    "nameEn": "Saraswati",
    "nameGu": "સરસ્વતી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6197",
    "code": "6197",
    "districtKey": "district:455",
    "nameEn": "Shankheshvar",
    "nameGu": "શંખેશ્વર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3746",
    "code": "3746",
    "districtKey": "district:455",
    "nameEn": "Sidhpur",
    "nameGu": "સિધ્ધપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3824",
    "code": "3824",
    "districtKey": "district:456",
    "nameEn": "Kutiyana",
    "nameGu": "કુતિયાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7445",
    "code": "7445",
    "districtKey": "district:456",
    "nameEn": "Porabandar City",
    "nameGu": "પોરબંદર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3822",
    "code": "3822",
    "districtKey": "district:456",
    "nameEn": "Porbandar",
    "nameGu": "પોરબંદર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3823",
    "code": "3823",
    "districtKey": "district:456",
    "nameEn": "Ranavav",
    "nameGu": "રાણાવાવ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3810",
    "code": "3810",
    "districtKey": "district:457",
    "nameEn": "Dhoraji",
    "nameGu": "ધોરાજી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3807",
    "code": "3807",
    "districtKey": "district:457",
    "nameEn": "Gondal",
    "nameGu": "ગોંડલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7439",
    "code": "7439",
    "districtKey": "district:457",
    "nameEn": "Gondal City",
    "nameGu": "ગોંડલ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3808",
    "code": "3808",
    "districtKey": "district:457",
    "nameEn": "Jamkandorna",
    "nameGu": "જામકંડોરણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3806",
    "code": "3806",
    "districtKey": "district:457",
    "nameEn": "Jasdan",
    "nameGu": "જસદણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3811",
    "code": "3811",
    "districtKey": "district:457",
    "nameEn": "Jetpur",
    "nameGu": "જેતપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7440",
    "code": "7440",
    "districtKey": "district:457",
    "nameEn": "Jetpur City",
    "nameGu": "જેતપુર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3805",
    "code": "3805",
    "districtKey": "district:457",
    "nameEn": "Kotda Sangani",
    "nameGu": "કોટડા સાંગાણી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3804",
    "code": "3804",
    "districtKey": "district:457",
    "nameEn": "Lodhika",
    "nameGu": "લોધીકા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3802",
    "code": "3802",
    "districtKey": "district:457",
    "nameEn": "Paddhari",
    "nameGu": "પડધરી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3803",
    "code": "3803",
    "districtKey": "district:457",
    "nameEn": "Rajkot",
    "nameGu": "રાજકોટ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6520",
    "code": "6520",
    "districtKey": "district:457",
    "nameEn": "Rajkot East",
    "nameGu": "રાજકોટ પૂર્વ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6524",
    "code": "6524",
    "districtKey": "district:457",
    "nameEn": "Rajkot South",
    "nameGu": "રાજકોટ દક્ષિણ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6523",
    "code": "6523",
    "districtKey": "district:457",
    "nameEn": "Rajkot West",
    "nameGu": "રાજકોટ પશ્ચિમ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3809",
    "code": "3809",
    "districtKey": "district:457",
    "nameEn": "Upleta",
    "nameGu": "ઉપલેટા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6198",
    "code": "6198",
    "districtKey": "district:457",
    "nameEn": "Vinchchiya",
    "nameGu": "વીંછીયા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3766",
    "code": "3766",
    "districtKey": "district:458",
    "nameEn": "Himatnagar",
    "nameGu": "હિંમતનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3763",
    "code": "3763",
    "districtKey": "district:458",
    "nameEn": "Idar",
    "nameGu": "ઈડર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3760",
    "code": "3760",
    "districtKey": "district:458",
    "nameEn": "Khedbrahma",
    "nameGu": "ખેડબ્રહ્મા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6088",
    "code": "6088",
    "districtKey": "district:458",
    "nameEn": "Poshina",
    "nameGu": "પોશીના",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3767",
    "code": "3767",
    "districtKey": "district:458",
    "nameEn": "Prantij",
    "nameGu": "પ્રાંતિજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3768",
    "code": "3768",
    "districtKey": "district:458",
    "nameEn": "Talod",
    "nameGu": "તલોદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3762",
    "code": "3762",
    "districtKey": "district:458",
    "nameEn": "Vadali",
    "nameGu": "વડાલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3761",
    "code": "3761",
    "districtKey": "district:458",
    "nameEn": "Vijaynagar",
    "nameGu": "વિજયનગર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7600",
    "code": "7600",
    "districtKey": "district:459",
    "nameEn": "Abrama",
    "nameGu": "અબ્રમ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:6518",
    "code": "6518",
    "districtKey": "district:459",
    "nameEn": "Adajan",
    "nameGu": "અદજન",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:7552",
    "code": "7552",
    "districtKey": "district:459",
    "nameEn": "Ambika",
    "nameGu": "અંબિકા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7553",
    "code": "7553",
    "districtKey": "district:459",
    "nameEn": "Areth",
    "nameGu": "અરેઠ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3940",
    "code": "3940",
    "districtKey": "district:459",
    "nameEn": "Bardoli",
    "nameGu": "બારડોલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3938",
    "code": "3938",
    "districtKey": "district:459",
    "nameEn": "Chorasi",
    "nameGu": "ચોર્યાસી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3936",
    "code": "3936",
    "districtKey": "district:459",
    "nameEn": "Kamrej",
    "nameGu": "કામરેજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6519",
    "code": "6519",
    "districtKey": "district:459",
    "nameEn": "Katargam",
    "nameGu": "કતર્ગમ",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3941",
    "code": "3941",
    "districtKey": "district:459",
    "nameEn": "Mahuva",
    "nameGu": "મહુવા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3937",
    "code": "3937",
    "districtKey": "district:459",
    "nameEn": "Majura",
    "nameGu": "મજુર",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3935",
    "code": "3935",
    "districtKey": "district:459",
    "nameEn": "Mandvi",
    "nameGu": "માંડવી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3933",
    "code": "3933",
    "districtKey": "district:459",
    "nameEn": "Mangrol",
    "nameGu": "માંગરોળ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3932",
    "code": "3932",
    "districtKey": "district:459",
    "nameEn": "Olpad",
    "nameGu": "ઓલપાડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3939",
    "code": "3939",
    "districtKey": "district:459",
    "nameEn": "Palsana",
    "nameGu": "પલસાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6521",
    "code": "6521",
    "districtKey": "district:459",
    "nameEn": "Puna",
    "nameGu": "પુના",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6522",
    "code": "6522",
    "districtKey": "district:459",
    "nameEn": "Udhna",
    "nameGu": "ઉધ્ન",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3934",
    "code": "3934",
    "districtKey": "district:459",
    "nameEn": "Umarpada",
    "nameGu": "ઉમરપાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3794",
    "code": "3794",
    "districtKey": "district:460",
    "nameEn": "Chotila",
    "nameGu": "ચોટીલા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3796",
    "code": "3796",
    "districtKey": "district:460",
    "nameEn": "Chuda",
    "nameGu": "ચુડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3790",
    "code": "3790",
    "districtKey": "district:460",
    "nameEn": "Dasada",
    "nameGu": "દસાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3789",
    "code": "3789",
    "districtKey": "district:460",
    "nameEn": "Dhrangadhra",
    "nameGu": "ધાંગધ્રા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3791",
    "code": "3791",
    "districtKey": "district:460",
    "nameEn": "Lakhtar",
    "nameGu": "લખતર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3797",
    "code": "3797",
    "districtKey": "district:460",
    "nameEn": "Limbdi",
    "nameGu": "લીમડી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3793",
    "code": "3793",
    "districtKey": "district:460",
    "nameEn": "Muli",
    "nameGu": "મુળી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3795",
    "code": "3795",
    "districtKey": "district:460",
    "nameEn": "Sayla",
    "nameGu": "સાયલા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7442",
    "code": "7442",
    "districtKey": "district:460",
    "nameEn": "Surendranagar City",
    "nameGu": "સુરેન્દ્રનગર શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6037",
    "code": "6037",
    "districtKey": "district:460",
    "nameEn": "Thangadh",
    "nameGu": "થાનગઢ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3792",
    "code": "3792",
    "districtKey": "district:460",
    "nameEn": "Wadhwan",
    "nameGu": "વઢવાણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3905",
    "code": "3905",
    "districtKey": "district:461",
    "nameEn": "Dabhoi",
    "nameGu": "ડભોઇ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6035",
    "code": "6035",
    "districtKey": "district:461",
    "nameEn": "Desar",
    "nameGu": "ડેસર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3907",
    "code": "3907",
    "districtKey": "district:461",
    "nameEn": "Karjan",
    "nameGu": "કરજણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3906",
    "code": "3906",
    "districtKey": "district:461",
    "nameEn": "Padra",
    "nameGu": "પાદરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3897",
    "code": "3897",
    "districtKey": "district:461",
    "nameEn": "Savli",
    "nameGu": "સાવલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3908",
    "code": "3908",
    "districtKey": "district:461",
    "nameEn": "Sinor",
    "nameGu": "સિનોર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6529",
    "code": "6529",
    "districtKey": "district:461",
    "nameEn": "Vadodara East",
    "nameGu": "વડોદરા (સીટી અને રૂરલ) પૂર્વ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6527",
    "code": "6527",
    "districtKey": "district:461",
    "nameEn": "Vadodara North",
    "nameGu": "વડોદરા (સીટી અને રૂરલ) ઉત્તર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3898",
    "code": "3898",
    "districtKey": "district:461",
    "nameEn": "Vadodara Rural",
    "nameGu": "વડોદરા (સીટી અને રૂરલ) ગ્રામ્ય",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6526",
    "code": "6526",
    "districtKey": "district:461",
    "nameEn": "Vadodara South",
    "nameGu": "વડોદરા (સીટી અને રૂરલ) દક્ષિણ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6528",
    "code": "6528",
    "districtKey": "district:461",
    "nameEn": "Vadodara West",
    "nameGu": "વડોદરા (સીટી અને રૂરલ) પશ્ચિમ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3899",
    "code": "3899",
    "districtKey": "district:461",
    "nameEn": "Vaghodia",
    "nameGu": "વાઘોડીયા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3928",
    "code": "3928",
    "districtKey": "district:462",
    "nameEn": "Dharampur",
    "nameGu": "ધરમપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3930",
    "code": "3930",
    "districtKey": "district:462",
    "nameEn": "Kaprada",
    "nameGu": "કપરાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7547",
    "code": "7547",
    "districtKey": "district:462",
    "nameEn": "Nanapodha",
    "nameGu": "નાના પોઢા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:7601",
    "code": "7601",
    "districtKey": "district:462",
    "nameEn": "Pardi",
    "nameGu": "પારડી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3931",
    "code": "3931",
    "districtKey": "district:462",
    "nameEn": "Umbergaon",
    "nameGu": "ઉમરગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3927",
    "code": "3927",
    "districtKey": "district:462",
    "nameEn": "Valsad",
    "nameGu": "વલસાડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7599",
    "code": "7599",
    "districtKey": "district:462",
    "nameEn": "Valsad City",
    "nameGu": "વલસાડ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6031",
    "code": "6031",
    "districtKey": "district:462",
    "nameEn": "Vapi",
    "nameGu": "વાપી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7596",
    "code": "7596",
    "districtKey": "district:462",
    "nameEn": "Vapi City",
    "nameGu": "વાપી શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6200",
    "code": "6200",
    "districtKey": "district:641",
    "nameEn": "Dolvan",
    "nameGu": "ડોલવણ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6169",
    "code": "6169",
    "districtKey": "district:641",
    "nameEn": "Kukarmunda",
    "nameGu": "કુકરમુંડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3942",
    "code": "3942",
    "districtKey": "district:641",
    "nameEn": "Nizar",
    "nameGu": "નીઝર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3944",
    "code": "3944",
    "districtKey": "district:641",
    "nameEn": "Songadh",
    "nameGu": "સોનગઢ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3943",
    "code": "3943",
    "districtKey": "district:641",
    "nameEn": "Uchchhal",
    "nameGu": "ઉચ્છલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7550",
    "code": "7550",
    "districtKey": "district:641",
    "nameEn": "Ukai",
    "nameGu": "ઉકાઇ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3946",
    "code": "3946",
    "districtKey": "district:641",
    "nameEn": "Valod",
    "nameGu": "વાલોડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3945",
    "code": "3945",
    "districtKey": "district:641",
    "nameEn": "Vyara",
    "nameGu": "વ્યારા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6020",
    "code": "6020",
    "districtKey": "district:668",
    "nameEn": "Bodeli",
    "nameGu": "બોડેલી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3901",
    "code": "3901",
    "districtKey": "district:668",
    "nameEn": "Chhota Udaipur",
    "nameGu": "છોટાઉદેપુર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3900",
    "code": "3900",
    "districtKey": "district:668",
    "nameEn": "Jetpur Pavi",
    "nameGu": "જેતપુર પાવી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7551",
    "code": "7551",
    "districtKey": "district:668",
    "nameEn": "Kadval",
    "nameGu": "કદવાલ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3902",
    "code": "3902",
    "districtKey": "district:668",
    "nameEn": "Kavant",
    "nameGu": "કવાંટ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3903",
    "code": "3903",
    "districtKey": "district:668",
    "nameEn": "Nasvadi",
    "nameGu": "નસવાડી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3904",
    "code": "3904",
    "districtKey": "district:668",
    "nameEn": "Sankheda",
    "nameGu": "સંખેડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3871",
    "code": "3871",
    "districtKey": "district:669",
    "nameEn": "Balasinor",
    "nameGu": "બાલાસિનોર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7546",
    "code": "7546",
    "districtKey": "district:669",
    "nameEn": "Godhar",
    "nameGu": "ગોધર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3880",
    "code": "3880",
    "districtKey": "district:669",
    "nameEn": "Kadana",
    "nameGu": "કડાણા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3879",
    "code": "3879",
    "districtKey": "district:669",
    "nameEn": "Khanpur",
    "nameGu": "ખાનપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7556",
    "code": "7556",
    "districtKey": "district:669",
    "nameEn": "Kothmba",
    "nameGu": "કોઠંબા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3882",
    "code": "3882",
    "districtKey": "district:669",
    "nameEn": "Lunawada",
    "nameGu": "લુણાવાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3881",
    "code": "3881",
    "districtKey": "district:669",
    "nameEn": "Santrampur",
    "nameGu": "સંતરામપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3870",
    "code": "3870",
    "districtKey": "district:669",
    "nameEn": "Virpur",
    "nameGu": "વીરપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3772",
    "code": "3772",
    "districtKey": "district:672",
    "nameEn": "Bayad",
    "nameGu": "બાયડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3764",
    "code": "3764",
    "districtKey": "district:672",
    "nameEn": "Bhiloda",
    "nameGu": "ભીલોડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3770",
    "code": "3770",
    "districtKey": "district:672",
    "nameEn": "Dhansura",
    "nameGu": "ધનસુરા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3771",
    "code": "3771",
    "districtKey": "district:672",
    "nameEn": "Malpur",
    "nameGu": "માલપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3765",
    "code": "3765",
    "districtKey": "district:672",
    "nameEn": "Meghraj",
    "nameGu": "મેઘરજ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3769",
    "code": "3769",
    "districtKey": "district:672",
    "nameEn": "Modasa",
    "nameGu": "મોડાસા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7559",
    "code": "7559",
    "districtKey": "district:672",
    "nameEn": "Sathamba",
    "nameGu": "સાઠંબા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7548",
    "code": "7548",
    "districtKey": "district:672",
    "nameEn": "Shamlaji",
    "nameGu": "શામળાજી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3788",
    "code": "3788",
    "districtKey": "district:673",
    "nameEn": "Halvad",
    "nameGu": "હળવદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3798",
    "code": "3798",
    "districtKey": "district:673",
    "nameEn": "Maliya",
    "nameGu": "માળીયા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7443",
    "code": "7443",
    "districtKey": "district:673",
    "nameEn": "Morbi City",
    "nameGu": "મોરબી શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3799",
    "code": "3799",
    "districtKey": "district:673",
    "nameEn": "Morvi",
    "nameGu": "મોરબી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3800",
    "code": "3800",
    "districtKey": "district:673",
    "nameEn": "Tankara",
    "nameGu": "ટંકારા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3801",
    "code": "3801",
    "districtKey": "district:673",
    "nameEn": "Wankaner",
    "nameGu": "વાંકાનેર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3820",
    "code": "3820",
    "districtKey": "district:674",
    "nameEn": "Bhanvad",
    "nameGu": "ભાણવડ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3819",
    "code": "3819",
    "districtKey": "district:674",
    "nameEn": "Kalyanpur",
    "nameGu": "કલ્યાણપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3813",
    "code": "3813",
    "districtKey": "district:674",
    "nameEn": "Khambhalia",
    "nameGu": "ખંભાળીયા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3812",
    "code": "3812",
    "districtKey": "district:674",
    "nameEn": "Okhamandal",
    "nameGu": "ઓખામંડળ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6199",
    "code": "6199",
    "districtKey": "district:675",
    "nameEn": "Gir Gadhda",
    "nameGu": "ગીર ગઢડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3837",
    "code": "3837",
    "districtKey": "district:675",
    "nameEn": "Kodinar",
    "nameGu": "કોડીનાર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3835",
    "code": "3835",
    "districtKey": "district:675",
    "nameEn": "Patan-Veraval",
    "nameGu": "વેરાવળ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3836",
    "code": "3836",
    "districtKey": "district:675",
    "nameEn": "Sutrapada",
    "nameGu": "સુત્રાપાડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3834",
    "code": "3834",
    "districtKey": "district:675",
    "nameEn": "Talala",
    "nameGu": "તલાલા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3838",
    "code": "3838",
    "districtKey": "district:675",
    "nameEn": "Una",
    "nameGu": "ઉના",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7446",
    "code": "7446",
    "districtKey": "district:675",
    "nameEn": "Veraval City",
    "nameGu": "વેરવલ કિત્ય",
    "labelSource": "deterministic-transliteration"
  },
  {
    "key": "subdistrict:3786",
    "code": "3786",
    "districtKey": "district:676",
    "nameEn": "Barwala",
    "nameGu": "બરવાળા",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3850",
    "code": "3850",
    "districtKey": "district:676",
    "nameEn": "Botad",
    "nameGu": "બોટાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7435",
    "code": "7435",
    "districtKey": "district:676",
    "nameEn": "Botad City",
    "nameGu": "બોટાદ શહેર",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:3852",
    "code": "3852",
    "districtKey": "district:676",
    "nameEn": "Gadhada",
    "nameGu": "ગઢડા",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3785",
    "code": "3785",
    "districtKey": "district:676",
    "nameEn": "Ranpur",
    "nameGu": "રાણપુર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3742",
    "code": "3742",
    "districtKey": "district:789",
    "nameEn": "Bhabhar",
    "nameGu": "ભાભર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3741",
    "code": "3741",
    "districtKey": "district:789",
    "nameEn": "Deodar",
    "nameGu": "દીઓદર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7544",
    "code": "7544",
    "districtKey": "district:789",
    "nameEn": "Dharnidhar",
    "nameGu": "ધરણીધર",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:6168",
    "code": "6168",
    "districtKey": "district:789",
    "nameEn": "Lakhani",
    "nameGu": "લાખણી",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:7543",
    "code": "7543",
    "districtKey": "district:789",
    "nameEn": "Raah",
    "nameGu": "રાહ",
    "labelSource": "lgd-code-linked-local-name"
  },
  {
    "key": "subdistrict:6166",
    "code": "6166",
    "districtKey": "district:789",
    "nameEn": "Suigam",
    "nameGu": "સુઇગામ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3733",
    "code": "3733",
    "districtKey": "district:789",
    "nameEn": "Tharad",
    "nameGu": "થરાદ",
    "labelSource": "lgd-local-name"
  },
  {
    "key": "subdistrict:3732",
    "code": "3732",
    "districtKey": "district:789",
    "nameEn": "Vav",
    "nameGu": "વાવ",
    "labelSource": "lgd-local-name"
  }
] as const satisfies readonly GujaratSubdistrict[]

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
    .replace(/\b(?:taluka|taluk|tehsil|district)\b/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '')
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
  return `${location.nameGu} / ${location.nameEn}`
}
