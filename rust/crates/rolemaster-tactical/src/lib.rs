//! Incremental, deterministic tactical combat. No renderer, global RNG, AI or storage.
//! Positions use axial five-foot hexes. All mutations go through commit/step.
pub mod data;
mod failures;
mod turns;
use data::{DataPack, Effect};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
pub use turns::{TurnCommand, TurnState};
pub const SAVE_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Hex {
    pub q: i32,
    pub r: i32,
}
impl Hex {
    pub fn distance(self, other: Self) -> i32 {
        ((self.q - other.q).abs()
            + (self.r - other.r).abs()
            + (self.q + self.r - other.q - other.r).abs())
            / 2
    }
    pub fn neighbors(self) -> [Hex; 6] {
        [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)].map(|(q, r)| Hex {
            q: self.q + q,
            r: self.r + r,
        })
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Phase {
    Snap,
    Normal,
    Deliberate,
}
impl Phase {
    pub fn modifier(self) -> i32 {
        match self {
            Self::Snap => -20,
            Self::Normal => 0,
            Self::Deliberate => 10,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Spell {
    HealingI,
    HealingIII,
    BlessI,
    Blur,
    ShockBoltI,
    JoltsI,
    MinorPain,
}
impl Spell {
    pub fn level(self) -> i32 {
        match self {
            Self::HealingI | Self::Blur | Self::JoltsI => 1,
            Self::BlessI | Self::ShockBoltI => 2,
            Self::MinorPain => 3,
            Self::HealingIII => 4,
        }
    }
    pub fn range(self) -> i32 {
        match self {
            Self::HealingI | Self::HealingIII => 5,
            Self::Blur => 0,
            _ => 100,
        }
    }
    pub fn hostile(self) -> bool {
        matches!(self, Self::ShockBoltI | Self::JoltsI | Self::MinorPain)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weapon {
    pub name: String,
    pub ob: i32,
    pub table: String,
    pub critical: String,
    pub range: i32,
    pub reload: u16,
    pub fumble: i32,
    pub two_handed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub effect: Effect,
    pub starts: u32,
    pub source: Option<u32>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preparation {
    pub spell: Spell,
    pub rounds: u32,
    pub last_round: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fighter {
    pub id: u32,
    pub team: u8,
    pub name: String,
    pub level: i32,
    pub pos: Hex,
    pub max_hits: i32,
    pub damage: i32,
    pub pp: i32,
    pub max_pp: i32,
    pub armor: u8,
    pub db: i32,
    pub quickness: i32,
    pub strength: i32,
    pub base_move: i32,
    pub rr: i32,
    pub spell_bonus: i32,
    pub bolt_ob: i32,
    pub weapons: Vec<Weapon>,
    pub weapon: usize,
    pub reload_left: u16,
    #[serde(default)]
    pub weapon_recovery: BTreeMap<usize, u32>,
    #[serde(default)]
    pub broken_weapons: BTreeSet<usize>,
    pub spells: Vec<Spell>,
    pub equipment: Vec<String>,
    pub conditions: Vec<Condition>,
    pub preparation: Option<Preparation>,
    pub dead: bool,
    pub disabling: bool,
    pub death_round: Option<u32>,
    pub initiative_override: Option<u32>,
}
impl Fighter {
    pub fn conscious(&self) -> bool {
        !self.dead && !self.disabling && self.damage < self.max_hits
    }
    pub fn has(&self, kind: &str, round: u32) -> bool {
        self.conditions
            .iter()
            .any(|c| c.starts <= round && c.effect.kind == kind)
    }
    pub fn can_act(&self, round: u32) -> bool {
        self.conscious()
            && !["stun", "stunNoParry", "downOrOut"]
                .iter()
                .any(|k| self.has(k, round))
    }
    pub fn modifier(&self, round: u32) -> i32 {
        self.conditions
            .iter()
            .filter(|c| c.starts <= round)
            .map(|c| match c.effect.kind.as_str() {
                "penalty" | "prone" => -c.effect.amount,
                "bonus" => c.effect.amount,
                _ => 0,
            })
            .sum()
    }
    pub fn defense(&self, round: u32) -> i32 {
        self.db
            + self
                .conditions
                .iter()
                .filter(|c| {
                    c.starts <= round && ["bless", "blur"].contains(&c.effect.kind.as_str())
                })
                .map(|c| c.effect.amount)
                .sum::<i32>()
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    Press { target: u32 },
    React { target: Option<u32> },
    Move { path: Vec<Hex> },
    Disengage { path: Vec<Hex> },
    Melee { target: u32 },
    Missile { target: u32 },
    Prepare { spell: Spell },
    Cast { spell: Spell, target: u32 },
    Reload,
    RecoverWeapon,
    StandUp,
    ChangeWeapon { index: usize },
    Wait,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionDeclaration {
    pub actor: u32,
    pub phase: Phase,
    pub activity: u8,
    pub action: Action,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RoundPlan {
    pub actions: Vec<ActionDeclaration>,
    pub parry: BTreeMap<u32, Parry>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parry {
    pub target: u32,
    pub amount: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombatEvent {
    pub sequence: usize,
    pub round: u32,
    pub phase: Option<Phase>,
    pub actor: Option<u32>,
    pub target: Option<u32>,
    pub kind: String,
    pub text: String,
    pub dice: Vec<i32>,
    pub from: Option<Hex>,
    pub to: Option<Hex>,
    pub damage: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleState {
    pub version: u32,
    #[serde(default)]
    pub turns: Option<TurnState>,
    pub round: u32,
    pub fighters: Vec<Fighter>,
    pub radius: i32,
    pub walls: BTreeSet<Hex>,
    #[serde(with = "u64_string")]
    pub rng: u64,
    pub plan: RoundPlan,
    pub initiative: BTreeMap<u32, i32>,
    pub queue: Vec<ActionDeclaration>,
    pub cursor: usize,
    #[serde(default)]
    pub awaiting_react: Option<u32>,
    pub resolving: bool,
    pub finished: bool,
    pub winner: Option<u8>,
    pub events: Vec<CombatEvent>,
}
impl BattleState {
    pub fn new(
        fighters: Vec<Fighter>,
        radius: i32,
        walls: BTreeSet<Hex>,
        seed: u64,
    ) -> Result<Self, String> {
        let state = Self {
            version: SAVE_VERSION,
            turns: None,
            round: 1,
            fighters,
            radius,
            walls,
            rng: seed.max(1),
            plan: RoundPlan::default(),
            initiative: BTreeMap::new(),
            queue: vec![],
            cursor: 0,
            awaiting_react: None,
            resolving: false,
            finished: false,
            winner: None,
            events: vec![],
        };
        state.validate_state()?;
        Ok(state)
    }
    pub fn validate_state(&self) -> Result<(), String> {
        if self.version != SAVE_VERSION {
            return Err("Unsupported battle save version".into());
        }
        if !(1..=30).contains(&self.radius)
            || self.round == 0
            || self.rng == 0
            || self.cursor > self.queue.len()
            || self.fighters.is_empty()
            || self.fighters.len() > 64
        {
            return Err("Invalid battle state".into());
        }
        self.validate_turn_state()?;
        let mut ids = BTreeSet::new();
        let mut occupied = BTreeSet::new();
        for f in &self.fighters {
            if !ids.insert(f.id)
                || !self.inboard(f.pos)
                || self.walls.contains(&f.pos)
                || f.max_hits <= 0
                || f.max_pp < 0
                || f.pp < 0
                || f.pp > f.max_pp
                || f.damage < 0
                || f.weapon >= f.weapons.len()
                || f.weapon_recovery
                    .iter()
                    .any(|(w, rounds)| *w >= f.weapons.len() || *rounds == 0)
                || f.broken_weapons.iter().any(|w| *w >= f.weapons.len())
                || !(1..=20).contains(&f.armor)
                || f.base_move <= 0
                || f.level < 1
            {
                return Err("Invalid fighter profile".into());
            }
            if f.conscious() && !occupied.insert(f.pos) {
                return Err("Overlapping fighters".into());
            }
        }
        if self.queue.iter().any(|a| self.fighter(a.actor).is_none()) {
            return Err("Invalid resolution queue".into());
        }
        Ok(())
    }
    pub fn fighter(&self, id: u32) -> Option<&Fighter> {
        self.fighters.iter().find(|f| f.id == id)
    }
    fn index(&self, id: u32) -> Result<usize, String> {
        self.fighters
            .iter()
            .position(|f| f.id == id)
            .ok_or("Unknown fighter".into())
    }
    pub fn inboard(&self, p: Hex) -> bool {
        p.distance(Hex { q: 0, r: 0 }) <= self.radius
    }
    pub fn open(&self, p: Hex, actor: u32) -> bool {
        self.inboard(p)
            && !self.walls.contains(&p)
            && !self
                .fighters
                .iter()
                .any(|f| f.id != actor && f.conscious() && f.pos == p)
    }
    pub fn line_of_sight(&self, a: Hex, b: Hex) -> bool {
        let n = a.distance(b);
        if n == 0 {
            return true;
        }
        (1..n).all(|i| {
            let t = i as f64 / n as f64;
            let x = a.q as f64 + (b.q - a.q) as f64 * t + 1e-6;
            let z = a.r as f64 + (b.r - a.r) as f64 * t + 1e-6;
            let y = -x - z;
            let (mut rx, ry, mut rz) = (x.round(), y.round(), z.round());
            if (rx - x).abs() > (ry - y).abs() && (rx - x).abs() > (rz - z).abs() {
                rx = -ry - rz
            } else if (ry - y).abs() <= (rz - z).abs() {
                rz = -rx - ry
            }
            !self.walls.contains(&Hex {
                q: rx as i32,
                r: rz as i32,
            })
        })
    }
    pub fn die(&mut self, sides: i32) -> i32 {
        // xorshift64*: explicit state is serialized; never use platform randomness.
        let mut x = self.rng;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.rng = x;
        ((x.wrapping_mul(2685821657736338717) >> 32) % sides as u64) as i32 + 1
    }
    pub fn open_roll(&mut self) -> Vec<i32> {
        let first = self.die(100);
        let mut dice = vec![first];
        if first <= 5 || first >= 96 {
            let sign = if first <= 5 { -1 } else { 1 };
            loop {
                let n = self.die(100);
                dice.push(sign * n);
                if n < 96 {
                    break;
                }
            }
        }
        dice
    }
    pub fn validate_plan(&self, plan: &RoundPlan, team: Option<u8>) -> Result<(), String> {
        if self.resolving || self.finished {
            return Err("This battle is not accepting declarations".into());
        }
        let mut phases = BTreeSet::new();
        let mut totals = BTreeMap::new();
        let mut spells = BTreeSet::new();
        let mut positions: BTreeMap<_, _> = self.fighters.iter().map(|f| (f.id, f.pos)).collect();
        let mut actions = plan.actions.clone();
        actions.sort_by_key(|a| a.phase);
        for a in &actions {
            let f = self.fighter(a.actor).ok_or("Unknown actor")?;
            if team.is_some_and(|t| f.team != t) {
                return Err("Cannot command the other team".into());
            }
            if !f.can_act(self.round) {
                return Err(format!("{} cannot act this round", f.name));
            }
            if !phases.insert((a.actor, a.phase)) {
                return Err("Only one action per fighter per phase".into());
            }
            let total = totals.entry(a.actor).or_insert(0u16);
            *total += a.activity as u16;
            if *total > 100 {
                return Err("Activity exceeds 100%".into());
            }
            let (low, high) = match &a.action {
                Action::Move { .. } => (
                    1,
                    match a.phase {
                        Phase::Snap => 20,
                        Phase::Normal => 50,
                        Phase::Deliberate => 80,
                    },
                ),
                Action::Disengage { .. } => (25, 25),
                Action::Melee { .. } => (60, 100),
                Action::Press { .. } | Action::React { .. } => (80, 100),
                Action::Missile { .. } => (30, 60),
                Action::Prepare { .. } => (90, 90),
                Action::Cast { spell, .. } => {
                    if *spell == Spell::Blur {
                        (10, 10)
                    } else {
                        (75, 75)
                    }
                }
                Action::Reload => (1, 100),
                Action::RecoverWeapon => (100, 100),
                Action::StandUp => (50, 50),
                Action::ChangeWeapon { .. } => (50, 50),
                Action::Wait => (0, 0),
            };
            if a.activity < low || a.activity > high {
                return Err(format!("Action requires {low}–{high}% activity"));
            }
            match &a.action {
                Action::Move { path } | Action::Disengage { path } => {
                    let mut p = positions[&a.actor];
                    let feet = if matches!(a.action, Action::Disengage { .. }) {
                        10
                    } else {
                        f.base_move * a.activity as i32 / 100
                    };
                    if path.len() as i32 * 5 > feet {
                        return Err("Path exceeds declared movement activity".into());
                    }
                    for next in path {
                        if p.distance(*next) != 1
                            || !self.inboard(*next)
                            || self.walls.contains(next)
                        {
                            return Err("Path contains an illegal step".into());
                        }
                        p = *next;
                    }
                    positions.insert(a.actor, p);
                }
                Action::Melee { target }
                | Action::Press { target }
                | Action::Missile { target } => {
                    let t = self.fighter(*target).ok_or("Unknown target")?;
                    if t.team == f.team || !t.conscious() {
                        return Err("Select an active enemy".into());
                    }
                    if f.has("mustParry", self.round) {
                        return Err("Fighter must parry and cannot attack".into());
                    }
                    if matches!(a.action, Action::Press { .. }) && f.pos.distance(t.pos) > 1 {
                        return Err("Press requires an adjacent target at declaration".into());
                    }
                    let w = &f.weapons[f.weapon];
                    if matches!(a.action, Action::Melee { .. } | Action::Press { .. })
                        && w.reload > 0
                    {
                        return Err("Change to a melee weapon first".into());
                    }
                    if matches!(a.action, Action::Missile { .. }) && w.reload == 0 {
                        return Err("Select a missile weapon first".into());
                    }
                }
                Action::React { target } => {
                    if target.is_some() {
                        return Err("React target is chosen during resolution".into());
                    }
                    if f.weapons[f.weapon].reload > 0 || f.has("mustParry", self.round) {
                        return Err("Cannot declare a react melee attack".into());
                    }
                }
                Action::Prepare { spell } | Action::Cast { spell, .. } => {
                    if !f.spells.contains(spell) || f.level < spell.level() {
                        return Err("Spell is not known".into());
                    }
                    if let Action::Cast { target, .. } = &a.action {
                        if !spells.insert(a.actor) {
                            return Err("Only one spell per round".into());
                        }
                        if f.pp < spell.level() {
                            return Err("Not enough power points".into());
                        }
                        let t = self.fighter(*target).ok_or("Unknown spell target")?;
                        if t.dead
                            || spell.hostile() && (t.team == f.team || !t.conscious())
                            || !spell.hostile() && t.team != f.team
                        {
                            return Err("Invalid spell target".into());
                        }
                        if *spell == Spell::Blur && *target != a.actor {
                            return Err("Blur is self only".into());
                        }
                    }
                }
                Action::StandUp => {
                    if !f.has("prone", self.round) {
                        return Err("Fighter is not prone".into());
                    }
                }
                Action::RecoverWeapon => {
                    if !f.weapon_recovery.contains_key(&f.weapon) {
                        return Err("Current weapon does not need recovery".into());
                    }
                }
                Action::Reload => {
                    if f.weapons[f.weapon].reload == 0 {
                        return Err("Weapon does not require reloading".into());
                    }
                }
                Action::ChangeWeapon { index } => {
                    if *index >= f.weapons.len() {
                        return Err("Unknown weapon".into());
                    }
                }
                Action::Wait => {}
            }
        }
        for (id, p) in &plan.parry {
            let f = self.fighter(*id).ok_or("Unknown parrying fighter")?;
            let t = self.fighter(p.target).ok_or("Unknown parry target")?;
            if team.is_some_and(|team| f.team != team)
                || !f.conscious()
                || f.weapon_recovery.contains_key(&f.weapon)
                || f.broken_weapons.contains(&f.weapon)
                || f.has("noParry", self.round)
                || f.has("stunNoParry", self.round)
                || f.team == t.team
            {
                return Err("Cannot parry this opponent".into());
            }
            let w = &f.weapons[f.weapon];
            let cap = if w.two_handed && !t.weapons[t.weapon].two_handed {
                w.ob / 2
            } else {
                w.ob
            };
            if p.amount < 0 || p.amount > cap.max(0) {
                return Err("Parry exceeds available OB".into());
            }
            if plan.actions.iter().any(|a| {
                a.actor == *id && matches!(a.action,Action::Melee{target}|Action::Press{target} if target!=p.target)
            }) {
                return Err("Parry must target the opponent being attacked".into());
            }
        }
        Ok(())
    }
    pub fn commit(&mut self, plan: RoundPlan) -> Result<(), String> {
        if self.turns.is_some() {
            return Err("Use turn commands in simplified mode".into());
        }
        self.validate_plan(&plan, None)?;
        self.initiative.clear();
        for i in 0..self.fighters.len() {
            let id = self.fighters[i].id;
            let movement: i32 = plan
                .actions
                .iter()
                .filter(|a| a.actor == id && matches!(a.action, Action::Move { .. }))
                .map(|a| a.activity as i32)
                .sum();
            let roll = self.die(10) + self.die(10);
            let f = &self.fighters[i];
            let score = if f.initiative_override == Some(self.round) {
                10000
            } else {
                roll + f.quickness + f.modifier(self.round)
                    - movement / 10
                    - if f.damage > f.max_hits / 2 { 4 } else { 0 }
            };
            self.initiative.insert(id, score);
        }
        self.queue = plan.actions.clone();
        self.queue
            .sort_by_key(|a| (a.phase, -self.initiative[&a.actor], a.actor));
        self.plan = plan;
        self.cursor = 0;
        self.resolving = true;
        self.emit(
            None,
            None,
            None,
            "initiative",
            format!(
                "Round {}: initiative established; Snap → Normal → Deliberate",
                self.round
            ),
            vec![],
            0,
            None,
            None,
        );
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    fn emit(
        &mut self,
        phase: Option<Phase>,
        actor: Option<u32>,
        target: Option<u32>,
        kind: &str,
        text: String,
        dice: Vec<i32>,
        damage: i32,
        from: Option<Hex>,
        to: Option<Hex>,
    ) {
        self.events.push(CombatEvent {
            sequence: self.events.len(),
            round: self.round,
            phase,
            actor,
            target,
            kind: kind.into(),
            text,
            dice,
            damage,
            from,
            to,
        });
    }
    /// Complete a paused React declaration without rolling dice or changing other actions.
    pub fn choose_react(&mut self, target: Option<u32>) -> Result<(), String> {
        let actor = self.awaiting_react.ok_or("No react choice is pending")?;
        if let Some(id) = target {
            let f = self.fighter(actor).ok_or("Unknown reacting fighter")?;
            let t = self.fighter(id).ok_or("Unknown react target")?;
            if t.team == f.team || !t.conscious() || f.pos.distance(t.pos) * 5 > 50 {
                return Err("React target must be an active enemy within 50 feet".into());
            }
            self.queue[self.cursor].action = Action::React { target: Some(id) };
        } else {
            self.queue[self.cursor].action = Action::Wait;
        }
        self.awaiting_react = None;
        Ok(())
    }
    fn approach(&self, actor: u32, target: Hex, max_steps: usize) -> Vec<Hex> {
        let start = self.fighter(actor).unwrap().pos;
        let mut queue = VecDeque::from([(start, vec![])]);
        let mut seen = BTreeSet::from([start]);
        while let Some((p, path)) = queue.pop_front() {
            if p.distance(target) <= 1 {
                return path;
            }
            if path.len() >= max_steps {
                continue;
            }
            for next in p.neighbors() {
                if self.open(next, actor) && seen.insert(next) {
                    let mut route = path.clone();
                    route.push(next);
                    queue.push_back((next, route));
                }
            }
        }
        vec![]
    }
    /// Resolve exactly one declaration (or round cleanup), then return newly recorded events.
    /// Cloning at this boundary makes errors atomic: neither rolls nor partial effects escape.
    pub fn step(&mut self, data: &DataPack) -> Result<Vec<CombatEvent>, String> {
        if self.turns.is_some() {
            return self.advance_turn_playback();
        }
        if !self.resolving || self.finished {
            return Ok(vec![]);
        }
        if self.awaiting_react.is_some() {
            return Ok(vec![]);
        }
        if let Some(a) = self.queue.get(self.cursor).cloned() {
            if matches!(a.action, Action::React { target: None })
                && self.fighter(a.actor).is_some_and(|f| f.can_act(self.round))
            {
                self.awaiting_react = Some(a.actor);
                self.emit(
                    Some(a.phase),
                    Some(a.actor),
                    None,
                    "react",
                    "Choose a react target within 50 feet, or wait".into(),
                    vec![],
                    0,
                    None,
                    None,
                );
                return Ok(vec![self.events.last().unwrap().clone()]);
            }
        }
        let mut next = self.clone();
        let start = next.events.len();
        if next.cursor < next.queue.len() {
            let a = next.queue[next.cursor].clone();
            next.cursor += 1;
            next.resolve(&a, data)?;
        } else {
            next.cleanup();
        }
        next.check_finished();
        let events = next.events[start..].to_vec();
        *self = next;
        Ok(events)
    }
    fn resolve(&mut self, a: &ActionDeclaration, data: &DataPack) -> Result<(), String> {
        let i = self.index(a.actor)?;
        let mut actor = self.fighters[i].clone();
        let phase = Some(a.phase);
        if !actor.can_act(self.round) {
            self.fighters[i].preparation = None;
            self.emit(
                phase,
                Some(a.actor),
                None,
                "cancel",
                format!("{} cannot act; declaration cancelled", actor.name),
                vec![],
                0,
                None,
                None,
            );
            return Ok(());
        }
        if !matches!(
            a.action,
            Action::Prepare { .. } | Action::Cast { .. } | Action::Wait
        ) {
            self.fighters[i].preparation = None;
        }
        match &a.action {
            Action::Move { path } | Action::Disengage { path } => {
                let from = actor.pos;
                let mut pos = from;
                for next in path {
                    if pos.distance(*next) != 1 || !self.open(*next, a.actor) {
                        break;
                    }
                    pos = *next;
                }
                self.fighters[i].pos = pos;
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "move",
                    format!("{} moves {} feet", actor.name, from.distance(pos) * 5),
                    vec![],
                    0,
                    Some(from),
                    Some(pos),
                );
            }
            Action::Melee { target }
            | Action::Press { target }
            | Action::React {
                target: Some(target),
            }
            | Action::Missile { target } => {
                let j = self.index(*target)?;
                let mut move_penalty = 0;
                let following = matches!(a.action, Action::Press { .. } | Action::React { .. });
                if following && actor.pos.distance(self.fighters[j].pos) > 1 {
                    let route = self.approach(
                        a.actor,
                        self.fighters[j].pos,
                        ((actor.base_move * a.activity as i32 / 100).min(50) / 5) as usize,
                    );
                    let moved = route.len() as i32 * 5;
                    if let Some(to) = route.last() {
                        let from = actor.pos;
                        actor.pos = *to;
                        self.fighters[i].pos = *to;
                        move_penalty = moved * 100 / actor.base_move;
                        if matches!(a.action, Action::Press { .. }) {
                            move_penalty /= 2;
                        }
                        self.emit(
                            phase,
                            Some(a.actor),
                            None,
                            "move",
                            format!("{} follows {} feet", actor.name, moved),
                            vec![],
                            0,
                            Some(from),
                            Some(*to),
                        );
                    }
                }
                let t = &self.fighters[j];
                let w = actor.weapons[actor.weapon].clone();
                let missile = matches!(a.action, Action::Missile { .. });
                let engaged = missile
                    && self.fighters.iter().any(|f| {
                        f.team != actor.team && f.conscious() && f.pos.distance(actor.pos) <= 1
                    });
                if !t.conscious()
                    || actor.pos.distance(t.pos) * 5 > w.range
                    || !self.line_of_sight(actor.pos, t.pos)
                    || engaged
                    || actor.weapon_recovery.contains_key(&actor.weapon)
                    || actor.broken_weapons.contains(&actor.weapon)
                    || actor.has("noAttack", self.round)
                    || missile && actor.reload_left > 0
                    || actor.has("mustParry", self.round)
                {
                    self.emit(
                        phase,
                        Some(a.actor),
                        Some(*target),
                        "cancel",
                        format!(
                            "{}: attack cancelled (target/range/line of sight/engagement/reload)",
                            actor.name
                        ),
                        vec![],
                        0,
                        None,
                        None,
                    );
                    return Ok(());
                }
                let parry = self.plan.parry.get(&a.actor).map_or(0, |p| p.amount);
                let target_parry = self
                    .plan
                    .parry
                    .get(target)
                    .filter(|p| {
                        p.target == a.actor
                            && !t.weapon_recovery.contains_key(&t.weapon)
                            && !t.broken_weapons.contains(&t.weapon)
                            && !t.has("noParry", self.round)
                            && !t.has("stunNoParry", self.round)
                    })
                    .map_or(0, |p| p.amount);
                let db = t.defense(self.round) + if missile { 0 } else { target_parry };
                let dice = self.open_roll();
                let first = dice[0];
                let mut total = dice.iter().sum::<i32>() + w.ob - parry - db
                    + actor.modifier(self.round)
                    + a.phase.modifier()
                    - (if missile { 60 } else { 100 } - a.activity as i32)
                    - move_penalty
                    + if missile || matches!(a.action, Action::Press { .. }) {
                        0
                    } else if matches!(a.action, Action::React { .. }) {
                        -10
                    } else {
                        10
                    };
                if missile {
                    self.fighters[i].reload_left = w.reload;
                }
                if first <= w.fumble {
                    let roll = self.die(100);
                    self.weapon_fumble(a, roll, data)?;
                } else {
                    if !missile && self.turns.is_some() {
                        total = self.spend_turn_parry(*target, &w.table, total, first, data)?;
                    }
                    self.apply_attack(a, *target, &w.table, &w.critical, total, first, dice, data)?;
                }
            }
            Action::StandUp => {
                self.fighters[i]
                    .conditions
                    .retain(|c| c.effect.kind != "prone");
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "stand",
                    format!("{} stands up", actor.name),
                    vec![],
                    0,
                    None,
                    None,
                );
            }
            Action::RecoverWeapon => {
                if let Some(left) = self.fighters[i].weapon_recovery.get_mut(&actor.weapon) {
                    *left = left.saturating_sub(1);
                    if *left == 0 {
                        self.fighters[i].weapon_recovery.remove(&actor.weapon);
                    }
                }
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "recover",
                    format!(
                        "{} recovers their weapon; {} rounds left",
                        actor.name,
                        self.fighters[i]
                            .weapon_recovery
                            .get(&actor.weapon)
                            .copied()
                            .unwrap_or(0)
                    ),
                    vec![],
                    0,
                    None,
                    None,
                );
            }
            Action::Reload => {
                self.fighters[i].reload_left = actor.reload_left.saturating_sub(a.activity as u16);
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "reload",
                    format!(
                        "{} reloads; {}% remaining",
                        actor.name, self.fighters[i].reload_left
                    ),
                    vec![],
                    0,
                    None,
                    None,
                );
            }
            Action::ChangeWeapon { index } => {
                self.fighters[i].weapon = *index;
                self.fighters[i].reload_left = self.fighters[i].weapons[*index].reload;
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "weapon",
                    format!(
                        "{} equips {}",
                        actor.name, self.fighters[i].weapons[*index].name
                    ),
                    vec![],
                    0,
                    None,
                    None,
                );
            }
            Action::Prepare { spell } => {
                let rounds = actor
                    .preparation
                    .filter(|p| p.spell == *spell && p.last_round + 1 == self.round)
                    .map_or(1, |p| p.rounds + 1);
                self.fighters[i].preparation = Some(Preparation {
                    spell: *spell,
                    rounds,
                    last_round: self.round,
                });
                self.emit(
                    phase,
                    Some(a.actor),
                    None,
                    "prepare",
                    format!("{} prepares {:?} ({rounds} rounds)", actor.name, spell),
                    vec![],
                    0,
                    None,
                    None,
                );
            }
            Action::Cast { spell, target } => self.cast(a, *spell, *target, data)?,
            Action::React { target: None } | Action::Wait => {}
        }
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    fn apply_attack(
        &mut self,
        a: &ActionDeclaration,
        target: u32,
        table: &str,
        critical: &str,
        total: i32,
        first: i32,
        dice: Vec<i32>,
        data: &DataPack,
    ) -> Result<(), String> {
        let i = self.index(a.actor)?;
        let j = self.index(target)?;
        let result = data
            .attack(table, total, first, self.fighters[j].armor)?
            .to_owned();
        let damage = result
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse::<i32>()
            .unwrap_or(0);
        self.fighters[j].damage += damage;
        if damage > 0 {
            self.fighters[j].preparation = None;
        }
        self.emit(
            Some(a.phase),
            Some(a.actor),
            Some(target),
            "attack",
            format!(
                "{} → {}: {} total, {} ({})",
                self.fighters[i].name, self.fighters[j].name, total, result, table
            ),
            dice,
            damage,
            None,
            None,
        );
        if let Some(severity) = result.chars().find(|c| ('A'..='E').contains(c)) {
            self.apply_critical(a, target, critical, severity, data)?;
        }
        Ok(())
    }
    fn apply_critical(
        &mut self,
        a: &ActionDeclaration,
        target: u32,
        critical: &str,
        severity: char,
        data: &DataPack,
    ) -> Result<(), String> {
        let i = self.index(a.actor)?;
        let j = self.index(target)?;
        let roll = self.die(100);
        let crit = data.critical(critical, severity, roll, &self.fighters[j].equipment)?;
        self.fighters[j].disabling |= crit.disabling;
        for effect in &crit.effects {
            match effect.kind.as_str() {
                "hits" => self.fighters[j].damage += effect.amount,
                "dies" => {
                    if effect.rounds.unwrap_or(0) == 0 {
                        self.fighters[j].dead = true
                    } else {
                        self.fighters[j].death_round = Some(self.round + effect.rounds.unwrap())
                    }
                }
                "initiative" => self.fighters[i].initiative_override = Some(self.round + 1),
                "recoil" => {}
                "bonus" => self.fighters[i].conditions.push(Condition {
                    effect: effect.clone(),
                    starts: self.round + 1,
                    source: Some(a.actor),
                }),
                "allyBonus" => {
                    let team = self.fighters[i].team;
                    for f in &mut self.fighters {
                        if f.team == team {
                            let mut e = effect.clone();
                            e.kind = "bonus".into();
                            f.conditions.push(Condition {
                                effect: e,
                                starts: self.round + 1,
                                source: Some(a.actor),
                            });
                        }
                    }
                }
                _ => self.fighters[j].conditions.push(Condition {
                    effect: effect.clone(),
                    starts: self.round + 1,
                    source: Some(a.actor),
                }),
            }
        }
        self.emit(
            Some(a.phase),
            Some(a.actor),
            Some(target),
            "critical",
            format!(
                "{severity} critical {roll}: {} {}{}",
                crit.description,
                crit.effect,
                if crit.review {
                    " [Conditional ruling requires review]"
                } else {
                    ""
                }
            ),
            vec![roll],
            0,
            None,
            None,
        );
        Ok(())
    }
    fn cast(
        &mut self,
        a: &ActionDeclaration,
        spell: Spell,
        target: u32,
        data: &DataPack,
    ) -> Result<(), String> {
        let i = self.index(a.actor)?;
        let j = self.index(target)?;
        let f = self.fighters[i].clone();
        let t = self.fighters[j].clone();
        if t.dead
            || f.pos.distance(t.pos) * 5 > spell.range()
            || !self.line_of_sight(f.pos, t.pos)
            || f.pp < spell.level()
        {
            self.emit(
                Some(a.phase),
                Some(a.actor),
                Some(target),
                "cancel",
                format!("{}: spell target unavailable or out of range", f.name),
                vec![],
                0,
                None,
                None,
            );
            return Ok(());
        }
        let prep = f
            .preparation
            .as_ref()
            .filter(|p| p.spell == spell && p.last_round + 1 >= self.round)
            .map_or(0, |p| p.rounds);
        self.fighters[i].pp -= spell.level();
        self.fighters[i].preparation = None;
        let diff = f.level - spell.level();
        let prep_mod = preparation_modifier(diff, prep, spell == Spell::Blur);
        let used = if f.max_pp > 0 {
            (f.max_pp - f.pp) * 100 / f.max_pp
        } else {
            0
        };
        let pp_mod = if used > 75 {
            -30
        } else if used > 50 {
            -20
        } else if used > 25 {
            -10
        } else {
            0
        };
        let phase_mod = if a.phase == Phase::Snap && spell != Spell::Blur {
            -20
        } else {
            0
        };
        let modifiers = prep_mod + pp_mod + phase_mod + f.modifier(self.round);
        if prep_mod < 0 || pp_mod < 0 || phase_mod < 0 || f.modifier(self.round) < 0 {
            let dice = self.open_roll();
            let total = dice.iter().sum::<i32>() + f.spell_bonus + modifiers;
            self.emit(
                Some(a.phase),
                Some(a.actor),
                Some(target),
                "casting",
                format!("{} casting maneuver: {total}", f.name),
                dice,
                0,
                None,
                None,
            );
            if total <= 60 {
                self.emit(
                    Some(a.phase),
                    Some(a.actor),
                    Some(target),
                    "failure",
                    "Spell casting did not succeed".into(),
                    vec![],
                    0,
                    None,
                    None,
                );
                return Ok(());
            }
        }
        let dice = self.open_roll();
        let first = dice[0];
        if first <= 2 {
            self.emit(
                Some(a.phase),
                Some(a.actor),
                Some(target),
                "failure",
                format!("{}: {:?} fails on {first}", f.name, spell),
                dice,
                0,
                None,
                None,
            );
            return Ok(());
        }
        match spell {
            Spell::ShockBoltI => {
                let total = (dice.iter().sum::<i32>() + f.bolt_ob - 40 - t.defense(self.round)
                    + a.phase.modifier()
                    + f.modifier(self.round))
                .min(90);
                self.apply_attack(a, target, "A-10.9.9", "A-10.10.2", total, first, dice, data)?;
            }
            Spell::HealingI | Spell::HealingIII => {
                let rolls: Vec<_> = (0..if spell == Spell::HealingIII { 3 } else { 1 })
                    .map(|_| self.die(10))
                    .collect();
                let healed = rolls.iter().sum::<i32>().min(t.damage);
                self.fighters[j].damage -= healed;
                self.emit(
                    Some(a.phase),
                    Some(a.actor),
                    Some(target),
                    "heal",
                    format!(
                        "{} heals {} for {} hits; injuries remain",
                        f.name, t.name, healed
                    ),
                    rolls,
                    -healed,
                    None,
                    None,
                );
            }
            Spell::BlessI | Spell::Blur => {
                let kind = if spell == Spell::BlessI {
                    "bless"
                } else {
                    "blur"
                };
                self.fighters[j]
                    .conditions
                    .retain(|c| c.effect.kind != kind);
                self.fighters[j].conditions.push(Condition {
                    effect: Effect {
                        kind: kind.into(),
                        amount: if spell == Spell::BlessI { 5 } else { 10 },
                        rounds: Some((f.level * 6) as u32),
                        feet: 0,
                    },
                    starts: self.round,
                    source: Some(a.actor),
                });
                self.emit(
                    Some(a.phase),
                    Some(a.actor),
                    Some(target),
                    "ward",
                    format!("{} casts {:?} on {}", f.name, spell, t.name),
                    dice,
                    0,
                    None,
                    None,
                );
            }
            Spell::JoltsI | Spell::MinorPain => {
                let distance = f.pos.distance(t.pos) * 5;
                let range_mod = if distance <= 10 {
                    10
                } else if distance <= 50 {
                    0
                } else {
                    -10
                };
                let wound_mod = if f.damage * 4 > f.max_hits * 3 {
                    -15
                } else if f.damage * 2 > f.max_hits {
                    -10
                } else if f.damage * 4 > f.max_hits {
                    -5
                } else {
                    0
                };
                // Basic spell OB is list rank, not the spell casting maneuver skill bonus.
                let total = first
                    + f.level
                    + range_mod
                    + wound_mod
                    + a.phase.modifier()
                    + f.modifier(self.round);
                let rr_modifier = match data.mentalism_attack(total, first, &t.equipment) {
                    Ok(n) => n,
                    Err(_) => {
                        self.emit(
                            Some(a.phase),
                            Some(a.actor),
                            Some(target),
                            "failure",
                            format!(
                                "{}: {:?} fails on the Basic Spell Attack table",
                                f.name, spell
                            ),
                            vec![first],
                            0,
                            None,
                            None,
                        );
                        return Ok(());
                    }
                };
                let threshold = DataPack::resistance_target(f.level, t.level);
                let rr = self.open_roll();
                let total = rr.iter().sum::<i32>() + t.rr + rr_modifier;
                let failed = threshold - total;
                if failed > 0 {
                    if spell == Spell::JoltsI {
                        self.fighters[j].conditions.push(Condition {
                            effect: Effect {
                                kind: "stun".into(),
                                amount: 0,
                                rounds: Some(((failed + 9) / 10) as u32),
                                feet: 0,
                            },
                            starts: self.round + 1,
                            source: Some(a.actor),
                        });
                    } else {
                        self.fighters[j].damage += (t.max_hits - t.damage).max(0) / 4;
                    }
                    self.fighters[j].preparation = None;
                }
                self.emit(
                    Some(a.phase),
                    Some(a.actor),
                    Some(target),
                    "resistance",
                    format!(
                        "{} casts {:?}: {} RR {} vs {} — {}",
                        f.name,
                        spell,
                        t.name,
                        total,
                        threshold,
                        if failed > 0 { "failed" } else { "resisted" }
                    ),
                    rr,
                    0,
                    None,
                    None,
                );
            }
        }
        Ok(())
    }
    fn cleanup(&mut self) {
        for i in 0..self.fighters.len() {
            let f = &mut self.fighters[i];
            let rounds: Vec<_> = f
                .conditions
                .iter()
                .map(|c| c.effect.rounds.map_or(f64::NAN, |n| n as f64))
                .collect();
            let starts: Vec<_> = f.conditions.iter().map(|c| c.starts as f64).collect();
            let priorities: Vec<_> = f
                .conditions
                .iter()
                .map(|c| match c.effect.kind.as_str() {
                    "stun" => 1,
                    "stunNoParry" => 2,
                    "downOrOut" => 3,
                    _ => 0,
                })
                .collect();
            let next = rolemaster_rules::critical_effect_rounds(
                &rounds,
                &starts,
                &priorities,
                self.round as f64,
            )
            .unwrap();
            for (c, n) in f.conditions.iter_mut().zip(next) {
                c.effect.rounds = if n.is_nan() { None } else { Some(n as u32) };
            }
            f.conditions.retain(|c| c.effect.rounds != Some(0));
        }
        self.round += 1;
        for i in 0..self.fighters.len() {
            let bleed = self.fighters[i]
                .conditions
                .iter()
                .filter(|c| c.effect.kind == "bleed" && c.starts <= self.round)
                .map(|c| c.effect.amount)
                .sum::<i32>();
            if !self.fighters[i].dead && bleed > 0 {
                self.fighters[i].damage += bleed;
                self.emit(
                    None,
                    Some(self.fighters[i].id),
                    None,
                    "bleed",
                    format!("{} bleeds for {bleed}", self.fighters[i].name),
                    vec![],
                    bleed,
                    None,
                    None,
                );
            }
            if self.fighters[i]
                .death_round
                .is_some_and(|n| n <= self.round)
            {
                self.fighters[i].dead = true;
            }
        }
        let positions: BTreeMap<_, _> = self.fighters.iter().map(|f| (f.id, f.pos)).collect();
        for f in &mut self.fighters {
            f.conditions.retain(|c| {
                c.effect.kind != "bless"
                    || c.source
                        .and_then(|id| positions.get(&id))
                        .is_some_and(|p| p.distance(f.pos) * 5 <= 100)
            });
        }
        self.resolving = false;
        self.plan = RoundPlan::default();
        self.queue.clear();
        self.cursor = 0;
        self.emit(
            None,
            None,
            None,
            "round",
            if self.turns.is_some() {
                format!("Round {}", self.round)
            } else {
                format!("Round {} — declare actions", self.round)
            },
            vec![],
            0,
            None,
            None,
        );
    }
    fn check_finished(&mut self) {
        let teams: BTreeSet<_> = self
            .fighters
            .iter()
            .filter(|f| f.conscious())
            .map(|f| f.team)
            .collect();
        if teams.len() < 2 {
            self.finished = true;
            self.resolving = false;
            self.winner = teams.first().copied();
            self.emit(
                None,
                None,
                None,
                "finished",
                match self.winner {
                    Some(0) => "Victory".into(),
                    Some(_) => "Defeat".into(),
                    None => "Draw".into(),
                },
                vec![],
                0,
                None,
                None,
            );
        }
    }
}
pub fn preparation_modifier(diff: i32, rounds: u32, instant: bool) -> i32 {
    let row = match diff {
        9.. => [15, 5, 10, 15, 20, 25, 30, 35],
        6..=8 => [10, 0, 5, 10, 15, 20, 25, 30],
        5 => [5, -10, 0, 5, 10, 15, 20, 25],
        4 => [5, -20, 0, 5, 10, 15, 20, 25],
        3 => [5, -30, 0, 5, 10, 15, 20, 25],
        2 => [0, -35, -10, 0, 5, 10, 15, 20],
        1 => [0, -45, -20, 0, 5, 10, 15, 20],
        _ => [0, -55, -30, 0, 5, 10, 15, 20],
    };
    row[if instant {
        0
    } else {
        match rounds {
            0 => 1,
            1 => 2,
            2 => 3,
            3..=4 => 4,
            5..=6 => 5,
            7..=8 => 6,
            _ => 7,
        }
    }]
}

// JSON numbers cannot round-trip u64 through JavaScript. Keep RNG exact at the host boundary.
mod u64_string {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(n: &u64, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&n.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Value {
            Text(String),
            Number(u64),
        }
        match Value::deserialize(d)? {
            Value::Text(s) => s.parse().map_err(serde::de::Error::custom),
            Value::Number(n) => Ok(n),
        }
    }
}
