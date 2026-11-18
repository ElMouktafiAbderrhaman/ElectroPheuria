// Moroccan cities and towns used by the checkout city selector.
// Each entry: [canonical name, Arabic name, ...spelling variants].
// The canonical name is what gets saved with the order.
const RAW_CITIES = [
  // Casablanca-Settat
  ["Casablanca", "الدار البيضاء", "Casa", "Dar El Beida", "Dar Bayda", "Kazablanka"],
  ["Mohammédia", "المحمدية", "Mohammedia", "Fedala"],
  ["El Jadida", "الجديدة", "Jdida", "Mazagan"],
  ["Settat", "سطات"],
  ["Berrechid", "برشيد", "Berchid"],
  ["Benslimane", "بنسليمان", "Ben Slimane"],
  ["Bouskoura", "بوسكورة"],
  ["Nouaceur", "النواصر", "Nouasseur"],
  ["Médiouna", "مديونة", "Mediouna"],
  ["Dar Bouazza", "دار بوعزة"],
  ["Tit Mellil", "تيط مليل", "Tit Melil"],
  ["Aïn Harrouda", "عين حرودة", "Ain Harrouda"],
  ["Azemmour", "أزمور", "Azemour"],
  ["Sidi Bennour", "سيدي بنور"],
  ["Bir Jdid", "البئر الجديد", "Bir Jdide"],
  ["Had Soualem", "حد السوالم", "Had Swalem"],
  ["Ben Ahmed", "ابن أحمد", "Ibn Ahmed"],
  ["El Gara", "الكارة"],
  ["Deroua", "الدروة"],
  ["Bouznika", "بوزنيقة"],
  ["Oulad Frej", "أولاد افرج", "Ouled Frej"],
  ["Sidi Rahal Chatai", "سيدي رحال الشاطئ", "Sidi Rahal Plage"],
  ["Lahraouyine", "الهراويين", "Lahraouiyine"],
  ["El Borouj", "البروج"],
  ["Oualidia", "الوليدية", "Walidia"],
  ["Zemamra", "الزمامرة"],
  ["Sidi Smaïl", "سيدي إسماعيل", "Sidi Smail", "Sidi Ismail"],
  ["Oulad Abbou", "أولاد عبو"],

  // Rabat-Salé-Kénitra
  ["Rabat", "الرباط", "Ribat"],
  ["Salé", "سلا", "Sale", "Sla"],
  ["Kénitra", "القنيطرة", "Kenitra", "Knitra"],
  ["Témara", "تمارة", "Temara"],
  ["Skhirat", "الصخيرات", "Skhirate"],
  ["Harhoura", "الهرهورة"],
  ["Tamesna", "تامسنا"],
  ["Aïn Aouda", "عين عودة", "Ain Aouda"],
  ["Khémisset", "الخميسات", "Khemisset"],
  ["Tiflet", "تيفلت"],
  ["Rommani", "الرماني", "Romani"],
  ["Oulmès", "والماس", "Oulmes"],
  ["Sidi Allal El Bahraoui", "سيدي علال البحراوي"],
  ["Sidi Kacem", "سيدي قاسم", "Sidi Qacem"],
  ["Sidi Slimane", "سيدي سليمان"],
  ["Sidi Yahya El Gharb", "سيدي يحيى الغرب", "Sidi Yahia"],
  ["Souk El Arbaa", "سوق الأربعاء الغرب", "Souk Larbaa", "Souk Larbaa El Gharb"],
  ["Mechra Bel Ksiri", "مشرع بلقصيري", "Mechraa Bel Ksiri"],
  ["Mehdia", "المهدية", "Mehdiya"],
  ["Sidi Bouknadel", "سيدي بوقنادل", "Bouknadel"],
  ["Jorf El Melha", "جرف الملحة"],

  // Tanger-Tétouan-Al Hoceïma
  ["Tanger", "طنجة", "Tangier", "Tanger", "Tanja", "Tangiers"],
  ["Tétouan", "تطوان", "Tetouan", "Tetuan", "Titwan"],
  ["Al Hoceïma", "الحسيمة", "Al Hoceima", "Hoceima", "Alhucemas", "Lhoceima"],
  ["Larache", "العرائش", "Laarache", "Laraiche"],
  ["Ksar El Kébir", "القصر الكبير", "Ksar El Kebir", "Ksar Kbir", "Alcazarquivir"],
  ["Asilah", "أصيلة", "Assilah", "Arzila"],
  ["Chefchaouen", "شفشاون", "Chaouen", "Chefchaouene", "Chaouene"],
  ["Ouazzane", "وزان", "Ouezzane", "Wazzan"],
  ["Fnideq", "الفنيدق", "Fnidek", "Castillejos"],
  ["M'diq", "المضيق", "Mdiq", "Mdik"],
  ["Martil", "مرتيل", "Martile"],
  ["Imzouren", "إمزورن"],
  ["Targuist", "تارجيست", "Targist"],
  ["Bni Bouayach", "بني بوعياش", "Beni Bouayach"],
  ["Oued Laou", "واد لاو"],
  ["Ksar Sghir", "القصر الصغير", "Ksar Seghir"],

  // Oriental
  ["Oujda", "وجدة", "Wajda", "Oujda Angad"],
  ["Nador", "الناظور"],
  ["Berkane", "بركان"],
  ["Taourirt", "تاوريرت"],
  ["Guercif", "جرسيف", "Guersif"],
  ["Jerada", "جرادة"],
  ["Figuig", "فكيك", "Figig"],
  ["Bouarfa", "بوعرفة"],
  ["Saïdia", "السعيدية", "Saidia"],
  ["Zaïo", "زايو", "Zaio"],
  ["Driouch", "الدريوش"],
  ["Selouane", "سلوان"],
  ["Al Aroui", "العروي", "Laaroui", "El Aroui"],
  ["Beni Ansar", "بني انصار", "Bni Ansar"],
  ["Ahfir", "أحفير"],
  ["Aïn Bni Mathar", "عين بني مطهر", "Ain Beni Mathar"],
  ["El Aïoun Sidi Mellouk", "العيون سيدي ملوك", "El Aioun", "Laayoun Charkia"],
  ["Midar", "ميضار"],
  ["Ben Taïeb", "بن الطيب", "Ben Taieb"],
  ["Debdou", "دبدو"],

  // Fès-Meknès
  ["Fès", "فاس", "Fes", "Fez"],
  ["Meknès", "مكناس", "Meknes", "Miknas"],
  ["Taza", "تازة"],
  ["Sefrou", "صفرو"],
  ["Ifrane", "إفران", "Ifran"],
  ["Azrou", "أزرو"],
  ["El Hajeb", "الحاجب"],
  ["Moulay Yacoub", "مولاي يعقوب", "Moulay Yaacoub"],
  ["Taounate", "تاونات"],
  ["Missour", "ميسور"],
  ["Boulemane", "بولمان"],
  ["Outat El Haj", "أوطاط الحاج"],
  ["Imouzzer Kandar", "إيموزار كندر", "Imouzer Kandar"],
  ["Bhalil", "البهاليل"],
  ["Tahla", "تاهلة"],
  ["Karia Ba Mohamed", "قرية با محمد", "Karia"],
  ["Aïn Taoujdate", "عين تاوجطات", "Ain Taoujdate"],
  ["Moulay Idriss Zerhoun", "مولاي إدريس زرهون", "Moulay Driss"],
  ["Aïn Chkef", "عين الشقف", "Ain Chkef"],
  ["Ribat El Kheir", "رباط الخير"],
  ["Tissa", "تيسة"],
  ["Ghafsaï", "غفساي", "Ghafsai"],
  ["Aknoul", "أكنول"],

  // Béni Mellal-Khénifra
  ["Béni Mellal", "بني ملال", "Beni Mellal", "Bni Mellal"],
  ["Khouribga", "خريبكة"],
  ["Khénifra", "خنيفرة", "Khenifra"],
  ["Fquih Ben Salah", "الفقيه بن صالح", "Fkih Ben Salah", "Fkih Ben Saleh"],
  ["Azilal", "أزيلال"],
  ["Kasba Tadla", "قصبة تادلة", "Kasbah Tadla"],
  ["Oued Zem", "وادي زم"],
  ["Souk Sebt Oulad Nemma", "سوق السبت أولاد النمة", "Souk Sebt"],
  ["Boujad", "أبي الجعد", "Bejaad", "Abi Al Jaad"],
  ["M'rirt", "مريرت", "Mrirt"],
  ["Demnate", "دمنات"],
  ["El Ksiba", "القصيبة"],
  ["Zaouiat Cheikh", "زاوية الشيخ", "Zaouia Cheikh"],
  ["Ouled Ayad", "أولاد عياد", "Oulad Ayad"],

  // Marrakech-Safi
  ["Marrakech", "مراكش", "Marrakesh", "Kech"],
  ["Safi", "آسفي", "Asfi"],
  ["Essaouira", "الصويرة", "Mogador", "Souira"],
  ["El Kelâa des Sraghna", "قلعة السراغنة", "Kelaa Sraghna", "El Kelaa"],
  ["Youssoufia", "اليوسفية", "Louis Gentil"],
  ["Ben Guerir", "ابن جرير", "Benguerir", "Ibn Guerir"],
  ["Chichaoua", "شيشاوة"],
  ["Tahannaout", "تحناوت"],
  ["Amizmiz", "أمزميز"],
  ["Aït Ourir", "أيت أورير", "Ait Ourir"],
  ["Tamansourt", "تامنصورت"],
  ["Tameslouht", "تامصلوحت"],
  ["Chemaïa", "الشماعية", "Chemaia"],
  ["Jemâa Shaim", "جمعة سحيم", "Jemaa Shaim", "Sahim"],
  ["Sebt Gzoula", "سبت كزولة"],
  ["Tamanar", "تمنار"],
  ["Imintanoute", "إمنتانوت"],
  ["Sidi Rahhal", "سيدي رحال"],
  ["Attaouia", "العطاوية"],
  ["Tamellalt", "تملالت"],

  // Drâa-Tafilalet
  ["Errachidia", "الرشيدية", "Rachidia", "Ksar Es Souk"],
  ["Ouarzazate", "ورزازات", "Warzazat"],
  ["Zagora", "زاكورة"],
  ["Tinghir", "تنغير", "Tineghir"],
  ["Midelt", "ميدلت"],
  ["Rissani", "الريصاني"],
  ["Erfoud", "أرفود"],
  ["Goulmima", "كلميمة"],
  ["Boumalne Dadès", "بومالن دادس", "Boumalne Dades", "Dades"],
  ["Kelaat M'Gouna", "قلعة مكونة", "Kelaa Mgouna"],
  ["Agdz", "أكدز"],
  ["Tinejdad", "تنجداد"],
  ["Rich", "الريش", "Errich"],
  ["Merzouga", "مرزوكة"],
  ["Taznakht", "تازناخت"],
  ["Imilchil", "إملشيل"],
  ["M'Hamid El Ghizlane", "امحاميد الغزلان", "Mhamid"],
  ["Tazarine", "تازارين"],
  ["Alnif", "ألنيف"],

  // Souss-Massa
  ["Agadir", "أكادير", "Agadir Ida Outanane"],
  ["Inezgane", "إنزكان"],
  ["Aït Melloul", "أيت ملول", "Ait Melloul"],
  ["Dcheira El Jihadia", "الدشيرة الجهادية", "Dcheira"],
  ["Taroudant", "تارودانت", "Taroudannt"],
  ["Tiznit", "تزنيت"],
  ["Oulad Teima", "أولاد تايمة", "Houara", "Ouled Teima"],
  ["Biougra", "بيوكرى"],
  ["Aït Baha", "آيت باها", "Ait Baha"],
  ["Tata", "طاطا"],
  ["Taliouine", "تالوين"],
  ["Tafraout", "تافراوت"],
  ["Taghazout", "تغازوت"],
  ["Massa", "ماسة"],
  ["Drarga", "الدراركة"],
  ["Temsia", "تمسية"],
  ["Lqliâa", "القليعة", "Lqliaa", "El Qliaa"],
  ["Aït Iaaza", "آيت إيعزة", "Ait Iaaza"],
  ["Igherm", "إغرم"],
  ["Akka", "أقا"],
  ["Foum Zguid", "فم زكيد"],
  ["Belfaa", "بلفاع"],
  ["Sidi Bibi", "سيدي بيبي"],

  // Guelmim-Oued Noun
  ["Guelmim", "كلميم", "Goulimine"],
  ["Tan-Tan", "طانطان", "Tantan"],
  ["El Ouatia", "الوطية", "Tan-Tan Plage"],
  ["Sidi Ifni", "سيدي إفني", "Ifni"],
  ["Assa", "أسا"],
  ["Zag", "الزاك"],
  ["Bouizakarne", "بويزكارن"],

  // Laâyoune-Sakia El Hamra
  ["Laâyoune", "العيون", "Laayoune", "El Aaiun", "Layoune"],
  ["El Marsa", "المرسى", "Laayoune Plage"],
  ["Boujdour", "بوجدور"],
  ["Tarfaya", "طرفاية"],
  ["Es-Semara", "السمارة", "Smara", "Semara"],

  // Dakhla-Oued Ed-Dahab
  ["Dakhla", "الداخلة", "Villa Cisneros"],
  ["Aousserd", "أوسرد"],
  ["Bir Gandouz", "بئر كندوز"],
  ["Guerguerat", "الكركرات"],
];

/** Lowercase, strip Latin accents and Arabic diacritics, unify letter variants. */
export function normalizeCity(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ٰٟـ]/g, "") // Arabic tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/['’`\-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const compact = (s) => s.replace(/ /g, "");

export const MOROCCAN_CITIES = RAW_CITIES.map(([name, ar, ...aliases]) => {
  const terms = [name, ar, ...aliases].map(normalizeCity);
  return {
    name,
    ar,
    terms,
    compactTerms: terms.map(compact),
    words: terms.flatMap((t) => t.split(" ")),
  };
}).sort((a, b) => a.name.localeCompare(b.name, "fr"));

/** Returns the canonical city entry if `input` is an exact name/alias match. */
export function findCity(input) {
  const q = normalizeCity(input);
  if (!q) return null;
  const cq = compact(q);
  return MOROCCAN_CITIES.find((c) => c.compactTerms.includes(cq)) || null;
}

/**
 * Ranked search: full-name prefix > word prefix > substring.
 * Spaces/hyphens are ignored so "eljad" finds "El Jadida".
 */
export function searchCities(input, limit = 50) {
  const q = normalizeCity(input);
  if (!q) return MOROCCAN_CITIES.slice(0, limit);
  const cq = compact(q);

  const scored = [];
  for (const city of MOROCCAN_CITIES) {
    let score = 0;
    if (city.compactTerms[0].startsWith(cq)) score = 4;
    else if (city.compactTerms.some((t) => t.startsWith(cq))) score = 3;
    else if (city.words.some((w) => w.startsWith(q))) score = 2;
    else if (city.compactTerms.some((t) => t.includes(cq))) score = 1;
    if (score) scored.push({ city, score });
  }
  scored.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, "fr"));
  return scored.slice(0, limit).map((s) => s.city);
}
