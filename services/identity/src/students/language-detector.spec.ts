import { detectLanguageFromState } from './language-detector';

describe('detectLanguageFromState', () => {
  it.each([
    ['Karnataka', 'kn'],
    ['Tamil Nadu', 'ta'],
    ['tamilnadu', 'ta'],
    ['Andhra Pradesh', 'te'],
    ['Telangana', 'te'],
    ['Delhi', 'hi'],
    ['Uttar Pradesh', 'hi'],
    ['Rajasthan', 'hi'],
    ['Maharashtra', 'en'],
    ['', 'en'],
    ['  ', 'en'],
    ['\nKarnataka\n', 'kn'],
    ['KA', 'en'],
    ['TN', 'en'],
    ['Goa', 'en'],
  ])('state "%s" → "%s"', (state, lang) => {
    expect(detectLanguageFromState(state)).toBe(lang);
  });
});
