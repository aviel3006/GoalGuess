// Countries offered on the edit-profile screen. The code is saved to auth
// user_metadata.country and shown as a flag next to the name on the profile.
export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: 'IL', name: 'ישראל' },
  { code: 'US', name: 'ארצות הברית' },
  { code: 'GB', name: 'בריטניה' },
  { code: 'FR', name: 'צרפת' },
  { code: 'DE', name: 'גרמניה' },
  { code: 'ES', name: 'ספרד' },
  { code: 'IT', name: 'איטליה' },
  { code: 'PT', name: 'פורטוגל' },
  { code: 'NL', name: 'הולנד' },
  { code: 'BE', name: 'בלגיה' },
  { code: 'CH', name: 'שווייץ' },
  { code: 'AT', name: 'אוסטריה' },
  { code: 'GR', name: 'יוון' },
  { code: 'CY', name: 'קפריסין' },
  { code: 'TR', name: 'טורקיה' },
  { code: 'PL', name: 'פולין' },
  { code: 'CZ', name: 'צ׳כיה' },
  { code: 'HU', name: 'הונגריה' },
  { code: 'RO', name: 'רומניה' },
  { code: 'BG', name: 'בולגריה' },
  { code: 'HR', name: 'קרואטיה' },
  { code: 'RS', name: 'סרביה' },
  { code: 'UA', name: 'אוקראינה' },
  { code: 'RU', name: 'רוסיה' },
  { code: 'SE', name: 'שוודיה' },
  { code: 'NO', name: 'נורווגיה' },
  { code: 'DK', name: 'דנמרק' },
  { code: 'FI', name: 'פינלנד' },
  { code: 'IE', name: 'אירלנד' },
  { code: 'CA', name: 'קנדה' },
  { code: 'MX', name: 'מקסיקו' },
  { code: 'BR', name: 'ברזיל' },
  { code: 'AR', name: 'ארגנטינה' },
  { code: 'UY', name: 'אורוגוואי' },
  { code: 'CO', name: 'קולומביה' },
  { code: 'CL', name: 'צ׳ילה' },
  { code: 'MA', name: 'מרוקו' },
  { code: 'EG', name: 'מצרים' },
  { code: 'NG', name: 'ניגריה' },
  { code: 'ZA', name: 'דרום אפריקה' },
  { code: 'ET', name: 'אתיופיה' },
  { code: 'AE', name: 'איחוד האמירויות' },
  { code: 'IN', name: 'הודו' },
  { code: 'CN', name: 'סין' },
  { code: 'JP', name: 'יפן' },
  { code: 'KR', name: 'דרום קוריאה' },
  { code: 'AU', name: 'אוסטרליה' },
];

export function flagEmoji(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
