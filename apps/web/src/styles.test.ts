import {readFileSync} from 'node:fs';

describe('Web narrow viewport containment', () => {
  it('keeps focused controls above the fixed route rail at 320 x 568', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const narrowViewportRules = css.slice(css.indexOf('@media (max-width: 760px)'));

    expect(narrowViewportRules).toContain(
      '--mobile-navigation-clearance: calc(116px + env(safe-area-inset-bottom))',
    );
    expect(narrowViewportRules).toContain(
      'html, body { scroll-padding-bottom: var(--mobile-navigation-clearance); }',
    );
    expect(narrowViewportRules).toContain(
      'scroll-margin-block: 1rem var(--mobile-navigation-clearance)',
    );
    expect(narrowViewportRules).toContain(
      '.route-rail { position: fixed;',
    );
  });
});
