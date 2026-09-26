/** Local server entry: same authenticated App, remote repositories and API contracts. */
import React from 'react';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import profile from './backend-runtime.local.json';
import {createSoftbookRemoteRuntimeConfig} from './src/runtime/appRuntimeConfig';
import {installSoftbookAppRuntimeConfig} from './src/runtime/installRuntimeConfig';
import {installLocalBackendTransport} from './src/runtime/localBackendTransport';
installLocalBackendTransport(profile.baseUrl);
installSoftbookAppRuntimeConfig(createSoftbookRemoteRuntimeConfig(profile));
function LocalBackendApp() {
  return <App softbookRemoteRuntimeProfile={profile}/>;
}
AppRegistry.registerComponent(appName, () => LocalBackendApp);
