#!/usr/bin/env node

import assert from 'node:assert/strict';
import {minimatch} from 'minimatch';

assert.equal(
  minimatch('src/App.tsx', 'src/{App,Other}.tsx'),
  true,
);

console.log(
  'PASS: modern ESM minimatch resolves the patched brace-expansion API.',
);
