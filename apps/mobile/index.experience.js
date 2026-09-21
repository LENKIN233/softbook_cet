/** Explicit Debug-only reading QA entry; normal local and Release entries never import it. */
import React from 'react';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {SOFTBOOK_APP_RUNTIME_CONFIG} from './src/runtime/appRuntimeConfig';
import {installSoftbookAppRuntimeConfig} from './src/runtime/installRuntimeConfig';
import {localLearningCardSource} from './src/learning/localCardSource';
import selectedIds from './e2e/experience/reading-cards.json';

if (!__DEV__) throw new Error('The experience entry requires a Debug bundle.');
if (!Array.isArray(selectedIds) || selectedIds.length !== 2 || new Set(selectedIds).size !== 2) {
  throw new Error('The reading journey requires exactly two distinct source cards.');
}
const loadFullLibrary = localLearningCardSource.loadCards;
localLearningCardSource.loadCards = subject => {
  if (subject !== 'cet4') throw new Error('The bounded reading journey covers CET4 only.');
  const full = loadFullLibrary(subject);
  const selected = selectedIds.map(id => full.find(card => card.card_id === id));
  if (selected[0]?.interaction_id !== 'multiple_choice' || selected[1]?.interaction_id !== 'elimination') {
    throw new Error('The reading samples changed; update the journey with its source cards.');
  }
  return selected;
};
installSoftbookAppRuntimeConfig(SOFTBOOK_APP_RUNTIME_CONFIG);
AppRegistry.registerComponent(appName, () => () => <App deviceOnly />);
