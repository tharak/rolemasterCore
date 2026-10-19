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
    BattleState::new(
        vec![fighter(1, 0, 0), fighter(2, 1, 1)],
        4,
        BTreeSet::new(),
        1234,
    )
    .unwrap()
}
fn action(actor: u32, phase: Phase, activity: u8, action: Action) -> ActionDeclaration {
    ActionDeclaration {
        actor,
        phase,
        activity,
        action,
    }
}
fn plan(actions: Vec<ActionDeclaration>) -> RoundPlan {
    RoundPlan {
        actions,
        ..Default::default()
    }
}
fn complete(b: &mut BattleState) {
    let data = DataPack::bundled();
    while b.resolving {
        b.step(&data).unwrap();
    }
}
#[test]
fn js_attack_parity() {
    let data = DataPack::bundled();
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("attack-parity.json")).unwrap();
    for c in cases.as_array().unwrap() {
        assert_eq!(
            data.attack(
                c["code"].as_str().unwrap(),
                c["total"].as_i64().unwrap() as i32,
                c["first"].as_i64().unwrap() as i32,
                c["armor"].as_u64().unwrap() as u8
            )
            .unwrap(),
            c["expected"].as_str().unwrap()
        );
    }
}
#[test]
fn all_critical_equipment_variants_exist() {
    let data = DataPack::bundled();
    for (code, rows) in &data.criticals {
        for row in rows {
            for (col, cell) in row.cells.iter().enumerate() {
                for mask in 0..(1 << cell.keys.len()) {
                    let equipment = cell
                        .keys
                        .iter()
                        .enumerate()
                        .filter(|(i, _)| mask & (1 << i) != 0)
                        .map(|(_, k)| k.clone())
                        .collect::<Vec<_>>();
                    data.critical(code, (b'A' + col as u8) as char, row.range[0], &equipment)
                        .unwrap();
                }
            }
        }
    }
}
#[test]
fn activity_and_phase_validation() {
    let b = battle();
    assert!(b
        .validate_plan(
            &plan(vec![
                action(1, Phase::Snap, 60, Action::Melee { target: 2 }),
                action(1, Phase::Normal, 50, Action::Reload)
            ]),
            Some(0)
        )
        .is_err());
    assert!(b
        .validate_plan(
            &plan(vec![
                action(1, Phase::Snap, 0, Action::Wait),
                action(1, Phase::Snap, 0, Action::Wait)
            ]),
            Some(0)
        )
        .is_err());
    assert!(b
        .validate_plan(
            &plan(vec![action(
                2,
                Phase::Normal,
                100,
                Action::Melee { target: 1 }
            )]),
            Some(0)
        )
        .is_err());
}
#[test]
fn phase_precedes_initiative_and_commit_is_single_use() {
    let mut b = battle();
    b.fighters[0].quickness = 100;
    b.commit(plan(vec![
        action(1, Phase::Deliberate, 100, Action::Melee { target: 2 }),
        action(2, Phase::Snap, 100, Action::Melee { target: 1 }),
    ]))
    .unwrap();
    assert_eq!(b.queue[0].actor, 2);
    assert!(b.commit(RoundPlan::default()).is_err());
}
#[test]
fn save_mid_round_does_not_reroll_or_double_apply() {
    let mut a = battle();
    a.commit(plan(vec![
        action(1, Phase::Normal, 100, Action::Melee { target: 2 }),
        action(2, Phase::Normal, 100, Action::Melee { target: 1 }),
    ]))
    .unwrap();
    a.step(&DataPack::bundled()).unwrap();
    let mut b: BattleState = serde_json::from_str(&serde_json::to_string(&a).unwrap()).unwrap();
    b.validate_state().unwrap();
    complete(&mut a);
    complete(&mut b);
    assert_eq!(
        serde_json::to_value(&a).unwrap(),
        serde_json::to_value(&b).unwrap()
    );
    let before = serde_json::to_string(&b).unwrap();
    b.step(&DataPack::bundled()).unwrap();
    assert_eq!(before, serde_json::to_string(&b).unwrap());
}
#[test]
fn movement_stops_at_occupied_tile() {
    let mut b = battle();
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        30,
        Action::Move {
            path: vec![Hex { q: 0, r: 1 }, Hex { q: 1, r: 0 }, Hex { q: 2, r: 0 }],
        },
    )]))
    .unwrap();
    b.step(&DataPack::bundled()).unwrap();
    assert_eq!(b.fighters[0].pos, Hex { q: 0, r: 1 });
}
#[test]
fn invalid_paths_and_los() {
    let mut b = battle();
    b.walls.insert(Hex { q: 1, r: 1 });
    assert!(!b.line_of_sight(Hex { q: 0, r: 1 }, Hex { q: 2, r: 1 }));
    assert!(b
        .validate_plan(
            &plan(vec![action(
                1,
                Phase::Snap,
                20,
                Action::Move {
                    path: vec![Hex { q: 3, r: 0 }]
                }
            )]),
            None
        )
        .is_err());
}
#[test]
fn cancelled_attack_does_not_roll() {
    let mut b = battle();
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        100,
        Action::Melee { target: 2 },
    )]))
    .unwrap();
    b.fighters[1].pos = Hex { q: 4, r: 0 };
    let rng = b.rng;
    b.step(&DataPack::bundled()).unwrap();
    assert_eq!(b.rng, rng);
    assert_eq!(b.events.last().unwrap().kind, "cancel");
}
#[test]
fn unconscious_actor_cannot_execute_pending_action() {
    let mut b = battle();
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        100,
        Action::Melee { target: 2 },
    )]))
    .unwrap();
    b.fighters[0].damage = 80;
    b.step(&DataPack::bundled()).unwrap();
    assert_eq!(b.fighters[1].damage, 0);
    assert!(b.finished);
    assert_eq!(b.winner, Some(1));
}
#[test]
fn spell_preparation_and_cost() {
    let mut b = battle();
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        90,
        Action::Prepare {
            spell: Spell::HealingI,
        },
    )]))
    .unwrap();
    complete(&mut b);
    assert_eq!(b.fighters[0].preparation.as_ref().unwrap().rounds, 1);
    assert_eq!(b.fighters[0].pp, 20);
    b.fighters[0].damage = 40;
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        75,
        Action::Cast {
            spell: Spell::HealingI,
            target: 1,
        },
    )]))
    .unwrap();
    complete(&mut b);
    assert_eq!(b.fighters[0].pp, 19);
    assert!(b.fighters[0].preparation.is_none());
}
#[test]
fn healing_cannot_target_dead_or_remove_disability() {
    let mut b = battle();
    b.fighters[1].team = 0;
    b.fighters[1].dead = true;
    assert!(b
        .validate_plan(
            &plan(vec![action(
                1,
                Phase::Normal,
                75,
                Action::Cast {
                    spell: Spell::HealingI,
                    target: 2
                }
            )]),
            None
        )
        .is_err());
    b.fighters[1].dead = false;
    b.fighters[1].disabling = true;
    b.fighters[1].damage = 50;
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        75,
        Action::Cast {
            spell: Spell::HealingI,
            target: 2,
        },
    )]))
    .unwrap();
    complete(&mut b);
    assert!(b.fighters[1].disabling);
}
#[test]
fn cumulative_stun_and_bleeding() {
    let mut b = battle();
    for kind in ["stun", "stunNoParry"] {
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
    }
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
    b.commit(RoundPlan::default()).unwrap();
    complete(&mut b);
    assert_eq!(b.fighters[0].conditions[0].effect.rounds, Some(2));
    assert_eq!(b.fighters[0].conditions[1].effect.rounds, Some(1));
    assert_eq!(b.fighters[0].damage, 3);
}
#[test]
fn preparation_table_matches_printed_values() {
    assert_eq!(preparation_modifier(3, 0, false), -30);
    assert_eq!(preparation_modifier(1, 1, false), -20);
    assert_eq!(preparation_modifier(1, 2, false), 0);
    assert_eq!(preparation_modifier(4, 0, true), 5);
}
#[test]
fn errors_are_atomic() {
    let mut b = battle();
    b.fighters[0].weapons[0].table = "unknown".into();
    b.commit(plan(vec![action(
        1,
        Phase::Normal,
        100,
        Action::Melee { target: 2 },
    )]))
    .unwrap();
    let before = serde_json::to_string(&b).unwrap();
    assert!(b.step(&DataPack::bundled()).is_err());
    assert_eq!(before, serde_json::to_string(&b).unwrap());
}
#[test]
fn invalid_save_rejected() {
    let mut b = battle();
    b.version += 1;
    assert!(b.validate_state().is_err());
    b.version = SAVE_VERSION;
    b.fighters[1].id = 1;
    assert!(b.validate_state().is_err());
}
