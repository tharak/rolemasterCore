import test from 'node:test';
import assert from 'node:assert/strict';
import {rankBonus, rankCost, openEndedD100, parseCriticalSymbols} from '../src/rules.js';

const die = values => {
  const rolls = values[Symbol.iterator]();
  return () => {
    const next = rolls.next();
    assert.equal(next.done, false, 'unexpected extra die roll');
    return next.value;
  };
};

test('open-ended d100 continues high and low rolls until a non-continuing die', () => {
  assert.deepEqual(openEndedD100(die([96, 100, 42])), {
    first:96, dice:[96, 100, 42], total:238, unmodified:false
  });
  assert.deepEqual(openEndedD100(die([5, 96, 24])), {
    first:5, dice:[5, -96, -24], total:-115, unmodified:false
  });
  assert.deepEqual(openEndedD100(die([95])), {
    first:95, dice:[95], total:95, unmodified:false
  });
});

test('unmodified exceptions stop only when enabled', () => {
  assert.deepEqual(openEndedD100(die([100]), true), {
    first:100, dice:[100], total:100, unmodified:true
  });
  assert.deepEqual(openEndedD100(die([66]), true), {
    first:66, dice:[66], total:66, unmodified:true
  });
  assert.equal(openEndedD100(die([100, 20])).total, 120);
});

test('rank progressions preserve zero-rank penalties and threshold changes', () => {
  assert.equal(rankBonus(0, 'standard'), -15);
  assert.equal(rankBonus(10, 'standard'), 30);
  assert.equal(rankBonus(20, 'standard'), 50);
  assert.equal(rankBonus(31, 'standard'), 61);
  assert.equal(rankBonus(0, 'category'), -15);
  assert.equal(rankBonus(11, 'category'), 21);
  assert.equal(rankBonus(21, 'category'), 31);
  assert.equal(rankBonus(0, 'combined'), -30);
  assert.equal(rankBonus(21, 'combined'), 82);
  assert.equal(rankBonus(1, 'limited'), 1);
  assert.equal(rankBonus(30, 'limited'), 25);
  assert.equal(rankBonus(31, 'special'), 153);
});

test('rank cost sums only purchased slots', () => {
  assert.equal(rankCost([2, 4, 6], 2), 6);
  assert.equal(rankCost([2, 4, 6], 0), 0);
  assert.equal(rankCost(null, 2), 0);
});

test('critical symbols produce timed and persistent effects', () => {
  assert.deepEqual(parseCriticalSymbols('+3H 2∑∏ 3(π−20) 2∫ (−15)'), [
    {kind:'hits', amount:3},
    {kind:'stunNoParry', roundsLeft:2},
    {kind:'mustParry', roundsLeft:3, amount:20},
    {kind:'bleed', amount:2, roundsLeft:null},
    {kind:'penalty', amount:15, roundsLeft:null, durationLabel:'until healed'}
  ]);
  assert.deepEqual(parseCriticalSymbols('2∑ 3∏ 1π 2(+10)'), [
    {kind:'stun', roundsLeft:2},
    {kind:'noParry', roundsLeft:3},
    {kind:'mustParry', roundsLeft:1, amount:0},
    {kind:'bonus', amount:10, roundsLeft:2}
  ]);
});
