import test from 'node:test';
import assert from 'node:assert/strict';
const fresh = name => import('../src/rules.js?' + name);
test('initialization is shared; synchronous API uses installed engine', async () => {
  const rules = await fresh('success');
  let loads = 0;
  const load = async () => { loads++; return {default:async () => {}, rank_bonus_wasm:rules.rankBonusJavaScript, rank_cost_wasm:rules.rankCostJavaScript, basic_stat_bonus_wasm:rules.basicStatBonusJavaScript}; };
  const first = rules.initializeRankBonusEngine({load});
  assert.equal(first, rules.initializeRankBonusEngine({load}));
  assert.equal((await first).backend, 'wasm');
  assert.equal(loads, 1);
  for (const input of [null, undefined, '', '21', 'bad', NaN, Infinity, -Infinity, -1, .5]) {
    for (const progression of ['combined', 'special', undefined, null, {}, 1]) {
      assert.equal(rules.rankBonus(input, progression), rules.rankBonusJavaScript(input, progression));
    }
  }
  assert.equal(rules.rankBonusEngineStatus().calls, 60);
  for (const costs of [[], [2,4,6], [NaN], [Infinity,-Infinity], [1e16,1,-1e16], ['2',4], [,2], null]) {
    for (const ranks of [-Infinity, -1, 0, 1.9, 2, Infinity, NaN, '2', null]) {
      assert.equal(rules.rankCost(costs, ranks), rules.rankCostJavaScript(costs, ranks));
    }
  }
  assert.ok(rules.rankCostEngineStatus().calls > 0);
});
test('failed loading explicitly falls back without marking Wasm active', async () => {
  const rules = await fresh('failure');
  const status = await rules.initializeRankBonusEngine({load:async () => { throw new Error('missing artifact'); }});
  assert.equal(status.backend, 'javascript');
  assert.equal(status.reason, 'missing artifact');
  assert.equal(rules.rankBonus(21, 'combined'), 82);
});
test('timeout prevents late initialization from silently switching backend', async () => {
  const rules = await fresh('timeout');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pending = rules.initializeRankBonusEngine({timeoutMs:5, load:async () => {
    await gate; return {default:async () => {}, rank_bonus_wasm:rules.rankBonusJavaScript, rank_cost_wasm:rules.rankCostJavaScript, basic_stat_bonus_wasm:rules.basicStatBonusJavaScript};
  }});
  assert.equal((await pending).backend, 'javascript');
  release();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(rules.rankBonusEngineStatus().backend, 'javascript');
  assert.equal(rules.basicStatBonusEngineStatus().backend, 'javascript');
  assert.equal(rules.basicStatBonus(99), 9);
  assert.equal(rules.basicStatBonusEngineStatus().calls, 0);
});

test('old Wasm module without rankCost falls back atomically', async () => {
  const rules = await fresh('old-module');
  await rules.initializeRankBonusEngine({load:async () => ({default:async () => {}, rank_bonus_wasm:rules.rankBonusJavaScript})});
  assert.equal(rules.rankBonusEngineStatus().backend, 'javascript');
  assert.equal(rules.rankCostEngineStatus().backend, 'javascript');
  assert.equal(rules.rankCost([2,4,6], 2), 6);
});

test('stat bonus dispatch preserves numeric parity and non-number fallback', async () => {
  const rules = await fresh('stat-success');
  await rules.initializeRankBonusEngine({load:async () => ({default:async () => {}, rank_bonus_wasm:rules.rankBonusJavaScript, rank_cost_wasm:rules.rankCostJavaScript, basic_stat_bonus_wasm:rules.basicStatBonusJavaScript})});
  for (const input of [1,10.5,11,30,31,70,90,99,100,100.5,NaN,Infinity,-Infinity]) {
    assert.equal(rules.basicStatBonus(input), rules.basicStatBonusJavaScript(input));
  }
  assert.equal(rules.basicStatBonusEngineStatus().calls, 13);
  for (const input of ['100','99',null,undefined,true,false,{valueOf:() => 100}]) {
    assert.equal(rules.basicStatBonus(input), rules.basicStatBonusJavaScript(input));
  }
  assert.equal(rules.basicStatBonusEngineStatus().calls, 13);
});
test('module missing stat bonus export falls back atomically', async () => {
  const rules = await fresh('missing-stat');
  await rules.initializeRankBonusEngine({load:async () => ({default:async () => {}, rank_bonus_wasm:rules.rankBonusJavaScript, rank_cost_wasm:rules.rankCostJavaScript})});
  assert.equal(rules.basicStatBonusEngineStatus().backend, 'javascript');
  assert.equal(rules.rankBonusEngineStatus().backend, 'javascript');
  assert.equal(rules.rankCostEngineStatus().backend, 'javascript');
  assert.equal(rules.basicStatBonus(100), 10);
});
