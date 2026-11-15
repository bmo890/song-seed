/**
 * SongNook Send's two pages (the parcel someone opens, and sending from a computer) in
 * the app's five languages, in the voice of songnook.app (landingI18n.ts). English is
 * the source; app controls keep the app's own words (src/i18n/locales/*). Hebrew
 * addresses the reader in the plural, as the app does.
 *
 * `{name}` placeholders are filled by the page; nothing here is markup.
 */
import type { Lang } from "./landingI18n";

type Plural = { one: string; other: string };

export type SendStrings = {
  // shared chrome
  sendTitle: string;
  holdNote: string;
  tagline: string;
  report: string;
  // the parcel page
  sentYou: string;
  someone: string;
  someMusic: string;
  songs: Plural;
  expiresToday: string;
  daysLeft: Plural;
  moreItems: string;
  openInApp: string;
  newHere: string;
  androidSoon: string;
  scan: string;
  qrLabel: string;
  aboutEyebrow: string;
  aboutH2: string;
  aboutSub: string;
  seeIt: string;
  moreAt: string;
  rawFiles: string;
  download: string;
  opening: string;
  tryAgain: string;
  noKeyHead: string;
  noKeySub: string;
  badKeyHead: string;
  badKeySub: string;
  goneHead: string;
  goneSub: string;
  // sending from a computer
  senderH1: string;
  senderSub: string;
  senderSealed: string;
  pairTitle: string;
  pairSteps: string;
  waiting: string;
  oneMoment: string;
  codeRanOut: string;
  newCode: string;
  tooManyCodes: string;
  noCode: string;
  paired: string;
  freeLeft: Plural;
  unpair: string;
  dropHere: string;
  dropHint: string;
  orChoose: string;
  chooseFiles: string;
  chooseFolder: string;
  dropLabel: string;
  sortAz: string;
  clear: string;
  fileCount: Plural;
  inThisOrder: string;
  whatIsThis: string;
  kindFiles: string;
  kindPlaylist: string;
  kindSetlist: string;
  hintFiles: string;
  hintPlaylist: string;
  hintSetlist: string;
  from: string;
  fromPlaceholder: string;
  titleLabel: string;
  titlePlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  getLink: string;
  sealing: string;
  ready: string;
  copy: string;
  copied: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  packageAlone: string;
  onlyAudio: string;
  freeUsed: string;
  failed: string;
};

export const SEND_STRINGS: Record<Lang, SendStrings> = {
  en: {
    sendTitle: "SongNook Send",
    holdNote: "Files are held for a limited time, then quietly let go.",
    tagline: "SongNook — a quiet corner for songwriting and practice",
    report: "Report",
    sentYou: "{sender} sent you {title}",
    someone: "Someone",
    someMusic: "some music",
    songs: { one: "1 song", other: "{n} songs" },
    expiresToday: "expires today",
    daysLeft: { one: "1 day left", other: "{n} days left" },
    moreItems: "and {n} more",
    openInApp: "Open in SongNook",
    newHere: "New to SongNook? Get it, then open this link again.",
    androidSoon: "SongNook for Android is coming soon.",
    scan: "Scan with your phone to open it in SongNook.",
    qrLabel: "QR code to open this in SongNook",
    aboutEyebrow: "What's SongNook?",
    aboutH2: "A quiet corner for songwriting and practice.",
    aboutSub: "For songwriters and working musicians. Catch every idea, finish your songs, and learn the set.",
    seeIt: "See it in the app",
    moreAt: "More at songnook.app",
    rawFiles: "Prefer the raw files? Download them here.",
    download: "Download",
    opening: "Opening…",
    tryAgain: "Try again",
    noKeyHead: "This link is missing its key.",
    noKeySub: "Ask the sender for the full link, including everything after the #.",
    badKeyHead: "This link's key doesn't fit.",
    badKeySub: "Ask the sender for the full link again.",
    goneHead: "This link isn't available.",
    goneSub: "It may have expired or been removed. Ask the sender for a fresh link.",
    senderH1: "Send songs from your computer",
    senderSub: "Drop in your demos, bounces or a SongNook file, put them in order, and get one private link. Your band opens it in SongNook, or takes the files.",
    senderSealed: "It's sealed in this browser before it leaves: only people with the link can open it, not even SongNook.",
    pairTitle: "Pair this browser",
    pairSteps: "Sending from a computer works through your SongNook app. On your phone, open SongNook, then Settings, Data & storage, Send from a computer, and type this code.",
    waiting: "Waiting for your phone…",
    oneMoment: "One moment…",
    codeRanOut: "This code ran out.",
    newCode: "New code",
    tooManyCodes: "Too many codes. Wait a minute, then try again.",
    noCode: "Could not get a code.",
    paired: "Paired with your SongNook app",
    freeLeft: { one: "1 free link left this month", other: "{n} free links left this month" },
    unpair: "Unpair this browser",
    dropHere: "Drop your music here",
    dropHint: "Files or a whole folder: audio and SongNook files, up to 1 GB",
    orChoose: "or",
    chooseFiles: "choose files",
    chooseFolder: "choose a folder",
    dropLabel: "Choose files or a folder to send",
    sortAz: "Sort A–Z",
    clear: "Clear",
    fileCount: { one: "1 file", other: "{n} files" },
    inThisOrder: "in this order",
    whatIsThis: "What is this?",
    kindFiles: "Files",
    kindPlaylist: "Playlist",
    kindSetlist: "Setlist",
    hintFiles: "Loose files. They arrive as they are.",
    hintPlaylist: "Arrives in SongNook as a playlist, in this order.",
    hintSetlist: "Arrives in SongNook as a setlist, in this order, ready for the band.",
    from: "From",
    fromPlaceholder: "Your name",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Spring show stems",
    noteLabel: "A note, if you like",
    notePlaceholder: "e.g. Learn the second one first…",
    getLink: "Get the link",
    sealing: "Sealing…",
    ready: "Your link is ready. It quietly expires in 7 days.",
    copy: "Copy",
    copied: "Copied",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    packageAlone: "Send a SongNook file on its own, or audio files together.",
    onlyAudio: "Only audio ({list}) and SongNook files can be sent. Skipped: {files}",
    freeUsed: "This month's free link is used. SongNook Pro sends without limit.",
    failed: "Nothing was sent ({reason}). Try again.",
  },

  es: {
    sendTitle: "SongNook Send",
    holdNote: "Los archivos se guardan por un tiempo limitado y luego se borran.",
    tagline: "SongNook: un rincón tranquilo para componer y practicar",
    report: "Denunciar",
    sentYou: "{sender} te envió {title}",
    someone: "Alguien",
    someMusic: "música",
    songs: { one: "1 canción", other: "{n} canciones" },
    expiresToday: "vence hoy",
    daysLeft: { one: "queda 1 día", other: "quedan {n} días" },
    moreItems: "y {n} más",
    openInApp: "Abrir en SongNook",
    newHere: "¿Nuevo en SongNook? Descárgala y vuelve a abrir este enlace.",
    androidSoon: "SongNook para Android llega muy pronto.",
    scan: "Escanéalo con tu teléfono para abrirlo en SongNook.",
    qrLabel: "Código QR para abrir esto en SongNook",
    aboutEyebrow: "¿Qué es SongNook?",
    aboutH2: "Un rincón tranquilo para componer y practicar.",
    aboutSub: "Para compositores y músicos en activo. Atrapa cada idea, termina tus canciones y apréndete el set.",
    seeIt: "Míralo en la app",
    moreAt: "Más en songnook.app",
    rawFiles: "¿Prefieres los archivos? Descárgalos aquí.",
    download: "Descargar",
    opening: "Abriendo…",
    tryAgain: "Reintentar",
    noKeyHead: "A este enlace le falta su clave.",
    noKeySub: "Pide a quien lo envió el enlace completo, incluido todo lo que va después del #.",
    badKeyHead: "La clave de este enlace no coincide.",
    badKeySub: "Pide a quien lo envió el enlace completo otra vez.",
    goneHead: "Este enlace no está disponible.",
    goneSub: "Puede que haya vencido o que lo hayan quitado. Pide un enlace nuevo.",
    senderH1: "Envía canciones desde tu computadora",
    senderSub: "Suelta tus demos, mezclas o un archivo de SongNook, ponlos en orden y obtén un enlace privado. Tu banda lo abre en SongNook o se lleva los archivos.",
    senderSealed: "Se sella en este navegador antes de salir: solo quien tenga el enlace puede abrirlo, ni siquiera SongNook.",
    pairTitle: "Vincula este navegador",
    pairSteps: "Enviar desde la computadora funciona a través de tu app SongNook. En tu teléfono, abre SongNook, luego Ajustes, Datos y almacenamiento, Enviar desde el navegador, y escribe este código.",
    waiting: "Esperando a tu teléfono…",
    oneMoment: "Un momento…",
    codeRanOut: "Este código venció.",
    newCode: "Código nuevo",
    tooManyCodes: "Demasiados códigos. Espera un minuto y vuelve a intentarlo.",
    noCode: "No se pudo obtener un código.",
    paired: "Vinculado con tu app SongNook",
    freeLeft: { one: "Te queda 1 enlace gratis este mes", other: "Te quedan {n} enlaces gratis este mes" },
    unpair: "Desvincular este navegador",
    dropHere: "Suelta tu música aquí",
    dropHint: "Archivos o una carpeta entera: audio y archivos de SongNook, hasta 1 GB",
    orChoose: "o",
    chooseFiles: "elige archivos",
    chooseFolder: "elige una carpeta",
    dropLabel: "Elige archivos o una carpeta para enviar",
    sortAz: "Ordenar A–Z",
    clear: "Vaciar",
    fileCount: { one: "1 archivo", other: "{n} archivos" },
    inThisOrder: "en este orden",
    whatIsThis: "¿Qué es esto?",
    kindFiles: "Archivos",
    kindPlaylist: "Playlist",
    kindSetlist: "Setlist",
    hintFiles: "Archivos sueltos. Llegan tal cual.",
    hintPlaylist: "Llega a SongNook como una playlist, en este orden.",
    hintSetlist: "Llega a SongNook como un setlist, en este orden, listo para la banda.",
    from: "De",
    fromPlaceholder: "Tu nombre",
    titleLabel: "Título",
    titlePlaceholder: "p. ej. Pistas del show de primavera",
    noteLabel: "Una nota, si quieres",
    notePlaceholder: "p. ej. Aprende primero la segunda…",
    getLink: "Obtener el enlace",
    sealing: "Sellando…",
    ready: "Tu enlace está listo. Vence en 7 días.",
    copy: "Copiar",
    copied: "Copiado",
    moveUp: "Subir",
    moveDown: "Bajar",
    remove: "Quitar",
    packageAlone: "Envía un archivo de SongNook solo, o archivos de audio juntos.",
    onlyAudio: "Solo se pueden enviar audio ({list}) y archivos de SongNook. Omitidos: {files}",
    freeUsed: "Ya usaste el enlace gratis de este mes. SongNook Pro envía sin límite.",
    failed: "No se envió nada ({reason}). Vuelve a intentarlo.",
  },

  de: {
    sendTitle: "SongNook Send",
    holdNote: "Dateien werden eine begrenzte Zeit aufbewahrt und dann still gelöscht.",
    tagline: "SongNook – ein stiller Winkel zum Songschreiben und Üben",
    report: "Melden",
    sentYou: "{sender} hat dir {title} geschickt",
    someone: "Jemand",
    someMusic: "Musik",
    songs: { one: "1 Song", other: "{n} Songs" },
    expiresToday: "läuft heute ab",
    daysLeft: { one: "noch 1 Tag", other: "noch {n} Tage" },
    moreItems: "und {n} weitere",
    openInApp: "In SongNook öffnen",
    newHere: "Neu bei SongNook? Hol dir die App und öffne diesen Link noch einmal.",
    androidSoon: "SongNook für Android kommt bald.",
    scan: "Scanne den Code mit dem Handy, um es in SongNook zu öffnen.",
    qrLabel: "QR-Code, um dies in SongNook zu öffnen",
    aboutEyebrow: "Was ist SongNook?",
    aboutH2: "Ein stiller Winkel zum Songschreiben und Üben.",
    aboutSub: "Für Songwriter und aktive Musiker. Halte jede Idee fest, mach deine Songs fertig und lern das Set.",
    seeIt: "So sieht es in der App aus",
    moreAt: "Mehr auf songnook.app",
    rawFiles: "Lieber die Dateien? Hier herunterladen.",
    download: "Laden",
    opening: "Wird geöffnet…",
    tryAgain: "Erneut",
    noKeyHead: "Diesem Link fehlt sein Schlüssel.",
    noKeySub: "Bitte um den vollständigen Link, mit allem nach dem #.",
    badKeyHead: "Der Schlüssel dieses Links passt nicht.",
    badKeySub: "Bitte noch einmal um den vollständigen Link.",
    goneHead: "Dieser Link ist nicht verfügbar.",
    goneSub: "Er ist vielleicht abgelaufen oder wurde entfernt. Bitte um einen neuen Link.",
    senderH1: "Songs vom Computer senden",
    senderSub: "Leg deine Demos, Bounces oder eine SongNook-Datei ab, bring sie in Reihenfolge und erhalte einen privaten Link. Deine Band öffnet ihn in SongNook oder lädt die Dateien.",
    senderSealed: "Er wird in diesem Browser versiegelt, bevor er rausgeht: Nur wer den Link hat, kann ihn öffnen, nicht einmal SongNook.",
    pairTitle: "Diesen Browser koppeln",
    pairSteps: "Senden vom Computer läuft über deine SongNook-App. Öffne auf dem Handy SongNook, dann Einstellungen, Daten & Speicher, Vom Computer senden, und gib diesen Code ein.",
    waiting: "Warte auf dein Handy…",
    oneMoment: "Einen Moment…",
    codeRanOut: "Dieser Code ist abgelaufen.",
    newCode: "Neuer Code",
    tooManyCodes: "Zu viele Codes. Warte eine Minute und versuch es erneut.",
    noCode: "Kein Code erhalten.",
    paired: "Mit deiner SongNook-App gekoppelt",
    freeLeft: { one: "Noch 1 kostenloser Link diesen Monat", other: "Noch {n} kostenlose Links diesen Monat" },
    unpair: "Kopplung aufheben",
    dropHere: "Leg deine Musik hier ab",
    dropHint: "Dateien oder ein ganzer Ordner: Audio- und SongNook-Dateien, bis 1 GB",
    orChoose: "oder",
    chooseFiles: "Dateien wählen",
    chooseFolder: "Ordner wählen",
    dropLabel: "Dateien oder einen Ordner zum Senden wählen",
    sortAz: "A–Z sortieren",
    clear: "Leeren",
    fileCount: { one: "1 Datei", other: "{n} Dateien" },
    inThisOrder: "in dieser Reihenfolge",
    whatIsThis: "Was ist das?",
    kindFiles: "Dateien",
    kindPlaylist: "Playlist",
    kindSetlist: "Setlist",
    hintFiles: "Lose Dateien. Sie kommen an, wie sie sind.",
    hintPlaylist: "Kommt in SongNook als Playlist an, in dieser Reihenfolge.",
    hintSetlist: "Kommt in SongNook als Setlist an, in dieser Reihenfolge, bereit für die Band.",
    from: "Von",
    fromPlaceholder: "Dein Name",
    titleLabel: "Titel",
    titlePlaceholder: "z. B. Stems fürs Frühjahrskonzert",
    noteLabel: "Eine Notiz, wenn du magst",
    notePlaceholder: "z. B. Lern zuerst den zweiten…",
    getLink: "Link erstellen",
    sealing: "Wird versiegelt…",
    ready: "Dein Link ist fertig. Er läuft in 7 Tagen ab.",
    copy: "Kopieren",
    copied: "Kopiert",
    moveUp: "Nach oben",
    moveDown: "Nach unten",
    remove: "Entfernen",
    packageAlone: "Sende eine SongNook-Datei allein oder Audiodateien zusammen.",
    onlyAudio: "Nur Audio ({list}) und SongNook-Dateien können gesendet werden. Übersprungen: {files}",
    freeUsed: "Der kostenlose Link dieses Monats ist verbraucht. SongNook Pro sendet ohne Limit.",
    failed: "Nichts wurde gesendet ({reason}). Versuch es erneut.",
  },

  pt: {
    sendTitle: "SongNook Send",
    holdNote: "Os arquivos ficam guardados por um tempo limitado e depois são apagados.",
    tagline: "SongNook: um canto tranquilo para compor e praticar",
    report: "Denunciar",
    sentYou: "{sender} enviou {title} para você",
    someone: "Alguém",
    someMusic: "música",
    songs: { one: "1 música", other: "{n} músicas" },
    expiresToday: "expira hoje",
    daysLeft: { one: "falta 1 dia", other: "faltam {n} dias" },
    moreItems: "e mais {n}",
    openInApp: "Abrir no SongNook",
    newHere: "Novo no SongNook? Baixe o app e abra este link de novo.",
    androidSoon: "O SongNook para Android chega em breve.",
    scan: "Escaneie com o celular para abrir no SongNook.",
    qrLabel: "Código QR para abrir isto no SongNook",
    aboutEyebrow: "O que é o SongNook?",
    aboutH2: "Um canto tranquilo para compor e praticar.",
    aboutSub: "Para compositores e músicos em atividade. Capture cada ideia, termine suas músicas e aprenda o repertório.",
    seeIt: "Veja no app",
    moreAt: "Mais em songnook.app",
    rawFiles: "Prefere os arquivos? Baixe aqui.",
    download: "Baixar",
    opening: "Abrindo…",
    tryAgain: "Tentar de novo",
    noKeyHead: "Falta a chave deste link.",
    noKeySub: "Peça o link completo, incluindo tudo depois do #.",
    badKeyHead: "A chave deste link não confere.",
    badKeySub: "Peça o link completo de novo.",
    goneHead: "Este link não está disponível.",
    goneSub: "Ele pode ter expirado ou sido removido. Peça um link novo.",
    senderH1: "Envie músicas do computador",
    senderSub: "Solte suas demos, mixagens ou um arquivo do SongNook, coloque em ordem e receba um link privado. Sua banda abre no SongNook ou baixa os arquivos.",
    senderSealed: "Ele é selado neste navegador antes de sair: só quem tem o link pode abrir, nem mesmo o SongNook.",
    pairTitle: "Pareie este navegador",
    pairSteps: "Enviar do computador funciona pelo seu app SongNook. No celular, abra o SongNook, depois Ajustes, Dados e armazenamento, Enviar do computador, e digite este código.",
    waiting: "Esperando seu celular…",
    oneMoment: "Um momento…",
    codeRanOut: "Este código expirou.",
    newCode: "Novo código",
    tooManyCodes: "Códigos demais. Espere um minuto e tente de novo.",
    noCode: "Não foi possível obter um código.",
    paired: "Pareado com seu app SongNook",
    freeLeft: { one: "Resta 1 link grátis este mês", other: "Restam {n} links grátis este mês" },
    unpair: "Desparear este navegador",
    dropHere: "Solte sua música aqui",
    dropHint: "Arquivos ou uma pasta inteira: áudio e arquivos do SongNook, até 1 GB",
    orChoose: "ou",
    chooseFiles: "escolha arquivos",
    chooseFolder: "escolha uma pasta",
    dropLabel: "Escolha arquivos ou uma pasta para enviar",
    sortAz: "Ordenar A–Z",
    clear: "Limpar",
    fileCount: { one: "1 arquivo", other: "{n} arquivos" },
    inThisOrder: "nesta ordem",
    whatIsThis: "O que é isto?",
    kindFiles: "Arquivos",
    kindPlaylist: "Playlist",
    kindSetlist: "Setlist",
    hintFiles: "Arquivos soltos. Chegam como estão.",
    hintPlaylist: "Chega no SongNook como uma playlist, nesta ordem.",
    hintSetlist: "Chega no SongNook como um setlist, nesta ordem, pronto para a banda.",
    from: "De",
    fromPlaceholder: "Seu nome",
    titleLabel: "Título",
    titlePlaceholder: "ex.: Stems do show de primavera",
    noteLabel: "Um recado, se quiser",
    notePlaceholder: "ex.: Aprenda a segunda primeiro…",
    getLink: "Gerar o link",
    sealing: "Selando…",
    ready: "Seu link está pronto. Ele expira em 7 dias.",
    copy: "Copiar",
    copied: "Copiado",
    moveUp: "Subir",
    moveDown: "Descer",
    remove: "Remover",
    packageAlone: "Envie um arquivo do SongNook sozinho, ou arquivos de áudio juntos.",
    onlyAudio: "Só áudio ({list}) e arquivos do SongNook podem ser enviados. Ignorados: {files}",
    freeUsed: "O link grátis deste mês já foi usado. O SongNook Pro envia sem limite.",
    failed: "Nada foi enviado ({reason}). Tente de novo.",
  },

  he: {
    sendTitle: "SongNook Send",
    holdNote: "הקבצים נשמרים לזמן מוגבל, ואז נמחקים בשקט.",
    tagline: "SongNook: פינה שקטה לכתיבת שירים ולתרגול",
    report: "דיווח",
    sentYou: "{sender} שלח/ה לך את {title}",
    someone: "מישהו",
    someMusic: "מוזיקה",
    songs: { one: "שיר אחד", other: "{n} שירים" },
    expiresToday: "פג היום",
    daysLeft: { one: "נשאר יום אחד", other: "נשארו {n} ימים" },
    moreItems: "ועוד {n}",
    openInApp: "פתיחה ב־SongNook",
    newHere: "חדשים ב־SongNook? הורידו את האפליקציה ופתחו שוב את הקישור.",
    androidSoon: "SongNook לאנדרואיד יגיע בקרוב.",
    scan: "סרקו עם הטלפון כדי לפתוח ב־SongNook.",
    qrLabel: "קוד QR לפתיחה ב־SongNook",
    aboutEyebrow: "מה זה SongNook?",
    aboutH2: "פינה שקטה לכתיבת שירים ולתרגול.",
    aboutSub: "לכותבי שירים ולמוזיקאים פעילים. לתפוס כל רעיון, לסיים את השירים וללמוד את הסט.",
    seeIt: "ככה זה נראה באפליקציה",
    moreAt: "עוד ב־songnook.app",
    rawFiles: "מעדיפים את הקבצים? הורידו אותם כאן.",
    download: "הורדה",
    opening: "פותח…",
    tryAgain: "שוב",
    noKeyHead: "לקישור הזה חסר המפתח.",
    noKeySub: "בקשו את הקישור המלא, כולל כל מה שאחרי ה־#.",
    badKeyHead: "המפתח של הקישור לא מתאים.",
    badKeySub: "בקשו שוב את הקישור המלא.",
    goneHead: "הקישור הזה לא זמין.",
    goneSub: "ייתכן שפג תוקפו או שהוסר. בקשו קישור חדש.",
    senderH1: "שליחת שירים מהמחשב",
    senderSub: "גררו לכאן דמו, מיקסים או קובץ SongNook, סדרו אותם וקבלו קישור פרטי אחד. הלהקה פותחת אותו ב־SongNook, או מורידה את הקבצים.",
    senderSealed: "הוא נחתם בדפדפן הזה לפני שהוא יוצא: רק מי שיש לו את הקישור יכול לפתוח, אפילו לא SongNook.",
    pairTitle: "חיבור הדפדפן",
    pairSteps: "שליחה מהמחשב עובדת דרך אפליקציית SongNook. בטלפון, פתחו את SongNook, ואז הגדרות, נתונים ואחסון, שליחה מהמחשב, והקלידו את הקוד הזה.",
    waiting: "ממתין לטלפון שלכם…",
    oneMoment: "רגע…",
    codeRanOut: "הקוד הזה פג.",
    newCode: "קוד חדש",
    tooManyCodes: "יותר מדי קודים. חכו דקה ונסו שוב.",
    noCode: "לא ניתן לקבל קוד.",
    paired: "מחובר לאפליקציית SongNook שלכם",
    freeLeft: { one: "נשאר קישור חינמי אחד החודש", other: "נשארו {n} קישורים חינמיים החודש" },
    unpair: "ניתוק הדפדפן",
    dropHere: "גררו את המוזיקה לכאן",
    dropHint: "קבצים או תיקייה שלמה: קובצי שמע וקובצי SongNook, עד 1GB",
    orChoose: "או",
    chooseFiles: "בחירת קבצים",
    chooseFolder: "בחירת תיקייה",
    dropLabel: "בחירת קבצים או תיקייה לשליחה",
    sortAz: "מיון א–ת",
    clear: "ניקוי",
    fileCount: { one: "קובץ אחד", other: "{n} קבצים" },
    inThisOrder: "בסדר הזה",
    whatIsThis: "מה זה?",
    kindFiles: "קבצים",
    kindPlaylist: "פלייליסט",
    kindSetlist: "סטליסט",
    hintFiles: "קבצים בודדים. מגיעים כמו שהם.",
    hintPlaylist: "מגיע ל־SongNook כפלייליסט, בסדר הזה.",
    hintSetlist: "מגיע ל־SongNook כסטליסט, בסדר הזה, מוכן ללהקה.",
    from: "מאת",
    fromPlaceholder: "השם שלכם",
    titleLabel: "כותרת",
    titlePlaceholder: "למשל: ערוצים להופעת האביב",
    noteLabel: "הערה, אם תרצו",
    notePlaceholder: "למשל: תלמדו קודם את השני…",
    getLink: "יצירת קישור",
    sealing: "חותם…",
    ready: "הקישור מוכן. הוא יפוג בעוד 7 ימים.",
    copy: "העתקה",
    copied: "הועתק",
    moveUp: "למעלה",
    moveDown: "למטה",
    remove: "הסרה",
    packageAlone: "שלחו קובץ SongNook לבד, או קובצי שמע יחד.",
    onlyAudio: "אפשר לשלוח רק קובצי שמע ({list}) וקובצי SongNook. דולגו: {files}",
    freeUsed: "הקישור החינמי של החודש כבר נוצל. SongNook Pro שולח בלי הגבלה.",
    failed: "שום דבר לא נשלח ({reason}). נסו שוב.",
  },
};

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export const plural = (p: Plural, n: number) => fill(n === 1 ? p.one : p.other, { n });
