/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { resolveSoftbookAppRuntimeConfig } from './src/runtime/appRuntimeConfig';
import { installSoftbookAppRuntimeConfig } from './src/runtime/installRuntimeConfig';
import { readNativeMobileReleaseRuntimeProfile } from './src/runtime/mobileReleaseRuntimeProfile';

const nativeReleaseProfile = readNativeMobileReleaseRuntimeProfile({
  isDevelopment: __DEV__,
});

installSoftbookAppRuntimeConfig(
  resolveSoftbookAppRuntimeConfig({
    ...(nativeReleaseProfile ? { remoteProfile: nativeReleaseProfile } : {}),
  }),
);

AppRegistry.registerComponent(appName, () => App);
