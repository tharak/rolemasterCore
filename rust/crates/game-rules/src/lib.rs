//! Game-independent effect clocks. Callers supply stacking pools and priorities.
//! No game names, notation, UI, I/O, persistence or browser dependencies.

#[derive(Clone, Debug, PartialEq)]
pub struct TimedEffect {
    /// None represents an effect that requires explicit removal.
    pub remaining: Option<f64>,
    pub starts_on: f64,
    /// Each pool spends one round per tick, choosing its highest priority first.
    /// Effects without a pool expire independently.
    pub pool: Option<u16>,
    pub priority: u8,
}

/// Advance one completed round in place. Stable input order breaks priority ties.
/// The caller removes elapsed effects; future and indefinite effects are retained.
pub fn tick_effects(effects: &mut [TimedEffect], completed_round: f64) {
    let mut selected = std::collections::BTreeMap::<u16, usize>::new();
    for (index, effect) in effects.iter().enumerate() {
        if effect.starts_on > completed_round || !effect.remaining.is_some_and(|n| n > 0.0) {
            continue;
        }
        if let Some(pool) = effect.pool {
            let previous = selected.get(&pool).copied();
            if previous.is_none_or(|old| effect.priority > effects[old].priority) {
                selected.insert(pool, index);
            }
        }
    }
    for (index, effect) in effects.iter_mut().enumerate() {
        if effect.starts_on > completed_round {
            continue;
        }
        if let Some(remaining) = &mut effect.remaining {
            if effect
                .pool
                .is_none_or(|pool| selected.get(&pool) == Some(&index))
            {
                *remaining -= 1.0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn effect(rounds: Option<f64>, pool: Option<u16>, priority: u8) -> TimedEffect {
        TimedEffect {
            remaining: rounds,
            starts_on: 1.0,
            pool,
            priority,
        }
    }

    #[test]
    fn independent_pools_and_stable_priority_ties() {
        let mut effects = vec![
            effect(Some(2.0), Some(7), 1),
            effect(Some(2.0), Some(7), 2),
            effect(Some(2.0), Some(7), 2),
            effect(Some(2.0), Some(42), 1),
            effect(Some(2.0), None, 0),
        ];
        tick_effects(&mut effects, 1.0);
        assert_eq!(
            effects.iter().map(|e| e.remaining).collect::<Vec<_>>(),
            vec![Some(2.0), Some(1.0), Some(2.0), Some(1.0), Some(1.0)]
        );
    }

    #[test]
    fn future_and_indefinite_effects_do_not_advance() {
        let mut effects = vec![
            effect(None, None, 0),
            effect(Some(2.0), Some(1), 3),
            effect(Some(1.0), Some(1), 1),
        ];
        effects[1].starts_on = 2.0;
        tick_effects(&mut effects, 1.0);
        assert_eq!(effects[0].remaining, None);
        assert_eq!(effects[1].remaining, Some(2.0));
        assert_eq!(effects[2].remaining, Some(0.0));
    }
}
