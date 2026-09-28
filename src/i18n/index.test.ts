import { describe, it, expect } from 'vitest';
import { getLocale, registerLocale, enLocale, zhLocale } from './index.js';

describe('i18n Locale Resolver & Registration', () => {
  it('should return default English for undefined or empty input', () => {
    expect(getLocale()).toBe(enLocale);
    expect(getLocale('')).toBe(enLocale);
    expect(getLocale('unknown-lang')).toBe(enLocale);
  });

  it('should resolve built-in languages and handle subtag prefixes', () => {
    expect(getLocale('zh')).toBe(zhLocale);
    expect(getLocale('zh-CN')).toBe(zhLocale);
    expect(getLocale('zh-TW')).toBe(zhLocale);
    expect(getLocale('en-US')).toBe(enLocale);
    expect(getLocale('en-GB')).toBe(enLocale);
  });

  it('should allow registering new languages and resolving them', () => {
    const frLocale = {
      ...enLocale,
      locale: 'fr',
      vdot: {
        ...enLocale.vdot,
        zones: {
          ...enLocale.vdot.zones,
          E: { name: 'Allure Facile (E)', shortName: 'Facile', description: 'Endurance de base' },
        },
      },
    };

    registerLocale('fr', frLocale);
    expect(getLocale('fr').vdot.zones.E.name).toBe('Allure Facile (E)');
    expect(getLocale('fr-FR').vdot.zones.E.name).toBe('Allure Facile (E)');
  });

  it('should allow passing a custom dictionary object directly with fallback', () => {
    const custom = getLocale({
      vdot: {
        zones: {
          E: { name: 'My Custom Easy Pace', shortName: 'CustomE', description: 'Custom description' },
        },
      } as any,
    });

    expect(custom.vdot.zones.E.name).toBe('My Custom Easy Pace');
    // Unchanged zones fallback to English
    expect(custom.vdot.zones.M.name).toBe(enLocale.vdot.zones.M.name);
  });
});
