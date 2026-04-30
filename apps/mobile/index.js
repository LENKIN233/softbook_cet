/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { resolveSoftbookAppRuntimeConfig } from './src/runtime/appRuntimeConfig';
import { installSoftbookAppRuntimeConfig } from './src/runtime/installRuntimeConfig';

installSoftbookAppRuntimeConfig(resolveSoftbookAppRuntimeConfig());

AppRegistry.registerComponent(appName, () => App);
