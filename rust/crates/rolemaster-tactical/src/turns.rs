//! Opt-in individual Normal turns; the declaration API remains unchanged.
use super::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnState {
    pub order: Vec<u32>,
    pub position: usize,
    pub active: u32,
    pub movement_remaining: i32,
    pub main_available: bool,
    pub reserves: BTreeMap<u32, i32>,
    /// Monotonic command token, including movement and playback transitions.
    pub sequence: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TurnCommand {
    Move { path: Vec<Hex> },
    Parry,
    Act(Action),
}
impl BattleState {
    pub fn new_simplified(
        fighters: Vec<Fighter>,
        radius: i32,
        walls: BTreeSet<Hex>,
        seed: u64,
    ) -> Result<Self, String> {
        let mut b = Self::new(fighters, radius, walls, seed)?;
        b.turns = Some(TurnState {
            order: vec![],
            position: 0,
            active: 0,
            movement_remaining: 0,
            main_available: true,
            reserves: BTreeMap::new(),
            sequence: 0,
        });
        b.begin_turn_round();
        Ok(b)
    }
    pub(super) fn validate_turn_state(&self) -> Result<(), String> {
        if let Some(t) = &self.turns {
            let ids: BTreeSet<_> = self.fighters.iter().map(|f| f.id).collect();
            if t.order.len() != ids.len()
                || t.order.iter().copied().collect::<BTreeSet<_>>() != ids
                || t.order.get(t.position) != Some(&t.active)
                || t.movement_remaining < 0
                || self
                    .fighter(t.active)
                    .is_none_or(|f| t.movement_remaining > f.base_move / 2)
                || t.reserves.iter().any(|(id, n)| !ids.contains(id) || *n < 0)
                || !self.queue.is_empty()
                || !self.plan.actions.is_empty()
                || !self.plan.parry.is_empty()
                || self.awaiting_react.is_some()
                || (!t.main_available && !self.resolving && !self.finished)
            {
                return Err("Invalid simplified turn state".into());
            }
        }
        Ok(())
    }
    fn begin_turn_round(&mut self) {
        self.initiative.clear();
        // Stable ID order makes dice assignment independent of the input roster order.
        let mut ids: Vec<_> = self.fighters.iter().map(|f| f.id).collect();
        ids.sort();
        for id in &ids {
            let roll = self.die(10) + self.die(10);
            let f = self.fighter(*id).unwrap();
            let score = if f.initiative_override == Some(self.round) {
                10000
            } else {
                roll + f.quickness + f.modifier(self.round)
                    - if f.damage > f.max_hits / 2 { 4 } else { 0 }
            };
            self.initiative.insert(*id, score);
        }
        ids.sort_by_key(|id| (-self.initiative[id], *id));
        let t = self.turns.as_mut().unwrap();
        t.order = ids;
        t.position = 0;
        self.emit(
            None,
            None,
            None,
            "initiative",
            format!("Round {}: individual initiative", self.round),
            vec![],
            0,
            None,
            None,
        );
        self.start_turn();
    }
    fn start_turn(&mut self) {
        let t = self.turns.as_mut().unwrap();
        t.active = t.order[t.position];
        t.reserves.remove(&t.active); // Even an unconscious/stunned turn expires parry.
        t.sequence += 1;
        let id = t.active;
        let f = self.fighter(id).unwrap();
        let can_act = f.can_act(self.round);
        let movement = if can_act { f.base_move / 2 } else { 0 };
        let name = f.name.clone();
        let t = self.turns.as_mut().unwrap();
        t.main_available = can_act;
        t.movement_remaining = movement;
        self.resolving = !can_act;
        self.emit(
            Some(Phase::Normal),
            Some(id),
            None,
            if can_act { "turn" } else { "skip" },
            format!(
                "{name}: {}",
                if can_act {
                    "turn begins"
                } else {
                    "cannot act; turn skipped"
                }
            ),
            vec![],
            0,
            None,
            None,
        );
    }
    /// Atomic command with an expected actor and sequence; rejected input consumes nothing.
    pub fn command_turn(
        &mut self,
        actor: u32,
        sequence: u64,
        command: TurnCommand,
        data: &DataPack,
    ) -> Result<Vec<CombatEvent>, String> {
        let t = self.turns.as_ref().ok_or("Not a simplified battle")?;
        if self.finished
            || self.resolving
            || actor != t.active
            || sequence != t.sequence
            || !t.main_available
        {
            return Err("Stale command or fighter is not taking a turn".into());
        }
        let mut next = self.clone();
        let start = next.events.len();
        next.resolve_turn_command(actor, command, data)?;
        next.turns.as_mut().unwrap().sequence += 1;
        next.resolving = true;
        let events = next.events[start..].to_vec();
        *self = next;
        Ok(events)
    }
    fn resolve_turn_command(
        &mut self,
        actor: u32,
        command: TurnCommand,
        data: &DataPack,
    ) -> Result<(), String> {
        let i = self.index(actor)?;
        if !self.fighters[i].can_act(self.round) {
            return Err("Fighter cannot act".into());
        }
        match command {
            TurnCommand::Move { path } => {
                let mut pos = self.fighters[i].pos;
                if path.is_empty()
                    || path.len() as i32 * 5 > self.turns.as_ref().unwrap().movement_remaining
                {
                    return Err("Path exceeds remaining movement".into());
                }
                for p in &path {
                    if pos.distance(*p) != 1 || !self.open(*p, actor) {
                        return Err("Illegal movement step".into());
                    }
                    pos = *p;
                }
                self.turns.as_mut().unwrap().movement_remaining -= path.len() as i32 * 5;
                self.resolve(
                    &ActionDeclaration {
                        actor,
                        phase: Phase::Normal,
                        activity: 50,
                        action: Action::Move { path },
                    },
                    data,
                )?;
            }
            TurnCommand::Parry => {
                if !self.turn_parry_usable(actor) {
                    return Err(
                        "Parry requires a usable melee weapon and permitted conditions".into(),
                    );
                }
                let f = &self.fighters[i];
                let reserve = f.weapons[f.weapon].ob.max(0);
                let name = f.name.clone();
                self.turns.as_mut().unwrap().reserves.insert(actor, reserve);
                self.emit(
                    Some(Phase::Normal),
                    Some(actor),
                    None,
                    "parry",
                    format!("{name} parries: {reserve} reserve"),
                    vec![],
                    0,
                    None,
                    None,
                );
                self.end_main_action();
            }
            TurnCommand::Act(action) => {
                let activity = match &action {
                    Action::Melee { .. } | Action::Reload | Action::RecoverWeapon => 100,
                    Action::Missile { .. } => 60,
                    Action::Cast { spell, .. } => {
                        if *spell == Spell::Blur {
                            10
                        } else {
                            75
                        }
                    }
                    Action::StandUp | Action::ChangeWeapon { .. } => 50,
                    Action::Wait => 0,
                    _ => return Err("Action is not available in simplified turns".into()),
                };
                let a = ActionDeclaration {
                    actor,
                    phase: Phase::Normal,
                    activity,
                    action,
                };
                self.validate_plan(
                    &RoundPlan {
                        actions: vec![a.clone()],
                        parry: BTreeMap::new(),
                    },
                    None,
                )?;
                // Preparation is never carried into simplified casting.
                self.fighters[i].preparation = None;
                self.resolve(&a, data)?;
                if matches!(a.action, Action::Wait) {
                    self.emit(
                        Some(Phase::Normal),
                        Some(actor),
                        None,
                        "wait",
                        format!("{} ends their turn", self.fighters[i].name),
                        vec![],
                        0,
                        None,
                        None,
                    );
                }
                self.end_main_action();
            }
        }
        Ok(())
    }
    fn end_main_action(&mut self) {
        let t = self.turns.as_mut().unwrap();
        t.main_available = false;
        t.movement_remaining = 0;
    }
    /// Host calls after playback. No second command may execute during that boundary.
    pub fn advance_turn_playback(&mut self) -> Result<Vec<CombatEvent>, String> {
        if self.turns.is_none() {
            return Err("Not a simplified battle".into());
        }
        if !self.resolving || self.finished {
            return Ok(vec![]);
        }
        let start = self.events.len();
        self.resolving = false;
        let t = self.turns.as_mut().unwrap();
        t.sequence += 1;
        if !t.main_available {
            if t.position + 1 == t.order.len() {
                self.cleanup();
                self.check_finished();
                if !self.finished {
                    self.begin_turn_round();
                }
            } else {
                t.position += 1;
                self.start_turn();
            }
        }
        // Victory waits until round cleanup so bleeding/death timers run exactly once.
        Ok(self.events[start..].to_vec())
    }
    fn turn_parry_usable(&self, id: u32) -> bool {
        self.fighter(id).is_some_and(|f| {
            f.conscious()
                && f.weapons[f.weapon].reload == 0
                && !f.weapon_recovery.contains_key(&f.weapon)
                && !f.broken_weapons.contains(&f.weapon)
                && !["noParry", "stunNoParry", "downOrOut"]
                    .iter()
                    .any(|k| f.has(k, self.round))
        })
    }
    pub(super) fn spend_turn_parry(
        &mut self,
        target: u32,
        table: &str,
        total: i32,
        first: i32,
        data: &DataPack,
    ) -> Result<i32, String> {
        if !self.turn_parry_usable(target) {
            return Ok(total);
        }
        let reserve = self
            .turns
            .as_ref()
            .unwrap()
            .reserves
            .get(&target)
            .copied()
            .unwrap_or(0);
        if reserve == 0 {
            return Ok(total);
        }
        let armor = self.fighter(target).unwrap().armor;
        let mut spent = reserve;
        for amount in 0..=reserve {
            let result = data.attack(table, total - amount, first, armor)?;
            let hits = result
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse::<i32>()
                .unwrap_or(0);
            if hits == 0 && !result.chars().any(|c| ('A'..='E').contains(&c)) {
                spent = amount;
                break;
            }
        }
        if spent > 0 {
            self.turns
                .as_mut()
                .unwrap()
                .reserves
                .insert(target, reserve - spent);
            self.emit(
                Some(Phase::Normal),
                Some(target),
                None,
                "parry-spend",
                format!(
                    "{} spends {spent} parry; {} remaining",
                    self.fighter(target).unwrap().name,
                    reserve - spent
                ),
                vec![],
                0,
                None,
                None,
            );
        }
        Ok(total - spent)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reserve_uses_minimum_table_expenditure_without_dice() {
        // Synthetic table deliberately includes a zero-hit critical result.
        let mut data = DataPack::bundled();
        data.attacks.insert(
            "parry-test".into(),
            vec![
                data::AttackRow {
                    range: [-10000, 49],
                    unmodified: false,
                    values: vec!["0".into(); 20],
                },
                data::AttackRow {
                    range: [50, 59],
                    unmodified: false,
                    values: vec!["0A".into(); 20],
                },
                data::AttackRow {
                    range: [60, 10000],
                    unmodified: false,
                    values: vec!["10B".into(); 20],
                },
            ],
        );
        let f: Fighter=serde_json::from_value(serde_json::json!({"id":1,"team":0,"name":"Defender","level":5,"pos":{"q":0,"r":0},"max_hits":100,"damage":0,"pp":0,"max_pp":0,"armor":1,"db":0,"quickness":0,"strength":0,"base_move":50,"rr":0,"spell_bonus":0,"bolt_ob":0,"weapons":[{"name":"Sword","ob":60,"table":"parry-test","critical":"","range":5,"reload":0,"fumble":0,"two_handed":false}],"weapon":0,"reload_left":0,"spells":[],"equipment":[],"conditions":[],"preparation":null,"dead":false,"disabling":false,"death_round":null,"initiative_override":null})).unwrap();
        let mut b = BattleState::new_simplified(vec![f], 4, BTreeSet::new(), 1234).unwrap();
        b.turns.as_mut().unwrap().reserves.insert(1, 60);
        let rng = b.rng;
        assert_eq!(
            b.spend_turn_parry(1, "parry-test", 40, 40, &data).unwrap(),
            40
        );
        assert_eq!(b.turns.as_ref().unwrap().reserves[&1], 60);
        assert_eq!(
            b.spend_turn_parry(1, "parry-test", 55, 55, &data).unwrap(),
            49
        );
        assert_eq!(b.turns.as_ref().unwrap().reserves[&1], 54);
        assert_eq!(
            b.spend_turn_parry(1, "parry-test", 80, 80, &data).unwrap(),
            49
        );
        assert_eq!(b.turns.as_ref().unwrap().reserves[&1], 23);
        assert_eq!(
            b.spend_turn_parry(1, "parry-test", 90, 90, &data).unwrap(),
            67
        );
        assert_eq!(b.turns.as_ref().unwrap().reserves[&1], 0);
        assert_eq!(
            b.spend_turn_parry(1, "parry-test", 90, 90, &data).unwrap(),
            90
        );
        assert_eq!(b.rng, rng);
    }
}
