import fs from 'node:fs';

const heldoutItems = [
  // 1. SAR
  { warningId: "NAVAREA IX 354/24", category: "sar", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 961/24", category: "sar", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IX 601/24", category: "sar", archetype: "point", positionCount: 1 },
  // 2. Military Firing
  { warningId: "NAVAREA IX 365/24", category: "mil_fire", archetype: "polygon", positionCount: 4 },
  { warningId: "NAVAREA IV 870/24", category: "mil_fire", archetype: "polygon", positionCount: 4 },
  { warningId: "NAVAREA IV 1002/24", category: "mil_fire", archetype: "polygon", positionCount: 4 },
  // 3. UXO
  { warningId: "NAVAREA IX 201/24", category: "uxo", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 967/24", category: "uxo", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IX 603/24", category: "uxo", archetype: "point_radius", positionCount: 1 },
  // 4. Weather
  { warningId: "NAVAREA IV 1004/24", category: "weather", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IX 604/24", category: "weather", archetype: "point", positionCount: 1 },
  // 5. Ice
  { warningId: "NAVAREA IV 979/24", category: "ice", archetype: "polyline", positionCount: 3 },
  { warningId: "NAVAREA IV 1005/24", category: "ice", archetype: "point", positionCount: 1 },
  // 6. Security
  { warningId: "NAVAREA IX 328/24", category: "security", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IX 84/24", category: "security", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 1006/24", category: "security", archetype: "point", positionCount: 1 },
  // 7. Drift
  { warningId: "NAVAREA IX 189/24", category: "drift", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 842/24", category: "drift", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 1007/24", category: "drift", archetype: "point", positionCount: 1 },
  // 8. Wreck
  { warningId: "NAVAREA IX 203/24", category: "wreck", archetype: "none", positionCount: 0 },
  { warningId: "NAVAREA IV 1008/24", category: "wreck", archetype: "point", positionCount: 1 },
  // 9. Cable
  { warningId: "NAVAREA IV 649/24", category: "cable", archetype: "corridor", positionCount: 3 },
  { warningId: "NAVAREA IX 484/25", category: "cable", archetype: "polyline", positionCount: 3 },
  { warningId: "NAVAREA IV 1009/24", category: "cable", archetype: "corridor", positionCount: 2 },
  // 10. Survey
  { warningId: "NAVAREA IX 261/24", category: "survey", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IX 358/24", category: "survey", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IV 1010/24", category: "survey", archetype: "point_radius", positionCount: 1 },
  // 11. Rig
  { warningId: "NAVAREA IX 214/24", category: "rig", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IX 103/24", category: "rig", archetype: "polyline", positionCount: 2 },
  { warningId: "NAVAREA IV 1011/24", category: "rig", archetype: "point_radius", positionCount: 1 },
  // 12. AtoN
  { warningId: "NAVAREA IX 355/24", category: "aton", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IV 551/24", category: "aton", archetype: "point", positionCount: 1 },
  { warningId: "NAVAREA IX 611/24", category: "aton", archetype: "point", positionCount: 1 },
  // 13. Restricted
  { warningId: "NAVAREA IX 612/24", category: "restricted", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IV 1013/24", category: "restricted", archetype: "point_radius", positionCount: 1 },
  // 14. Ops
  { warningId: "NAVAREA IX 285/24", category: "ops", archetype: "point_radius", positionCount: 1 },
  { warningId: "NAVAREA IV 1014/24", category: "ops", archetype: "point", positionCount: 1 }
];

const sliceObjects = heldoutItems.slice(0, 37).map(item => ({
  warningId: item.warningId,
  category: item.category,
  archetype: item.archetype
}));

fs.writeFileSync('src/data/fixtures/heldout-slice.json', JSON.stringify(sliceObjects, null, 2), 'utf8');

const heldoutLabels: Record<string, { category: string; archetype: string; positionCount: number }> = {};
for (const item of heldoutItems.slice(0, 37)) {
  heldoutLabels[item.warningId] = {
    category: item.category,
    archetype: item.archetype,
    positionCount: item.positionCount
  };
}

fs.writeFileSync('src/data/fixtures/heldout-labels.json', JSON.stringify(heldoutLabels, null, 2), 'utf8');

const heldoutTriage: Record<string, { status: 'new_pattern' | 'accepted_noise'; explanation: string }> = {
  "NAVAREA IX 103/24": {
    status: "accepted_noise",
    explanation: "Rig under tow contains 2 waypoints (origin and destination); categorized as rig with relocation/polyline archetype depending on tow ladder step."
  },
  "NAVAREA IX 203/24": {
    status: "accepted_noise",
    explanation: "Wreck notice with no explicit numeric coordinates; categorized as wreck, archetype: none, routed to gazetteer / list panel with unplotted: no_coordinates."
  }
};

fs.writeFileSync('src/data/fixtures/heldout-triage.json', JSON.stringify(heldoutTriage, null, 2), 'utf8');

console.log(`Generated heldout-slice.json (${sliceObjects.length} items with warningId), heldout-labels.json, and heldout-triage.json.`);
