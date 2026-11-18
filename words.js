// Deepnames word packs.
// Names come from the Deepwoken wiki (deepwoken.fandom.com category pages), cleaned to
// short in-game names. Cut and unreleased content is left out. Edit freely: one word
// or short name per entry. Team names (Ministry, Authority) and the Vantablack Warrior are
// filtered out automatically, duplicates are removed, and hosts can add custom words
// from the lobby.

const PACKS = {
  peoples: {
    name: "Races, Oaths & Attunements",
    on: true,
    words: [
      "Aberrant Capra", "Adret", "Anansi", "Auroran", "Canor", "Capra", "Celtor", "Chrysid",
      "Drakkard", "Felinor", "Ganymede", "Gremor", "Heliodar", "Khan", "Kiron", "Levit",
      "Lightborn", "Primal Vesperian", "Tiran", "Vesperian", "Celestial", "Krulian",
      "Kyrsgarde", "Arcwarder", "Bladeharper", "Blightsurger", "Blindseer", "Chainwarden",
      "Contractor", "Dawnwalker", "Fadetrimmer", "Jetstriker", "Linkstrider", "Oathless",
      "Saintsworn", "Saltchemist", "Silentheart", "Soulbreaker", "Starkindred", "Visionshaper",
      "Attunement-less", "Bloodrend", "Flamecharm", "Frostdraw", "Galebreathe", "Ironsing",
      "Shadowcast", "Thundercall", "Castaway", "Deepbound", "Ignition Delver", "Justicar",
      "Lone Warrior", "Voidwalker", "Blood Scourge", "Chorus Divide", "Crazy Slots",
      "Dimensional Travel", "Gravity Field", "Jar of Souls", "Paralytic Dust", "Payback",
      "Portals", "Preservation", "Resurrection", "Run It Back", "Sacred Field", "Shard Bow",
      "Skeleton Key", "Smite", "Smokescreen", "Teleportation", "Wind-Up", "Ardour", "Rhythm",
      "Tacet", "Fang and Coil", "Imperium Kata", "Infected", "Jus Karita", "Legion Kata",
      "Untrained Fist", "Way of Navae", "Mur Of Light", "Songseeker", "Faust", "Jace", "Tessa",
      "Trinity Galenwarde", "Urek Felhand"
    ]
  },
  places: {
    name: "Places & Dungeons",
    on: true,
    words: [
      "Alsin's Landing", "Ancient Rotlands", "Aratel Island", "Beloved Zofia",
      "Bluster Rapids", "Bluster Rift", "Boatman's Watch", "Brinepool Passage", "Cascabel Bay",
      "Castle Light", "Cathedral's Spire", "Caudal Glade", "Cerebral Requiem", "Corvus Manor",
      "Deep Thresher Nest", "Diver's Camp", "Erisia", "Erisor's Church", "Firfire",
      "Firfire Caverns", "Firfire Cliffs", "Fisher Hut", "Fort Merit", "Fragments of Self",
      "Glacial Remnant", "Greathive Approach", "Greathive Aratel", "Hall of Heroes",
      "Isle of Vigils", "King's Colosseum", "Kingmaker's Isle", "Kyrsan Wilds",
      "Light's Causeway", "Lower Erisia", "Merit's Reach", "Meteor Isle", "Miner's Landing",
      "Minityrsa", "Minityrsa Bight", "Monastery of Mur", "Moon's Eyrie", "Mount Mavros",
      "Nest Corridor", "Open Sea", "Outpost Antumbra", "Outpost Dignity", "Outpost Virtue",
      "Outpost Worth", "Path's Respite", "Pilgrim's Respite", "Pillar Peak", "Port Merit",
      "Rat's Den", "Red Lotus Keep", "Ruins of Leiuna", "Saramaed Crossing", "Saramaed Hollow",
      "Saramaed Strait", "Saramaed Summit", "Seeker's Cove", "Siirka Point", "Simforea",
      "Songseeker Temple", "Songseeker Wilds", "Starfall Bay", "Starfield Grove",
      "Starfield Tundra", "Starfield Veldt", "Summer Isle", "Temple Approach",
      "Temple Courtyard", "Temple of Hearts", "Temple of Mur", "The Aratel Sea", "Birdcage",
      "The Blade Within", "The Cerebral Spire", "The Cold Forge", "Depths",
      "The Falcon's Hold", "The Floating Keep", "Furnace", "The Golden Rat",
      "The Harvest Ritual", "The Hidden Village", "The Indigo Citadel", "Interstice",
      "The King's Garden", "Lordsgrove", "The Monkey's Paw", "Polymarch", "The Profane Cavern",
      "The Sable Estate", "The Summer Sea", "The Three Cheers", "Understrand",
      "The Vashtir Sea", "Vat", "The Viper's Jaw", "Towerstruck Lands", "Trial of One",
      "Upper Erisia", "Valiant Valley", "Varicosa District", "Vigil's Mark", "Void Spire",
      "Voidheart", "Voidsea", "Widow's Hollow", "Yarix Yard", "Carnival of Hearts"
    ]
  },
  creatures: {
    name: "Monsters, Bosses & NPCs",
    on: true,
    words: [
      "Alpha Megalodaunt", "Arkasid", "Baby Spider", "Brainsucker", "Crab", "Crustaceous Rex",
      "Deep Owl", "Deep Widow", "Dread Serpent", "Elder Primadon", "Exotic Megalodaunt",
      "Gigamed", "Glacial Lionfish", "Golem Magma", "Golem Prime", "Gourdskipper",
      "Hive Construct", "Horseshoe Crab", "King Gigamed", "King Thresher", "Lavasucker",
      "Mechalodaunt", "Megalodaunt", "Moon Knight", "Moss Knight", "Mudskipper",
      "Mudskipper Brute", "Mudskipper Knight", "Nautilodaunt", "Necroskipper",
      "Nightmare Thresher", "Parliament", "Primadon", "Prime Megalodaunt", "Rock Golem",
      "Rogue Construct", "Rotskipper", "Star Knight", "Stone Knight", "Stonespark", "Terrapod",
      "Thresher", "Watcher", "Chaser", "Dravik", "Evengarde Rest", "Heart of Enmity", "Knell",
      "Ferryman", "Harvestman", "Zi'eer", "Abaddon", "Adar", "Amashi", "Apprentice Diver",
      "Aska", "Astaroth", "Bandit", "Bandit Leader", "Beiruul", "Black Diver",
      "Blacksteel Pirate", "Blade Temple Guard", "Bounty Hunter", "Captain Marley",
      "Captain Solaire", "Celtorian Guard", "Cloaked Assassin", "Diver", "Eastern Nomad",
      "Emar Vend", "Forgotten Villager", "Friid", "Funke", "Ghost", "Goesh and Draud",
      "Golden Rat Bouncer", "Golden Warrior", "Grudge", "Hive Adjudicator", "Hive Arbiter",
      "Hive Guard", "Hive Scout", "Hobo", "Iblis", "Immortal Guardian", "Karas",
      "Knife of Eylis", "Legion Captain", "Legion Sniper", "Legion Soldier", "Lodestar",
      "Lost Diver", "Maljuror", "Mindless Servant", "Ministry Agent", "Ministry Captain",
      "Ministry Enforcer", "Ministry Footpad", "Ministry Scout", "Minos", "Nell", "Nostor",
      "Phantom Hunter", "Polis", "Prisoner", "Quiet Stranger", "Rat Fighter", "Royalist Guard",
      "Semblance", "Shade", "Shogun Specialist", "Summer Dragoon", "Summer Goon",
      "Summer Manager", "Sworn Angel", "Teacher", "Thief", "Tideknight", "Vice-Warden",
      "Vyrelda", "Zana", "Worm", "Lamprey", "Pufferfish", "Red Snapper", "Sea Bass", "Squid",
      "Swordfish", "Tuna", "Yellow Bass", "Bone Keeper", "Bounder", "Fury Nautilodaunt",
      "Hollow Angel", "Kyrsgarde Champion", "Fisherman", "Carbuncle", "Diver Husk", "Galewax",
      "Ghost Bounder", "Kaide", "Kyrsgarde Brute", "Kyrsgarde Crawler", "Kyrsgarde Lancer",
      "Kyrsgarde Sniper", "Finnegan The Lost"
    ]
  },
  gear: {
    name: "Weapons, Relics & Gear",
    on: true,
    words: [
      "Big Brother", "Black Death", "Bloodbane", "Bloodfouler", "Boltcrusher",
      "Chorus of Agonies", "Coldpoint", "Crypt Blade", "Deepspindle", "Eye of Malice",
      "Flareblood Kamas", "Fondant Splitter", "Fractine", "Frostthorn", "Gran Sudaruska",
      "Guiding Star", "Hailbreaker", "Imperator's Edge", "Imperial Staff", "Iron Requiem",
      "Karita Plating", "Kyrsieger", "Kyrswynter", "Light's Final Toll", "Lumensplitter",
      "Pleeksty's Inferno", "Rangescraper", "Red Death", "Rimebreakers", "Ritual Sacrifice",
      "Rosen's Hellflame", "Soulthorn", "Stormseye", "Vortex Echo", "Warmonger",
      "Weal and Woe", "Withered Gale Pale", "Wraithclaw", "Tenacity", "Armorer's Needle",
      "Azure Duelist Ring", "Baneful Syrinx", "Blizzard Ring", "Bone Ring",
      "Charged Bonecharm", "Dark Pearls", "Deranged Treasure", "Divine Cast Ring",
      "Dormant Splinter", "Enchant Grease", "Enchant Stone", "Forge Needle", "Frost Essence",
      "Frost Ring", "Gilded Needle", "Idol of Yun'Shul", "Kyrsan Gem", "Mantle of Enmity",
      "Moonseye Tome", "Nocturnal Gem", "Ouroboral Husk", "Phoenix Talon Ring",
      "Pluripotent Alloy", "Rain Spire", "Remnants of Soul", "Sinner's Ash", "Smith's Alloy",
      "Tiny Soul Ring", "Tiran Pendant", "Trickster Dust", "Vortex Accelerator",
      "Warped Blue Gem", "Whistling Periapt", "Kyrsblade", "Kyrscleave", "Kyrsedge",
      "Kyrsglaive", "Kyrstear", "Kyrstreza", "Aegis Gem", "Blessed Gem", "Bloodless Gem",
      "Blue Gem", "Insignia Gem", "Might Gem", "Wayward Gem", "Wind Gem", "Wrath Gem",
      "Avenger", "Canteen", "Fishing Rod", "Flint", "Gliders", "Ironcry", "Irontusk",
      "Leather Boots", "Leather Gloves", "Lumber Axe", "Pickaxe", "Quickfang", "Silversix",
      "Campfire Pit", "Candle", "Chime of Dwelling", "Hunter's Brace", "Light Hook",
      "Repair Kit", "Sanguine Candle", "Glumfig", "Ongo", "Pumpkin", "Redd", "Sap",
      "Seaweed Bundle", "Crowns", "Joy", "Knowledge", "Notes", "Trinkets", "Ashes"
    ]
  },
  lore: {
    name: "Factions, Mechanics & Lore",
    on: true,
    words: [
      "Age", "Artifacts", "Badges", "Boundary", "Bounty Hunting", "Bullets", "Carry Load",
      "Chest Master", "Crafting Station", "Crews", "Death", "Deep Crucible", "Deep Shrines",
      "Echoes", "Enchantments", "Family", "Fishing", "Food", "Fountain Gates", "Guard Turrets",
      "Hippocampal Pool", "Hollow Forge", "Ingredients", "Inn", "Insanity", "Instruments",
      "Job Boards", "Mantra Lectern", "Maps", "Mementos", "Meteor", "Motifs", "Mounts",
      "Power", "Purge Shrine", "Quests", "Random Encounters", "Regalia", "Reputation",
      "Resonance Door", "Shipwright", "Shrine of Courage", "Sibex", "Soul Orb", "Stealth",
      "Terrains", "Traits", "Transmogrification", "Vow of Mastery", "War Mode", "Water Well",
      "Whirlpools", "Whisper Draw", "Ziplines", "Ether", "Pumpkin Pitch", "Aces", "Kasen",
      "Lost Celtor", "Divers", "Golden Rats", "Hive", "Ignition Union", "Ministry",
      "Summer Company", "Chime of Conflict", "Pathfinder", "Vow of Iron", "Ignition Deepdrill",
      "Ignition Lanterns", "Kyrsan Medallions", "Hell Mode", "Mantra", "Murmur", "Resonance",
      "Talent", "Oath", "Attunement", "Parry", "Dodge", "Feint", "Posture", "Tempo", "Grip",
      "Carry", "Knocked", "Wipe", "Permadeath", "Strength", "Fortitude", "Agility",
      "Intelligence", "Willpower", "Charisma", "Luminant"
    ]
  },
  classic: {
    name: "Depths Classics (everyday words)",
    on: false,
    words: [
      "Tide", "Anchor", "Ember", "Mirror", "Crown", "Storm", "Ghost", "Chalice", "Ship",
      "Sail", "Island", "Reef", "Coral", "Pearl", "Salt", "Brine", "Fog", "Mist", "Ash",
      "Bone", "Skull", "Tomb", "Vault", "Gate", "Key", "Chain", "Shackle", "Tower",
      "Spire", "Throne", "Banner", "Mask", "Hood", "Torch", "Candle", "Whisper", "Dream",
      "Void", "Star", "Moon", "Sun", "Night", "Thunder", "Frost", "Flame", "Gale",
      "Shadow", "Iron", "Blood", "Steel", "Gold", "Silver", "Glass", "Crystal", "Pillar",
      "Ruin", "Temple", "Arena", "Forge", "Anvil", "Hammer", "Rope", "Hook", "Net",
      "Eel", "Shark", "Squid", "Crab", "Wolf", "Bear", "Boar", "Spider", "Worm",
      "Leech", "Swamp", "Desert", "Jungle", "Cave", "Cliff", "Waterfall", "Volcano",
      "Glacier", "Compass", "Map", "Scroll", "Potion", "Feather", "Fang", "Claw", "Scale",
      "Tentacle", "Heart", "Eye", "Hand", "Wing", "Horn", "Tusk", "Shell", "Kelp",
      "Current", "Whirlpool", "Lightning", "Sword", "Axe", "Arrow", "Armor", "Coin",
      "Treasure", "Map Fragment", "Ink", "Feast", "Wine", "Prison", "Market", "Bridge",
      "Cathedral", "Library", "Garden", "Graveyard", "Mine", "Quarry", "Well"
    ]
  }
};

const BANNED = /ministry|authority|vantablack/i;

function wordsFor(packIds, custom = []) {
  const seen = new Set();
  const out = [];
  const add = (w) => {
    const word = String(w).trim().replace(/\s+/g, " ");
    const key = word.toLowerCase();
    if (!word || word.length > 24 || seen.has(key) || BANNED.test(key)) return;
    seen.add(key);
    out.push(word);
  };
  for (const id of packIds) if (PACKS[id]) PACKS[id].words.forEach(add);
  custom.forEach(add);
  return out;
}

function packSummary() {
  return Object.entries(PACKS).map(([id, p]) => ({ id, name: p.name, count: wordsFor([id]).length, on: !!p.on }));
}

function defaultPacks() {
  return Object.keys(PACKS).filter((id) => PACKS[id].on);
}

module.exports = { PACKS, wordsFor, packSummary, defaultPacks, BANNED };
