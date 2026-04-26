export function detectLanguageFromState(homeState: string): string {
  const s = homeState.trim().toLowerCase();
  if (s.includes('karnataka')) return 'kn';
  if (s.includes('tamil') || s.includes('tamilnadu')) return 'ta';
  if (s.includes('andhra') || s.includes('telangana')) return 'te';
  const hindiStates = ['uttar pradesh', 'bihar', 'rajasthan', 'madhya pradesh', 'haryana', 'punjab', 'himachal', 'uttarakhand', 'jharkhand', 'chhattisgarh', 'delhi'];
  if (hindiStates.some(h => s.includes(h))) return 'hi';
  return 'en';
}
