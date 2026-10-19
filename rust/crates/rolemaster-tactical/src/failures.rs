//! Explicit effects for the weapon families used by the shipped skirmishes.
//! Result text remains in the normalized source data; mechanics never parse prose.
use super::*;
impl BattleState {
    fn condition(
        &mut self,
        id: u32,
        kind: &str,
        amount: i32,
        rounds: Option<u32>,
    ) -> Result<(), String> {
        let i = self.index(id)?;
        self.fighters[i].conditions.push(Condition {
            effect: Effect {
                kind: kind.into(),
                amount,
                rounds,
                feet: 0,
            },
            starts: self.round + 1,
            source: None,
        });
        Ok(())
    }
    fn roll_hits(&mut self, id: u32, count: i32, sides: i32) -> Result<(), String> {
        let hits = (0..count).map(|_| self.die(sides)).sum::<i32>();
        let i = self.index(id)?;
        self.fighters[i].damage += hits;
        self.fighters[i].preparation = None;
        Ok(())
    }
    fn drop_weapon(&mut self, id: u32, rounds: u32) -> Result<(), String> {
        let i = self.index(id)?;
        let w = self.fighters[i].weapon;
        self.fighters[i].weapon_recovery.insert(w, rounds);
        Ok(())
    }
    fn break_weapon(&mut self, id: u32) -> Result<(), String> {
        let i = self.index(id)?;
        let w = self.fighters[i].weapon;
        self.fighters[i].broken_weapons.insert(w);
        Ok(())
    }
    pub(super) fn weapon_fumble(
        &mut self,
        a: &ActionDeclaration,
        roll: i32,
        data: &DataPack,
    ) -> Result<(), String> {
        if !(1..=100).contains(&roll) {
            return Err("Weapon fumble roll must be 1–100".into());
        }
        let i = self.index(a.actor)?;
        let weapon = self.fighters[i].weapons[self.fighters[i].weapon].clone();
        let missile = weapon.table == "A-10.9.4";
        if !missile && !["A-10.9.1", "A-10.9.2"].contains(&weapon.table.as_str()) {
            return Err(
                "Fumble automation currently supports one-handed and missile weapons".into(),
            );
        }
        let text = data
            .failure_text(false, roll, if missile { 5 } else { 0 })?
            .to_owned();
        self.emit(
            Some(a.phase),
            Some(a.actor),
            None,
            "fumble",
            format!("{} — fumble {}: {}", self.fighters[i].name, roll, text),
            vec![roll],
            0,
            None,
            None,
        );
        if missile {
            match roll {
                1..=25 | 51..=60 => {}
                26..=50 => self.fighters[i].reload_left = weapon.reload,
                61..=65 | 67..=70 => self.drop_weapon(a.actor, 2)?,
                66 => {
                    self.break_weapon(a.actor)?;
                    self.apply_critical(a, a.actor, "A-10.10.3", 'A', data)?;
                }
                71..=80 => self.break_weapon(a.actor)?,
                81..=85 => self.condition(a.actor, "stunNoParry", 0, Some(3))?,
                86..=90 => self.condition(a.actor, "noAttack", 0, Some(2))?,
                91..=95 => {
                    self.condition(a.actor, "stun", 0, Some(6))?;
                    self.condition(a.actor, "noParry", 0, Some(2))?;
                    self.condition(a.actor, "prone", 50, None)?;
                }
                96..=99 => {
                    self.break_weapon(a.actor)?;
                    self.condition(a.actor, "stun", 0, Some(4))?;
                }
                100 => {
                    self.fighters[i].damage += 5;
                    self.condition(a.actor, "bleed", 2, None)?;
                    self.condition(a.actor, "maimed", 0, None)?;
                }
                _ => unreachable!(),
            }
        } else {
            match roll {
                1..=25 | 31..=40 => {}
                26..=30 | 61..=65 => self.drop_weapon(a.actor, 2)?,
                41..=50 => self.roll_hits(a.actor, 1, 5)?,
                51..=60 | 81..=85 => self.condition(a.actor, "downOrOut", 0, Some(2))?,
                66 => {
                    let f = &self.fighters[i];
                    let target = self
                        .fighters
                        .iter()
                        .filter(|t| t.id != a.actor && t.team == f.team && t.conscious())
                        .min_by_key(|t| (t.pos.distance(f.pos), t.id))
                        .map_or(a.actor, |t| t.id);
                    self.roll_hits(target, 1, 10)?;
                    self.apply_critical(a, target, &weapon.critical, 'B', data)?;
                }
                67..=80 => self.condition(a.actor, "noAttack", 0, Some(2))?,
                86..=90 => self.condition(a.actor, "stun", 0, Some(2))?,
                91..=95 => {
                    self.condition(a.actor, "stun", 0, Some(3))?;
                    self.condition(a.actor, "prone", 50, None)?;
                }
                96..=99 => self.condition(a.actor, "stunNoParry", 0, Some(3))?,
                100 => self.apply_critical(a, a.actor, &weapon.critical, 'D', data)?,
                _ => unreachable!(),
            }
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fighter() -> Fighter {
        serde_json::from_value(serde_json::json!({"id":1,"team":0,"name":"Test","level":5,"pos":{"q":0,"r":0},"max_hits":80,"damage":0,"pp":20,"max_pp":20,"armor":1,"db":0,"quickness":0,"strength":0,"base_move":50,"rr":0,"spell_bonus":50,"bolt_ob":50,"weapons":[{"name":"Sword","ob":60,"table":"A-10.9.2","critical":"A-10.10.5","range":5,"reload":0,"fumble":3,"two_handed":false}],"weapon":0,"reload_left":0,"spells":[],"equipment":[],"conditions":[],"preparation":null,"dead":false,"disabling":false,"death_round":null,"initiative_override":null})).unwrap()
    }
    #[test]
    fn every_supported_fumble_row_resolves() {
        let data = DataPack::bundled();
        for missile in [false, true] {
            for roll in 1..=100 {
                let mut f = fighter();
                if missile {
                    f.weapons[0].table = "A-10.9.4".into();
                    f.weapons[0].reload = 50;
                }
                let mut b = BattleState::new(vec![f], 4, Default::default(), 123).unwrap();
                let a = ActionDeclaration {
                    actor: 1,
                    phase: Phase::Normal,
                    activity: 100,
                    action: Action::Wait,
                };
                b.weapon_fumble(&a, roll, &data).unwrap();
                b.validate_state().unwrap();
                assert_eq!(b.events[0].kind, "fumble");
            }
        }
    }
    #[test]
    fn dropped_weapon_requires_two_recovery_actions() {
        let data = DataPack::bundled();
        let mut b = BattleState::new(vec![fighter()], 4, Default::default(), 123).unwrap();
        let a = ActionDeclaration {
            actor: 1,
            phase: Phase::Normal,
            activity: 100,
            action: Action::RecoverWeapon,
        };
        b.weapon_fumble(&a, 26, &data).unwrap();
        assert_eq!(b.fighters[0].weapon_recovery[&0], 2);
        b.resolve(&a, &data).unwrap();
        assert_eq!(b.fighters[0].weapon_recovery[&0], 1);
        b.resolve(&a, &data).unwrap();
        assert!(b.fighters[0].weapon_recovery.is_empty());
    }
    #[test]
    fn broken_bow_cannot_be_recovered() {
        let data = DataPack::bundled();
        let mut f = fighter();
        f.weapons[0].table = "A-10.9.4".into();
        let mut b = BattleState::new(vec![f], 4, Default::default(), 1).unwrap();
        let a = ActionDeclaration {
            actor: 1,
            phase: Phase::Normal,
            activity: 60,
            action: Action::Wait,
        };
        b.weapon_fumble(&a, 75, &data).unwrap();
        assert!(b.fighters[0].broken_weapons.contains(&0));
        assert!(b.fighters[0].weapon_recovery.is_empty());
    }
}
