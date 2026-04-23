import type {SoftbookAppRuntimeConfig} from '../src/learning/learningRuntimeConfig';
import { readSoftbookAppRuntimeConfig } from '../src/learning/learningRuntimeConfig';
import { SOFTBOOK_APP_RUNTIME_CONFIG } from '../src/runtime/appRuntimeConfig';
import { installSoftbookAppRuntimeConfig } from '../src/runtime/installRuntimeConfig';

declare global {
  var __SOFTBOOK_CET_RUNTIME_CONFIG__: SoftbookAppRuntimeConfig | undefined;
}

afterEach(() => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
});

test('installs the tracked app runtime config into global runtime state', () => {
  expect(global.__SOFTBOOK_CET_RUNTIME_CONFIG__).toBeUndefined();

  installSoftbookAppRuntimeConfig(SOFTBOOK_APP_RUNTIME_CONFIG);

  expect(readSoftbookAppRuntimeConfig()).toEqual(SOFTBOOK_APP_RUNTIME_CONFIG);
});
