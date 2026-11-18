const assert = require('node:assert/strict');
const test = require('node:test');
const { summarize, toGeneralMatch } = require('./hardcore-model.js');

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

test('killer one-life rules clear wins, eliminate losses, and break streaks on draws', () => {
  const match = (character, outcome) => ({ character, outcome });
  const run = {
    role: 'killer',
    roster: ['The Trapper', 'The Wraith', 'The Hillbilly', 'The Nurse'],
    active: 'The Wraith',
    rules: { eliminate: true, clear: true, disconnect: false },
    matches: [
      match('The Trapper', '3 kills'),
      match('The Wraith', '2 kills'),
      match('The Hillbilly', '1 kill'),
      match('The Nurse', '4 kills'),
      match('The Wraith', 'Disconnected')
    ]
  };
  assert.deepEqual(summarize(run), {
    roster: {
      'The Trapper': 'Cleared', 'The Wraith': 'Playing',
      'The Hillbilly': 'Eliminated', 'The Nurse': 'Cleared'
    },
    escapes: 2, deaths: 1, kills: 10, streak: 1, remaining: 1, latest: run.matches.at(-1)
  });
  assert.equal(summarize({ ...run, rules: { ...run.rules, disconnect: true } }).remaining, 0);
  assert.equal(summarize({ ...run, matches: run.matches.slice(0, 2) }).streak, 0);
});

test('killer transfers keep kill counts and leave disconnect results for the user to classify', () => {
  const run = {
    role: 'killer', title: 'Killer one-life', id: '08a4ee31-5f37-4261-be37-eaa9dd623158',
    matches: [
      { character: 'The Trapper', outcome: '2 kills', at: '2026-10-22T12:00:00Z', queue: 'solo' },
      { character: 'The Wraith', outcome: 'Disconnected', at: '2026-10-22T12:15:00Z' }
    ]
  };
  assert.equal(toGeneralMatch(run, 0).result, 2);
  assert.equal(toGeneralMatch(run, 0).role, 'K');
  assert.equal(toGeneralMatch(run, 0).queue, 'solo');
  assert.equal(toGeneralMatch(run, 1).result, null);
  assert.match(toGeneralMatch(run, 1).notes, /Disconnected/);
});
