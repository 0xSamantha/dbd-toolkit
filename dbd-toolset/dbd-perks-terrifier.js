const DBD_PERKS = (() => {
  const source = "https://support.deadbydaylight.com/hc/en-us/articles/55705675383956-10-3-0-Patch-Notes";
  const terrifier = [
    {
      id: "funny-business",
      name: "Funny Business",
      tags: ["generator", "speed"],
      desc: "Damaging a generator grants 10% Haste for 10 seconds. One bonus outcome is chosen at random: 5 extra seconds of Haste, a 2-second self-stun, a 30-second block on that generator, or confetti with no gameplay effect. The random outcome cannot repeat consecutively. Cooldown: 60/50/40 seconds.",
      tiers: ["60/50/40"]
    },
    {
      id: "kill-spree",
      name: "Kill Spree",
      tags: ["generator", "hook"],
      desc: "Once every generator is complete and each remaining survivor has two hook states, you can kill survivors. Both exit gate switches stay blocked during the kill and for 12/16/20 seconds afterward.",
      tiers: ["12/16/20"]
    },
    {
      id: "laughingstock",
      name: "Laughingstock",
      tags: ["aura-reading", "generator", "exhaustion", "stealth"],
      desc: "Completed generators inflict Exhausted and Oblivious on survivors within 12 metres. Both effects last 3/4/5 seconds after they leave that radius. You can see completed generators' auras.",
      tiers: ["3/4/5"]
    }
  ];
  const sienna = [
    {
      id: "best-gift-ever",
      name: "Best Gift Ever",
      tags: ["items", "aura-reading", "generator", "healing", "vault"],
      desc: "Start the trial with 4/5/6 tokens. The first time you drop each item type, spend a token and sacrifice the item for its effect. Flashlight: your killer stuns also blind for 2 seconds. Fog Vial: after a fast vault, scratch marks fade 50% faster for 5 seconds. Key: one extra rummage per chest. Map: timed aura reveals last 1 second longer. Medkit: healing another survivor heals you at 25% speed. Toolbox: reveal the three generators closest to each other.",
      tiers: ["4/5/6"]
    },
    {
      id: "shared-trauma",
      name: "Shared Trauma",
      tags: ["aura-reading", "exhaustion"],
      desc: "Taking a protection hit lets survivors within 12 metres recover from Exhausted while running for 30/35/40 seconds. You can see Exhausted survivors' auras within 32 metres.",
      tiers: ["30/35/40"]
    },
    {
      id: "valkyries-rage",
      name: "Valkyrie's Rage",
      tags: ["stun", "chase"],
      desc: "After 40/35/30 seconds of being chased, your next pallet stun against the killer lasts 75% longer.",
      tiers: ["40/35/30"]
    }
  ];

  return [
    ...DBD_PERK_DATA.perks,
    ...terrifier.map(perk => ({ ...perk, role: "killer", meta: { owner: DBD_TERRIFIER, source } })),
    ...sienna.map(perk => ({ ...perk, role: "survivor", meta: { owner: "Sienna Shaw", source } }))
  ];
})();
