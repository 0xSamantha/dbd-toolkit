// Roster additions from patch 10.3.0 supplement the pinned perk snapshot.
const DBD_TERRIFIER = "The Terrifier";
const DBD_KILLER_NAMES = [
  ...DBD_PERK_DATA.killers.map(name => "The " + name),
  DBD_TERRIFIER
];
const DBD_SURVIVOR_NAMES = [...new Set([
  ...DBD_PERK_DATA.perks
    .filter(perk => perk.role === "S" || perk.role === "survivor")
    .map(perk => perk.meta?.owner)
    .filter(name => name && name !== "General perk"),
  "Sienna Shaw"
])];
