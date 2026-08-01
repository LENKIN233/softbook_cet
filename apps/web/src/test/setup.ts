import '@testing-library/jest-dom/vitest';
import {vi} from 'vitest';

document.documentElement.lang = 'zh-CN';
document.title = '软书四六级';
window.scrollTo = vi.fn();
