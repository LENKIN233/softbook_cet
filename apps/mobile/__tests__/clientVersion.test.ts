import {
  assertInstalledClientVersionAtLeast,
  ClientUpdateRequiredError,
  createWebBuildClientIdentity,
  findClientUpdateRequiredError,
} from '../src/runtime/clientVersion';

test('creates an explicit strict web build identity for scalar release minimums', () => {
  const identity = createWebBuildClientIdentity('1.4.0+web.27');

  expect(identity).toEqual({platform: 'web', version: '1.4.0+web.27'});
  expect(() =>
    assertInstalledClientVersionAtLeast(identity, '1.4.0'),
  ).not.toThrow();
  expect(() => createWebBuildClientIdentity('build-27')).toThrow(
    'Web build version must use strict semantic version form.',
  );
});

test('reports an update-required condition through nested bootstrap errors', () => {
  let thrown: unknown;
  try {
    assertInstalledClientVersionAtLeast(
      createWebBuildClientIdentity('1.0.0'),
      '1.1.0',
    );
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(ClientUpdateRequiredError);
  expect(findClientUpdateRequiredError({integrityCause: thrown})).toMatchObject({
    installedVersion: '1.0.0',
    platform: 'web',
    requiredVersion: '1.1.0',
  });
});

test('fails closed when a web build is checked against a native controlled-pilot table', () => {
  expect(() =>
    assertInstalledClientVersionAtLeast(
      createWebBuildClientIdentity('9.0.0'),
      {android: '1.0.0', ios: '1.0.0'},
    ),
  ).toThrow(
    'Controlled-pilot native minimum client versions do not authorize web builds.',
  );
});
