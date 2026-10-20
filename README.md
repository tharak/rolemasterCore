# rolemasterCore

Reusable Rolemaster rules extracted from `tharak/rolemaster-fieldbook` at commit `a1bb374`. This private repository is the source of truth for the shared engine. It contains JavaScript ES modules and pure Rust rule crates, with no application UI, browser storage, arena economy, recruitment, or Ludus progression.

## Use from Node or a browser

```js
import {rules, characterRules, simulateGuildBattle, seededRandom} from './src/index.js';

rules.rankBonus(21, 'combined'); // 82
characterRules.basicStatBonus(99); // 9
const result = simulateGuildBattle(party, enemies, tables, seededRandom('match-1'), {
  recordPlayback: true,
  persistentConsequences: true,
});
```

Consumers supply contenders, parsed rule tables, random-number generators, and game state. There is no fetch or filesystem access in the engine. Load table data in the application. Tests carry reference-table fixtures; they are not runtime assets. No source PDFs are included.

The private package name is `@tharak/rolemaster-core`. Root exports use namespaces to avoid collisions; subpath exports expose individual modules, for example `@tharak/rolemaster-core/character-rules`. Native relative imports also work without a bundler, package installation, or build step.

### Combat support

`simulateGuildBattle` accepts optional `support: {clock, auras}`, `geometry: {partyX, enemyX, formationSpacing, attendantX, meleeReach}`, and `elements: {elementNames, elementTables}`. These are caller-supplied policies, not Ludus configuration imports. The fieldbook adapter passes its existing configuration and maps the legacy `ludusSupport` option to `support`, preserving combat behavior.

### Optional Rust acceleration

JavaScript is the default backend. To enable acceleration, call `rules.initializeRankBonusEngine({load})` with a loader returning a Wasm binding with an async `default()` initializer and the existing numeric exports. Loading failure or timeout retains JavaScript behavior. The host owns its Wasm packaging and any HTML rendering adapters. Pure Rust rules live in `rust/crates/game-rules` and `rust/crates/rolemaster-rules`.

## Verify

```sh
npm test
# Alternative for restricted environments that cannot isolate test subprocesses:
node --test --test-isolation=none tests/*.test.mjs
cargo test --manifest-path rust/Cargo.toml --locked
```

Tests include six complete combat-output fingerprints captured before extraction, with and without support effects, plus rules, criticals, healing, economics, items, encounters, and optional-backend fallback tests.

## Fieldbook integration

The fieldbook vendors a pinned revision under `vendor/rolemaster-core` using Git subtree. Its `src` compatibility modules re-export this implementation; Ludus and guild adapters stay in the fieldbook. This keeps static hosting self-contained and does not require a host to authenticate to this private repository. Make engine changes here, verify them, commit and push, then pull the subtree into each consumer. Do not maintain divergent engine implementations in application folders.

The extraction preserves the original implementation and rule data. It does not change ownership or licensing of the original source material or grant a new redistribution license.

## Incremental Rust tactical engine

`rust/crates/rolemaster-tactical` provides serializable `BattleState`, `RoundPlan`,
`ActionDeclaration`, and `CombatEvent` types. Validate declarations, call `commit`,
then `step` once per animation/save boundary. Failed steps are atomic. The engine
owns positions, conditions, initiative, power points and deterministic RNG; hosts
own scenario profiles, planning/AI, presentation and save storage.

`node scripts/build-tactical-data.mjs` regenerates `data/tactical-v1.json` from
our audited table fixtures and JS critical normalizer. It also generates 945
cross-language attack lookup cases. The pack contains no PDFs. Existing JS APIs
remain unchanged. This tactical API is experimental until the complete source
rule audit and browser integration checks have finished; do not treat it as a
complete Rolemaster rules implementation.

### Simplified tactical turns

`BattleState::new_simplified` opts into individual Normal turns. The existing
`BattleState::new`, full-round `commit`/`step` API and JavaScript fieldbook rules
retain their behavior. `BattleState.turns` contains the initiative order, active
actor, position, remaining movement, main-action availability, parry reserves,
and monotonic command sequence. Initiative is 2d10 plus existing status/profile
modifiers, with ID ties and no declaration-dependent movement penalty.

Submit `command_turn(actor, expected_sequence, TurnCommand, data)` and play its
returned events. Then call `advance_turn_playback`; a movement command retains
the actor, while a main action advances the turn. The host chooses enemy actions
when that enemy becomes active. The core validates each command atomically;
duplicates, stale sequences and out-of-turn actors do not consume resources or
RNG. Serialize the complete battle, including the decimal-string RNG, to resume
at either side of the playback boundary. A skipped turn is also a playback
boundary, and expires that fighter's reserve. Round cleanup runs once after the
last initiative entry, including the final round.

Movement is at most half base movement before the main action. Attacks use their
full normal resolution; casts use zero preparation. Reload advances 100 units,
weapon recovery one round, and every utility/cast/parry/wait consumes the main
action. `TurnCommand::Parry` requires a usable melee weapon and reserves its
nonnegative full OB against all melee attackers until the defender's next turn.
Lookup searches for the smallest expenditure removing both hits and criticals;
insufficient reserves are spent completely. Misses and fumbles cost nothing;
missiles and spells bypass the reserve. Parry expenditure never rolls extra dice.
