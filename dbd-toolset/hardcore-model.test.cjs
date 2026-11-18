const assert = require('node:assert/strict');
const test = require('node:test');
const { summarize } = require('./hardcore-model.js');

test('one-life rules derive roster state and the scoreboard from logged matches', () => {
  const run = {
    roster: ['Meg Thomas', 'Claudette Morel', 'Dwight Fairfield', 'Jake Park'],
    rules: { eliminate: true, clear: true, disconnect: false },
    active: 'Jake Park',
    matches: [
      { character: 'Meg Thomas', outcome: 'Sacrificed', cause: 'Hook' },
      { character: 'Claudette Morel', outcome: 'Escaped' },
      { character: 'Jake Park', outcome: 'Disconnected' }
    ]
  };
  assert.deepEqual(summarize(run), {
    roster: {
      'Meg Thomas': 'Eliminated', 'Claudette Morel': 'Escaped',
      'Dwight Fairfield': 'Available', 'Jake Park': 'Playing'
    },
    escapes: 1, deaths: 1, streak: 1, remaining: 2, latest: run.matches[2]
  });
  assert.equal(summarize({ ...run, rules: { ...run.rules, disconnect: true } }).roster['Jake Park'], 'Eliminated');
  assert.equal(summarize({ ...run, rules: { eliminate: false, clear: false } }).remaining, 4);
});
