/** Local server entry: same authenticated App, remote repositories and API contracts. */
import React from 'react';
import {AppRegistry, Text, View} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import profile from './backend-runtime.local.json';
import {createSoftbookRemoteRuntimeConfig} from './src/runtime/appRuntimeConfig';
import {installSoftbookAppRuntimeConfig} from './src/runtime/installRuntimeConfig';
import {installLocalBackendTransport} from './src/runtime/localBackendTransport';
installLocalBackendTransport(profile.baseUrl);
installSoftbookAppRuntimeConfig(createSoftbookRemoteRuntimeConfig(profile));
function LocalBackendApp() {
  return <View style={{flex: 1}}><View style={{padding: 8, paddingTop: 52, backgroundColor: '#f6f4ee'}}><Text>本地联调：验证码见启动终端，不发送短信。</Text></View><App softbookRemoteRuntimeProfile={profile}/></View>;
}
AppRegistry.registerComponent(appName, () => LocalBackendApp);
