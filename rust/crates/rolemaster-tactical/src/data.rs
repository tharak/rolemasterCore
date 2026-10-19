use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Deserialize)]
pub struct DataPack {
    pub weapon_fumbles: Vec<TextRow>,
    pub spell_failures: Vec<TextRow>,
    pub version: u32,
    pub basic: Vec<AttackRow>,
    pub attacks: BTreeMap<String, Vec<AttackRow>>,
    pub criticals: BTreeMap<String, Vec<CriticalRow>>,
}
#[derive(Debug, Deserialize)]
pub struct TextRow {
    pub range: [i32; 2],
    pub cells: Vec<String>,
}
#[derive(Debug, Deserialize)]
pub struct AttackRow {
    pub range: [i32; 2],
    pub unmodified: bool,
    pub values: Vec<String>,
}
#[derive(Debug, Deserialize)]
pub struct CriticalRow {
    pub range: [i32; 2],
    pub cells: Vec<CriticalCell>,
}
#[derive(Debug, Deserialize)]
pub struct CriticalCell {
    pub keys: Vec<String>,
    pub variants: Vec<Critical>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Critical {
    pub mask: u32,
    pub description: String,
    pub effect: String,
    pub effects: Vec<Effect>,
    pub disabling: bool,
    pub review: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Effect {
    pub kind: String,
    #[serde(default)]
    pub amount: i32,
    #[serde(rename = "roundsLeft", default)]
    pub rounds: Option<u32>,
    #[serde(default)]
    pub feet: i32,
}
fn contains(range: [i32; 2], n: i32) -> bool {
    n >= range[0] && n <= range[1]
}
pub fn has_equipment(items: &[String], key: &str) -> bool {
    items.iter().any(|s| s == key)
        || match key {
            "helmet" | "head gear" => items
                .iter()
                .any(|s| ["helmet", "full helmet", "visor"].contains(&s.as_str())),
            "chest armor" => items.iter().any(|s| s == "plate chest armor"),
            "armor" => items.iter().any(|s| s.contains("armor")),
            _ => false,
        }
}
impl DataPack {
    pub fn failure_text(&self, spell: bool, roll: i32, column: usize) -> Result<&str, String> {
        let rows = if spell {
            &self.spell_failures
        } else {
            &self.weapon_fumbles
        };
        rows.iter()
            .find(|r| contains(r.range, roll))
            .and_then(|r| r.cells.get(column))
            .map(String::as_str)
            .ok_or("Missing failure table result".into())
    }

    /// Basic Mentalism spell attacks use the helmet columns (A-10.9.11).
    pub fn mentalism_attack(
        &self,
        total: i32,
        first: i32,
        equipment: &[String],
    ) -> Result<i32, String> {
        let column =
            if has_equipment(equipment, "metal helmet") || has_equipment(equipment, "helmet") {
                6
            } else if has_equipment(equipment, "leather helmet") {
                7
            } else {
                8
            };
        let row = self
            .basic
            .iter()
            .find(|r| r.unmodified && contains(r.range, first))
            .or_else(|| {
                self.basic
                    .iter()
                    .find(|r| !r.unmodified && contains(r.range, total.clamp(3, 95)))
            })
            .ok_or("Missing basic spell attack row")?;
        row.values[column]
            .parse()
            .map_err(|_| "Basic spell attack failed".into())
    }
    /// T-3.4: piecewise progression, including levels over 15.
    pub fn resistance_target(attacker: i32, target: i32) -> i32 {
        fn level(n: i32) -> i32 {
            if n <= 5 {
                n * 5
            } else if n <= 10 {
                25 + (n - 5) * 3
            } else if n <= 15 {
                40 + (n - 10) * 2
            } else {
                50 + n - 15
            }
        }
        50 + level(attacker) - level(target)
    }
    pub fn bundled() -> Self {
        serde_json::from_str(include_str!("../../../../data/tactical-v1.json"))
            .expect("validated combat pack")
    }
    pub fn attack(&self, code: &str, total: i32, first: i32, armor: u8) -> Result<&str, String> {
        if !(1..=20).contains(&armor) {
            return Err("Armor type must be 1–20".into());
        }
        let rows = self.attacks.get(code).ok_or("Unknown attack table")?;
        let upper = rows
            .iter()
            .filter(|r| !r.unmodified)
            .map(|r| r.range[1])
            .max()
            .ok_or("Empty attack table")?;
        let lower = rows
            .iter()
            .filter(|r| !r.unmodified)
            .map(|r| r.range[0])
            .min()
            .unwrap();
        let row = rows
            .iter()
            .find(|r| r.unmodified && contains(r.range, first))
            .or_else(|| {
                rows.iter()
                    .find(|r| !r.unmodified && contains(r.range, total.clamp(lower, upper)))
            })
            .ok_or("Missing attack row")?;
        Ok(&row.values[(20 - armor) as usize])
    }
    pub fn critical(
        &self,
        code: &str,
        severity: char,
        roll: i32,
        equipment: &[String],
    ) -> Result<Critical, String> {
        let rows = self.criticals.get(code).ok_or("Unknown critical table")?;
        let row = rows
            .iter()
            .find(|r| contains(r.range, roll))
            .ok_or("Missing critical row")?;
        let cell = row
            .cells
            .get(severity as usize - 'A' as usize)
            .ok_or("Invalid critical severity")?;
        let mask = cell.keys.iter().enumerate().fold(0, |m, (i, k)| {
            m | if has_equipment(equipment, k) {
                1 << i
            } else {
                0
            }
        });
        cell.variants
            .iter()
            .find(|c| c.mask == mask)
            .cloned()
            .ok_or("Missing equipment variant".into())
    }
}
