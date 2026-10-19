//! Rolemaster rules. No browser, UI, storage or Wasm dependencies.

/// Translate the Rolemaster stun policy to the reusable effect clock.
/// Priorities: 0 = independent timer, 1 = stun, 2 = stun/no-parry, 3 = down/out.
/// NaN remaining rounds represents indefinite duration at the adapter boundary.
pub fn critical_effect_rounds(
    rounds: &[f64],
    starts: &[f64],
    priorities: &[u8],
    completed: f64,
) -> Result<Vec<f64>, &'static str> {
    if rounds.len() != starts.len() || rounds.len() != priorities.len() {
        return Err("effect arrays must have equal lengths");
    }
    let mut effects: Vec<_> = rounds
        .iter()
        .zip(starts)
        .zip(priorities)
        .map(
            |((&remaining, &starts_on), &priority)| game_rules::TimedEffect {
                remaining: (!remaining.is_nan()).then_some(remaining),
                starts_on,
                pool: (priority > 0).then_some(0),
                priority,
            },
        )
        .collect();
    game_rules::tick_effects(&mut effects, completed);
    Ok(effects
        .iter()
        .map(|effect| effect.remaining.unwrap_or(f64::NAN))
        .collect())
}

#[cfg(test)]
mod critical_tests {
    use super::critical_effect_rounds;

    #[test]
    fn rolemaster_uses_one_stun_pool_and_independent_other_timers() {
        let result = critical_effect_rounds(
            &[2.0, 2.0, 1.0, 2.0, f64::NAN],
            &[1.0; 5],
            &[1, 2, 3, 0, 0],
            1.0,
        )
        .unwrap();
        assert_eq!(&result[..4], &[2.0, 2.0, 0.0, 1.0]);
        assert!(result[4].is_nan());
        assert!(critical_effect_rounds(&[1.0], &[], &[], 1.0).is_err());
    }
}

/// Equivalent to character-rules.js basicStatBonus for numeric inputs.
/// Keep the exact-100 exception, floor (not truncation), NaN and infinities.
pub fn basic_stat_bonus(value: f64) -> f64 {
    if value == 100.0 {
        10.0
    } else if value >= 90.0 {
        5.0 + ((value - 90.0) / 2.0).floor()
    } else if value >= 70.0 {
        1.0 + ((value - 70.0) / 5.0).floor()
    } else if value >= 31.0 {
        0.0
    } else if value >= 11.0 {
        -1.0 - ((30.0 - value) / 5.0).floor()
    } else {
        -5.0 - ((10.0 - value) / 2.0).floor()
    }
}

/// Numeric-array rankCost: truncate/clamp purchased slots and sum left to right.
/// Rust float-to-usize saturation maps NaN/negative to zero and infinity to the end.
pub fn rank_cost(costs: &[f64], ranks: f64) -> f64 {
    let count = (ranks as usize).min(costs.len());
    costs[..count].iter().fold(0.0, |sum, value| sum + value)
}

/// Equivalent to rules.js rankBonus after JavaScript Number(input) conversion.
/// Unknown progression names retain the original standard-progression fallback.
/// Negative values and NaN become zero; fractions and positive infinity are kept.
pub fn rank_bonus(ranks: f64, progression: &str) -> f64 {
    let n = if ranks.is_nan() { 0.0 } else { ranks.max(0.0) };
    let first = n.min(10.0);
    let second = (n - 10.0).clamp(0.0, 10.0);
    let third = (n - 20.0).clamp(0.0, 10.0);
    let rest = (n - 30.0).max(0.0);
    let rounded = |value: f64| (value + 0.5).floor();
    match progression {
        "category" => {
            if n == 0.0 {
                -15.0
            } else {
                rounded(2.0 * first + second + 0.5 * third)
            }
        }
        "limited" => rounded(n.min(20.0) + 0.5 * third),
        "special" => 6.0 * first + 5.0 * second + 4.0 * third + 3.0 * rest,
        "combined" => {
            if n == 0.0 {
                -30.0
            } else {
                rounded(5.0 * first + 3.0 * second + 1.5 * third + 0.5 * rest)
            }
        }
        _ => {
            if n == 0.0 {
                -15.0
            } else {
                rounded(3.0 * first + 2.0 * second + third + 0.5 * rest)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{basic_stat_bonus, rank_bonus, rank_cost};

    #[test]
    fn stat_bonus_boundaries_and_special_values() {
        for (value, expected) in [
            (1.0, -9.0),
            (10.0, -5.0),
            (10.5, -4.0),
            (11.0, -4.0),
            (30.0, -1.0),
            (31.0, 0.0),
            (69.0, 0.0),
            (70.0, 1.0),
            (89.0, 4.0),
            (90.0, 5.0),
            (99.0, 9.0),
            (100.0, 10.0),
            (100.5, 10.0),
            (102.0, 11.0),
            (f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, f64::NEG_INFINITY),
        ] {
            assert_eq!(basic_stat_bonus(value), expected);
        }
        assert!(basic_stat_bonus(f64::NAN).is_nan());
    }

    #[test]
    fn purchased_cost_slots() {
        let costs = [2.0, 4.0, 6.0];
        for (ranks, expected) in [
            (0.0, 0.0),
            (-1.0, 0.0),
            (2.9, 6.0),
            (f64::NAN, 0.0),
            (f64::NEG_INFINITY, 0.0),
            (f64::INFINITY, 12.0),
        ] {
            assert_eq!(rank_cost(&costs, ranks), expected);
        }
        assert_eq!(rank_cost(&[], 4.0), 0.0);
        assert_eq!(rank_cost(&[1e16, 1.0, -1e16], 3.0), 0.0);
        assert!(rank_cost(&[f64::NAN], 1.0).is_nan());
    }

    #[test]
    fn table_boundaries() {
        for (n, progression, expected) in [
            (0.0, "standard", -15.0),
            (10.0, "standard", 30.0),
            (20.0, "standard", 50.0),
            (31.0, "standard", 61.0),
            (0.0, "category", -15.0),
            (11.0, "category", 21.0),
            (21.0, "category", 31.0),
            (0.0, "combined", -30.0),
            (21.0, "combined", 82.0),
            (1.0, "limited", 1.0),
            (30.0, "limited", 25.0),
            (31.0, "special", 153.0),
        ] {
            assert_eq!(rank_bonus(n, progression), expected);
        }
    }

    #[test]
    fn numeric_normalization_and_fallback() {
        assert_eq!(rank_bonus(f64::NAN, "standard"), -15.0);
        assert_eq!(rank_bonus(-1.0, "combined"), -30.0);
        assert_eq!(rank_bonus(f64::NEG_INFINITY, "limited"), 0.0);
        assert_eq!(rank_bonus(31.0, "unknown"), 61.0);
        assert_eq!(rank_bonus(0.25, "special"), 1.5);
        assert_eq!(rank_bonus(0.5, "standard"), 2.0);
        assert_eq!(rank_bonus(f64::INFINITY, "category"), 35.0);
        assert_eq!(rank_bonus(f64::INFINITY, "limited"), 25.0);
        assert_eq!(rank_bonus(f64::INFINITY, "standard"), f64::INFINITY);
    }
}
