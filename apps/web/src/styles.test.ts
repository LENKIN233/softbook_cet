import {readFileSync} from 'node:fs';

describe('Web narrow viewport containment', () => {
  it('uses the shared navigation clearance for scrolling and keyboard focus', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const marker = /@media\s*\(max-width:\s*760px\)/.exec(css);
    expect(marker).not.toBeNull();
    const mobile = css.slice(marker!.index);
    expect(mobile).toMatch(/--mobile-navigation-clearance:\s*calc\([^;{}]+env\(safe-area-inset-bottom\)\)/);
    expect(mobile).toMatch(/scroll-padding-bottom:\s*var\(--mobile-navigation-clearance\)/);
    expect(mobile).toMatch(/scroll-margin-block:[^;{}]*var\(--mobile-navigation-clearance\)/);
    expect(mobile).toMatch(/\.route-rail\s*\{\s*position:\s*fixed/);
  });
});
