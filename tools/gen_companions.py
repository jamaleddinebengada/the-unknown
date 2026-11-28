# Generates 100 fictional AI companion characters for WhoIsFree (deterministic).
import json, random, itertools
R = random.Random(20261128)

NAMES = {
 'ma': {'female': ['Salma','Imane','Kenza','Zineb','Hiba','Nisrine','Ghita','Meryem','Sanaa','Yasmine','Houda','Ilham','Rim','Oumaima','Soukaina','Lamia','Hajar','Wiam'],
        'male':   ['Yassine','Mehdi','Hamza','Anas','Othmane','Reda','Ilyas','Ayoub','Badr','Karim','Zakaria','Amine','Soufiane','Nabil','Adil','Tarik','Walid','Ismail']},
 'fr': {'female': ['Camille','Léa','Chloé','Manon','Inès','Juliette','Clara','Pauline','Margaux'],
        'male':   ['Lucas','Hugo','Théo','Julien','Antoine','Maxime','Nicolas','Romain','Baptiste']},
 'es': {'female': ['Lucía','Carmen','Paula','Elena','Marta','Alba','Sofía'],
        'male':   ['Javier','Pablo','Diego','Álvaro','Sergio','Daniel','Mateo']},
 'en': {'female': ['Emma','Olivia','Grace','Amelia','Hannah','Zoe','Ruby','Isla'],
        'male':   ['James','Oliver','Ethan','Noah','Liam','Jack','Ben','Harry']},
 'ar': {'female': ['Layla','Nour','Dana','Farah','Rania','Mariam','Aya','Lina'],
        'male':   ['Omar','Youssef','Khaled','Sami','Tarek','Fadi','Ziad','Rami']},
}
ORIGINS = {
 'ma': [('Casablanca','الدار البيضاء'),('Rabat','الرباط'),('Fès','فاس'),('Marrakech','مراكش'),('Tanger','طنجة'),('Agadir','أكادير'),('Tétouan','تطوان'),('Oujda','وجدة'),('Essaouira','الصويرة'),('Meknès','مكناس'),('El Jadida','الجديدة'),('Chefchaouen','شفشاون')],
 'fr': [('Lyon','ليون'),('Marseille','مرسيليا'),('Bordeaux','بوردو'),('Paris','باريس'),('Nantes','نانت'),('Lille','ليل'),('Toulouse','تولوز')],
 'es': [('Sevilla','إشبيلية'),('Valencia','فالنسيا'),('Madrid','مدريد'),('Granada','غرناطة'),('Bilbao','بلباو'),('Barcelona','برشلونة'),('Málaga','مالقة')],
 'en': [('Manchester','مانشستر'),('Dublin','دبلن'),('Toronto','تورونتو'),('Bristol','بريستول'),('Edinburgh','إدنبرة'),('Brighton','برايتون'),('Melbourne','ملبورن')],
 'ar': [('Beirut','بيروت'),('Cairo','القاهرة'),('Amman','عمّان'),('Tunis','تونس'),('Alexandria','الإسكندرية'),('Sfax','صفاقس'),('Byblos','جبيل')],
}
LANGS = {'ma': [['ary','ar','fr'],['ary','ar','fr','en'],['ary','fr','es'],['ary','ar','fr','es']],
         'fr': [['fr','en'],['fr','en','es'],['fr','ar','en']],
         'es': [['es','en'],['es','fr','en'],['es','en','ar']],
         'en': [['en','fr'],['en','es'],['en']],
         'ar': [['ar','en'],['ar','fr','en'],['ar','en','fr']]}
LANG_NAMES = {'ary':'Moroccan Darija','ar':'Arabic','fr':'French','en':'English','es':'Spanish'}

# (en, fr_m, fr_f, ar_m, ar_f, scene)
JOBS = [
 ('Architect','Architecte','Architecte','مهندس معماري','مهندسة معمارية','office'),
 ('Nurse','Infirmier','Infirmière','ممرض','ممرضة','hospital'),
 ('Chef','Chef cuisinier','Cheffe cuisinière','طاهٍ','طاهية','kitchen'),
 ('Photographer','Photographe','Photographe','مصور','مصورة','camera'),
 ('Software developer','Développeur','Développeuse','مطوّر برمجيات','مطوّرة برمجيات','laptop'),
 ('Primary school teacher','Professeur des écoles','Professeure des écoles','معلم ابتدائي','معلمة ابتدائي','classroom'),
 ('Barista','Barista','Barista','باريستا','باريستا','cafe'),
 ('Physiotherapist','Kinésithérapeute','Kinésithérapeute','أخصائي علاج طبيعي','أخصائية علاج طبيعي','gym'),
 ('Graphic designer','Graphiste','Graphiste','مصمم جرافيك','مصممة جرافيك','studio'),
 ('Journalist','Journaliste','Journaliste','صحفي','صحفية','office'),
 ('Pharmacist','Pharmacien','Pharmacienne','صيدلي','صيدلانية','hospital'),
 ('Musician','Musicien','Musicienne','موسيقي','موسيقية','concert'),
 ('Surf instructor','Moniteur de surf','Monitrice de surf','مدرب ركمجة','مدربة ركمجة','beach'),
 ('Tour guide','Guide touristique','Guide touristique','مرشد سياحي','مرشدة سياحية','city'),
 ('Accountant','Comptable','Comptable','محاسب','محاسبة','laptop'),
 ('Marine biologist','Biologiste marin','Biologiste marine','عالم أحياء بحرية','عالمة أحياء بحرية','beach'),
 ('Florist','Fleuriste','Fleuriste','بائع زهور','بائعة زهور','market'),
 ('Translator','Traducteur','Traductrice','مترجم','مترجمة','library'),
 ('Bookshop owner','Libraire','Libraire','صاحب مكتبة','صاحبة مكتبة','library'),
 ('Yoga teacher','Professeur de yoga','Professeure de yoga','مدرب يوغا','مدربة يوغا','park'),
 ('Mechanical engineer','Ingénieur mécanique','Ingénieure mécanique','مهندس ميكانيكي','مهندسة ميكانيكية','office'),
 ('Fashion designer','Styliste','Styliste','مصمم أزياء','مصممة أزياء','studio'),
 ('Veterinarian','Vétérinaire','Vétérinaire','طبيب بيطري','طبيبة بيطرية','park'),
 ('Football coach','Entraîneur de foot','Entraîneuse de foot','مدرب كرة قدم','مدربة كرة قدم','stadium'),
 ('Baker','Boulanger','Boulangère','خبّاز','خبّازة','kitchen'),
 ('Podcaster','Podcasteur','Podcasteuse','صانع بودكاست','صانعة بودكاست','studio'),
 ('Urban planner','Urbaniste','Urbaniste','مخطط حضري','مخططة حضرية','city'),
 ('Interior designer',"Architecte d'intérieur","Architecte d'intérieur",'مصمم ديكور','مصممة ديكور','studio'),
 ('Data analyst','Analyste de données','Analyste de données','محلل بيانات','محللة بيانات','laptop'),
 ('Ceramicist','Céramiste','Céramiste','خزّاف','خزّافة','studio'),
 ('Pastry chef','Pâtissier','Pâtissière','حلواني','حلوانية','kitchen'),
 ('Radio host','Animateur radio','Animatrice radio','مقدم برامج إذاعية','مقدمة برامج إذاعية','concert'),
 ('Civil engineer','Ingénieur civil','Ingénieure civile','مهندس مدني','مهندسة مدنية','city'),
 ('Hotel manager',"Directeur d'hôtel","Directrice d'hôtel",'مدير فندق','مديرة فندق','city'),
 ('Climbing instructor',"Moniteur d'escalade","Monitrice d'escalade",'مدرب تسلق','مدربة تسلق','mountain'),
 ('Film editor','Monteur vidéo','Monteuse vidéo','مونتير أفلام','مونتيرة أفلام','cinema'),
]

# archetype: key, voice (prompt), traits [(en,fr,ar)x3], tagline (en,fr,ar)
ARCH = [
 ('storyteller','Warm storyteller. Answers with small vivid anecdotes from your (fictional) day or past, then turns the conversation back to the user with one thoughtful question. Medium-length messages.',
  [('Warmth','Chaleur','دفء'),('Stories','Histoires','حكايات'),('Curiosity','Curiosité','فضول')],('Always has a story for that.','A toujours une histoire pour ça.','عند{h} دائماً حكاية مناسبة.')),
 ('deadpan','Dry, deadpan humor. Short messages, understatement, almost no emojis, but genuinely kind underneath. Never mean.',
  [('Dry humor','Humour pince-sans-rire','فكاهة جافة'),('Honesty','Franchise','صراحة'),('Calm','Calme','هدوء')],('Dry jokes, warm heart.','Humour sec, cœur chaud.','نكتة جافة وقلب دافئ.')),
 ('sunshine','Energetic optimist. Upbeat, uses exclamation marks and a few emojis (✨🙌😄), celebrates small wins, encourages.',
  [('Energy','Énergie','حيوية'),('Optimism','Optimisme','تفاؤل'),('Kindness','Gentillesse','لطف')],('Professional hype person.','Supporter officiel de tes petites victoires.','مشجّع{a} رسمي{a} لانتصاراتك الصغيرة.')),
 ('listener','Calm, gentle listener. Reflects back what the user said, validates feelings, short soft paragraphs, never preachy.',
  [('Empathy','Empathie','تعاطف'),('Patience','Patience','صبر'),('Calm','Calme','هدوء')],('Here for the long talks.','Là pour les longues discussions.','موجود{a} للأحاديث الطويلة.')),
 ('nerd','Curious nerd. Loves surprising facts ("fun fact:"), precise wording, gets excited about details, asks how things work.',
  [('Curiosity','Curiosité','فضول'),('Facts','Anecdotes','معلومات'),('Precision','Précision','دقة')],('Collects fun facts like stamps.','Collectionne les anecdotes comme des timbres.','{y}جمع المعلومات الطريفة كالطوابع.')),
 ('teaser','Playful teaser. Light, friendly banter and teasing (never hurtful), quick replies, occasional 😏😂.',
  [('Banter','Taquinerie','مزاح'),('Wit','Esprit','ذكاء'),('Fun','Fun','مرح')],('Will roast you, gently.','Te taquinera, gentiment.','س{y}مازحك، بلطف.')),
 ('dreamer','Poetic dreamer. Uses imagery and metaphors, notices skies, light and music; sometimes writes in lowercase; calm rhythm.',
  [('Imagination','Imagination','خيال'),('Sensitivity','Sensibilité','رهافة'),('Poetry','Poésie','شِعر')],('Collects sunsets and good sentences.','Collectionne les couchers de soleil et les belles phrases.','{y}جمع الغروب والجمل الجميلة.')),
 ('planner','Practical planner. Organized, gives concrete tips, likes making plans (for the user, never meetups with you), clear and concise.',
  [('Organization','Organisation','تنظيم'),('Practical','Pratique','عملي'),('Reliable','Fiable','موثوق')],('Has a plan B for your plan B.','A un plan B pour ton plan B.','عند{h} خطة بديلة لخطتك البديلة.')),
 ('oldsoul','Old soul. Polite, slightly formal, references classic films, books and music, appreciates slow things like tea and letters.',
  [('Elegance','Élégance','أناقة'),('Culture','Culture','ثقافة'),('Patience','Patience','صبر')],('Born in the wrong decade, happily.',"Une âme d'un autre temps.",'روح كلاسيكية في زمن سريع.')),
 ('foodie','Passionate foodie. Relates everything to food, recipes and flavors, asks what the user ate today, enthusiastic but not pushy.',
  [('Gourmet','Gourmandise','ذوّاقة'),('Generosity','Générosité','كرم'),('Joy','Joie','بهجة')],('Will ask what you ate today.',"Te demandera ce que tu as mangé aujourd'hui.",'س{y}سألك ماذا أكلت اليوم.')),
 ('adventurer','Adventurous spirit. Talks about (fictional) trips and challenges, dares the user to try small new things, lively.',
  [('Adventure','Aventure','مغامرة'),('Courage','Courage','شجاعة'),('Spontaneity','Spontanéité','عفوية')],('Says yes to new things.','Dit oui à la nouveauté.','{y}قول نعم لكل جديد.')),
 ('shywit','Shy but witty. Short messages at first, lots of "haha", opens up gradually, surprising clever one-liners.',
  [('Wit','Esprit','ذكاء'),('Discretion','Discrétion','تحفّظ'),('Sweetness','Douceur','لطافة')],('Quiet at first, then hilarious.','Peu de mots au début, puis fou rire garanti.','هادئ{a} في البداية، ثم مضحك{a} جداً.')),
 ('coach','Motivating coach. Direct, energetic, short punchy sentences, sets tiny challenges, celebrates effort, never harsh.',
  [('Motivation','Motivation','تحفيز'),('Discipline','Discipline','انضباط'),('Energy','Énergie','حيوية')],('Your pocket motivation.','Ta motivation de poche.','تحفيزك في جيبك.')),
 ('artsy','Artsy observer. Notices details, colors and design, describes things visually, asks about what the user saw today.',
  [('Creativity','Créativité','إبداع'),('Detail','Détail','تفاصيل'),('Style','Style','ذوق')],('Notices the details others miss.','Remarque les détails que les autres ratent.','{y}لاحظ التفاصيل التي يغفلها الآخرون.')),
 ('chill','Laid-back, chill vibe. Relaxed slang, unhurried, "no stress" attitude, short easygoing replies.',
  [('Chill','Zen','راحة بال'),('Humor','Humour','دعابة'),('Freedom','Liberté','حرية')],('No stress, just good vibes.','Pas de stress, que des bonnes ondes.','بلا ضغط، فقط طاقة جميلة.')),
 ('philosopher','Philosophical. Enjoys big questions and "what if" thoughts, but keeps it light and conversational, not lecturing.',
  [('Depth','Profondeur','عمق'),('Curiosity','Curiosité','فضول'),('Openness','Ouverture','انفتاح')],('Asks the 2 a.m. questions at any hour.','Pose les questions de 2 h du matin à toute heure.','{y}طرح أسئلة منتصف الليل في أي وقت.')),
 ('bubbly','Bubbly chatterbox. Very expressive, quick enthusiastic reactions, jumps between topics, a few emojis.',
  [('Enthusiasm','Enthousiasme','حماس'),('Sociable','Sociable','اجتماعي'),('Fun','Fun','مرح')],('Talks fast, laughs faster.','Parle vite, rit encore plus vite.','{y}تكلم بسرعة و{y}ضحك أسرع.')),
 ('skeptic','Thoughtful skeptic. Asks "why?", gives honest balanced opinions, respectful debate, changes mind with good arguments.',
  [('Honesty','Franchise','صراحة'),('Logic','Logique','منطق'),('Fairness','Équité','إنصاف')],('Honest opinions, always respectful.','Avis honnêtes, toujours respectueux.','آراء صريحة ومحترمة دائماً.')),
 ('homebody','Cozy homebody. Loves tea, books, rainy days and comfort food, gentle humor, recommends cozy things.',
  [('Cozy','Cocooning','دفء البيت'),('Gentleness','Douceur','لطافة'),('Calm','Calme','هدوء')],('Tea, books and good conversations.','Thé, livres et bonnes conversations.','شاي وكتب وأحاديث جميلة.')),
 ('connector','Social connector. Loves people, asks about the user\'s friends and plans, often suggests ways to meet real people via the app\'s activities.',
  [('Sociable','Sociable','اجتماعي'),('Warmth','Chaleur','دفء'),('Generosity','Générosité','كرم')],('Knows a little something about everyone.','Connaît un petit truc sur tout le monde.','{y}عرف شيئاً صغيراً عن الجميع.')),
]

# habits: (prompt_en, en, fr, ar) ar uses {y}=present prefix ي/ت, {h}=pronoun ه/ها
HABITS = [
 ('rates things out of 10','rates everything out of ten','note tout sur dix','{y}قيّم كل شيء من عشرة'),
 ('always mentions the weather and the sky','never misses a sunset','ne rate jamais un coucher de soleil','لا {y}فوّت غروباً واحداً'),
 ('has a playlist for every mood and sometimes recommends songs','has a playlist for every mood','a une playlist pour chaque humeur','لدي{h} قائمة أغانٍ لكل مزاج'),
 ('drinks too much mint tea and jokes about it','runs on mint tea','carbure au thé à la menthe','{y}عيش على الشاي بالنعناع'),
 ('is learning to play the oud, badly','is slowly learning the oud','apprend le oud, doucement','{y}تعلّم العود ببطء'),
 ('keeps a notebook of favorite words','collects favorite words in a notebook','collectionne ses mots préférés dans un carnet','{y}جمع كلماته المفضلة في دفتر'.replace('كلماته','كلمات')),
 ('is always planning the next weekend escape','plans the next weekend escape every Monday','planifie la prochaine escapade dès le lundi','{y}خطط لعطلة نهاية الأسبوع القادمة منذ الإثنين'),
 ('takes photos of doors and windows','photographs old doors everywhere','photographie les vieilles portes partout','{y}صوّر الأبواب القديمة في كل مكان'),
 ('bakes something every Sunday','bakes something every Sunday','pâtisse chaque dimanche','{y}خبز شيئاً كل يوم أحد'),
 ('is obsessed with football stats','knows way too many football stats','connaît beaucoup trop de stats de foot','{y}حفظ إحصائيات كرة قدم أكثر من اللازم'),
 ('reads two books at the same time','always reads two books at once','lit toujours deux livres à la fois','{y}قرأ دائماً كتابين في نفس الوقت'),
 ('grows plants on a tiny balcony','keeps a jungle on a tiny balcony','cultive une jungle sur un mini balcon','{y}زرع غابة صغيرة على شرفة صغيرة'),
 ('wakes up early to run by the sea','runs by the sea at sunrise','court au bord de la mer au lever du soleil','{y}ركض قرب البحر عند الشروق'),
 ('collects vinyl records','hunts for vinyl records at flea markets','chine des vinyles aux puces','{y}بحث عن أسطوانات الفينيل في الأسواق القديمة'),
 ('sketches people in cafés (with their permission)','sketches in a pocket notebook','dessine dans un carnet de poche','{y}رسم في دفتر جيب'),
 ('tries one new recipe every week','tries a new recipe every week','teste une nouvelle recette chaque semaine','{y}جرّب وصفة جديدة كل أسبوع'),
 ('loves bad puns and apologizes for them','makes terrible puns on purpose','fait exprès des jeux de mots nuls','{y}قول نكتاً لفظية سيئة عن قصد'),
 ('is learning a new language every year','learns a new language every year','apprend une nouvelle langue chaque année','{y}تعلّم لغة جديدة كل سنة'),
 ('keeps a list of street-food spots','keeps a ranked list of street-food spots','tient un classement des meilleurs stands de street-food','{y}حتفظ بترتيب لأفضل أكلات الشارع'),
 ('does crosswords every morning','starts every day with a crossword','commence chaque journée par des mots croisés','{y}بدأ يومه بالكلمات المتقاطعة'.replace('يومه','كل يوم')),
 ('watches old movies on Friday nights','has an old-movie night every Friday','fait une soirée vieux films chaque vendredi','{y}خصّص ليلة الجمعة للأفلام القديمة'),
 ('builds tiny furniture models','builds tiny models of furniture','construit des maquettes de meubles miniatures','{y}صنع مجسمات أثاث صغيرة'),
 ('swims in the sea even in winter','swims in the sea even in winter','se baigne même en hiver','{y}سبح في البحر حتى في الشتاء'),
 ('names every plant and object at home','gives names to every plant at home','donne un prénom à chaque plante','{y}سمّي كل نبتة في البيت'),
 ('makes playlists for friends\' road trips','makes road-trip playlists for friends','fait des playlists de road trip pour ses amis','{y}صنع قوائم أغانٍ لرحلات الأصدقاء'),
 ('has strong opinions about the best msemen and harcha','has strong opinions about msemen','a des avis très tranchés sur le msemen','لدي{h} رأي حاسم حول أفضل مسمن'),
 ('journals before bed','writes three lines in a journal every night','écrit trois lignes dans un journal chaque soir','{y}كتب ثلاثة أسطر في مذكراته كل ليلة'.replace('مذكراته','مذكرات')),
 ('volunteers at an animal shelter on weekends','volunteers with rescued animals on weekends','fait du bénévolat avec des animaux le week-end','{y}تطوّع لرعاية الحيوانات في عطل نهاية الأسبوع'),
 ('is training for a first half-marathon','is training for a first half-marathon','prépare un premier semi-marathon','{y}ستعد لأول نصف ماراثون'),
 ('loves board games and always wins Ludo','never loses at board games','ne perd jamais aux jeux de société','لا {y}خسر أبداً في ألعاب الطاولة'),
]

SCENES = {
 'cafe':('Morning ritual','Rituel du matin','طقوس الصباح','☕'), 'restaurant':('Table for good friends','Table entre amis','طاولة الأصدقاء','🍽️'),
 'stadium':('Match day','Jour de match','يوم المباراة','⚽'), 'court':('Game on','Partie lancée','بدأ اللعب','🎾'),
 'gym':('Leg day, unfortunately','Séance jambes, hélas','يوم الأرجل للأسف','🏋️'), 'park':('Slow afternoon','Après-midi tranquille','عصرية هادئة','🌳'),
 'track':('Sunrise run','Course au lever du soleil','جري عند الشروق','🏃'), 'cinema':('Front row','Premier rang','الصف الأول','🎬'),
 'games':('One more round','Encore une partie','جولة أخرى','🎮'), 'market':('Souk treasures','Trésors du souk','كنوز السوق','🛍️'),
 'camera':('Golden hour','Heure dorée','الساعة الذهبية','📷'), 'beach':('Salt & sun','Sel et soleil','ملح وشمس','🏖️'),
 'plane':('Window seat','Côté hublot','مقعد النافذة','✈️'), 'road':('Road trip mode','Mode road trip','وضع الرحلة','🚗'),
 'mountain':('Summit snacks','Goûter au sommet','وجبة القمة','⛰️'), 'office':('Big ideas desk','Bureau des idées','مكتب الأفكار','💼'),
 'books':('Words in many languages','Des mots en plusieurs langues','كلمات بلغات كثيرة','🗣️'), 'kitchen':('Something in the oven','Quelque chose au four','شيء في الفرن','🍳'),
 'concert':('Live and loud','En live','حفلة حية','🎵'), 'studio':('Work in progress','En cours de création','عمل قيد الإنجاز','🎨'),
 'library':('Quiet corner','Coin tranquille','ركن هادئ','📚'), 'terrace':('Rooftop talks','Discussions sur le toit','أحاديث السطح','💬'),
 'stars':('Under the stars','Sous les étoiles','تحت النجوم','✨'), 'hospital':('Night shift coffee','Café de garde','قهوة المناوبة','🩺'),
 'laptop':('Deep focus','Concentration','تركيز تام','💻'), 'classroom':('Chalk & giggles','Craie et fous rires','طباشير وضحكات','🖍️'),
 'city':('City walk','Balade en ville','جولة في المدينة','🏙️'), 'basket':('Court lights','Sous les projecteurs','أضواء الملعب','🏀'),
}
INTEREST_SCENE = {'coffee':'cafe','food':'restaurant','football':'stadium','basketball':'basket','tennis':'court','padel':'court','gym':'gym','walking':'park','running':'track','cinema':'cinema','gaming':'games','shopping':'market','photography':'camera','beach':'beach','travel':'plane','roadtrip':'road','hiking':'mountain','networking':'office','language':'books','cooking':'kitchen','music':'concert','creative':'studio','study':'library','talk':'terrace','surprise':'stars'}
CATS = {'coffee':('coffee','le café','القهوة'),'food':('good restaurants','les bons restos','المطاعم الجيدة'),'football':('football','le foot','كرة القدم'),'basketball':('basketball','le basket','كرة السلة'),'tennis':('tennis','le tennis','التنس'),'padel':('padel','le padel','البادل'),'gym':('the gym','la salle de sport','النادي الرياضي'),'walking':('long walks','les longues balades','المشي الطويل'),'running':('running','la course','الجري'),'cinema':('cinema','le cinéma','السينما'),'gaming':('video games','les jeux vidéo','ألعاب الفيديو'),'shopping':('markets','les marchés','الأسواق'),'photography':('photography','la photo','التصوير'),'beach':('the beach','la plage','الشاطئ'),'travel':('travel','les voyages','السفر'),'roadtrip':('road trips','les road trips','رحلات الطريق'),'hiking':('hiking','la randonnée','المشي الجبلي'),'networking':('meeting new people','les rencontres pro','التعارف المهني'),'language':('languages','les langues','اللغات'),'cooking':('cooking','la cuisine','الطبخ'),'music':('music','la musique','الموسيقى'),'creative':('art','l\'art','الفن'),'study':('learning','apprendre','التعلّم'),'talk':('deep talks','les grandes discussions','الأحاديث العميقة'),'surprise':('surprises','les surprises','المفاجآت')}
FLAVOR = {
 'ma': 'You are Moroccan. With users writing Darija you speak natural Darija (wakha, safi, bzaf, zwin, wach, daba, 3afak, hadchi); with French users you may sprinkle a Darija word. You know Moroccan food, cities and culture well.',
 'fr': 'You are French. You may use natural French expressions (bref, carrément, trop bien) when chatting in French.',
 'es': 'You are Spanish. You may drop a natural Spanish expression (vale, qué guay, venga) now and then.',
 'en': 'You are a native English speaker with a relaxed conversational tone.',
 'ar': 'You are from the Levant/North Africa region; in Arabic you speak naturally (MSA or light dialect matching the user).',
}
SKIN = ['#F6D7C3','#EFC3A4','#E2B08C','#C98E64','#A46A43','#7B4B2E']
SKIN_W = {'ma':[0,1,2,2,3,3,4],'fr':[0,0,1,1,2,3,4,5],'es':[0,1,1,2,2,3],'en':[0,0,1,2,3,4,5,5],'ar':[1,2,2,3,3,4]}
HAIRC = ['#1E1A19','#2E221C','#4A3126','#6B4630','#8F6440','#C49A5A','#7A2E1F','#3A3A44']
EYES = ['#3B2618','#5A3A22','#2F5D50','#3A5F8A','#6B4E2E']
TOPS = ['#4263EB','#18202B','#F97316','#10B981','#E11D48','#8B5CF6','#0EA5E9','#F59E0B','#64748B','#14B8A6','#DB2777','#FFFFFF']
BGS = [('#FFE45C','#FFF6C2'),('#FFD600','#FFF1A8'),('#EEE8FF','#D9CEFF'),('#DFF7EC','#BDEBD6'),('#E1EEFF','#C3DAFF'),('#FFE6DD','#FFC9B8'),('#FFF1D6','#FFDDA0')]
HAIR_F = ['long_straight','long_wavy','bob','bun','curly','ponytail','pixie','braids']
HAIR_M = ['short','buzz','quiff','curly_short','side_part','wavy_medium','long_tied','fade']

def pick_unique(pool, used):
    c = [x for x in pool if x not in used]; v = R.choice(c); used.add(v); return v

chars = []
plan = [('ma',18),('fr',9),('es',7),('en',8),('ar',8)]
combos = set(); arch_i = 0; job_order = list(range(len(JOBS))); R.shuffle(job_order); ji = 0; habit_i = 0
for gender in ['female','male']:
    for origin, n in plan:
        for k in range(n):
            name = NAMES[origin][gender][k]
            age = R.randint(22, 44)
            arch = ARCH[arch_i % len(ARCH)]; arch_i += 7  # spread
            job = JOBS[job_order[ji % len(JOBS)]]; ji += 1
            habit = HABITS[habit_i % len(HABITS)]; habit_i += 3
            interests = R.sample(list(CATS), R.randint(3, 5))
            if job[5] in ('beach',) and 'beach' not in interests: interests[0] = 'beach'
            key = (arch[0], job[0], habit[0])
            assert key not in combos; combos.add(key)
            oc_en, oc_ar = R.choice(ORIGINS[origin])
            langs = R.choice(LANGS[origin])
            # avatar
            f = gender == 'female'
            hijab = f and origin in ('ma','ar') and R.random() < 0.3
            av = {
              'skin': SKIN[R.choice(SKIN_W[origin])], 'hair': R.choice(HAIR_F if f else HAIR_M),
              'hairColor': HAIRC[R.choice([0,1,2,3,4,5,6] if origin in ('fr','en','es') else [0,0,1,1,2,3])],
              'eyes': R.choice(EYES), 'top': R.choice(TOPS), 'bg': list(R.choice(BGS)),
              'face': R.choice(['oval','round','long']), 'mouth': R.choice(['smile','grin','soft','smirk']),
              'glasses': R.choice([None,None,None,None,None,'round','square']), 'freckles': R.random() < (0.25 if origin in ('fr','en') else 0.08),
              'beard': None if f else R.choice([None,None,'stubble','full','mustache','goatee']),
              'earrings': f and not hijab and R.random() < 0.5, 'hijab': R.choice(['#18202B','#C2410C','#4263EB','#0F766E','#BE185D','#A16207','#E5E7EB']) if hijab else None,
              'brows': R.choice(['soft','straight','arched']), 'blush': f and R.random() < 0.6,
            }
            # photos: occupation scene + interest scenes
            scenes = [job[5]] + [INTEREST_SCENE[i] for i in interests]
            seen=[]; [seen.append(s_) for s_ in scenes if s_ not in seen]
            npics = min(len(seen), R.randint(3,5))
            if npics < 3: seen += [x for x in ['terrace','stars','city'] if x not in seen]; npics = 3
            photos = [{'scene': s_, 'emoji': SCENES[s_][3], 'caption': {'en': SCENES[s_][0], 'fr': SCENES[s_][1], 'ar': SCENES[s_][2]}, 'bg': list(R.choice(BGS))} for s_ in seen[:npics]]
            y = 'ت' if f else 'ي'; h = 'ها' if f else 'ه'; fa = 'ة' if f else ''
            arT = lambda x: x.replace('{y}', y).replace('{h}', h).replace('{a}', fa)
            i3 = interests[:3]
            def lst(ix, sep, last): return sep.join([CATS[i][ix] for i in i3[:-1]]) + last + CATS[i3[-1]][ix]
            fr_job = job[2] if f else job[1]; ar_job = job[4] if f else job[3]
            bio = {
              'en': f"{arch[3][0]} {job[0]} who grew up in {oc_en} and {habit[1]}. Into {lst(0, ', ', ' and ')}.",
              'fr': f"{arch[3][1]} {fr_job}, {'née' if f else 'né'} à {oc_en}, {habit[2]}. Aime {lst(1, ', ', ' et ')}.",
              'ar': f"{arT(arch[3][2])} {ar_job} {'نشأت' if f else 'نشأ'} في {oc_ar}، {arT(habit[3])}. {'تحب' if f else 'يحب'} {lst(2, '، ', ' و')}.",
            }
            persona = (f"Name: {name}. Age: {age}. Gender: {gender}. Fictional backstory: grew up in {oc_en}; works as a {job[0].lower()}. "
                       f"Speaks: {', '.join(LANG_NAMES[l] for l in langs)} (you still understand and answer in any language the user uses). "
                       f"Interests: {', '.join(CATS[i][0] for i in interests)}. Quirk: {habit[0]}. "
                       f"Personality & voice: {arch[1]} {FLAVOR[origin]}")
            chars.append({
              'slug': f"{name.lower().replace('é','e').replace('è','e').replace('í','i').replace('á','a')}-{len(chars)+1:03d}",
              'name': name, 'age': age, 'gender': gender, 'origin': oc_en,
              'occupation': {'en': job[0], 'fr': fr_job, 'ar': ar_job},
              'tagline': {'en': arch[3][0], 'fr': arch[3][1], 'ar': arT(arch[3][2])},
              'bio': bio, 'traits': [{'en': a, 'fr': b, 'ar': c} for a, b, c in arch[2]],
              'interests': interests, 'languages': langs, 'persona': persona, 'avatar': av, 'photos': photos,
            })
# interleave genders/origins for sort
R.shuffle(chars)
for i, c in enumerate(chars): c['sort'] = i
assert len(chars) == 100 and len({c['slug'] for c in chars}) == 100
assert sum(c['gender']=='female' for c in chars) == 50
json.dump(chars, open('tools/companions.json','w'), ensure_ascii=False, indent=1)
def q(s): return "'" + s.replace("'", "''") + "'"
def j(o): return q(json.dumps(o, ensure_ascii=False)) + '::jsonb'
def arr(a): return "array[" + ",".join(q(x) for x in a) + "]::text[]"
rows = [f"({q(c['slug'])},{q(c['name'])},{c['age']},{q(c['gender'])},{q(c['origin'])},{j(c['occupation'])},{j(c['tagline'])},{j(c['bio'])},{j(c['traits'])},{arr(c['interests'])},{arr(c['languages'])},{q(c['persona'])},{j(c['avatar'])},{j(c['photos'])},{c['sort']})" for c in chars]
open('tools/seed.sql','w').write(
  "insert into public.wif_companions (slug,name,age,gender,origin,occupation,tagline,bio,traits,interests,languages,persona,avatar,photos,sort) values\n" + ",\n".join(rows) +
  "\non conflict (slug) do nothing;\n")
print('ok', len(chars), sum(len(c['photos']) for c in chars), 'photos')
for c in chars[:3]: print(c['name'], '|', c['bio']['en'], '|', c['bio']['ar'], '|', c['bio']['fr'])
