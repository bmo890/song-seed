/**
 * songnook.app in the app's five languages. The English is the source (founder-approved
 * 2026-11-15); the others follow it line for line and borrow the app's own words for its
 * controls (Loop, Step up, sections, plan names: src/i18n/locales/*). Hebrew addresses the
 * reader in the plural, as the app does.
 *
 * Which language a visitor sees: the one they picked (a cookie set by /es, /he…), else
 * their browser's languages, else their country, else English.
 */

export const LANGS = ["en", "es", "de", "pt", "he"] as const;
export type Lang = (typeof LANGS)[number];

export const isLang = (s: string | undefined): s is Lang => !!s && (LANGS as readonly string[]).includes(s);

/** Countries whose visitors read a language before English, when the browser says nothing we speak. */
const COUNTRY_LANG: Record<string, Lang> = {
  IL: "he",
  DE: "de", AT: "de", CH: "de", LI: "de",
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es",
  BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
};

/** Browser first (it is the reader's own setting), country only when the browser names none of ours. */
export function negotiateLang(acceptLanguage: string | undefined, country: string | undefined): Lang {
  const prefs = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((p) => p.base && p.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) {
    const base = p.base === "iw" ? "he" : p.base;
    if (isLang(base)) return base;
  }
  return COUNTRY_LANG[(country ?? "").toUpperCase()] ?? "en";
}

type Pair = { title: string; line: string };
type Step = Pair & { alt: string };
type Plan = { label: string; per: string; note: string };

export type LandingStrings = {
  name: string;
  dir: "ltr" | "rtl";
  title: string;
  description: string;
  getApp: string;
  language: string;
  support: string;
  privacy: string;
  terms: string;
  appStoreAlt: string;
  playAlt: string;
  androidSoon: [string, string];
  heroH1: string;
  heroEm: string;
  heroSub: string;
  heroAlt: string;
  tourEyebrow: string;
  tourH2: string;
  tour: [Step, Step, Step, Step];
  bandEyebrow: string;
  bandH2: string;
  bandLead: string;
  band: [Pair, Pair, Pair];
  bandAlt: string;
  learnEyebrow: string;
  learnH2: string;
  learnLead: string;
  cards: CardStrings;
  yoursEyebrow: string;
  yoursH2: string;
  yours: [Pair, Pair, Pair];
  plansEyebrow: string;
  plansH2: string;
  plansLead: string;
  freeH3: string;
  forever: string;
  freeNote: string;
  free: [string, string, string, string];
  plans: { year: Plan; month: Plan; life: Plan };
  proAdds: [Pair, Pair, Pair, Pair, Pair];
  closingH2: string;
  closingEm: string;
  closingLead: string;
};

/** The words inside the living player cards (the app's own labels). */
export type CardStrings = {
  loop: string;
  stepUp: string;
  speed: string;
  pitch: string;
  verse: string;
  chorus: string;
  bridge: string;
  outro: string;
  harmonyHere: string;
  meta1: string;
  meta2: string;
  meta3: string;
  cap1: [string, string];
  cap2: [string, string];
  cap3: [string, string];
};

export const CARDS_EN: CardStrings = {
  loop: "Loop",
  stepUp: "Step up",
  speed: "Speed",
  pitch: "Pitch",
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
  harmonyHere: "Harmony here",
  meta1: "Harbor Lights • 2h ago • 1 layer",
  meta2: "Album demos • Version 2",
  meta3: "Harbor Lights • Chorus on repeat",
  cap1: ["Play it", "loop it, slow it, mark the verse and chorus"],
  cap2: ["Sing along", "lyrics and chords scroll with the song"],
  cap3: ["Drill it", "loop the hard part, a little faster each time"],
};

export const STRINGS: Record<Lang, LandingStrings> = {
  en: {
    name: "English",
    dir: "ltr",
    title: "SongNook: a quiet corner for songwriting and practice",
    description:
      "A quiet corner for songwriting and practice. SongNook records your song ideas, keeps them organized, helps you finish them, and brings back the ones you forgot.",
    getApp: "Get the app",
    language: "Language",
    support: "Support",
    privacy: "Privacy",
    terms: "Terms",
    appStoreAlt: "Download on the App Store",
    playAlt: "Get it on Google Play",
    androidSoon: ["Android", "coming soon"],
    heroH1: "A quiet corner for songwriting",
    heroEm: "and practice.",
    heroSub: "For songwriters and working musicians. Catch every idea, finish your songs, and learn the set.",
    heroAlt: "A collection of song ideas, newest first, each with its waveform and stage",
    tourEyebrow: "How it works",
    tourH2: "From a hum to a finished song",
    tour: [
      { title: "Catch it", line: "Record the moment inspiration hits, and keep it organized your way.", alt: "Recording a new idea" },
      { title: "Write it", line: "Lyrics and chords side by side, and writing games to break writer's block. Every word is yours.", alt: "A chord chart with lyrics" },
      { title: "Finish it", line: "Every take and every lyric draft is kept, so you can always go back.", alt: "A song with its takes and older versions" },
      { title: "Never lose it", line: "Old gems come back to you, so a good idea never gets lost.", alt: "Unfinished songs and forgotten ideas, brought back" },
    ],
    bandEyebrow: "For the band",
    bandH2: "Send the whole song, not just the audio",
    bandLead:
      "Exporting gives your band a bare audio file. SongNook Send gives them the song: the recording with its lyrics, chords, sections, marked moments and notes.",
    band: [
      { title: "Send it.", line: "One private link carries the recording and everything attached to it." },
      { title: "Collaborate.", line: "Receive the setlist ready to learn: sections, notes, lyrics and all." },
      { title: "Play it.", line: "Setlists and chord charts, ready for the stage." },
    ],
    bandAlt: "A song from a bandmate, with its lyrics, chart and notes",
    learnEyebrow: "Practice",
    learnH2: "Learn the set before the gig",
    learnLead: "Slow down the tricky parts, change the key, and loop a passage until it's in your hands.",
    cards: CARDS_EN,
    yoursEyebrow: "Private by design",
    yoursH2: "Yours, and only yours",
    yours: [
      { title: "Stays on your phone", line: "We never see your songs." },
      { title: "No account, no ads", line: "Open it and start." },
      { title: "Never trains AI", line: "Your music stays yours." },
    ],
    plansEyebrow: "Plans",
    plansH2: "Free, with a free month of Pro",
    plansLead: "Every tool free for your first month, no card needed. Writing and keeping your songs stay free after that.",
    freeH3: "Free for good",
    forever: "forever",
    freeNote: "Everything you need to write and keep your songs.",
    free: ["Record and organize without limits", "Lyrics and chord charts", "Backup and export", "One SongNook Send link a month"],
    plans: {
      year: { label: "Yearly", per: "a year", note: "About $2 a month." },
      month: { label: "Monthly", per: "a month", note: "Cancel anytime." },
      life: { label: "Lifetime", per: "once", note: "Pay once. Early-adopter launch price." },
    },
    proAdds: [
      { title: "Practice tools", line: "Slow it down, change the key, drill the hard parts." },
      { title: "Gig-ready charts", line: "Setlists and chord charts in any key." },
      { title: "Writing help", line: "Rhymes, synonyms and games for when you're stuck." },
      { title: "Unlimited sharing", line: "As many SongNook Send links as you like, and a space for every band." },
      { title: "Studio export", line: "Take your ideas into Logic, Ableton and more." },
    ],
    closingH2: "Catch the",
    closingEm: "next one.",
    closingLead: "Free to download. Your first month of Pro is on us.",
  },

  es: {
    name: "Español",
    dir: "ltr",
    title: "SongNook: un rincón tranquilo para componer y practicar",
    description:
      "Un rincón tranquilo para componer y practicar. SongNook graba tus ideas, las mantiene en orden, te ayuda a terminarlas y te devuelve las que olvidaste.",
    getApp: "Descarga la app",
    language: "Idioma",
    support: "Soporte",
    privacy: "Privacidad",
    terms: "Términos",
    appStoreAlt: "Descárgalo en el App Store",
    playAlt: "Disponible en Google Play",
    androidSoon: ["Android", "muy pronto"],
    heroH1: "Un rincón tranquilo para componer",
    heroEm: "y practicar.",
    heroSub: "Para compositores y músicos en activo. Atrapa cada idea, termina tus canciones y apréndete el set.",
    heroAlt: "Una colección de ideas, las más nuevas primero, cada una con su onda y su etapa",
    tourEyebrow: "Cómo funciona",
    tourH2: "De un tarareo a una canción terminada",
    tour: [
      { title: "Atrápala", line: "Graba en cuanto llega la inspiración y ordénalo a tu manera.", alt: "Grabando una idea nueva" },
      { title: "Escríbela", line: "Letra y acordes lado a lado, y juegos de escritura para romper el bloqueo. Cada palabra es tuya.", alt: "Un cifrado con la letra" },
      { title: "Termínala", line: "Cada toma y cada borrador de la letra se guardan, para que siempre puedas volver.", alt: "Una canción con sus tomas y versiones anteriores" },
      { title: "No la pierdas", line: "Las joyas olvidadas vuelven a ti, para que ninguna buena idea se pierda.", alt: "Canciones sin terminar e ideas olvidadas, de vuelta" },
    ],
    bandEyebrow: "Para la banda",
    bandH2: "Envía la canción entera, no solo el audio",
    bandLead:
      "Exportar le da a tu banda un simple archivo de audio. SongNook Send les da la canción: la grabación con su letra, acordes, partes, momentos marcados y notas.",
    band: [
      { title: "Envíala.", line: "Un enlace privado lleva la grabación y todo lo que va con ella." },
      { title: "Colabora.", line: "Recibe el setlist listo para aprender: partes, notas, letras y todo." },
      { title: "Tócala.", line: "Setlists y cifrados, listos para el escenario." },
    ],
    bandAlt: "Una canción de un compañero de banda, con su letra, cifrado y notas",
    learnEyebrow: "Práctica",
    learnH2: "Apréndete el set antes del concierto",
    learnLead: "Baja la velocidad de las partes difíciles, cambia el tono y repite un pasaje en loop hasta dominarlo.",
    cards: {
      loop: "Loop",
      stepUp: "Subida gradual",
      speed: "Velocidad",
      pitch: "Tono",
      verse: "Estrofa",
      chorus: "Coro",
      bridge: "Puente",
      outro: "Outro",
      harmonyHere: "Armonía aquí",
      meta1: "Harbor Lights • hace 2 h • 1 capa",
      meta2: "Album demos • Versión 2",
      meta3: "Harbor Lights • Coro en loop",
      cap1: ["Tócala", "haz loop, baja la velocidad, marca estrofa y coro"],
      cap2: ["Canta", "la letra y los acordes avanzan con la canción"],
      cap3: ["Domínala", "repite la parte difícil, un poco más rápido cada vez"],
    },
    yoursEyebrow: "Privado por diseño",
    yoursH2: "Tuyo, y solo tuyo",
    yours: [
      { title: "Se queda en tu teléfono", line: "Nunca vemos tus canciones." },
      { title: "Sin cuenta, sin anuncios", line: "Ábrela y empieza." },
      { title: "Nunca entrena IA", line: "Tu música sigue siendo tuya." },
    ],
    plansEyebrow: "Planes",
    plansH2: "Gratis, con un mes gratis de Pro",
    plansLead: "Todas las herramientas gratis tu primer mes, sin tarjeta. Escribir y guardar tus canciones sigue siendo gratis después.",
    freeH3: "Gratis para siempre",
    forever: "para siempre",
    freeNote: "Todo lo que necesitas para escribir y guardar tus canciones.",
    free: ["Graba y organiza sin límites", "Letras y cifrados", "Copia de seguridad y exportación", "Un enlace de SongNook Send al mes"],
    plans: {
      year: { label: "Anual", per: "al año", note: "Unos $2 al mes." },
      month: { label: "Mensual", per: "al mes", note: "Cancela cuando quieras." },
      life: { label: "De por vida", per: "una vez", note: "Pago único. Precio de lanzamiento para los primeros." },
    },
    proAdds: [
      { title: "Herramientas de práctica", line: "Baja la velocidad, cambia el tono, domina las partes difíciles." },
      { title: "Cifrados para el escenario", line: "Setlists y cifrados en cualquier tono." },
      { title: "Ayuda para escribir", line: "Rimas, sinónimos y juegos para cuando te atascas." },
      { title: "Compartir sin límite", line: "Todos los enlaces de SongNook Send que quieras, y un espacio para cada banda." },
      { title: "Exportación para estudio", line: "Lleva tus ideas a Logic, Ableton y más." },
    ],
    closingH2: "Atrapa la",
    closingEm: "próxima.",
    closingLead: "Descarga gratis. Tu primer mes de Pro corre por nuestra cuenta.",
  },

  de: {
    name: "Deutsch",
    dir: "ltr",
    title: "SongNook: ein stiller Winkel zum Songschreiben und Üben",
    description:
      "Ein stiller Winkel zum Songschreiben und Üben. SongNook nimmt deine Songideen auf, hält sie in Ordnung, hilft dir, sie fertigzustellen, und bringt die zurück, die du vergessen hast.",
    getApp: "App laden",
    language: "Sprache",
    support: "Support",
    privacy: "Datenschutz",
    terms: "Bedingungen",
    appStoreAlt: "Laden im App Store",
    playAlt: "Jetzt bei Google Play",
    androidSoon: ["Android", "bald verfügbar"],
    heroH1: "Ein stiller Winkel zum Songschreiben",
    heroEm: "und Üben.",
    heroSub: "Für Songwriter und aktive Musiker. Halte jede Idee fest, mach deine Songs fertig und lern das Set.",
    heroAlt: "Eine Sammlung von Songideen, die neuesten zuerst, jede mit Wellenform und Stand",
    tourEyebrow: "So funktioniert's",
    tourH2: "Vom Summen zum fertigen Song",
    tour: [
      { title: "Festhalten", line: "Nimm auf, sobald die Inspiration kommt, und ordne alles, wie du willst.", alt: "Eine neue Idee wird aufgenommen" },
      { title: "Schreiben", line: "Text und Akkorde nebeneinander, dazu Schreibspiele gegen die Blockade. Jedes Wort ist deins.", alt: "Ein Akkordblatt mit Text" },
      { title: "Fertigstellen", line: "Jeder Take und jeder Textentwurf bleibt erhalten, damit du immer zurückkannst.", alt: "Ein Song mit seinen Takes und älteren Versionen" },
      { title: "Nichts verlieren", line: "Alte Perlen kommen zu dir zurück, damit keine gute Idee verloren geht.", alt: "Unfertige Songs und vergessene Ideen, zurückgeholt" },
    ],
    bandEyebrow: "Für die Band",
    bandH2: "Schick den ganzen Song, nicht nur das Audio",
    bandLead:
      "Ein Export gibt deiner Band eine nackte Audiodatei. SongNook Send gibt ihr den Song: die Aufnahme mit Text, Akkorden, Teilen, markierten Stellen und Notizen.",
    band: [
      { title: "Schick ihn.", line: "Ein privater Link trägt die Aufnahme und alles, was dazugehört." },
      { title: "Arbeitet zusammen.", line: "Bekomm die Setlist fertig zum Lernen: Teile, Notizen, Texte und alles." },
      { title: "Spiel ihn.", line: "Setlists und Akkordblätter, bereit für die Bühne." },
    ],
    bandAlt: "Ein Song von einem Bandmitglied, mit Text, Akkordblatt und Notizen",
    learnEyebrow: "Üben",
    learnH2: "Lern das Set vor dem Gig",
    learnLead: "Mach schwere Stellen langsamer, ändere die Tonart und loope eine Passage, bis sie sitzt.",
    cards: {
      loop: "Loop",
      stepUp: "Steigern",
      speed: "Geschwindigkeit",
      pitch: "Tonhöhe",
      verse: "Strophe",
      chorus: "Refrain",
      bridge: "Bridge",
      outro: "Outro",
      harmonyHere: "Zweite Stimme hier",
      meta1: "Harbor Lights • vor 2 Std. • 1 Spur",
      meta2: "Album demos • Version 2",
      meta3: "Harbor Lights • Refrain im Loop",
      cap1: ["Spiel ihn", "loopen, verlangsamen, Strophe und Refrain markieren"],
      cap2: ["Sing mit", "Text und Akkorde laufen mit dem Song"],
      cap3: ["Feil dran", "loope die schwere Stelle, jedes Mal etwas schneller"],
    },
    yoursEyebrow: "Privat von Grund auf",
    yoursH2: "Deins, und nur deins",
    yours: [
      { title: "Bleibt auf deinem Handy", line: "Wir sehen deine Songs nie." },
      { title: "Kein Konto, keine Werbung", line: "Öffnen und loslegen." },
      { title: "Trainiert nie KI", line: "Deine Musik bleibt deine." },
    ],
    plansEyebrow: "Preise",
    plansH2: "Kostenlos, mit einem Gratismonat Pro",
    plansLead: "Im ersten Monat jedes Werkzeug gratis, ohne Karte. Schreiben und Aufbewahren deiner Songs bleibt danach kostenlos.",
    freeH3: "Für immer kostenlos",
    forever: "für immer",
    freeNote: "Alles, was du brauchst, um deine Songs zu schreiben und aufzubewahren.",
    free: ["Aufnehmen und ordnen ohne Grenzen", "Texte und Akkordblätter", "Backup und Export", "Ein SongNook-Send-Link pro Monat"],
    plans: {
      year: { label: "Jährlich", per: "pro Jahr", note: "Etwa 2 $ im Monat." },
      month: { label: "Monatlich", per: "pro Monat", note: "Jederzeit kündbar." },
      life: { label: "Dauerhaft", per: "einmalig", note: "Einmal zahlen. Startpreis für Frühentschlossene." },
    },
    proAdds: [
      { title: "Übungswerkzeuge", line: "Langsamer spielen, Tonart ändern, schwere Stellen drillen." },
      { title: "Bühnenfertige Akkordblätter", line: "Setlists und Akkordblätter in jeder Tonart." },
      { title: "Schreibhilfe", line: "Reime, Synonyme und Spiele, wenn du feststeckst." },
      { title: "Unbegrenzt teilen", line: "So viele SongNook-Send-Links, wie du willst, und ein Bereich für jede Band." },
      { title: "Studio-Export", line: "Bring deine Ideen in Logic, Ableton und mehr." },
    ],
    closingH2: "Fang die",
    closingEm: "nächste ein.",
    closingLead: "Kostenlos laden. Dein erster Pro-Monat geht auf uns.",
  },

  pt: {
    name: "Português",
    dir: "ltr",
    title: "SongNook: um canto tranquilo para compor e praticar",
    description:
      "Um canto tranquilo para compor e praticar. O SongNook grava suas ideias de música, mantém tudo organizado, ajuda você a terminá-las e traz de volta as que você esqueceu.",
    getApp: "Baixe o app",
    language: "Idioma",
    support: "Suporte",
    privacy: "Privacidade",
    terms: "Termos",
    appStoreAlt: "Baixar na App Store",
    playAlt: "Disponível no Google Play",
    androidSoon: ["Android", "em breve"],
    heroH1: "Um canto tranquilo para compor",
    heroEm: "e praticar.",
    heroSub: "Para compositores e músicos em atividade. Capture cada ideia, termine suas músicas e aprenda o repertório.",
    heroAlt: "Uma coleção de ideias, as mais novas primeiro, cada uma com sua forma de onda e etapa",
    tourEyebrow: "Como funciona",
    tourH2: "De um cantarolar a uma música pronta",
    tour: [
      { title: "Capture", line: "Grave na hora em que a inspiração chega, e organize do seu jeito.", alt: "Gravando uma nova ideia" },
      { title: "Escreva", line: "Letra e acordes lado a lado, e jogos de escrita para sair do bloqueio. Cada palavra é sua.", alt: "Uma cifra com letra" },
      { title: "Termine", line: "Cada take e cada rascunho da letra ficam guardados, para você sempre poder voltar.", alt: "Uma música com seus takes e versões anteriores" },
      { title: "Não perca nada", line: "Pérolas antigas voltam para você, para nenhuma boa ideia se perder.", alt: "Músicas inacabadas e ideias esquecidas, de volta" },
    ],
    bandEyebrow: "Para a banda",
    bandH2: "Envie a música inteira, não só o áudio",
    bandLead:
      "Exportar entrega à sua banda um arquivo de áudio solto. O SongNook Send entrega a música: a gravação com letra, acordes, partes, momentos marcados e notas.",
    band: [
      { title: "Envie.", line: "Um link privado leva a gravação e tudo o que vem com ela." },
      { title: "Colabore.", line: "Receba o setlist pronto para aprender: partes, notas, letras e tudo." },
      { title: "Toque.", line: "Setlists e cifras, prontos para o palco." },
    ],
    bandAlt: "Uma música de um colega de banda, com letra, cifra e notas",
    learnEyebrow: "Prática",
    learnH2: "Aprenda o repertório antes do show",
    learnLead: "Desacelere as partes difíceis, mude o tom e faça loop de um trecho até ele estar nas suas mãos.",
    cards: {
      loop: "Loop",
      stepUp: "Subida gradual",
      speed: "Velocidade",
      pitch: "Tom",
      verse: "Verso",
      chorus: "Refrão",
      bridge: "Ponte",
      outro: "Outro",
      harmonyHere: "Harmonia aqui",
      meta1: "Harbor Lights • há 2 h • 1 camada",
      meta2: "Album demos • Versão 2",
      meta3: "Harbor Lights • Refrão em loop",
      cap1: ["Toque", "faça loop, desacelere, marque verso e refrão"],
      cap2: ["Cante junto", "letra e acordes rolam com a música"],
      cap3: ["Pratique", "loop na parte difícil, um pouco mais rápido a cada vez"],
    },
    yoursEyebrow: "Privado por natureza",
    yoursH2: "Seu, e só seu",
    yours: [
      { title: "Fica no seu celular", line: "Nunca vemos suas músicas." },
      { title: "Sem conta, sem anúncios", line: "Abra e comece." },
      { title: "Nunca treina IA", line: "Sua música continua sua." },
    ],
    plansEyebrow: "Planos",
    plansH2: "Grátis, com um mês grátis de Pro",
    plansLead: "Todas as ferramentas grátis no primeiro mês, sem cartão. Escrever e guardar suas músicas continua grátis depois disso.",
    freeH3: "Grátis para sempre",
    forever: "para sempre",
    freeNote: "Tudo o que você precisa para escrever e guardar suas músicas.",
    free: ["Grave e organize sem limites", "Letras e cifras", "Backup e exportação", "Um link do SongNook Send por mês"],
    plans: {
      year: { label: "Anual", per: "por ano", note: "Cerca de US$ 2 por mês." },
      month: { label: "Mensal", per: "por mês", note: "Cancele quando quiser." },
      life: { label: "Vitalício", per: "uma vez", note: "Pagamento único. Preço de lançamento para os primeiros." },
    },
    proAdds: [
      { title: "Ferramentas de prática", line: "Desacelere, mude o tom, domine as partes difíceis." },
      { title: "Cifras para o palco", line: "Setlists e cifras em qualquer tom." },
      { title: "Ajuda para escrever", line: "Rimas, sinônimos e jogos para quando você trava." },
      { title: "Compartilhamento sem limite", line: "Quantos links do SongNook Send quiser, e um espaço para cada banda." },
      { title: "Exportação para estúdio", line: "Leve suas ideias para o Logic, o Ableton e mais." },
    ],
    closingH2: "Capture a",
    closingEm: "próxima.",
    closingLead: "Download grátis. Seu primeiro mês de Pro é por nossa conta.",
  },

  he: {
    name: "עברית",
    dir: "rtl",
    title: "SongNook: פינה שקטה לכתיבת שירים ולתרגול",
    description:
      "פינה שקטה לכתיבת שירים ולתרגול. SongNook מקליט את רעיונות השירים שלכם, שומר עליהם מסודרים, עוזר לכם לסיים אותם ומחזיר את אלה ששכחתם.",
    getApp: "להורדת האפליקציה",
    language: "שפה",
    support: "תמיכה",
    privacy: "פרטיות",
    terms: "תנאים",
    appStoreAlt: "להורדה ב-App Store",
    playAlt: "זמין ב-Google Play",
    androidSoon: ["Android", "בקרוב"],
    heroH1: "פינה שקטה לכתיבת שירים",
    heroEm: "ולתרגול.",
    heroSub: "לכותבי שירים ולמוזיקאים פעילים. לתפוס כל רעיון, לסיים את השירים וללמוד את הסט.",
    heroAlt: "אוסף של רעיונות לשירים, החדשים קודם, כל אחד עם גל הקול והשלב שלו",
    tourEyebrow: "איך זה עובד",
    tourH2: "מזמזום לשיר גמור",
    tour: [
      { title: "לתפוס", line: "להקליט ברגע שההשראה מגיעה, ולסדר הכול בדרך שלכם.", alt: "הקלטה של רעיון חדש" },
      { title: "לכתוב", line: "מילים ואקורדים זה לצד זה, ומשחקי כתיבה לשבירת המחסום. כל מילה היא שלכם.", alt: "דף אקורדים עם מילים" },
      { title: "לסיים", line: "כל טייק וכל טיוטה של המילים נשמרים, כך שתמיד אפשר לחזור.", alt: "שיר עם הטייקים והגרסאות הקודמות שלו" },
      { title: "לא לאבד", line: "פנינים ישנות חוזרות אליכם, כך שאף רעיון טוב לא הולך לאיבוד.", alt: "שירים שלא נגמרו ורעיונות שנשכחו, חוזרים" },
    ],
    bandEyebrow: "ללהקה",
    bandH2: "לשלוח את השיר כולו, לא רק את השמע",
    bandLead:
      "ייצוא נותן ללהקה קובץ שמע חשוף. SongNook Send נותן לה את השיר: ההקלטה עם המילים, האקורדים, החלקים, הרגעים המסומנים וההערות.",
    band: [
      { title: "לשלוח.", line: "קישור פרטי אחד נושא את ההקלטה וכל מה שמצורף אליה." },
      { title: "לשתף פעולה.", line: "לקבל את הסט מוכן ללמידה: חלקים, הערות, מילים והכול." },
      { title: "לנגן.", line: "סטליסטים ודפי אקורדים, מוכנים לבמה." },
    ],
    bandAlt: "שיר מחבר להקה, עם המילים, דף האקורדים וההערות",
    learnEyebrow: "תרגול",
    learnH2: "ללמוד את הסט לפני ההופעה",
    learnLead: "להאט את הקטעים הקשים, לשנות סולם ולעשות לופ על קטע עד שהוא יושב בידיים.",
    cards: {
      loop: "לופ",
      stepUp: "האצה הדרגתית",
      speed: "מהירות",
      pitch: "סולם",
      verse: "בית",
      chorus: "פזמון",
      bridge: "גשר",
      outro: "סיום",
      harmonyHere: "כאן הרמוניה",
      meta1: "Harbor Lights • לפני שעתיים • שכבה 1",
      meta2: "Album demos • גרסה 2",
      meta3: "Harbor Lights • הפזמון בלופ",
      cap1: ["לנגן", "לופ, האטה, סימון בית ופזמון"],
      cap2: ["לשיר יחד", "המילים והאקורדים זזים עם השיר"],
      cap3: ["לתרגל", "לופ על החלק הקשה, קצת יותר מהר בכל פעם"],
    },
    yoursEyebrow: "פרטי מהיסוד",
    yoursH2: "שלכם, ורק שלכם",
    yours: [
      { title: "נשאר בטלפון", line: "אנחנו אף פעם לא רואים את השירים שלכם." },
      { title: "בלי חשבון, בלי פרסומות", line: "פותחים ומתחילים." },
      { title: "לא מאמן בינה מלאכותית", line: "המוזיקה שלכם נשארת שלכם." },
    ],
    plansEyebrow: "תוכניות",
    plansH2: "בחינם, עם חודש Pro במתנה",
    plansLead: "כל הכלים בחינם בחודש הראשון, בלי כרטיס אשראי. כתיבה ושמירה של השירים נשארות בחינם גם אחר כך.",
    freeH3: "חינם לתמיד",
    forever: "לתמיד",
    freeNote: "כל מה שצריך כדי לכתוב ולשמור את השירים שלכם.",
    free: ["הקלטה וסידור בלי הגבלה", "מילים ודפי אקורדים", "גיבוי וייצוא", "קישור SongNook Send אחד בחודש"],
    plans: {
      year: { label: "שנתי", per: "לשנה", note: "בערך ‎$2 לחודש." },
      month: { label: "חודשי", per: "לחודש", note: "אפשר לבטל בכל עת." },
      life: { label: "לכל החיים", per: "פעם אחת", note: "תשלום אחד. מחיר השקה למצטרפים הראשונים." },
    },
    proAdds: [
      { title: "כלי תרגול", line: "להאט, לשנות סולם, לשייף את הקטעים הקשים." },
      { title: "דפי אקורדים לבמה", line: "סטליסטים ודפי אקורדים, עם טרנספוזיציה וקאפו." },
      { title: "עזרה בכתיבה", line: "חרוזים, מילים נרדפות ומשחקים לרגעים שנתקעים." },
      { title: "שיתוף בלי הגבלה", line: "כמה קישורי SongNook Send שתרצו, ומקום לכל להקה." },
      { title: "ייצוא לאולפן", line: "להעביר רעיונות ל־Logic, ל־Ableton ועוד." },
    ],
    closingH2: "לתפוס את",
    closingEm: "הרעיון הבא.",
    closingLead: "הורדה בחינם. החודש הראשון של Pro עלינו.",
  },
};
