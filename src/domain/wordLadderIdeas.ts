import { ES_ALIASES, ES_EVERYDAY_NOUNS, ES_EVERYDAY_VERBS, ES_PLACES, ES_ROLES } from "./wordIdeasEs";
import { DE_ALIASES, DE_EVERYDAY_NOUNS, DE_EVERYDAY_VERBS, DE_PLACES, DE_ROLES } from "./wordIdeasDe";
import { PT_ALIASES, PT_EVERYDAY_NOUNS, PT_EVERYDAY_VERBS, PT_PLACES, PT_ROLES } from "./wordIdeasPt";

/**
 * Inspiration for the Word Ladder setup step, per Jeff Tweedy's exercise: pick
 * a job (and list verbs that person does), pick a place (and list nouns found
 * there). A curated dataset beats an LLM here — one tap gives instant, offline,
 * quality-controlled randomness with zero cost.
 *
 * Each seed carries a LARGE pool; the UI samples a small random subset each tap,
 * so repeat visits keep finding fresh words. Pools are authored for
 * DISTINCTIVENESS — words strongly tied to that seed — which both sparks better
 * lines and, as a happy side effect, keeps the same word from recurring across
 * seeds (verified by src/__tests__/wordLadderIdeas.test.ts, which caps how many
 * pools any one word may appear in). English, Hebrew, Spanish (wordIdeasEs.ts)
 * German (wordIdeasDe.ts) and Brazilian Portuguese (wordIdeasPt.ts).
 */

export type Idea = { seed: string; words: string[] };
export type IdeaBank = { roles: Idea[]; places: Idea[] };
export type IdeaLang = "en" | "he" | "es" | "de" | "pt";

// ── English ──────────────────────────────────────────────────────────────────

const EN_ROLES: Idea[] = [
  { seed: "surgeon", words: ["incise", "suture", "cauterize", "anesthetize", "clamp", "transfuse", "resect", "graft", "steady", "sterilize", "excise", "probe", "revive", "close", "operate", "dissect"] },
  { seed: "fisherman", words: ["cast", "reel", "trawl", "gaff", "bait", "gut", "moor", "net", "troll", "wade", "chum", "filet", "capsize", "drift", "haul", "salt"] },
  { seed: "locksmith", words: ["pick", "rekey", "jimmy", "cut", "shim", "bore", "jiggle", "file", "decode", "latch", "bolt", "spring", "duplicate", "unbind", "seize", "free"] },
  { seed: "baker", words: ["knead", "proof", "laminate", "score", "glaze", "dust", "temper", "crimp", "pipe", "leaven", "braid", "flour", "blister", "cool", "rise", "brown"] },
  { seed: "gravedigger", words: ["excavate", "inter", "lower", "shovel", "level", "mark", "mourn", "backfill", "kneel", "tamp", "cover", "carry", "settle", "bury", "clear", "weep"] },
  { seed: "pilot", words: ["taxi", "throttle", "bank", "stall", "trim", "flare", "yaw", "climb", "descend", "radio", "glide", "circle", "level", "land", "ascend", "chart"] },
  { seed: "bartender", words: ["muddle", "shake", "garnish", "pour", "chill", "strain", "flambe", "uncork", "comp", "stir", "eavesdrop", "wipe", "call", "cut off", "mix", "listen"] },
  { seed: "electrician", words: ["wire", "ground", "splice", "strip", "bend", "fuse", "arc", "trip", "insulate", "short", "energize", "test", "rewire", "spark", "shock", "connect"] },
  { seed: "seamstress", words: ["hem", "baste", "pleat", "mend", "gather", "dart", "topstitch", "backstitch", "unpick", "press", "cuff", "bind", "thread", "tuck", "patch", "measure"] },
  { seed: "lifeguard", words: ["scan", "whistle", "dive", "resuscitate", "pull", "tow", "surface", "warn", "squint", "float", "reach", "sprint", "watch", "signal", "rescue", "tread"] },
  { seed: "astronomer", words: ["chart", "sketch", "track", "magnify", "calibrate", "catalog", "record", "gaze", "triangulate", "wonder", "log", "predict", "resolve", "observe", "wander", "name"] },
  { seed: "butcher", words: ["cleave", "debone", "hang", "grind", "cure", "portion", "trim", "hook", "quarter", "salt", "sharpen", "weigh", "wrap", "brine", "carve", "flay"] },
  { seed: "midwife", words: ["deliver", "swaddle", "coach", "cradle", "soothe", "guide", "calm", "time", "wash", "reassure", "cut", "count", "breathe", "wait", "catch", "hush"] },
  { seed: "detective", words: ["tail", "interrogate", "profile", "stake out", "dust", "trace", "deduce", "suspect", "corner", "question", "connect", "follow", "doubt", "shadow", "solve", "accuse"] },
  { seed: "gardener", words: ["prune", "graft", "mulch", "transplant", "deadhead", "stake", "compost", "weed", "sow", "water", "irrigate", "harvest", "prop", "espalier", "tend", "rake"] },
  { seed: "welder", words: ["fuse", "tack", "grind", "braze", "torch", "gouge", "clamp", "weld", "chip", "temper", "quench", "seal", "bevel", "patch", "join", "melt"] },
  { seed: "librarian", words: ["shelve", "catalog", "hush", "archive", "circulate", "renew", "recommend", "index", "reshelve", "preserve", "stamp", "lend", "collate", "return", "collect", "whisper"] },
  { seed: "boxer", words: ["jab", "weave", "clinch", "counter", "feint", "parry", "hook", "bob", "spar", "guard", "sway", "duck", "swing", "bleed", "rise", "pivot"] },
  { seed: "shepherd", words: ["herd", "shear", "graze", "corral", "wean", "brand", "whistle", "lamb", "roam", "guard", "count", "wander", "gather", "dip", "lead", "lose"] },
  { seed: "mechanic", words: ["torque", "diagnose", "flush", "align", "bleed", "recalibrate", "jack", "grease", "crank", "idle", "rebuild", "gauge", "swap", "tune", "loosen", "test"] },
  { seed: "priest", words: ["bless", "absolve", "anoint", "consecrate", "hear", "genuflect", "eulogize", "baptize", "intone", "forgive", "chant", "wed", "kneel", "pray", "mourn", "bow"] },
  { seed: "sailor", words: ["hoist", "reef", "moor", "tack", "swab", "helm", "navigate", "weather", "furl", "bail", "signal", "dock", "capsize", "trim", "sail", "knot"] },
  { seed: "painter", words: ["prime", "feather", "blend", "mask", "roll", "thin", "layer", "sponge", "varnish", "stipple", "cover", "streak", "scrape", "coat", "dry", "brush"] },
  { seed: "beekeeper", words: ["smoke", "hive", "extract", "requeen", "split", "feed", "uncap", "brush", "harvest", "tend", "jar", "gather", "sweeten", "inspect", "cultivate", "collect"] },
  { seed: "blacksmith", words: ["forge", "flatten", "quench", "temper", "punch", "draw", "upset", "fuller", "peen", "harden", "strike", "stoke", "shape", "cool", "hammer", "heat"] },
  { seed: "nurse", words: ["chart", "dose", "triage", "cannulate", "dress", "monitor", "rotate", "comfort", "draw", "medicate", "bathe", "wake", "turn", "hold", "check", "soothe"] },
  { seed: "thief", words: ["case", "pilfer", "fence", "pickpocket", "burgle", "vanish", "hotwire", "lift", "creep", "stash", "bolt", "duck", "swipe", "conceal", "flee", "hide"] },
  { seed: "teacher", words: ["explain", "grade", "quiz", "assign", "erase", "lecture", "correct", "chalk", "recite", "dismiss", "encourage", "repeat", "mark", "inspire", "learn", "test"] },
  { seed: "carpenter", words: ["saw", "plane", "chisel", "dovetail", "sand", "miter", "frame", "level", "rout", "clamp", "brace", "joint", "shim", "finish", "build", "measure"] },
  { seed: "trucker", words: ["haul", "downshift", "log", "fuel", "jackknife", "convoy", "idle", "weigh", "tarp", "brake", "signal", "coast", "deliver", "park", "drive", "pass"] },
  { seed: "florist", words: ["arrange", "wire", "snip", "mist", "tie", "strip", "prune", "wrap", "bundle", "deliver", "soak", "spray", "freshen", "bunch", "pin", "cut"] },
  { seed: "actor", words: ["rehearse", "improvise", "project", "audition", "emote", "block", "memorize", "cue", "bow", "pretend", "double", "flub", "exit", "become", "weep", "enter"] },
  { seed: "plumber", words: ["snake", "solder", "unclog", "vent", "caulk", "flush", "seat", "thread", "drain", "sweat", "seal", "crawl", "fit", "tighten", "route", "wrench"] },
  { seed: "soldier", words: ["march", "salute", "entrench", "flank", "patrol", "aim", "ration", "deploy", "obey", "dig", "wait", "cover", "advance", "retreat", "write", "return"] },
  { seed: "photographer", words: ["frame", "expose", "focus", "bracket", "develop", "crop", "flash", "backlight", "pose", "dodge", "burn", "print", "capture", "wait", "shoot", "compose"] },
  { seed: "conductor", words: ["cue", "swell", "beat", "phrase", "conduct", "hush", "sustain", "syncopate", "lift", "release", "silence", "sweep", "build", "hold", "time", "quiet"] },
  { seed: "farmer", words: ["plow", "sow", "reap", "thresh", "furrow", "irrigate", "milk", "fence", "rotate", "bale", "graze", "harvest", "till", "yoke", "rise", "pray"] },
  { seed: "tailor", words: ["chalk", "taper", "let out", "take in", "line", "pin", "drape", "baste", "cuff", "fit", "press", "alter", "measure", "adjust", "trim", "shape"] },
  { seed: "diver", words: ["plunge", "equalize", "surface", "descend", "hover", "decompress", "kick", "salvage", "explore", "float", "regulate", "signal", "rise", "sink", "breathe", "drift"] },
  { seed: "judge", words: ["adjudicate", "sentence", "overrule", "admonish", "recuse", "pardon", "arraign", "convict", "weigh", "deliberate", "recess", "rule", "consider", "acquit", "decide", "preside"] },
  { seed: "miner", words: ["drill", "blast", "shore", "sluice", "tunnel", "extract", "sift", "descend", "pan", "hew", "cough", "carve", "surface", "haul", "strike", "dig"] },
  { seed: "clockmaker", words: ["wind", "regulate", "clean", "set", "jewel", "calibrate", "time", "listen", "oil", "assemble", "adjust", "repair", "mesh", "balance", "tighten", "sync"] },
  { seed: "glassblower", words: ["gather", "blow", "marver", "anneal", "stretch", "shape", "roll", "reheat", "twist", "cut", "cool", "flare", "spin", "temper", "melt", "form"] },
  { seed: "clown", words: ["juggle", "tumble", "honk", "mime", "fall", "unicycle", "twist", "grin", "trip", "squirt", "cartwheel", "mock", "stumble", "laugh", "paint", "bow"] },
  { seed: "tattooist", words: ["ink", "outline", "shade", "sterilize", "stencil", "needle", "trace", "bandage", "wipe", "line", "fill", "buzz", "design", "heal", "mark", "draw"] },
  { seed: "undertaker", words: ["embalm", "dress", "cosmetize", "wash", "arrange", "escort", "console", "drape", "shroud", "carry", "prepare", "seal", "attend", "lower", "mourn", "bury"] },
  { seed: "cartographer", words: ["survey", "plot", "scale", "contour", "triangulate", "chart", "letter", "project", "trace", "annotate", "ink", "fold", "orient", "map", "sketch", "name"] },
  { seed: "watchmaker", words: ["dismantle", "polish", "fit", "regulate", "lubricate", "reassemble", "inspect", "wind", "solder", "engrave", "tighten", "align", "clean", "repair", "test", "set"] },
  { seed: "chef", words: ["chop", "sear", "deglaze", "plate", "season", "taste", "reduce", "whisk", "simmer", "julienne", "braise", "fry", "expedite", "sauté", "carve", "roast"] },
  { seed: "waiter", words: ["serve", "seat", "refill", "recite", "balance", "clear", "hurry", "smile", "upsell", "bus", "juggle", "apologize", "jot", "split", "comp", "greet"] },
  { seed: "doctor", words: ["prescribe", "examine", "palpate", "reassure", "refer", "treat", "heal", "vaccinate", "x-ray", "stitch", "admit", "discharge", "diagnose", "warn", "sign", "soothe"] },
  { seed: "firefighter", words: ["douse", "extinguish", "hose", "smother", "evacuate", "rescue", "vent", "crawl", "climb", "chop", "search", "slide", "suit up", "drill", "shout", "return"] },
  { seed: "police officer", words: ["patrol", "arrest", "cuff", "frisk", "chase", "radio", "ticket", "book", "pull over", "detain", "testify", "escort", "direct", "question", "warn", "holster"] },
  { seed: "mail carrier", words: ["sort", "deliver", "stamp", "knock", "ring", "slip", "bundle", "route", "forward", "walk", "whistle", "dodge", "tote", "scan", "postmark", "address"] },
  { seed: "barber", words: ["shave", "fade", "lather", "strop", "clip", "comb", "taper", "line up", "part", "rinse", "towel", "gossip", "sweep", "style", "blow-dry", "snip"] },
  { seed: "dancer", words: ["pirouette", "leap", "spin", "stretch", "point", "plié", "glide", "turn", "partner", "stomp", "sway", "dip", "land", "rehearse", "twirl", "freeze"] },
  { seed: "lawyer", words: ["argue", "object", "cross-examine", "plead", "depose", "file", "settle", "appeal", "draft", "cite", "bill", "advise", "negotiate", "sue", "defend", "rest"] },
  { seed: "singer", words: ["sing", "belt", "harmonize", "croon", "hum", "warm up", "project", "phrase", "breathe", "riff", "scat", "hold", "soar", "whisper", "rasp", "falter"] },
  { seed: "cashier", words: ["scan", "ring up", "bag", "count", "void", "refund", "tally", "greet", "swipe", "make change", "card", "smile", "balance", "close", "price", "total"] },
  { seed: "driver", words: ["merge", "honk", "idle", "brake", "swerve", "reverse", "park", "pick up", "drop off", "detour", "speed", "tailgate", "yield", "navigate", "meter", "chat"] },
  { seed: "writer", words: ["draft", "revise", "outline", "scribble", "cross out", "rewrite", "research", "stall", "procrastinate", "publish", "edit", "describe", "confess", "submit", "imagine", "title"] },
  { seed: "programmer", words: ["code", "debug", "compile", "refactor", "deploy", "commit", "merge", "ship", "branch", "patch", "crash", "reboot", "comment", "automate", "type", "loop"] },
];

const EN_PLACES: Idea[] = [
  { seed: "kitchen", words: ["cleaver", "steam", "flour", "kettle", "colander", "apron", "flame", "pilot light", "whisk", "grease trap", "cutting board", "salt", "spatter", "ladle", "drawer", "table"] },
  { seed: "attic", words: ["dust", "steamer trunk", "cobweb", "daguerreotype", "rafter", "mothball", "insulation", "dormer", "cradle", "mildew", "eave", "hatch", "keepsake", "beam", "mirror", "letter"] },
  { seed: "harbor", words: ["hawser", "gull", "fog", "bollard", "brine", "hull", "buoy", "tide", "gangplank", "barnacle", "lighthouse", "trawler", "net", "wharf", "anchor", "swell"] },
  { seed: "hospital", words: ["monitor", "gurney", "IV pole", "wristband", "gauze", "corridor", "chart", "curtain", "defibrillator", "waiting room", "scrubs", "bedpan", "call button", "clock", "ward", "gown"] },
  { seed: "church", words: ["pew", "votive", "stained glass", "hymnal", "altar", "belfry", "incense", "steeple", "collection plate", "kneeler", "nave", "vestry", "chalice", "cross", "organ", "aisle"] },
  { seed: "garage", words: ["wrench", "motor oil", "workbench", "extension cord", "toolbox", "shop rag", "creeper", "pegboard", "socket set", "antifreeze", "jack", "vise", "spark plug", "radio", "grease", "ladder"] },
  { seed: "bedroom", words: ["pillow", "nightstand", "wardrobe", "duvet", "vanity", "dresser", "quilt", "alarm clock", "sill", "slipper", "headboard", "lampshade", "curtain", "keyhole", "mirror", "closet"] },
  { seed: "forest", words: ["moss", "taproot", "canopy", "fern", "deadfall", "game trail", "toadstool", "birdsong", "bark", "clearing", "brambles", "hollow", "sap", "lichen", "thicket", "undergrowth"] },
  { seed: "diner", words: ["booth", "bottomless coffee", "napkin dispenser", "jukebox", "Formica", "griddle", "laminated menu", "pie case", "ketchup", "register", "neon", "counter stool", "milkshake", "receipt", "tip jar", "syrup"] },
  { seed: "laundromat", words: ["quarter", "dryer drum", "lint trap", "wire basket", "bleach", "folding table", "detergent", "spin cycle", "orphan sock", "dryer sheet", "coin slot", "static", "hamper", "steam", "linoleum", "timer"] },
  { seed: "rooftop", words: ["gravel", "antenna", "skyline", "pigeon", "vent stack", "tarpaper", "clothesline", "parapet", "satellite dish", "chimney pot", "ledge", "water tower", "starlight", "ash", "string lights", "smoke"] },
  { seed: "basement", words: ["sump pump", "boiler", "cobweb", "shelving", "workbench", "furnace", "cellar door", "concrete", "fuse box", "mousetrap", "mildew", "crawlspace", "jars", "draft", "dampness", "flashlight"] },
  { seed: "train station", words: ["platform", "timetable", "whistle", "porter", "waiting bench", "turnstile", "loudspeaker", "ticket stub", "luggage cart", "farewell", "third rail", "signal", "clock tower", "steam", "carriage", "pigeon"] },
  { seed: "greenhouse", words: ["pane", "seed tray", "humidity", "terracotta", "vine", "trowel", "condensation", "potting soil", "orchid", "sun lamp", "misting", "aphid", "sprout", "trellis", "warmth", "fern"] },
  { seed: "motel", words: ["ice machine", "vacancy sign", "key card", "asphalt lot", "Gideon bible", "blackout curtain", "vending machine", "kidney pool", "bedspread", "cinderblock", "peephole", "ashtray", "neon", "highway", "ceiling fan", "room key"] },
  { seed: "cemetery", words: ["headstone", "wreath", "iron gate", "weeping willow", "epitaph", "plot", "stone angel", "mausoleum", "granite", "hush", "urn", "gravel path", "obelisk", "fresh dirt", "moss", "chapel"] },
  { seed: "arcade", words: ["token", "joystick", "high score", "ticket", "black light", "claw machine", "pinball", "prize counter", "quarter slot", "skee-ball", "change machine", "leaderboard", "cabinet", "flipper", "buzzer", "carpet"] },
  { seed: "barn", words: ["hayloft", "rafter", "pitchfork", "stall", "swallow", "lantern", "tack", "feed trough", "milking stool", "silo", "dust", "weathervane", "bale", "manure", "chaff", "beam"] },
  { seed: "office", words: ["cubicle", "stapler", "sticky note", "coffee ring", "keyboard", "memo", "venetian blind", "elevator", "lanyard", "wall clock", "water cooler", "swivel chair", "inbox", "cord", "carpet tile", "printer"] },
  { seed: "beach", words: ["driftwood", "seashell", "tide line", "beach umbrella", "dune grass", "kelp", "sandbar", "sanderling", "sandcastle", "horizon", "flotsam", "riptide", "boardwalk", "salt spray", "tar", "gull"] },
  { seed: "carnival", words: ["ferris wheel", "cotton candy", "carny barker", "tilt-a-whirl", "goldfish prize", "big top", "ride ticket", "funhouse mirror", "sawdust", "midway", "ring toss", "corn dog", "calliope", "strongman", "kettle corn", "lights"] },
  { seed: "junkyard", words: ["rust", "hubcap", "crane magnet", "windshield", "junkyard dog", "chain link", "engine block", "car battery", "mud", "scrap heap", "crushed fender", "oil slick", "tetanus", "gravel", "wrecker", "weeds"] },
  { seed: "pharmacy", words: ["pill counter", "prescription", "receipt", "aisle end cap", "waiting chair", "amber bottle", "greeting card", "pill organizer", "counter bell", "cotton ball", "blood pressure cuff", "lozenge", "childproof cap", "scale", "queue", "clerk"] },
  { seed: "orchard", words: ["ladder", "blossom", "bushel crate", "windfall", "grafted branch", "orchard bee", "cider press", "row", "pruning shear", "frost", "burlap", "wasp", "picking bag", "trunk", "dew", "netting"] },
  { seed: "subway", words: ["turnstile", "third rail", "busker", "route map", "grime", "tile mosaic", "platform gap", "handrail", "graffiti", "tunnel", "MetroCard", "conductor booth", "vent grate", "screech", "commuter", "token"] },
  { seed: "theater", words: ["proscenium", "spotlight", "wing", "balcony", "prop table", "greasepaint", "orchestra pit", "marquee", "trapdoor", "curtain call", "footlight", "dressing room", "playbill", "catwalk", "applause", "usher"] },
  { seed: "swamp", words: ["cypress knee", "cattail", "peat", "heron", "mosquito", "duckweed", "mangrove root", "marsh gas", "bullfrog", "stillness", "quicksand", "dragonfly", "mudflat", "moonlight", "moss", "reed"] },
  { seed: "casino", words: ["poker chip", "green felt", "dice", "slot machine", "card shoe", "one-way mirror", "plush carpet", "complimentary cocktail", "surveillance camera", "roulette wheel", "cocktail waitress", "marker", "jackpot bell", "ante", "high roller", "neon"] },
  { seed: "lighthouse", words: ["Fresnel lens", "spiral stair", "logbook", "foghorn", "gallery rail", "storm glass", "cliff", "beacon", "keeper's desk", "breaker", "brass fitting", "widow's walk", "oilcan", "gull", "gale", "reef"] },
  { seed: "classroom", words: ["chalk dust", "desk", "globe", "flag", "eraser", "pencil sharpener", "cursive poster", "backpack", "recess bell", "cubby", "overhead projector", "hall pass", "gold star", "ruler", "chalkboard", "detention"] },
  { seed: "vineyard", words: ["trellis", "oak barrel", "grape cluster", "wine press", "cellar", "cork", "hillside", "sediment", "cask", "harvest moon", "pruning hook", "must", "tasting room", "tendril", "dew", "yeast"] },
  { seed: "morgue", words: ["cold drawer", "toe tag", "steel table", "shroud", "hanging scale", "autopsy report", "chill", "latex glove", "drain", "clipboard", "gurney", "formaldehyde", "body bag", "sheet", "hush", "scalpel"] },
  { seed: "playground", words: ["swing chain", "slide", "wood chip", "monkey bars", "seesaw", "chain link", "hopscotch chalk", "sneaker", "merry-go-round", "sandbox", "jungle gym", "scraped knee", "tetherball", "recess", "puddle", "laughter"] },
  { seed: "airport", words: ["boarding gate", "baggage carousel", "boarding pass", "duty free", "intercom", "moving walkway", "runway", "window seat", "customs booth", "departure board", "jet bridge", "layover", "tarmac", "carry-on", "terminal", "delay"] },
  { seed: "bathhouse", words: ["steam", "mosaic tile", "folded towel", "brass faucet", "cedar bench", "fogged mirror", "locker key", "soap sliver", "echo", "floor drain", "plunge pool", "eucalyptus", "condensation", "robe", "attendant", "heat"] },
  { seed: "pawnshop", words: ["consignment guitar", "glass case", "wedding band", "price tag", "window bars", "wristwatch", "amplifier", "ledger", "neon sign", "second chance", "layaway", "class ring", "power tool", "loupe", "buzzer", "trinket"] },
  { seed: "observatory", words: ["dome slit", "telescope", "star chart", "shutter", "eyepiece", "constellation", "spiral ladder", "logbook", "coordinate", "darkness", "counterweight", "meridian", "red light", "tripod", "silence", "lens"] },
  { seed: "ferry", words: ["car deck", "railing", "wake", "life jacket", "wooden bench", "sea spray", "ship horn", "gangway", "escort gull", "crossing", "cabin", "life ring", "diesel", "whitecap", "pilothouse", "dock"] },
  { seed: "record store", words: ["milk crate", "record sleeve", "turntable", "concert poster", "headphone", "genre bin", "receipt", "rare bootleg", "listening booth", "vinyl", "price sticker", "cassette", "band patch", "dust jacket", "counter", "flyer"] },
  { seed: "gymnasium", words: ["free throw line", "bleacher", "whistle", "scoreboard", "climbing rope", "locker", "rosin", "backboard", "buzzer", "sweat", "pull-up bar", "banner", "sneaker squeak", "kettlebell", "chalk", "mat"] },
  { seed: "aquarium", words: ["glass tank", "coral", "kelp", "jellyfish", "bubble curtain", "seahorse", "touch pool", "blue light", "filter hum", "anemone", "viewing tunnel", "plankton", "eel", "current", "diver", "sand"] },
  { seed: "campsite", words: ["ember", "guy line", "sleeping bag", "lantern", "fire ring", "cooler", "tent stake", "s'more", "pine needle", "canteen", "trailhead", "mosquito coil", "flannel", "dew", "smoke", "stars"] },
  { seed: "mine", words: ["ore cart", "headlamp", "canary", "timber support", "pickaxe", "coal dust", "shaft", "elevator cage", "seam", "lunch pail", "rail track", "helmet lamp", "tunnel", "blast cap", "grit", "darkness"] },
  { seed: "wharf", words: ["mooring line", "creosote plank", "crab pot", "fish crate", "gull", "tide mark", "winch", "bait bucket", "chandlery", "brine", "cleat", "trawl net", "diesel", "barnacle", "dock light", "swell"] },
  { seed: "chapel", words: ["votive rack", "kneeler", "narrow aisle", "pipe organ", "wedding veil", "prayer book", "arched window", "hush", "wedding band", "confessional", "altar rail", "candle wax", "hymn board", "pew", "font", "vestibule"] },
];

// ── Hebrew ─────────────────────────────────────────────────────────────────────
// Verbs are infinitives (gender-neutral); nouns are singular. Same
// distinctiveness principle.

const HE_ROLES: Idea[] = [
  { seed: "רופא", words: ["לרפא", "לאבחן", "לחבוש", "להזריק", "לרשום", "להרדים", "למשש", "להאזין", "לבדוק", "לחטא", "לחסן", "לטפל", "למדוד", "להרגיע", "לייעץ", "להקשיב"] },
  { seed: "דייג", words: ["להטיל", "לגרור", "לעגון", "לצוד", "לפרוש", "למשות", "להיסחף", "למיין", "לשחות", "לקשור", "לחכות", "לנקות", "לגלוש", "לפתות", "לחתור", "לצלות"] },
  { seed: "אופה", words: ["ללוש", "להתפיח", "לקפל", "לפזר", "להמתיק", "לזלף", "לגלגל", "למרוח", "לצנן", "לחרוץ", "לאפות", "להבריק", "לפרוס", "לרדד", "לעטר", "לקלוע"] },
  { seed: "נגר", words: ["לנסר", "למסמר", "למקצע", "להבריג", "להשחיז", "לדבק", "לפלס", "להרכיב", "לשייף", "לבנות", "לחתוך", "להדק", "למדוד", "לצבוע", "לשבץ", "לגלף"] },
  { seed: "חשמלאי", words: ["לחווט", "להאריק", "לבודד", "לקצר", "להתיך", "לחשמל", "לנתק", "להזרים", "להחליף", "לאתר", "להשחיל", "לחבר", "לתקן", "למתוח", "לסמן", "לבדוק"] },
  { seed: "טייס", words: ["להמריא", "לנחות", "להטות", "לטפס", "לצלול", "לחוג", "לתמרן", "לאזן", "לרדת", "להאיץ", "לנווט", "לרחף", "לשדר", "להאט", "לגלגל", "לדווח"] },
  { seed: "גנן", words: ["לגזום", "לזרוע", "לנכש", "להשקות", "לשתול", "לדשן", "לקטום", "לתמוך", "לגרוף", "לטפח", "להצמיח", "לחפור", "לקצור", "לשרש", "לחפות", "להעביר"] },
  { seed: "ספר", words: ["לספר", "לגלח", "להחליק", "לסרק", "לקצוץ", "להבריש", "לשטוף", "לייבש", "לחפוף", "להרטיב", "לתלתל", "לגזוז", "לעצב", "לסדר", "לפזר", "לרכל"] },
  { seed: "נפח", words: ["לחשל", "לרקע", "להקשות", "לכופף", "לצרוף", "לרדד", "לנקב", "לרתך", "להכות", "לחמם", "לחדד", "למרק", "לכבות", "ללבות", "לצנן", "לעצב"] },
  { seed: "מלח", words: ["להפליג", "לשוט", "לקשור", "לצוף", "להתיר", "לאותת", "לעגן", "לשאוב", "לדרוך", "להרים", "לחתור", "לגלוש", "לפלס", "לשפשף", "להשקיף", "לנווט"] },
  { seed: "צייד", words: ["לארוב", "לעקוב", "לירות", "לרדוף", "לצוד", "להסתתר", "לזחול", "לכוון", "להמתין", "לתפוס", "להטעות", "לגשש", "להריח", "להציב", "לפשוט", "לשרוק"] },
  { seed: "רועה", words: ["לרעות", "לנדוד", "לספור", "לשמור", "לאסוף", "לשרוק", "להוליך", "לחלוב", "לתעות", "לחצות", "להשגיח", "לגדור", "לגזוז", "להשקות", "לחפש", "לנגן"] },
  { seed: "טבח", words: ["לקצוץ", "לטגן", "לתבל", "לבשל", "לצלות", "לאדות", "לערבב", "להגיש", "לקלף", "לחתוך", "לטעום", "להקציף", "לזלף", "להשרות", "לאפות", "לסנן"] },
  { seed: "צלם", words: ["למקד", "לצלם", "לחשוף", "לפתח", "להדפיס", "למסגר", "להבזיק", "לזום", "לתעד", "להמתין", "להנציח", "לטשטש", "להאיר", "לערוך", "לחכות", "להתקרב"] },
  { seed: "מורה", words: ["ללמד", "להסביר", "לבחון", "למחוק", "להעריך", "לחזור", "לנקד", "לעודד", "להרצות", "לשנן", "לצייר", "לנזוף", "לחנך", "לשאול", "להשתיק", "לכתוב"] },
  { seed: "שען", words: ["לפרק", "ללטש", "להרכיב", "לכוונן", "לשמן", "לחרוט", "להדק", "ליישר", "לנקות", "לתקן", "לבדוק", "לכוון", "להחליף", "לסובב", "למתוח", "לזהות"] },
  { seed: "פסל", words: ["לחצוב", "לגלף", "לעצב", "ללטש", "לפסל", "להחליק", "לחרוט", "לצקת", "לשבור", "לשייף", "ללוש", "להרים", "ליצור", "לסתת", "להתבונן", "לגרד"] },
  { seed: "כורה", words: ["לקדוח", "לפוצץ", "לתמוך", "לחצוב", "לנפות", "לרדת", "להשחיל", "לחפור", "לגרוף", "להכות", "לשאוב", "להעמיס", "לגלות", "להשתעל", "לעלות", "לנשום"] },
  { seed: "חייל", words: ["לצעוד", "להצדיע", "לחפור", "לסייר", "לכוון", "לפרוס", "לתעל", "לזחול", "להמתין", "לחסות", "לצור", "לסגת", "לשוב", "לשמור", "להתגעגע", "לירות"] },
  { seed: "כבאי", words: ["לכבות", "לחלץ", "לפרוץ", "לגרור", "לטפס", "לרסס", "לפנות", "להזעיק", "לשבור", "להתיז", "לזנק", "להציל", "לחפש", "להנשים", "לאוורר", "לסרוק"] },
  { seed: "דוור", words: ["למיין", "לחלק", "לחתום", "לצלצל", "למסור", "להחתים", "לשלוח", "לקפל", "לאסוף", "לרשום", "להשליך", "לדרוך", "לנעול", "לדפוק", "לשלשל", "למהר"] },
  { seed: "רקדן", words: ["להסתובב", "לקפוץ", "להתמתח", "להחליק", "לרקוע", "להרים", "לנחות", "לזרום", "לנתר", "להתכופף", "לסובב", "לרעוד", "להתחיל", "להשתחוות", "לרחף", "לקפוא"] },
  { seed: "שוטר", words: ["לעצור", "לחקור", "לרדוף", "לתשאל", "לאזוק", "לסייר", "לרשום", "להסתתר", "לעקוב", "לצפור", "להשתלט", "לחשוד", "להזהיר", "לכבול", "לתעד", "להעיד"] },
  { seed: "מנתח", words: ["לבתר", "לתפור", "לצרוב", "להרדים", "להדק", "לעצור", "לחטא", "לנקז", "לייצב", "לחשוף", "לחבר", "לספור", "לחתוך", "לשטוף", "להשתיל", "לפתוח"] },
  { seed: "חקלאי", words: ["לחרוש", "לזרוע", "לקצור", "לדוש", "להשקות", "לחלוב", "לגדר", "לאגד", "לרעות", "לרסס", "לאסוף", "לקום", "להתפלל", "לכסח", "לבצור", "להאכיל"] },
  { seed: "צורף", words: ["לרתך", "ללטש", "לחרוט", "לצקת", "להלחים", "לשבץ", "למרק", "לכופף", "למדוד", "לנקות", "לזהב", "להבריק", "ליצור", "לחשל", "לשזור", "לנקב"] },
  { seed: "בנאי", words: ["לטייח", "להניח", "לערבב", "ליישר", "לחצוב", "להרים", "לפלס", "לחבר", "לצקת", "לבנות", "למדוד", "לחזק", "לגבס", "לטפס", "לרצף", "לסייד"] },
  { seed: "שחקן", words: ["לחזור", "לאלתר", "להופיע", "לזייף", "לשנן", "לגלם", "לבכות", "להעמיד", "לצאת", "להיכנס", "לקוד", "להפוך", "להפתיע", "להשתחוות", "להתאפר", "לשכוח"] },
  { seed: "כוהן", words: ["לברך", "לכפר", "למשוח", "להקדיש", "להקשיב", "לקדש", "לכרוע", "לזמר", "לקבור", "לסלוח", "לחתן", "להתאבל", "להתפלל", "להדליק", "לנחם", "לשאת"] },
  { seed: "חייט", words: ["לתפור", "לגזור", "לסמן", "לגהץ", "לכפתר", "לבטן", "לקצר", "לאמוד", "לקפל", "למתוח", "לתקן", "להצר", "להתאים", "לרקום", "להשחיל", "לשחרר"] },
  { seed: "מלצר", words: ["להביא", "להושיב", "למזוג", "לנקות שולחן", "למלא", "להתבדח", "להמליץ", "להתפתל", "לרוץ", "להתנצל", "לסחוב", "להציע", "לקבל פנים", "לחשב", "לערוך שולחן", "לזכור"] },
  { seed: "עורך דין", words: ["לטעון", "להתנגד", "לתחקר", "לייצג", "לערער", "לנסח", "לצטט", "להתייעץ", "לתבוע", "להגן", "לשכנע", "לחתום", "להסדיר", "לגשר", "לסכם", "לחקור עדים"] },
  { seed: "זמר", words: ["לשיר", "לזמזם", "לסלסל", "לשאוף", "להחזיק", "לייבב", "לצרוח", "להתחמם", "להקליט", "לפזם", "לפרוט", "ללחוש", "להתייפח", "לעלות לבמה", "לדייק", "לשתוק"] },
  { seed: "קופאי", words: ["לסרוק ברקוד", "לארוז", "לספור כסף", "לבטל", "להחזיר", "לשקול", "לעגל", "לפהק", "לתת עודף", "לסגור", "לפתוח קופה", "לאחל", "לתמחר", "להשתעמם", "לקרוא", "להנפיק"] },
  { seed: "נהג", words: ["לנהוג", "לבלום", "לצפצף", "להבהב", "לעקוף", "לעצור ברמזור", "לחנות", "להוריד", "לטעות בדרך", "ללחוץ על הגז", "לפנות ימינה", "לסטות", "לנמנם", "לתדלק", "לזגזג", "להסיע"] },
  { seed: "סופר", words: ["לנסות", "לגנוז", "לקצץ", "לתמצת", "לשרבט", "לתאר", "לדמיין", "לפרסם", "לשכתב", "לדחות", "לחטט", "להתוודות", "לסיים", "להגיש לעורך", "לפתוח פרק", "להקריא"] },
  { seed: "מתכנת", words: ["לתכנת", "לדבג", "לקמפל", "להריץ", "להעלות", "לקרוס", "לאתחל", "להעתיק", "להדביק", "לגלול", "להקליד", "לאחסן", "למזג", "לפצל ענף", "להגיב", "להשיק"] },
  { seed: "ברמן", words: ["לשפוך", "לנער", "לשקשק", "לקשט", "לקרר", "לסחוט", "להנהן", "לנגב", "לחלוץ פקק", "לכתוש", "להצית", "לסרב", "לקרוץ", "לגבות", "לשמוע סודות", "להחליק כוס"] },
];

const HE_PLACES: Idea[] = [
  { seed: "מטבח", words: ["סכין", "אדים", "קמח", "קומקום", "מסננת", "סינר", "להבה", "כיריים", "מטרפה", "קרש חיתוך", "מלח", "מצקת", "מגירה", "שולחן", "מקרר", "צנצנת תבלינים"] },
  { seed: "עליית גג", words: ["אבק", "תיבה", "קורים", "תמונות", "קורה", "עש", "צוהר", "עריסה", "מזוודה", "מכתבים", "מראה", "מזכרת", "טחב", "קרש", "סולם מתקפל", "קופסת קרטון"] },
  { seed: "נמל", words: ["חבל", "שחף", "ערפל", "עוגן", "מלח", "גוף אונייה", "מצוף", "גאות", "כבש", "רשת", "מגדלור", "רציף", "חבית", "משבר", "מנוף", "מכולה"] },
  { seed: "בית חולים", words: ["מוניטור", "אלונקה", "עירוי", "צמיד", "גזה", "מסדרון", "גיליון", "וילון", "מיטה", "חלוק", "כפתור מצוקה", "שעון", "מחלקה", "כיסא גלגלים", "מזרק", "חדר המתנה"] },
  { seed: "בית כנסת", words: ["ספסל", "נר", "ויטראז'", "סידור", "בימה", "פעמון", "ארון קודש", "מזוזה", "טלית", "עמוד", "פרוכת", "מנורה", "מדף ספרים", "מדרגה", "שופר", "עזרת נשים"] },
  { seed: "מוסך", words: ["מפתח ברגים", "שמן מנוע", "שולחן עבודה", "כבל מאריך", "ארגז כלים", "סמרטוט", "עגלה", "לוח קיר", "מפתח בוקסה", "אנטיפריז", "מגבה", "מלחציים", "מצת", "רדיו", "צמיג", "בור שמן"] },
  { seed: "חדר שינה", words: ["כרית", "שידה", "ארון", "שמיכה", "שולחן איפור", "מגירה", "פוך", "שעון מעורר", "אדן", "נעל בית", "מסגרת מיטה", "אהיל", "וילון", "מראה", "פיג'מה", "מנורת לילה"] },
  { seed: "יער", words: ["טחב", "שורש", "חופה", "שרך", "ענף נופל", "שביל", "פטרייה", "שירת ציפורים", "קליפה", "קרחת יער", "קוצים", "מאורה", "שרף", "חשכה", "אצטרובל", "גזע כרות"] },
  { seed: "מסעדה", words: ["תא", "קפה", "מפית", "ג'וקבוקס", "דלפק", "פלנצ'ה", "תפריט", "עוגה", "קופה", "ניאון", "כיסא בר", "מלצרית", "צלחת", "קבלה", "מזלג", "קנקן"] },
  { seed: "מכבסה", words: ["מטבע", "מייבש", "מוך", "סל", "אקונומיקה", "שולחן קיפול", "אבקת כביסה", "סחרור", "גרב", "מתקן סבון", "חריץ מטבע", "חשמל סטטי", "קיטור", "טיימר", "אטב", "מכונת כביסה"] },
  { seed: "גג", words: ["חצץ", "אנטנה", "קו רקיע", "יונה", "פיר אוורור", "זפת", "חבל כביסה", "מעקה", "צלחת לוויין", "ארובה", "מגדל מים", "אפר", "כוכבים", "עשן", "דוד שמש", "מרזב"] },
  { seed: "מרתף", words: ["צינורות", "דוד", "קורים", "מדפים", "שולחן עבודה", "תנור", "דלת מרתף", "בטון", "לוח חשמל", "מלכודת", "עובש", "צנצנות", "רוח פרצים", "פנס", "מדרגות עץ", "ארגז"] },
  { seed: "תחנת רכבת", words: ["רציף", "לוח זמנים", "שריקה", "סבל", "ספסל", "שער", "רמקול", "כרטיס", "עגלת מטען", "פרידה", "פסים", "מגדל שעון", "אדים", "קרון", "קיוסק", "מזוודה"] },
  { seed: "חממה", words: ["זכוכית", "מגש זרעים", "לחות", "עציץ חרס", "גפן", "כף גינה", "התעבות", "אדמה", "סחלב", "מנורת שמש", "התזה", "כנימה", "נבט", "חום", "צינור השקיה", "קקטוס"] },
  { seed: "מוטל", words: ["מכונת קרח", "שלט פנוי", "כרטיס מגנטי", "מגרש חניה", "תנ\"ך", "וילון האפלה", "מכונת ממכר", "בריכה", "כיסוי מיטה", "בלוק בטון", "עינית", "מאפרה", "ניאון", "כביש", "דלפק קבלה", "שטיח מוכתם"] },
  { seed: "בית קברות", words: ["מצבה", "זר", "שער ברזל", "ערבה בוכייה", "כתובת", "חלקה", "מלאך אבן", "אוהל אבן", "גרניט", "דממה", "כד", "שביל חצץ", "עפר טרי", "טחב", "נר נשמה", "ברוש"] },
  { seed: "אולם משחקים", words: ["אסימון", "ג'ויסטיק", "שיא", "כרטיס", "אור שחור", "מכונת טופר", "פינבול", "דלפק פרסים", "חריץ מטבע", "סקי-בול", "מכונת עודף", "לוח מובילים", "כפתור", "שטיח", "מקלות", "צפצוף"] },
  { seed: "אסם", words: ["מתבן", "קורה", "קלשון", "תא", "סנונית", "פנס", "רתמה", "אבוס", "שרפרף חליבה", "ממגורה", "אבק", "שבשבת", "חבילת חציר", "זבל", "פרה", "סוס"] },
  { seed: "משרד", words: ["תא עבודה", "שדכן", "פתק דביק", "כתם קפה", "מקלדת", "מזכר", "תריס", "מעלית", "תג שם", "שעון קיר", "מתקן מים", "כיסא מסתובב", "תיבת דואר", "כבל", "מדפסת", "מכונת קפה"] },
  { seed: "חוף", words: ["בול עץ", "צדף", "קו גאות", "שמשייה", "דיונה", "אצה", "שרטון", "חול רטוב", "ארמון חול", "אופק", "שיירים", "זרם תת-מימי", "טיילת", "רסס מלח", "מגבת", "מציל"] },
  { seed: "קרקס", words: ["גלגל ענק", "צמר גפן מתוק", "כרוז", "כרכרה", "דג זהב", "אוהל גדול", "כרטיס", "מראה עקומה", "נסורת", "שדרה", "טבעות", "נקניקייה", "עוגב", "מרים משקולות", "ליצן", "טרפז"] },
  { seed: "מגרש גרוטאות", words: ["חלודה", "צלחת גלגל", "מגנט מנוף", "שמשה", "כלב שמירה", "גדר רשת", "גוש מנוע", "מצבר", "בוץ", "ערמת גרוטאות", "כנף מעוכה", "כתם שמן", "חצץ", "עשבים", "צמיג", "מכונית שרופה"] },
  { seed: "בית מרקחת", words: ["דלפק", "כדורים", "קבלה", "מדף", "כיסא המתנה", "בקבוקון", "כרטיס ברכה", "מארז כדורים", "פעמון", "צמר גפן", "מד לחץ דם", "סוכריה", "פקק בטיחות", "משקל", "מרשם", "תרופה"] },
  { seed: "מטע", words: ["סולם", "פריחה", "ארגז", "נשל", "ענף מורכב", "דבורה", "מכבש תפוחים", "שורה", "מזמרה", "כפור", "יוטה", "צרעה", "שק קטיף", "גזע", "תפוח", "עלה שלכת"] },
  { seed: "רכבת תחתית", words: ["שער", "פס שלישי", "נגן רחוב", "מפת קווים", "לכלוך", "פסיפס", "מרווח רציף", "מאחז יד", "גרפיטי", "מנהרה", "כרטיס", "תא נהג", "סורג אוורור", "חריקה", "מדרגות נעות", "נוסע"] },
  { seed: "תיאטרון", words: ["קדמת במה", "זרקור", "כנף", "יציע", "שולחן אביזרים", "איפור", "בור תזמורת", "שלט חוצות", "דלת סתרים", "מסך", "אור קדמי", "חדר הלבשה", "תוכנייה", "מסלול", "תסריט", "מחיאות כפיים"] },
  { seed: "ביצה", words: ["שורש ברוש", "סוף", "כבול", "אנפה", "יתוש", "עדשת מים", "שורש", "גז ביצה", "צפרדע", "דממה", "טיט", "שפירית", "אדמת בוץ", "אור ירח", "נחש", "ערפל"] },
  { seed: "קזינו", words: ["ז'יטון", "לבד ירוק", "קוביות", "מכונת מזל", "נעל קלפים", "מראה חד-כיוונית", "שטיח", "קוקטייל", "מצלמת אבטחה", "גלגל רולטה", "מלצרית", "אסימון", "פעמון זכייה", "הימור", "דילר", "שולחן פוקר"] },
  { seed: "מגדלור", words: ["עדשה", "מדרגות לולייניות", "יומן", "צופר ערפל", "מעקה", "בקבוק סערה", "צוק", "משואה", "שולחן שומר", "משבר", "אביזר פליז", "מרפסת", "פחית שמן", "שחף", "סערה", "גלים"] },
  { seed: "כיתה", words: ["גיר", "שולחן", "גלובוס", "דגל", "מחק", "מחדד", "פוסטר", "תיק גב", "פעמון הפסקה", "תא", "מקרן", "אישור יציאה", "כוכב זהב", "סרגל", "לוח", "מחברת"] },
];

const BANKS: Record<IdeaLang, IdeaBank> = {
  en: { roles: EN_ROLES, places: EN_PLACES },
  he: { roles: HE_ROLES, places: HE_PLACES },
  es: { roles: ES_ROLES, places: ES_PLACES },
  de: { roles: DE_ROLES, places: DE_PLACES },
  pt: { roles: PT_ROLES, places: PT_PLACES },
};

/** The dataset for a language (falls back to English). */
export function ideaBank(lang: IdeaLang): IdeaBank {
  return BANKS[lang] ?? BANKS.en;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function sample<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function randomIdea(list: Idea[], exclude?: string): Idea {
  const current = (exclude ?? "").trim().toLowerCase();
  const pool = list.filter((idea) => idea.seed.toLowerCase() !== current);
  return pick(pool.length > 0 ? pool : list);
}

/** A random job seed, never the one already in the field. */
export function randomRoleIdea(lang: IdeaLang, excludeRole?: string): Idea {
  return randomIdea(ideaBank(lang).roles, excludeRole);
}

export function randomPlaceIdea(lang: IdeaLang, excludePlace?: string): Idea {
  return randomIdea(ideaBank(lang).places, excludePlace);
}

// ── Matching what people type ──────────────────────────────────────────────
// A job or place typed by hand must find its own list when we have it
// ("Florists", "the baker", "a cop", one typo, either language), and one we
// don't have must never borrow another seed's words (founder, 2026-10-19:
// a custom job used to get a random other job's verbs). Unknown seeds get the
// everyday pools below instead.

/** Other names people type for a seed, keyed by the canonical seed. */
export const ALIASES: Record<IdeaLang, Record<string, string[]>> = {
  en: {
    chef: ["cook", "line cook", "head chef", "sous chef"],
    waiter: ["waitress", "server", "waitstaff"],
    doctor: ["physician", "medic", "gp"],
    firefighter: ["fireman", "firewoman"],
    "police officer": ["cop", "policeman", "policewoman", "police", "officer"],
    "mail carrier": ["mailman", "postman", "postwoman", "postal worker", "courier", "letter carrier"],
    barber: ["hairdresser", "hairstylist", "stylist"],
    lawyer: ["attorney", "solicitor", "barrister"],
    singer: ["vocalist"],
    cashier: ["checkout clerk", "clerk"],
    driver: ["taxi driver", "cab driver", "cabbie", "bus driver", "chauffeur", "uber driver"],
    writer: ["author", "novelist", "poet", "journalist"],
    programmer: ["coder", "developer", "software engineer"],
    fisherman: ["fisher", "fisherwoman"],
    bartender: ["barman", "barmaid", "mixologist"],
    tattooist: ["tattoo artist"],
    undertaker: ["mortician", "funeral director"],
    surgeon: ["surgical resident"],
    seamstress: ["sewer", "dressmaker"],
    sailor: ["seaman", "deckhand"],
    clockmaker: ["horologist"],
    soldier: ["marine", "infantryman"],
    "train station": ["station", "railway station"],
    theater: ["theatre"],
    "record store": ["record shop", "music store"],
    gymnasium: ["gym"],
    campsite: ["campground", "camp"],
    diner: ["cafe", "café", "coffee shop"],
  },
  he: {
    טבח: ["שף", "מבשל", "טבחית", "מבשלת"],
    רופא: ["רופאה", "דוקטור"],
    "עורך דין": ["עורכת דין", 'עו"ד', "עורכי דין"],
    כוהן: ["כומר"],
    מנתח: ["מנתחת"],
  },
  es: ES_ALIASES,
  de: DE_ALIASES,
  pt: PT_ALIASES,
};

/** Hebrew gender and plural forms that point back at a listed seed:
 *  צלמת → צלם, קופאית → קופאי, מלצרית → מלצר, דייגים → דייג. */
const HE_SUFFIXES = ["ית", "ת", "ים", "ות"];

/** Compare key: case, spacing and hyphens never decide a match. */
const HE_FINAL_FORMS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

function key(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\-־]+/g, "")
    .replace(/ß/g, "ss")
    // Accents and umlauts never decide a match (fotografo finds fotógrafo,
    // backer finds bäcker), nor does writing an umlaut out (baecker).
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    // A Hebrew word's last letter takes its final form; once a suffix is cut
    // (צלמת → צלמ) it has to meet צלם, so final letters compare as regular ones.
    .replace(/[ךםןףץ]/g, (letter) => HE_FINAL_FORMS[letter]);
}

/** The forms of what was typed worth looking up, most literal first. */
function typedForms(text: string): string[] {
  const base = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!base) return [];
  const forms = new Set<string>([base]);
  // English articles and possessives ("a florist", "the old barn", "my kitchen").
  const bare = base.replace(/^(a|an|the|my|our|your)\s+/, "");
  forms.add(bare);
  // Spanish articles and possessives ("la cocina", "un panadero", "mi taller").
  forms.add(base.replace(/^(el|la|los|las|un|una|unos|unas|mi|mis|tu|nuestro|nuestra)\s+/, ""));
  // Portuguese articles and contractions ("o padeiro", "na cozinha", "da praia").
  forms.add(base.replace(/^(o|os|as|um|uma|uns|umas|meu|minha|meus|minhas|seu|sua|nosso|nossa|no|na|nos|nas|do|da|dos|das|ao|à)\s+/, ""));
  // German articles and prepositions ("der bäcker", "im theater", "auf dem dach").
  forms.add(base.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|mein|meine|im|am|beim|zum|zur|in der|auf dem)\s+/, ""));
  for (const form of [...forms]) {
    // English plurals: florists, benches, libraries → library.
    if (/ies$/.test(form)) forms.add(form.replace(/ies$/, "y"));
    if (/(ch|sh|ss|x)es$/.test(form)) forms.add(form.replace(/es$/, ""));
    if (/s$/.test(form) && !/ss$/.test(form)) forms.add(form.replace(/s$/, ""));
    // Spanish plurals: pescadores → pescador, luces → luz.
    if (/ces$/.test(form)) forms.add(form.replace(/ces$/, "z"));
    if (/[^aeiou]es$/.test(form)) forms.add(form.replace(/es$/, ""));
    // German plurals and feminine plurals: bäckerinnen → bäckerin, polizisten →
    // polizist, küchen → küche.
    if (/innen$/.test(form)) forms.add(form.replace(/nen$/, ""));
    if (form.length > 4 && /en$/.test(form)) forms.add(form.replace(/en$/, ""));
    if (form.length > 4 && /n$/.test(form)) forms.add(form.replace(/n$/, ""));
    // Portuguese plurals: ladrões → ladrão, capitães → capitão, quintais →
    // quintal, papéis → papel, barris → barril, armazéns → armazém.
    if (/[õã]es$/.test(form)) forms.add(form.replace(/[õã]es$/, "ão"));
    if (/ais$/.test(form)) forms.add(form.replace(/ais$/, "al"));
    if (/[ée]is$/.test(form)) forms.add(form.replace(/[ée]is$/, "el"));
    if (/is$/.test(form)) forms.add(form.replace(/is$/, "il"));
    if (/ns$/.test(form)) forms.add(form.replace(/ns$/, "m"));
    // Hebrew definite article (הנגר) and gender/plural endings.
    const withoutHe = form.startsWith("ה") && form.length > 2 ? form.slice(1) : form;
    forms.add(withoutHe);
    for (const stem of [form, withoutHe]) {
      for (const suffix of HE_SUFFIXES) {
        if (stem.endsWith(suffix) && stem.length > suffix.length + 1) forms.add(stem.slice(0, -suffix.length));
      }
    }
  }
  return [...forms];
}

/** One letter wrong, missing, extra, or two swapped. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length === 1) return true;
    return diffs.length === 2 && diffs[1] === diffs[0] + 1 && a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      j++;
    }
  }
  return true;
}

type SeedKind = "roles" | "places";

/** Every name that leads to a seed, in one language: the seed and its aliases. */
function namesFor(lang: IdeaLang, kind: SeedKind): { name: string; idea: Idea }[] {
  const list = ideaBank(lang)[kind];
  const aliases = ALIASES[lang] ?? {};
  return list.flatMap((idea) => [
    { name: key(idea.seed), idea },
    ...(aliases[idea.seed] ?? []).map((alias) => ({ name: key(alias), idea })),
  ]);
}

/**
 * The listed seed that typed text means, or null. Looks in the UI language
 * first, then the other one (an English job typed in a Hebrew UI still finds
 * its words); exact forms win over a one-letter typo.
 */
export function matchSeed(lang: IdeaLang, kind: SeedKind, text: string): Idea | null {
  const forms = typedForms(text).map(key).filter(Boolean);
  if (forms.length === 0) return null;
  const langs: IdeaLang[] = [lang, ...(["en", "es", "pt", "de", "he"] as IdeaLang[]).filter((other) => other !== lang)];
  for (const candidateLang of langs) {
    const names = namesFor(candidateLang, kind);
    for (const form of forms) {
      const exact = names.find((entry) => entry.name === form);
      if (exact) return exact.idea;
    }
  }
  for (const candidateLang of langs) {
    const names = namesFor(candidateLang, kind);
    for (const form of forms) {
      if (form.length < 5) continue;
      const near = names.filter((entry) => entry.name.length >= 5 && withinOneEdit(entry.name, form));
      const seeds = new Set(near.map((entry) => entry.idea.seed));
      if (seeds.size === 1) return near[0].idea;
    }
  }
  return null;
}

// ── Everyday pools ──────────────────────────────────────────────────────────
// For a job or place we have no list for: plain words that fit anyone and
// anywhere, so a custom seed is never handed another seed's words.

export const EVERYDAY_VERBS: Record<IdeaLang, string[]> = {
  en: ["carry", "wait", "fold", "open", "count", "leave", "hold", "lift", "sort", "clean", "fix", "watch", "listen", "check", "lock", "reach", "borrow", "return", "stay", "forget"],
  he: ["לסחוב", "לחכות", "לקפל", "לפתוח", "לספור", "לעזוב", "להחזיק", "להרים", "למיין", "לנקות", "לתקן", "לבדוק", "להקשיב", "לנעול", "להגיע", "להחזיר", "להישאר", "לשאול", "לזכור", "לשכוח"],
  es: ES_EVERYDAY_VERBS,
  de: DE_EVERYDAY_VERBS,
  pt: PT_EVERYDAY_VERBS,
};

export const EVERYDAY_NOUNS: Record<IdeaLang, string[]> = {
  en: ["door", "window", "chair", "key", "coat", "light switch", "clock", "bag", "cup", "stairs", "shadow", "floor", "wall", "phone", "pocket", "mirror", "rain", "dust", "noise", "receipt"],
  he: ["דלת", "חלון", "כיסא", "מפתח", "מעיל", "מתג", "שעון", "תיק", "כוס", "מדרגות", "צל", "רצפה", "קיר", "טלפון", "כיס", "מראה", "גשם", "אבק", "רעש", "שקית"],
  es: ES_EVERYDAY_NOUNS,
  de: DE_EVERYDAY_NOUNS,
  pt: PT_EVERYDAY_NOUNS,
};

/** Hebrew letters decide which everyday pool fits what was typed; Latin
 *  letters keep the word language when it is Latin (English or Spanish). */
function textLang(text: string, fallback: IdeaLang): IdeaLang {
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (/[a-zñáéíóúäöüßçãõâêô]/i.test(text)) return fallback === "he" ? "en" : fallback;
  return fallback;
}

function suggest(lang: IdeaLang, kind: SeedKind, seed: string, existing: string[], count: number): string[] {
  const match = matchSeed(lang, kind, seed);
  const everyday = kind === "roles" ? EVERYDAY_VERBS : EVERYDAY_NOUNS;
  const pool = match ? match.words : everyday[textLang(seed, lang)];
  const taken = new Set(existing.map((word) => word.trim().toLowerCase()));
  return sample(pool.filter((word) => !taken.has(word.toLowerCase())), count);
}

/** Suggestion verbs for a role seed, skipping words already in the column. */
export function suggestVerbs(lang: IdeaLang, roleSeed: string, existing: string[], count: number): string[] {
  return suggest(lang, "roles", roleSeed, existing, count);
}

export function suggestNouns(lang: IdeaLang, placeSeed: string, existing: string[], count: number): string[] {
  return suggest(lang, "places", placeSeed, existing, count);
}
