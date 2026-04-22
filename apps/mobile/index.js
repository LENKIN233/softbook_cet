/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { SOFTBOOK_APP_RUNTIME_CONFIG } from './src/runtime/appRuntimeConfig';
import { installSoftbookAppRuntimeConfig } from './src/runtime/installRuntimeConfig';

installSoftbookAppRuntimeConfig(SOFTBOOK_APP_RUNTIME_CONFIG);

AppRegistry.registerComponent(appName, () => App);
