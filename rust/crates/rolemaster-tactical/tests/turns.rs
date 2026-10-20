use rolemaster_tactical::{data::*, *};
use std::collections::BTreeSet;
fn fighter(id: u32, team: u8, q: i32) -> Fighter {
    Fighter {
        id,
        team,
        name: format!("Fighter {id}"),
        level: 5,
        pos: Hex { q, r: 0 },
        max_hits: 80,
        damage: 0,
        pp: 20,
        max_pp: 20,
        armor: 1,
        db: 20,
        quickness: 0,
        strength: 0,
        base_move: 50,
        rr: 0,
        spell_bonus: 50,
        bolt_ob: 70,
        weapons: vec![Weapon {
            name: "Broadsword".into(),
            ob: 60,
            table: "A-10.9.2".into(),
            critical: "A-10.10.5".into(),
            range: 5,
            reload: 0,
            fumble: 3,
            two_handed: false,
        }],
        weapon: 0,
        reload_left: 0,
        weapon_recovery: Default::default(),
        broken_weapons: Default::default(),
        spells: vec![
            Spell::HealingI,
            Spell::HealingIII,
            Spell::BlessI,
            Spell::Blur,
            Spell::ShockBoltI,
            Spell::JoltsI,
            Spell::MinorPain,
        ],
        equipment: vec![],
        conditions: vec![],
        preparation: None,
        dead: false,
        disabling: false,
        death_round: None,
        initiative_override: None,
    }
}
fn battle() -> BattleState {
    let mut a = fighter(1, 0, 0);
    a.quickness = 100;
    BattleState::new_simplified(
        vec![a, fighter(2, 1, 3), fighter(3, 1, 4)],
        8,
        BTreeSet::new(),
        1234,
    )
    .unwrap()
}
fn command(b: &mut BattleState, c: TurnCommand) {
    let t = b.turns.as_ref().unwrap();
    b.command_turn(t.active, t.sequence, c, &DataPack::bundled())
        .unwrap();
}
fn wait(b: &mut BattleState) {
    command(b, TurnCommand::Act(Action::Wait));
    b.advance_turn_playback().unwrap();
}
#[test]
fn initiative_is_stable_and_has_no_movement_penalty() {
    let b = battle();
    assert_eq!(b.turns.as_ref().unwrap().active, 1);
    let mut fighters = b.fighters.clone();
    fighters.reverse();
    let c = BattleState::new_simplified(fighters, 8, BTreeSet::new(), 1234).unwrap();
    assert_eq!(b.initiative, c.initiative);
    assert_eq!(
        b.turns.as_ref().unwrap().order,
        c.turns.as_ref().unwrap().order
    );
    let mut fighters = b.fighters.clone();
    for f in &mut fighters {
        f.initiative_override = Some(1);
    }
    let tie = BattleState::new_simplified(fighters, 8, BTreeSet::new(), 1).unwrap();
    assert_eq!(tie.turns.unwrap().order, vec![1, 2, 3]);
}
#[test]
fn movement_one_action_duplicate_rejection_and_exact_resume() {
    let mut b = battle();
    let token = b.turns.as_ref().unwrap().sequence;
    let movement = TurnCommand::Move {
        path: vec![Hex { q: 1, r: 0 }, Hex { q: 2, r: 0 }],
    };
    command(&mut b, movement.clone());
    assert_eq!(b.turns.as_ref().unwrap().movement_remaining, 15);
    let before = serde_json::to_string(&b).unwrap();
    assert!(b
        .command_turn(1, token, movement, &DataPack::bundled())
        .is_err());
    assert_eq!(serde_json::to_string(&b).unwrap(), before);
    let mut loaded: BattleState = serde_json::from_str(&before).unwrap();
    loaded.validate_state().unwrap();
    for state in [&mut b, &mut loaded] {
        state.advance_turn_playback().unwrap();
        command(state, TurnCommand::Act(Action::Melee { target: 2 }));
        assert!(!state.turns.as_ref().unwrap().main_available);
        assert_eq!(state.turns.as_ref().unwrap().movement_remaining, 0);
        state.advance_turn_playback().unwrap();
    }
    assert_eq!(
        serde_json::to_string(&b).unwrap(),
        serde_json::to_string(&loaded).unwrap()
    );
    let before = serde_json::to_string(&b).unwrap();
    let t = b.turns.as_ref().unwrap();
    assert!(b
        .command_turn(
            1,
            t.sequence,
            TurnCommand::Act(Action::Wait),
            &DataPack::bundled()
        )
        .is_err());
    assert_eq!(serde_json::to_string(&b).unwrap(), before);
}
#[test]
fn movement_does_not_reduce_attack_and_illegal_paths_are_atomic() {
    let mut b = battle();
    let before = serde_json::to_string(&b).unwrap();
    let t = b.turns.as_ref().unwrap();
    assert!(b
        .command_turn(
            1,
            t.sequence,
            TurnCommand::Move {
                path: vec![Hex { q: 5, r: 0 }]
            },
            &DataPack::bundled()
        )
        .is_err());
    assert_eq!(serde_json::to_string(&b).unwrap(), before);
    command(
        &mut b,
        TurnCommand::Move {
            path: vec![Hex { q: 1, r: 0 }, Hex { q: 2, r: 0 }],
        },
    );
    b.advance_turn_playback().unwrap();
    let mut stationary = b.clone();
    stationary.turns.as_mut().unwrap().movement_remaining = 25;
    for state in [&mut b, &mut stationary] {
        command(state, TurnCommand::Act(Action::Melee { target: 2 }));
    }
    assert_eq!(b.rng, stationary.rng);
    assert_eq!(b.fighters[1].damage, stationary.fighters[1].damage);
    assert_eq!(
        serde_json::to_string(&b.events).unwrap(),
        serde_json::to_string(&stationary.events).unwrap()
    );
}
#[test]
fn skipped_turn_expiry_and_cleanup_once() {
    let mut b = battle();
    for f in &mut b.fighters[1..] {
        f.conditions.push(Condition {
            effect: Effect {
                kind: "stun".into(),
                amount: 0,
                rounds: Some(1),
                feet: 0,
            },
            starts: 1,
            source: None,
        });
    }
    b.turns.as_mut().unwrap().reserves.insert(2, 60);
    b.fighters[0].conditions.push(Condition {
        effect: Effect {
            kind: "bleed".into(),
            amount: 3,
            rounds: None,
            feet: 0,
        },
        starts: 1,
        source: None,
    });
    wait(&mut b);
    for _ in 0..2 {
        b.advance_turn_playback().unwrap();
    }
    assert_eq!(b.round, 2);
    assert_eq!(b.fighters[0].damage, 3);
    assert!(b.fighters[1].conditions.is_empty());
    assert!(!b.turns.as_ref().unwrap().reserves.contains_key(&2));
    b.advance_turn_playback().unwrap();
    assert_eq!(b.round, 2);
    assert_eq!(b.fighters[0].damage, 3);
}
#[test]
fn casting_is_unprepared_and_blur_ends_turn() {
    let mut b = battle();
    let mut c = b.clone();
    b.fighters[0].preparation = Some(Preparation {
        spell: Spell::Blur,
        rounds: 10,
        last_round: 1,
    });
    for state in [&mut b, &mut c] {
        command(
            state,
            TurnCommand::Act(Action::Cast {
                spell: Spell::Blur,
                target: 1,
            }),
        );
    }
    assert_eq!(b.rng, c.rng);
    assert_eq!(b.fighters[0].pp, 19);
    assert!(b.fighters[0].preparation.is_none());
    assert!(!b.turns.as_ref().unwrap().main_available);
    assert_eq!(
        serde_json::to_string(&b).unwrap(),
        serde_json::to_string(&c).unwrap()
    );
}
#[test]
fn utility_progress_and_parry_restrictions() {
    let mut b = battle();
    b.fighters[0].weapons[0].reload = 250;
    b.fighters[0].reload_left = 250;
    command(&mut b, TurnCommand::Act(Action::Reload));
    assert_eq!(b.fighters[0].reload_left, 150);
    let mut b = battle();
    b.fighters[0].weapon_recovery.insert(0, 2);
    command(&mut b, TurnCommand::Act(Action::RecoverWeapon));
    assert_eq!(b.fighters[0].weapon_recovery[&0], 1);
    for kind in ["noParry", "stunNoParry", "downOrOut"] {
        let mut b = battle();
        b.fighters[0].conditions.push(Condition {
            effect: Effect {
                kind: kind.into(),
                amount: 0,
                rounds: Some(2),
                feet: 0,
            },
            starts: 1,
            source: None,
        });
        let before = serde_json::to_string(&b).unwrap();
        let seq = b.turns.as_ref().unwrap().sequence;
        assert!(b
            .command_turn(1, seq, TurnCommand::Parry, &DataPack::bundled())
            .is_err());
        assert_eq!(serde_json::to_string(&b).unwrap(), before);
    }
    let mut b = battle();
    command(&mut b, TurnCommand::Parry);
    assert_eq!(b.turns.as_ref().unwrap().reserves[&1], 60);
    b.advance_turn_playback().unwrap();
    wait(&mut b);
    wait(&mut b);
    assert_eq!(b.round, 2);
    assert!(!b.turns.as_ref().unwrap().reserves.contains_key(&1));
}
#[test]
fn melee_reserve_bypassed_by_fumbles_misses_missiles_and_spells() {
    for kind in ["fumble", "miss", "missile", "spell"] {
        let mut b = battle();
        b.fighters[1].pos = Hex { q: 1, r: 0 };
        b.fighters[2].pos = Hex { q: 0, r: 1 };
        command(&mut b, TurnCommand::Parry);
        b.advance_turn_playback().unwrap();
        let actor = b.turns.as_ref().unwrap().active;
        let i = b.fighters.iter().position(|f| f.id == actor).unwrap();
        if kind == "missile" {
            b.fighters[i].pos = Hex { q: 4, r: 0 };
            b.fighters[i].weapons[0].reload = 50;
            b.fighters[i].weapons[0].range = 100;
        }
        if kind == "miss" {
            b.fighters[i].weapons[0].ob = -200;
        }
        for seed in 1..10000 {
            let mut test = b.clone();
            test.rng = seed;
            let roll = test.die(100);
            if (kind == "fumble" && roll == 1) || (kind != "fumble" && roll == 50) {
                b.rng = seed;
                break;
            }
        }
        let action = match kind {
            "missile" => Action::Missile { target: 1 },
            "spell" => Action::Cast {
                spell: Spell::ShockBoltI,
                target: 1,
            },
            _ => Action::Melee { target: 1 },
        };
        command(&mut b, TurnCommand::Act(action));
        assert_eq!(
            b.turns.as_ref().unwrap().reserves[&1],
            60,
            "{kind} spent reserve"
        );
        assert!(!b.events.iter().any(|e| e.kind == "parry-spend"));
        if kind == "fumble" {
            assert!(b.events.iter().any(|e| e.kind.contains("fumble")));
        }
    }
}
#[test]
fn parry_applies_to_multiple_attackers_and_logs_expenditure() {
    let mut b = battle();
    b.fighters[1].pos = Hex { q: 1, r: 0 };
    b.fighters[2].pos = Hex { q: 0, r: 1 };
    b.fighters[0].weapons[0].ob = 200;
    command(&mut b, TurnCommand::Parry);
    b.advance_turn_playback().unwrap();
    for _ in 0..2 {
        for seed in 1..10000 {
            let mut test = b.clone();
            test.rng = seed;
            if test.die(100) == 70 {
                b.rng = seed;
                break;
            }
        }
        let before = b.turns.as_ref().unwrap().reserves[&1];
        command(&mut b, TurnCommand::Act(Action::Melee { target: 1 }));
        assert!(b.turns.as_ref().unwrap().reserves[&1] < before);
        assert_eq!(b.fighters[0].damage, 0);
        b.advance_turn_playback().unwrap();
    }
    assert_eq!(
        b.events.iter().filter(|e| e.kind == "parry-spend").count(),
        2
    );
}

#[test]
fn standing_and_changing_weapon_end_the_turn() {
    let mut b = battle();
    b.fighters[0].conditions.push(Condition {
        effect: Effect {
            kind: "prone".into(),
            amount: 20,
            rounds: None,
            feet: 0,
        },
        starts: 1,
        source: None,
    });
    command(&mut b, TurnCommand::Act(Action::StandUp));
    assert!(!b.fighters[0].has("prone", 1));
    assert!(!b.turns.as_ref().unwrap().main_available);
    let mut b = battle();
    let mut bow = b.fighters[0].weapons[0].clone();
    bow.reload = 50;
    bow.range = 100;
    b.fighters[0].weapons.push(bow);
    command(&mut b, TurnCommand::Act(Action::ChangeWeapon { index: 1 }));
    assert_eq!(b.fighters[0].weapon, 1);
    assert_eq!(b.fighters[0].reload_left, 50);
    assert!(!b.turns.as_ref().unwrap().main_available);
}
#[test]
fn death_timer_runs_after_last_initiative_entry() {
    let mut b = battle();
    b.fighters[2].death_round = Some(2);
    wait(&mut b);
    assert!(!b.fighters[2].dead);
    wait(&mut b);
    assert!(!b.fighters[2].dead);
    wait(&mut b);
    assert_eq!(b.round, 2);
    assert!(b.fighters[2].dead);
}
