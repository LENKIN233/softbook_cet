#!/usr/bin/env node

import {spawnSync} from 'node:child_process';

const envId = process.env.CLOUDBASE_ENV_ID || 'test-d2gzcyxr9f7e80972';
const collections = [
  'softbook_account_deletions',
  'softbook_auth_challenges',
  'softbook_auth_rate_limits',
  'softbook_auth_sessions',
  'softbook_card_source_versions',
  'softbook_card_sources',
  'softbook_memberships',
  'softbook_daily_check_ins',
  'softbook_daily_progress',
  'softbook_learning_event_cursors',
  'softbook_learning_events',
  'softbook_learning_event_sequences',
  'softbook_learning_migration_revisions',
  'softbook_learning_sessions',
  'softbook_learning_states',
  'softbook_space_actions',
  'softbook_space_states',
];
const now = new Date().toISOString();
const command = JSON.stringify(
  collections.map(collectionName => ({
    TableName: collectionName,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: collectionName,
      updates: [
        {
          q: {_id: '__provision__'},
          u: {
            $set: {
              kind: 'provision',
              updated_at: now,
            },
          },
          upsert: true,
        },
      ],
    }),
  })),
);
const result = spawnSync(
  'tcb',
  ['db', 'nosql', 'execute', '-e', envId, '--command', command, '--json'],
  {
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
