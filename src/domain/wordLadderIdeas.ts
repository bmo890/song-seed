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
 * pools any one word may appear in). English + Hebrew.
 */

export type Idea = { seed: string; words: string[] };
export type IdeaBank = { roles: Idea[]; places: Idea[] };
export type IdeaLang = "en" | "he";

// ── English ──────────────────────────────────────────────────────────────────

const EN_ROLES: Idea[] = [
  { seed: "surgeon", words: ["incise", "suture", "cauterize", "anesthetize", "clamp", "transfuse", "resect", "graft", "steady", "sterilize", "excise", "probe", "revive", "close", "operate", "dissect"] },
  { seed: "fisherman", words: ["cast", "reel", "trawl", "gaff", "bait", "gut", "moor", "net", "troll", "wade", "chum", "filet", "capsize", "drift", "haul", "salt"] },
  { seed: "locksmith", words: ["pick", "rekey", "jimmy", "cut", "shim", "bore", "master", "impression", "decode", "latch", "bolt", "spring", "duplicate", "unbind", "seize", "free"] },
  { seed: "baker", words: ["knead", "proof", "laminate", "score", "glaze", "dust", "temper", "crimp", "pipe", "leaven", "braid", "flour", "blister", "cool", "rise", "brown"] },
  { seed: "gravedigger", words: ["excavate", "inter", "lower", "shovel", "level", "mark", "mourn", "backfill", "kneel", "tamp", "cover", "carry", "settle", "bury", "clear", "weep"] },
  { seed: "pilot", words: ["taxi", "throttle", "bank", "stall", "trim", "flare", "yaw", "climb", "descend", "radio", "glide", "circle", "level", "touchdown", "ascend", "chart"] },
  { seed: "bartender", words: ["muddle", "shake", "garnish", "pour", "chill", "strain", "flambe", "uncork", "comp", "tab", "eavesdrop", "wipe", "call", "cut off", "mix", "listen"] },
  { seed: "electrician", words: ["wire", "ground", "splice", "strip", "conduit", "fuse", "arc", "trip", "insulate", "short", "energize", "test", "rewire", "spark", "shock", "connect"] },
  { seed: "seamstress", words: ["hem", "baste", "pleat", "overlock", "gather", "dart", "topstitch", "backstitch", "unpick", "press", "cuff", "bind", "thread", "tuck", "patch", "measure"] },
  { seed: "lifeguard", words: ["scan", "whistle", "dive", "resuscitate", "backboard", "tow", "surface", "warn", "sunburn", "float", "reach", "sprint", "watch", "signal", "rescue", "tread"] },
  { seed: "astronomer", words: ["chart", "eclipse", "orbit", "magnify", "calibrate", "catalog", "spectrum", "redshift", "triangulate", "wonder", "log", "predict", "resolve", "observe", "wander", "name"] },
  { seed: "butcher", words: ["cleave", "debone", "hang", "grind", "cure", "portion", "trim", "hook", "quarter", "salt", "sharpen", "weigh", "wrap", "brine", "carve", "flay"] },
  { seed: "midwife", words: ["deliver", "swaddle", "coach", "cradle", "soothe", "dilate", "crown", "time", "latch", "reassure", "cut", "count", "breathe", "wait", "catch", "hush"] },
  { seed: "detective", words: ["tail", "interrogate", "profile", "stake out", "dust", "trace", "deduce", "suspect", "corner", "confess", "connect", "hunch", "doubt", "shadow", "solve", "accuse"] },
  { seed: "gardener", words: ["prune", "graft", "mulch", "transplant", "deadhead", "stake", "compost", "weed", "sow", "trellis", "irrigate", "harvest", "prop", "espalier", "tend", "bloom"] },
  { seed: "welder", words: ["fuse", "tack", "grind", "braze", "torch", "gouge", "clamp", "mig", "slag", "temper", "quench", "seal", "bevel", "glow", "join", "melt"] },
  { seed: "librarian", words: ["shelve", "catalog", "hush", "archive", "circulate", "renew", "recommend", "index", "reshelve", "preserve", "stamp", "lend", "collate", "return", "collect", "whisper"] },
  { seed: "boxer", words: ["jab", "weave", "clinch", "counter", "feint", "parry", "hook", "bob", "spar", "guard", "sway", "duck", "swing", "bleed", "rise", "rope"] },
  { seed: "shepherd", words: ["herd", "shear", "graze", "corral", "wean", "brand", "whistle", "lamb", "roam", "guard", "count", "wander", "gather", "dip", "lead", "lose"] },
  { seed: "mechanic", words: ["torque", "diagnose", "flush", "align", "bleed", "recalibrate", "jack", "grease", "crank", "idle", "rebuild", "gauge", "swap", "tune", "loosen", "test"] },
  { seed: "priest", words: ["bless", "absolve", "anoint", "consecrate", "confess", "genuflect", "eulogize", "baptize", "intone", "forgive", "chant", "wed", "kneel", "pray", "mourn", "bow"] },
  { seed: "sailor", words: ["hoist", "reef", "moor", "tack", "swab", "helm", "navigate", "weather", "furl", "bail", "signal", "dock", "capsize", "trim", "sail", "knot"] },
  { seed: "painter", words: ["prime", "feather", "blend", "mask", "roll", "thin", "layer", "sponge", "varnish", "stipple", "cover", "streak", "scrape", "coat", "dry", "brush"] },
  { seed: "beekeeper", words: ["smoke", "hive", "extract", "requeen", "swarm", "veil", "uncap", "sting", "harvest", "tend", "hum", "gather", "sweeten", "buzz", "cultivate", "collect"] },
  { seed: "blacksmith", words: ["forge", "anvil", "quench", "temper", "punch", "draw", "upset", "fuller", "peen", "harden", "strike", "bellow", "shape", "cool", "hammer", "heat"] },
  { seed: "nurse", words: ["chart", "dose", "triage", "cannulate", "dress", "monitor", "rotate", "comfort", "draw", "medicate", "bathe", "wake", "shift", "hold", "check", "soothe"] },
  { seed: "thief", words: ["case", "pilfer", "fence", "pickpocket", "burgle", "vanish", "hotwire", "lift", "creep", "stash", "bolt", "duck", "swipe", "conceal", "flee", "hide"] },
  { seed: "teacher", words: ["explain", "grade", "quiz", "assign", "erase", "lecture", "correct", "chalk", "recite", "dismiss", "encourage", "repeat", "mark", "inspire", "learn", "test"] },
  { seed: "carpenter", words: ["saw", "plane", "chisel", "dovetail", "sand", "miter", "frame", "level", "rout", "clamp", "brace", "joint", "shim", "finish", "build", "measure"] },
  { seed: "trucker", words: ["haul", "downshift", "log", "fuel", "jackknife", "convoy", "idle", "weigh", "flatbed", "brake", "signal", "coast", "deliver", "park", "drive", "pass"] },
  { seed: "florist", words: ["arrange", "wire", "condition", "mist", "corsage", "bouquet", "prune", "wrap", "bundle", "deliver", "deadhead", "spray", "freshen", "pair", "wilt", "cut"] },
  { seed: "actor", words: ["rehearse", "improvise", "project", "audition", "emote", "block", "memorize", "cue", "bow", "pretend", "double", "flub", "exit", "become", "weep", "enter"] },
  { seed: "plumber", words: ["snake", "solder", "unclog", "vent", "caulk", "flush", "seat", "trap", "drain", "sweat", "seal", "leak", "fit", "tighten", "route", "wrench"] },
  { seed: "soldier", words: ["march", "salute", "entrench", "flank", "patrol", "aim", "ration", "deploy", "obey", "dig", "wait", "cover", "advance", "retreat", "write", "return"] },
  { seed: "photographer", words: ["frame", "expose", "focus", "bracket", "develop", "crop", "flash", "backlight", "shutter", "dodge", "burn", "print", "capture", "wait", "shoot", "compose"] },
  { seed: "conductor", words: ["cue", "swell", "downbeat", "phrase", "crescendo", "hush", "sustain", "syncopate", "lift", "release", "silence", "sweep", "build", "hold", "time", "quiet"] },
  { seed: "farmer", words: ["plow", "sow", "reap", "thresh", "furrow", "irrigate", "milk", "fence", "rotate", "bale", "graze", "harvest", "till", "yoke", "rise", "pray"] },
  { seed: "tailor", words: ["chalk", "taper", "let out", "take in", "line", "canvas", "drape", "baste", "cuff", "fit", "press", "alter", "measure", "adjust", "trim", "shape"] },
  { seed: "diver", words: ["plunge", "equalize", "surface", "descend", "hover", "decompress", "kick", "salvage", "explore", "float", "regulate", "signal", "rise", "sink", "breathe", "drift"] },
  { seed: "judge", words: ["adjudicate", "sentence", "overrule", "gavel", "recuse", "pardon", "arraign", "convict", "weigh", "deliberate", "recess", "rule", "consider", "acquit", "decide", "preside"] },
  { seed: "miner", words: ["drill", "blast", "shore", "sluice", "tunnel", "extract", "sift", "descend", "pan", "hew", "cough", "carve", "surface", "haul", "strike", "dig"] },
  { seed: "clockmaker", words: ["wind", "regulate", "escape", "mainspring", "jewel", "calibrate", "tick", "chime", "oil", "assemble", "adjust", "repair", "gear", "balance", "tighten", "sync"] },
  { seed: "glassblower", words: ["gather", "blow", "marver", "anneal", "punty", "shape", "roll", "reheat", "twist", "cut", "cool", "flare", "spin", "temper", "melt", "form"] },
  { seed: "clown", words: ["juggle", "tumble", "honk", "mime", "pratfall", "unicycle", "balloon", "grin", "trip", "squirt", "cartwheel", "mock", "stumble", "laugh", "paint", "bow"] },
  { seed: "tattooist", words: ["ink", "outline", "shade", "sterilize", "stencil", "needle", "trace", "bandage", "wipe", "line", "fill", "buzz", "design", "heal", "mark", "draw"] },
  { seed: "undertaker", words: ["embalm", "dress", "cosmetize", "casket", "arrange", "escort", "console", "drape", "shroud", "carry", "prepare", "seal", "attend", "lower", "mourn", "bury"] },
  { seed: "cartographer", words: ["survey", "plot", "scale", "contour", "triangulate", "chart", "letter", "project", "trace", "annotate", "ink", "fold", "orient", "map", "sketch", "name"] },
  { seed: "watchmaker", words: ["dismantle", "polish", "fit", "regulate", "lubricate", "reassemble", "inspect", "wind", "solder", "engrave", "tighten", "align", "clean", "repair", "test", "set"] },
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
  { seed: "laundromat", words: ["quarter", "dryer drum", "lint trap", "wire basket", "bleach", "folding table", "detergent", "spin cycle", "orphan sock", "fluorescent", "coin slot", "static", "hamper", "steam", "linoleum", "timer"] },
  { seed: "rooftop", words: ["gravel", "antenna", "skyline", "pigeon", "vent stack", "tarpaper", "clothesline", "parapet", "satellite dish", "chimney pot", "ledge", "water tower", "starlight", "ash", "pigeon coop", "smoke"] },
  { seed: "basement", words: ["sump pump", "boiler", "cobweb", "shelving", "workbench", "furnace", "cellar door", "concrete", "fuse box", "mousetrap", "mildew", "crawlspace", "jars", "draft", "dampness", "flashlight"] },
  { seed: "train station", words: ["platform", "timetable", "whistle", "porter", "waiting bench", "turnstile", "loudspeaker", "ticket stub", "luggage cart", "farewell", "third rail", "signal", "clock tower", "steam", "carriage", "pigeon"] },
  { seed: "greenhouse", words: ["pane", "seed tray", "humidity", "terracotta", "vine", "trowel", "condensation", "potting soil", "orchid", "sun lamp", "misting", "aphid", "sprout", "trellis", "warmth", "fern"] },
  { seed: "motel", words: ["ice machine", "vacancy sign", "key card", "asphalt lot", "Gideon bible", "blackout curtain", "vending machine", "kidney pool", "bedspread", "cinderblock", "peephole", "ashtray", "neon", "highway", "ceiling fan", "room key"] },
  { seed: "cemetery", words: ["headstone", "wreath", "iron gate", "weeping willow", "epitaph", "plot", "stone angel", "mausoleum", "granite", "hush", "urn", "gravel path", "obelisk", "fresh dirt", "moss", "chapel"] },
  { seed: "arcade", words: ["token", "joystick", "high score", "ticket", "black light", "claw machine", "pinball", "prize counter", "quarter slot", "skee-ball", "change machine", "leaderboard", "cabinet", "flipper", "buzzer", "carpet"] },
  { seed: "barn", words: ["hayloft", "rafter", "pitchfork", "stall", "swallow", "lantern", "tack", "feed trough", "milking stool", "silo", "dust", "weathervane", "bale", "manure", "chaff", "beam"] },
  { seed: "office", words: ["cubicle", "stapler", "fluorescent", "coffee ring", "keyboard", "memo", "venetian blind", "elevator", "lanyard", "wall clock", "water cooler", "swivel chair", "inbox", "cord", "carpet tile", "printer"] },
  { seed: "beach", words: ["driftwood", "seashell", "tide line", "beach umbrella", "dune grass", "kelp", "sandbar", "sanderling", "sandcastle", "horizon", "flotsam", "riptide", "boardwalk", "salt spray", "tar", "gull"] },
  { seed: "carnival", words: ["ferris wheel", "cotton candy", "carny barker", "tilt-a-whirl", "goldfish prize", "big top", "ride ticket", "funhouse mirror", "sawdust", "midway", "ring toss", "corn dog", "calliope", "strongman", "kettle corn", "lights"] },
  { seed: "junkyard", words: ["rust", "hubcap", "crane magnet", "windshield", "junkyard dog", "chain link", "engine block", "car battery", "mud", "scrap heap", "crushed fender", "oil slick", "tetanus", "gravel", "wrecker", "weeds"] },
  { seed: "pharmacy", words: ["pill counter", "prescription", "receipt", "aisle end cap", "fluorescent", "amber bottle", "greeting card", "pill organizer", "counter bell", "cotton ball", "blood pressure cuff", "lozenge", "childproof cap", "scale", "queue", "clerk"] },
  { seed: "orchard", words: ["ladder", "blossom", "bushel crate", "windfall", "grafted branch", "orchard bee", "cider press", "row", "pruning shear", "frost", "burlap", "wasp", "picking bag", "trunk", "dew", "netting"] },
  { seed: "subway", words: ["turnstile", "third rail", "busker", "route map", "grime", "tile mosaic", "platform gap", "handrail", "graffiti", "tunnel", "MetroCard", "conductor booth", "vent grate", "screech", "commuter", "token"] },
  { seed: "theater", words: ["proscenium", "spotlight", "wing", "balcony", "prop table", "greasepaint", "orchestra pit", "marquee", "trapdoor", "curtain call", "footlight", "dressing room", "playbill", "catwalk", "applause", "usher"] },
  { seed: "swamp", words: ["cypress knee", "cattail", "peat", "heron", "mosquito", "duckweed", "mangrove root", "marsh gas", "bullfrog", "stillness", "quicksand", "dragonfly", "mudflat", "moonlight", "moss", "reed"] },
  { seed: "casino", words: ["poker chip", "green felt", "dice", "slot machine", "card shoe", "one-way mirror", "plush carpet", "complimentary cocktail", "surveillance camera", "roulette wheel", "cocktail waitress", "marker", "jackpot bell", "ante", "high roller", "neon"] },
  { seed: "lighthouse", words: ["Fresnel lens", "spiral stair", "logbook", "foghorn", "gallery rail", "storm glass", "cliff", "beacon", "keeper's desk", "breaker", "brass fitting", "widow's walk", "oilcan", "gull", "gale", "reef"] },
  { seed: "classroom", words: ["chalk dust", "desk", "globe", "flag", "eraser", "pencil sharpener", "cursive poster", "backpack", "recess bell", "cubby", "overhead projector", "hall pass", "gold star", "ruler", "chalkboard", "detention"] },
  { seed: "vineyard", words: ["trellis", "oak barrel", "grape cluster", "wine press", "cellar", "cork", "hillside", "sediment", "cask", "harvest moon", "pruning hook", "must", "tasting room", "tendril", "dew", "yeast"] },
  { seed: "morgue", words: ["cold drawer", "toe tag", "steel table", "shroud", "hanging scale", "autopsy report", "chill", "latex glove", "drain", "clipboard", "gurney", "formaldehyde", "fluorescent", "sheet", "hush", "scalpel"] },
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
  { seed: "mine", words: ["ore cart", "headlamp", "canary", "timber support", "pickaxe", "coal dust", "shaft", "elevator cage", "seam", "damp", "rail track", "helmet lamp", "tunnel", "blast cap", "grit", "darkness"] },
  { seed: "wharf", words: ["mooring line", "creosote plank", "crab pot", "fish crate", "gull", "tide mark", "winch", "bait bucket", "chandlery", "brine", "cleat", "trawl net", "diesel", "barnacle", "dock light", "swell"] },
  { seed: "chapel", words: ["votive rack", "kneeler", "narrow aisle", "pipe organ", "wedding veil", "prayer book", "arched window", "hush", "wedding band", "confessional", "altar rail", "candle wax", "hymn board", "pew", "font", "vestibule"] },
];

// ── Hebrew ─────────────────────────────────────────────────────────────────────
// Verbs are infinitives (gender-neutral); nouns are singular. Same
// distinctiveness principle.

const HE_ROLES: Idea[] = [
  { seed: "רופא", words: ["לרפא", "לאבחן", "לחבוש", "להזריק", "לרשום", "להרדים", "למשש", "להאזין", "לבדוק", "לחטא", "לחסן", "לטפל", "למדוד"] },
  { seed: "דייג", words: ["להטיל", "לגרור", "לעגון", "לצוד", "לפרוש", "למשות", "להיסחף", "לשקוע", "לשחות", "לקשור", "לחכות", "לנקות", "לגלוש"] },
  { seed: "אופה", words: ["ללוש", "להתפיח", "לקפל", "לפזר", "להמתיק", "לזלף", "לגלגל", "למרוח", "לצנן", "לחרוץ", "לאפות", "להבריק", "לפרוס"] },
  { seed: "נגר", words: ["לנסר", "למסמר", "למקצע", "להבריג", "להשחיז", "לדבק", "לפלס", "להרכיב", "לשייף", "לבנות", "לחתוך", "להדק", "למדוד"] },
  { seed: "חשמלאי", words: ["לחווט", "להאריק", "לבודד", "לקצר", "להתיך", "לחשמל", "לנתק", "להזרים", "להצית", "לנצנץ", "להשחיל", "לחבר", "לתקן"] },
  { seed: "טייס", words: ["להמריא", "לנחות", "להטות", "לטפס", "לצלול", "לחוג", "לתמרן", "לאזן", "לרדת", "להאיץ", "לנווט", "לרחף", "לשדר"] },
  { seed: "גנן", words: ["לגזום", "לזרוע", "לנכש", "להשקות", "לשתול", "לדשן", "לקטום", "לתמוך", "לפרוח", "לטפח", "להצמיח", "לחפור", "לקצור"] },
  { seed: "ספר", words: ["לספר", "לגלח", "להחליק", "לסרק", "לקצוץ", "להבריש", "לשטוף", "לייבש", "לחפוף", "להרטיב", "לתלתל", "לגזוז", "לעצב"] },
  { seed: "נפח", words: ["לחשל", "לרקע", "להקשות", "לכופף", "לצרוף", "לרדד", "לנקב", "לרתך", "להכות", "לחמם", "לחדד", "למרק", "לכבות"] },
  { seed: "מלח", words: ["להפליג", "לשוט", "לתרן", "לצוף", "לטבוע", "לאותת", "לעגן", "לשאוב", "לדרוך", "להרים", "לחתור", "לגלוש", "לפלס"] },
  { seed: "צייד", words: ["לארוב", "לעקוב", "לירות", "לרדוף", "לצוד", "להסתתר", "לזחול", "לכוון", "להמתין", "לתפוס", "להטעות", "לגשש", "להריח"] },
  { seed: "רועה", words: ["לרעות", "לנדוד", "לספור", "לשמור", "לאסוף", "לשרוק", "להוליך", "לחלוב", "לתעות", "לחצות", "להשגיח", "לגדור", "לגזוז"] },
  { seed: "טבח", words: ["לקצוץ", "לטגן", "לתבל", "לבשל", "לצלות", "לאדות", "לערבב", "להגיש", "לקלף", "לחתוך", "לטעום", "להקציף", "לזלף"] },
  { seed: "צלם", words: ["למקד", "לצלם", "לחשוף", "לפתח", "להדפיס", "למסגר", "להבזיק", "לזום", "לתעד", "להמתין", "להנציח", "לקדד", "להאיר"] },
  { seed: "מורה", words: ["ללמד", "להסביר", "לבחון", "למחוק", "להעריך", "לחזור", "לנקד", "לעודד", "להרצות", "לשנן", "לצייר", "לנזוף", "לחנך"] },
  { seed: "שען", words: ["לפרק", "ללטש", "להרכיב", "לכוונן", "לשמן", "לחרוט", "להדק", "ליישר", "לנקות", "לתקן", "לבדוק", "לכוון", "להחליף"] },
  { seed: "פסל", words: ["לחצוב", "לגלף", "לעצב", "ללטש", "לפסל", "להחליק", "לחרוט", "לצקת", "לשבור", "לשייף", "לכייר", "להרים", "ליצור"] },
  { seed: "כורה", words: ["לקדוח", "לפוצץ", "לתמוך", "לחצוב", "לנפות", "לרדת", "להשחיל", "לחפור", "לגרוף", "להכות", "לשאוב", "להעמיס", "לגלות"] },
  { seed: "חייל", words: ["לצעוד", "להצדיע", "לחפור", "לסייר", "לכוון", "לפרוס", "לתעל", "לזחול", "להמתין", "לחסות", "לצור", "לסגת", "לשוב"] },
  { seed: "כבאי", words: ["לכבות", "לחלץ", "לפרוץ", "לגרור", "לטפס", "לרסס", "לפנות", "להזעיק", "לשבור", "להתיז", "לזנק", "להציל", "לחפש"] },
  { seed: "דוור", words: ["למיין", "לחלק", "לחתום", "לצלצל", "למסור", "להחתים", "לשלוח", "לקפל", "לאסוף", "לרשום", "להשליך", "לדרוך", "לנעול"] },
  { seed: "רקדן", words: ["להסתובב", "לקפוץ", "להתמתח", "להחליק", "לרקוע", "להרים", "לנחות", "לזרום", "לגשר", "להתכופף", "לסובב", "לרעוד", "להתחיל"] },
  { seed: "שוטר", words: ["לעצור", "לחקור", "לרדוף", "לתשאל", "לאזוק", "לסייר", "לרשום", "להסתתר", "לעקוב", "לצפור", "להשתלט", "לחשוד", "להזהיר"] },
  { seed: "מנתח", words: ["לבתר", "לתפור", "לצרוב", "להרדים", "להדק", "לעצור", "לחטא", "לגלד", "לייצב", "לחשוף", "לחבר", "לספור", "לחתוך"] },
  { seed: "חקלאי", words: ["לחרוש", "לזרוע", "לקצור", "לדוש", "להשקות", "לחלוב", "לגדר", "לאגד", "לרעות", "לרסס", "לאסוף", "לקום", "להתפלל"] },
  { seed: "צורף", words: ["לרתך", "ללטש", "לחרוט", "לצקת", "להלחים", "לשבץ", "למרק", "לכופף", "למדוד", "לנקות", "לזהב", "להבריק", "ליצור"] },
  { seed: "בנאי", words: ["לטייח", "להניח", "לערבב", "ליישר", "לחצוב", "להרים", "לפלס", "לחבר", "לצקת", "לבנות", "למדוד", "לחזק", "לגבס"] },
  { seed: "שחקן", words: ["לחזור", "לאלתר", "להטיל", "לזייף", "לשנן", "לגלם", "לבכות", "להעמיד", "לצאת", "להיכנס", "לקוד", "להפוך", "להפתיע"] },
  { seed: "כוהן", words: ["לברך", "לכפר", "למשוח", "להקדיש", "להתוודות", "לקדש", "לכרוע", "לזמר", "לקבור", "לסלוח", "לחתן", "להתאבל", "להתפלל"] },
  { seed: "חייט", words: ["לתפור", "לגזור", "לסמן", "לגהץ", "לכפתר", "לבטן", "לקצר", "לאמוד", "לקפל", "למתוח", "לתקן", "להצר", "להתאים"] },
];

const HE_PLACES: Idea[] = [
  { seed: "מטבח", words: ["סכין", "אדים", "קמח", "קומקום", "מסננת", "סינר", "להבה", "כיריים", "מטרפה", "קרש חיתוך", "מלח", "מצקת", "מגירה", "שולחן"] },
  { seed: "עליית גג", words: ["אבק", "תיבה", "קורים", "תמונות", "קורה", "עש", "צוהר", "עריסה", "מזוודה", "מכתבים", "מראה", "מזכרת", "טחב", "קרש"] },
  { seed: "נמל", words: ["חבל", "שחף", "ערפל", "עוגן", "מלח", "גוף אונייה", "מצוף", "גאות", "כבש", "רשת", "מגדלור", "רציף", "בַּרְנַקְל", "משבר"] },
  { seed: "בית חולים", words: ["מוניטור", "אלונקה", "עירוי", "צמיד", "גזה", "מסדרון", "גיליון", "וילון", "מיטה", "חלוק", "כפתור מצוקה", "שעון", "מחלקה", "כיסא גלגלים"] },
  { seed: "בית כנסת", words: ["ספסל", "נר", "ויטראז'", "סידור", "בימה", "פעמון", "ארון קודש", "מזוזה", "טלית", "עמוד", "פרוכת", "מנורה", "מדף ספרים", "מדרגה"] },
  { seed: "מוסך", words: ["מפתח ברגים", "שמן מנוע", "שולחן עבודה", "כבל מאריך", "ארגז כלים", "סמרטוט", "עגלה", "לוח קיר", "מפתח בוקסה", "אנטיפריז", "מגבה", "מלחציים", "מצת", "רדיו"] },
  { seed: "חדר שינה", words: ["כרית", "שידה", "ארון", "שמיכה", "שולחן איפור", "מגירה", "פוך", "שעון מעורר", "אדן", "נעל בית", "מסגרת מיטה", "אהיל", "וילון", "מראה"] },
  { seed: "יער", words: ["טחב", "שורש", "חופה", "שרך", "ענף נופל", "שביל", "פטרייה", "שירת ציפורים", "קליפה", "קרחת יער", "קוצים", "מאורה", "שרף", "חשכה"] },
  { seed: "מסעדה", words: ["תא", "קפה", "מפית", "ג'וקבוקס", "דלפק", "פלנצ'ה", "תפריט", "עוגה", "קופה", "ניאון", "כיסא בר", "מלצרית", "צלחת", "קבלה"] },
  { seed: "מכבסה", words: ["מטבע", "מייבש", "מוך", "סל", "אקונומיקה", "שולחן קיפול", "אבקת כביסה", "סחרור", "גרב", "פלואורסנט", "חריץ מטבע", "חשמל סטטי", "קיטור", "טיימר"] },
  { seed: "גג", words: ["חצץ", "אנטנה", "קו רקיע", "יונה", "פיר אוורור", "זפת", "חבל כביסה", "מעקה", "צלחת לוויין", "ארובה", "מגדל מים", "אפר", "כוכבים", "עשן"] },
  { seed: "מרתף", words: ["צינורות", "דוד", "קורים", "מדפים", "שולחן עבודה", "תנור", "דלת מרתף", "בטון", "לוח חשמל", "מלכודת", "עובש", "צנצנות", "רוח פרצים", "פנס"] },
  { seed: "תחנת רכבת", words: ["רציף", "לוח זמנים", "שריקה", "סבל", "ספסל", "שער", "רמקול", "כרטיס", "עגלת מטען", "פרידה", "פסים", "מגדל שעון", "אדים", "קרון"] },
  { seed: "חממה", words: ["זכוכית", "מגש זרעים", "לחות", "עציץ חרס", "גפן", "כף גינה", "התעבות", "אדמה", "סחלב", "מנורת שמש", "התזה", "כנימה", "נבט", "חום"] },
  { seed: "מוטל", words: ["מכונת קרח", "שלט פנוי", "כרטיס מגנטי", "מגרש חניה", "תנ\"ך", "וילון האפלה", "מכונת ממכר", "בריכה", "כיסוי מיטה", "בלוק בטון", "עינית", "מאפרה", "ניאון", "כביש"] },
  { seed: "בית קברות", words: ["מצבה", "זר", "שער ברזל", "ערבה בוכייה", "כתובת", "חלקה", "מלאך אבן", "אוהל אבן", "גרניט", "דממה", "כד", "שביל חצץ", "עפר טרי", "טחב"] },
  { seed: "אולם משחקים", words: ["אסימון", "ג'ויסטיק", "שיא", "כרטיס", "אור שחור", "מכונת טופר", "פינבול", "דלפק פרסים", "חריץ מטבע", "סקי-בול", "מכונת עודף", "לוח מובילים", "כפתור", "שטיח"] },
  { seed: "אסם", words: ["מתבן", "קורה", "קלשון", "תא", "סנונית", "פנס", "רתמה", "אבוס", "שרפרף חליבה", "ממגורה", "אבק", "שבשבת", "חבילת חציר", "זבל"] },
  { seed: "משרד", words: ["תא עבודה", "שדכן", "פלואורסנט", "כתם קפה", "מקלדת", "מזכר", "תריס", "מעלית", "תג שם", "שעון קיר", "מתקן מים", "כיסא מסתובב", "תיבת דואר", "כבל"] },
  { seed: "חוף", words: ["בול עץ", "צדף", "קו גאות", "שמשייה", "דיונה", "אצה", "שרטון", "חוֹלִית", "ארמון חול", "אופק", "שיירים", "זרם תת-מימי", "טיילת", "רסס מלח"] },
  { seed: "קרקס", words: ["גלגל ענק", "צמר גפן מתוק", "כרוז", "כרכרה", "דג זהב", "אוהל גדול", "כרטיס", "מראה עקומה", "נסורת", "שדרה", "טבעות", "נקניקייה", "עוגב", "מרים משקולות"] },
  { seed: "מגרש גרוטאות", words: ["חלודה", "צלחת גלגל", "מגנט מנוף", "שמשה", "כלב שמירה", "גדר רשת", "גוש מנוע", "מצבר", "בוץ", "ערמת גרוטאות", "כנף מעוכה", "כתם שמן", "חצץ", "עשבים"] },
  { seed: "בית מרקחת", words: ["דלפק", "כדורים", "קבלה", "מדף", "פלואורסנט", "בקבוקון", "כרטיס ברכה", "מארז כדורים", "פעמון", "צמר גפן", "מד לחץ דם", "סוכריה", "פקק בטיחות", "משקל"] },
  { seed: "מטע", words: ["סולם", "פריחה", "ארגז", "נשל", "ענף מורכב", "דבורה", "מכבש תפוחים", "שורה", "מזמרה", "כפור", "יוטה", "צרעה", "שק קטיף", "גזע"] },
  { seed: "רכבת תחתית", words: ["שער", "פס שלישי", "נגן רחוב", "מפת קווים", "לכלוך", "פסיפס", "מרווח רציף", "מאחז יד", "גרפיטי", "מנהרה", "כרטיס", "תא נהג", "סורג אוורור", "חריקה"] },
  { seed: "תיאטרון", words: ["קדמת במה", "זרקור", "כנף", "יציע", "שולחן אביזרים", "איפור", "בור תזמורת", "שלט חוצות", "דלת סתרים", "מסך", "אור קדמי", "חדר הלבשה", "תוכנייה", "מסלול"] },
  { seed: "ביצה", words: ["שורש ברוש", "סוף", "כבול", "אנפה", "יתוש", "עדשת מים", "שורש", "גז ביצה", "צפרדע", "דממה", "טיט", "שפירית", "אדמת בוץ", "אור ירח"] },
  { seed: "קזינו", words: ["ז'יטון", "לבד ירוק", "קוביות", "מכונת מזל", "נעל קלפים", "מראה חד-כיוונית", "שטיח", "קוקטייל", "מצלמת אבטחה", "גלגל רולטה", "מלצרית", "אסימון", "פעמון זכייה", "הימור"] },
  { seed: "מגדלור", words: ["עדשה", "מדרגות לולייניות", "יומן", "צופר ערפל", "מעקה", "בקבוק סערה", "צוק", "משואה", "שולחן שומר", "משבר", "אביזר פליז", "מרפסת", "פחית שמן", "שחף"] },
  { seed: "כיתה", words: ["גיר", "שולחן", "גלובוס", "דגל", "מחק", "מחדד", "פוסטר", "תיק גב", "פעמון הפסקה", "תא", "מקרן", "אישור יציאה", "כוכב זהב", "סרגל"] },
];

const BANKS: Record<IdeaLang, IdeaBank> = {
  en: { roles: EN_ROLES, places: EN_PLACES },
  he: { roles: HE_ROLES, places: HE_PLACES },
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

function suggest(list: Idea[], seed: string, existing: string[], count: number): string[] {
  const key = seed.trim().toLowerCase();
  const match = list.find((idea) => idea.seed.toLowerCase() === key);
  // Exact seed → its own pool; a custom seed → a random pool, so the button
  // always produces something (different flavor each tap).
  const pool = (match ?? pick(list)).words;
  const taken = new Set(existing.map((word) => word.trim().toLowerCase()));
  return sample(pool.filter((word) => !taken.has(word.toLowerCase())), count);
}

/** Suggestion verbs for a role seed, skipping words already in the column. */
export function suggestVerbs(lang: IdeaLang, roleSeed: string, existing: string[], count: number): string[] {
  return suggest(ideaBank(lang).roles, roleSeed, existing, count);
}

export function suggestNouns(lang: IdeaLang, placeSeed: string, existing: string[], count: number): string[] {
  return suggest(ideaBank(lang).places, placeSeed, existing, count);
}
