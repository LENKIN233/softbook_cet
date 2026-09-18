const assert = require('node:assert/strict');
const test = require('node:test');
const {createMemoryStore} = require('../index');

test('an empty backend never silently seeds example cards', async () => {
  for (const track of ['cet4', 'cet6']) {
    const store = createMemoryStore();
    assert.throws(() => store.getCardSource(track, {allowDevelopmentDefault: true}), {code: 'card_source_missing'});
    assert.equal(store.snapshot().cardSources.size, 0);
  }
});
