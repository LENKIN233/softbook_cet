import '@testing-library/jest-dom/vitest';
import {vi} from 'vitest';

document.documentElement.lang = 'zh-CN';
document.title = '软书四六级';
window.scrollTo = vi.fn();

const webLockTails = new Map<string, Promise<void>>();
Object.defineProperty(window.navigator, 'locks', {
  configurable: true,
  value: {
    request<Result>(name: string, callback: () => Promise<Result>) {
      const previous = webLockTails.get(name) ?? Promise.resolve();
      const result = previous.then(callback);
      const tail = result.then(
        () => undefined,
        () => undefined,
      );
      webLockTails.set(name, tail);
      void tail.finally(() => {
        if (webLockTails.get(name) === tail) {
          webLockTails.delete(name);
        }
      });
      return result;
    },
  },
});
