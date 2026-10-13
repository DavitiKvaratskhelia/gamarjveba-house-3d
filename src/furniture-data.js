// გამარჯვების სახლი — ავეჯის განლაგება, ზომები და რენდერის პარამეტრები (მმ, გეგმის კოორდინატები — იხ. config.js).
//
// r — გეგმის კონტური (A.8 ვექტორებიდან; ტერასის ნივთები — რენდერიდან შეფასებული).
// face — წინა მხარის მიმართულება: x0 დასავლეთი, x1 აღმოსავლეთი, y0 ჩრდილოეთი, y1 სამხრეთი (საწოლებზე — ფეხის მხარე).
// ლოკალური x — ნივთის წინიდან შეხედვისას მარცხნიდან მარჯვნივ (როგორც A.15/A.16-ის ხედებზე).
// type — ამგები furniture.js-ში; mat — FMAT-ის მასალა. y — [ქვედა, ზედა] ნიშნული იატაკიდან.
// st — სტატუსი: w/d/h — ზომები, pos — მდებარეობა, shape — ფორმა (pdf | vec | render | assumed).
// ref — რენდერის გვერდი (A01…A08 = PDF-ის გვ. 1…8); sheets — ტექნიკური ფურცლები.
// ყველა დაუდასტურებელი ზომა აქ არის პარამეტრად — შეცვალეთ და გაუშვით `npm run build`.

const P = (h = 'assumed') => ({ w: 'pdf', d: 'pdf', h, pos: 'vec', shape: 'render' });
const V = (h = 'assumed') => ({ w: 'vec', d: 'vec', h, pos: 'vec', shape: 'render' });
const R = { w: 'assumed', d: 'assumed', h: 'assumed', pos: 'assumed', shape: 'render' }; // მხოლოდ რენდერზე

export const FURNITURE = [
  // ================= 01 · მისაღები, სასადილო, სამზარეულო, შესასვლელი
  { id: 'F1', code: 'F1', type: 'kitchen', zone: '01', name: 'სამზარეულო', r: [4115, 1515, 4700, 5385], face: 'x1', h: 3000,
    mods: [636, 250, 600, 600, 898, 250, 636], ovensRight: true, base: 900, top: 20, upperDepth: 350, upperMat: 'oakLight', topTier: 2350,
    hob: [2255, 2835], sink: [895, 1395], ovens: [[565, 1165], [1165, 1765]],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A01', sheets: ['A.8', 'A.15'],
    note: 'A.15: 636 | 250 | 600 | 600 | 898 | 250 | 636 = 3870, ქვედა 900, ზურგი 600, ზედა 1500 (სულ 3000). რენდერი A01: თეთრი მქრქალი ქვედა და მაღალი კარადები (Gola-ღარი), ღია მუხის ზედა კარადები LED-ით, თეთრი ზედა რიგი ჭერამდე, ღია ქვის ზედაპირი და ზურგი, ფოლადის ღუმელები. ღუმელები — გეგმის მიხედვით ჩრდილოეთ მხარეს (რენდერზე სამხრეთითაა — იხ. წინააღმდეგობები; ovensRight).' },
  { id: 'TB-01', type: 'diningTable', zone: '01', name: 'სასადილო მაგიდა 1600 × 800', r: [6100, 2575, 6900, 4175], h: 750, radius: 300, legInset: [230, 130],
    st: P(), ref: 'A01', sheets: ['A.8'], note: 'მარმარილოს რბილი მართკუთხა ფილა (30 მმ) და 4 დახრილი მუხის ფეხი + გრძივი ძელი. კუთხის რადიუსი და ფეხების ფორმა — რენდერიდან.' },
  { id: 'CH-01a', type: 'wishbone', zone: '01', name: 'სკამი „Wishbone“', r: [5780, 2800, 6230, 3250], face: 'x1', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'CH-01b', type: 'wishbone', zone: '01', name: 'სკამი „Wishbone“', r: [5780, 3500, 6230, 3950], face: 'x1', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'CH-01c', type: 'wishbone', zone: '01', name: 'სკამი „Wishbone“', r: [6770, 2800, 7220, 3250], face: 'x0', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'CH-01d', type: 'wishbone', zone: '01', name: 'სკამი „Wishbone“', r: [6770, 3500, 7220, 3950], face: 'x0', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'CH-01e', type: 'shellChair', zone: '01', name: 'რბილი სკამი (მაგიდის ბოლოში)', r: [6275, 2220, 6725, 2670], face: 'y1', mat: 'chairGrey', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'CH-01f', type: 'shellChair', zone: '01', name: 'რბილი სკამი (მაგიდის ბოლოში)', r: [6275, 4025, 6725, 4475], face: 'y0', mat: 'chairGrey', st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'SF-01', type: 'sofa', zone: '01', name: 'დივანი 2800 × 900', r: [8600, 1975, 9500, 4775], face: 'x1', mat: 'sofaFabric', seats: 2,
    pillows: [[0.17, 'linenGreige', 470], [0.72, 'linenGreige', 470], [0.85, 'sofaFabric', 450]], balls: [0.46, 0.54],
    st: P(), ref: 'A01, A02', sheets: ['A.8'], note: 'გეგმაზე 2800 × 900 — დაცულია. რენდერზე სამხრეთ ბოლოს დამატებითი შეზლონგის მოდული ჩანს, რომელიც გეგმაზე არ არის (იხ. წინააღმდეგობები) — არ არის დამატებული.' },
  { id: 'AC-01a', type: 'armchair', zone: '01', name: 'სავარძელი (კაკლის ჩარჩო)', r: [9970, 1420, 10770, 2220], face: 'y1', mat: 'creamBoucle', st: V(), ref: 'A01, A02', sheets: ['A.8'] },
  { id: 'AC-01b', type: 'armchair', zone: '01', name: 'სავარძელი (კაკლის ჩარჩო)', r: [9970, 4530, 10770, 5330], face: 'y0', mat: 'creamBoucle', st: V(), ref: 'A01, A02', sheets: ['A.8'] },
  { id: 'CT-01', type: 'coffeeTable', zone: '01', name: 'ჟურნალების მაგიდა 1000 × 500', r: [10150, 2875, 10650, 3875], face: 'x1', h: 400, inset: 170,
    st: P(), ref: 'A01, A02', sheets: ['A.8'], note: 'მარმარილოს ფილა 40 მმ, საყრდენი — კაკლის ორ-ორი ვერტიკალური ფილა თითო ბოლოში (რენდერი).' },
  { id: 'F2-panel', code: 'F2', type: 'wallPanels', zone: '01', name: 'TV-ნიშის მუხის პანელები', r: [11975, 1500, 12000, 5250], face: 'x0', n: 4, h: 3000, mat: 'oakLight',
    st: { w: 'pdf', d: 'assumed', h: 'assumed', pos: 'vec', shape: 'render' }, ref: 'A01', sheets: ['A.9'], note: '4 ვერტიკალური ღია მუხის პანელი შავი ღარებით (რენდერი A01).' },
  { id: 'F2', code: 'F2', type: 'consoleF2', zone: '01', name: 'TV-კონსოლი (ჩამოკიდებული)', r: [11515, 1515, 11985, 5235], face: 'x0', y: [145, 500], drawers: 5,
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A01', sheets: ['A.15'], note: 'A.15: 3720 × 500 × 355, ზედა ნიშნული H 500, 5 უჯრა. რენდერი: კრემისფერი ზედა ფილა, მუხის ფასადები, LED ქვემოთ.' },
  { id: 'F2-shelf', code: 'F2', type: 'shelf', zone: '01', name: 'თარო LED-ით (F2)', r: [11735, 1875, 11985, 4875], face: 'x0', y: [2000, 2100], mat: 'oakLight', led: true,
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A01', sheets: ['A.15'], note: 'A.15: 3000 × 100, H 2100; სიღრმე (250) — ვარაუდი.' },
  { id: 'TV-01', type: 'tv', zone: '01', name: 'ტელევიზორი', r: [11845, 2605, 11895, 4145], face: 'x0', y: [867, 1733], st: V(), ref: 'A01', sheets: ['A.8'] },
  { id: 'F9', code: 'F9', type: 'slats', zone: '01', name: 'ღარიანი ტიხარი (შესასვლელი)', r: [6300, 5400, 8500, 5500], face: 'y1', h: 3000, n: 31, slat: 37, mat: 'oakLight',
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A02', sheets: ['A.8', 'A.16'], note: 'A.16: 2196 × 3000; A.8: 31 ლამელი 35–40 × 100 მმ. რენდერი A02: ღია მუხა.' },
  { id: 'F9-bench', code: 'F9', type: 'bench', zone: '01', name: 'სკამი ხავერდის ბალიშით (F9)', r: [6300, 5500, 7670, 5800], face: 'y1', y: [340, 400],
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A02', sheets: ['A.16'], note: 'A.16: სიგრძე 1368, სიმაღლე 400. რენდერი A02 (ზედხედი): მოვისფერი ხავერდის ბალიში და პატარა ბალიში.' },
  { id: 'F9-shelf', code: 'F9', type: 'shelf', zone: '01', name: 'თარო (F9)', r: [6666, 5500, 7666, 5800], face: 'y1', y: [1680, 1800], mat: 'white',
    st: { w: 'pdf', d: 'assumed', h: 'vec', pos: 'vec', shape: 'assumed' }, sheets: ['A.16'], note: 'A.16: 1000 × 120; რენდერზე არ ჩანს.' },
  { id: 'F9-mirror', code: 'F9', type: 'mirror', zone: '01', name: 'სარკე (F9)', r: [7670, 5500, 8500, 5535], face: 'y1', y: [0, 3000], frame: false,
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A02', sheets: ['A.16'] },
  { id: 'F3', code: 'F3', type: 'wardrobe', zone: '01', name: 'შესასვლელის კარადა', r: [10515, 6485, 11985, 7185], face: 'y0', h: 3000, mat: 'greigeF3',
    mods: [18, '650f', 392, 392, 18], split: 2210, flutePitch: 24, handles: [[1, 'R', 880, 1080], [2, 'R', 880, 1080], [3, 'L', 880, 1080]], handleMat: 'blackMetal', handleW: 12, handleD: 24,
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A02', sheets: ['A.15'],
    note: 'A.15: 650 (ღარიანი) + 392 + 392 = 1470, სიღრმე 700, სიმაღლე 3000, ზედა ყუთები ≈2210-დან. რენდერი A02: ღია ბეჟ-ნაცრისფერი მქრქალი ფასადები, შავი სახელურები. შიდა სივრცე (სარეცხი მანქანა, ქვაბი, თაროები — რენდერი A02) კარების მიღმაა და არ არის აგებული.' },

  // ================= 02 · მასტერ საძინებელი
  { id: 'F4', code: 'F4', type: 'wardrobe', zone: '02', name: 'ჩაშენებული კარადა ღია თაროებით', r: [315, 1685, 915, 4385], face: 'x1', h: 3000, mat: 'taupeF4', inner: 'oakLight',
    mods: [470, 470, 470, 470, '332o', 470], split: 2100, deskOver: [4, 5], desk: [612, 750], shelves: [445, 1105, 1564, 1808, 2482],
    handles: [[0, 'R', 250, 1065], [1, 'L', 250, 1065], [2, 'R', 250, 1065], [3, 'L', 250, 1065]], handleMat: 'alu', handleW: 16, handleD: 28,
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A03', sheets: ['A.8', 'A.15'],
    note: 'A.15: 470 × 4 + 332 (ღია) + 470 = 2700 × 600 × 3000. რენდერი A03: ნაცრისფერ-იასამნისფერი მქრქალი ფასადები, გრძელი ალუმინის სახელურები, ღია მუხის თაროები; მაგიდის ფილა გადის ღია თაროებსა და ბოლო კარზე. სახელურების სიმაღლე — A.15 (0.25–1.07 მ; რენდერზე უფრო გრძელი ჩანს — იხ. წინააღმდეგობები).' },
  { id: 'F4-desk', code: 'F4', type: 'desk', zone: '02', name: 'სამუშაო / კოსმეტიკური მაგიდა (F4)', r: [315, 315, 915, 1685], face: 'x1', y: [612, 750], drawers: [788, 582],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A03', sheets: ['A.15'], note: 'A.15: 1370, H 750, სისქე 138. რენდერი A03: ღია მუხა, ორი უჯრა ფილის ქვეშ, ჩამოკიდებული.' },
  { id: 'MR-02', type: 'mirror', zone: '02', name: 'სარკე LED-განათებით (მაგიდის თავზე)', r: [300, 640, 320, 1360], face: 'x1', y: [1020, 2560], frame: false, glow: true,
    st: R, ref: 'A03', note: 'მხოლოდ რენდერზეა (A03); ზომა ≈720 × 1540 და სიმაღლე შეფასებულია მაგიდის 750 მმ-ის მიხედვით.' },
  { id: 'CH-02', type: 'tubChair', zone: '02', name: 'რბილი სკამი (ვარდისფერი ხავერდი)', r: [665, 690, 1255, 1310], face: 'x0', mat: 'roseVelvet', st: V(), ref: 'A03', sheets: ['A.8'] },
  { id: 'BED-02', type: 'bedRound', zone: '02', name: 'საწოლი 1900 × 2100 (რბილი, მომრგვალებული სათავით)', r: [1885, 1935, 3985, 3835], face: 'x0', mat: 'greyBoucle',
    st: P(), ref: 'A03', sheets: ['A.8'], note: 'რენდერი A03: ნაცრისფერი ბუკლე, სქელი მომრგვალებული ჩარჩო, მაღალი სათავე მრგვალი კუთხეებით, მუქი პატარა ფეხები; თეთრეული და მოვისფერი ხავერდის გადასაფარებელი.' },
  { id: 'NS-02a', type: 'drum', zone: '02', name: 'მრგვალი ტუმბო მარმარილოს ზედაპირით', r: [3525, 1460, 3975, 1910], h: 545, open: 110, openYaw: 90,
    st: { w: 'render', d: 'render', h: 'assumed', pos: 'vec', shape: 'render' }, ref: 'A03', sheets: ['A.8'], note: 'გეგმაზე 300 × 500 მართკუთხედი; რენდერზე — მრგვალი ≈Ø450 (იხ. წინააღმდეგობები). ცენტრი გეგმის ადგილზეა, კედლიდან დაშორებით.' },
  { id: 'NS-02b', type: 'drum', zone: '02', name: 'მრგვალი ტუმბო მარმარილოს ზედაპირით', r: [3525, 3860, 3975, 4310], h: 545, open: 110, openYaw: 90,
    st: { w: 'render', d: 'render', h: 'assumed', pos: 'vec', shape: 'render' }, ref: 'A03', sheets: ['A.8'] },

  // ================= 03 · აბაზანა (მასტერი)
  { id: 'F6', code: 'F6', type: 'vanityF6', zone: '03', name: 'ნიჟარის კარადა 1570 × 500', r: [315, 4515, 815, 6085], face: 'x1', y: [450, 900], mat: 'taupeBath', basin: [500, 80, 575, 320],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A04', sheets: ['A.16'], note: 'A.16: 1570 × 500 × 450, H 900. რენდერი A04: ტაუპის მქრქალი ფასადი ზედა ღარით, მარმარილოს ზედაპირი მუქი ძარღვებით, თეთრი ჭურჭლისებრი ნიჟარა, კედლის ონკანი.' },
  { id: 'F6-mirror', code: 'F6', type: 'mirror', zone: '03', name: 'სარკე 1150 × 1500 LED-ით (F6)', r: [300, 4722, 320, 5872], face: 'x1', y: [1050, 2550], round: 160, glow: true,
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'assumed', shape: 'render' }, ref: 'A04', sheets: ['A.16'] },
  { id: 'F5', code: 'F5', type: 'wardrobe', zone: '03', name: 'მაღალი კარადა', r: [2285, 4515, 2585, 5185], face: 'x0', h: 3000, mat: 'white', mods: [670],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A04', sheets: ['A.16'] },
  { id: 'F5-A', code: 'F5-A', type: 'wallCab', zone: '03', name: 'ჩამოკიდებული კარადა უნიტაზის თავზე (F5-A)', r: [2400, 5315, 2600, 6085], face: 'x0', y: [1500, 3000], mat: 'white', ledBelow: true,
    st: { w: 'vec', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A04', sheets: ['A.16'], note: 'A.16: 800 × 200 × 1500. რენდერი A04: თეთრი, ჭერამდე, ქვემოთ LED.' },
  { id: 'IB-03', type: 'instBox', zone: '03', name: 'ინსტალაციის ყუთი თაროთი', r: [2435, 5315, 2600, 6085], face: 'x0', h: 1220, mat: 'terrazzo', ledge: true, plate: 1000,
    st: { w: 'vec', d: 'vec', h: 'render', pos: 'vec', shape: 'render' }, ref: 'A04', sheets: ['A.9'] },
  { id: 'WC-03', type: 'wc', zone: '03', name: 'ჩამოკიდებული უნიტაზი', r: [1875, 5520, 2430, 5880], face: 'x0', st: V(), ref: 'A04', sheets: ['A.8'] },
  { id: 'GL-03', type: 'glass', zone: '03', name: 'საშხაპის მინის კარი', r: [835, 6140, 2065, 6160], face: 'y1', h: 2000, hinges: [60, 1170],
    st: { w: 'pdf', d: 'assumed', h: 'assumed', pos: 'vec', shape: 'render' }, ref: 'A04', sheets: ['A.9'] },
  { id: 'TR-03', type: 'towel', zone: '03', name: 'პირსახოცის საშრობი', r: [1880, 4500, 2230, 4580], face: 'y1', y: [850, 1950], st: R, ref: 'A04', note: 'მხოლოდ რენდერზეა (A04, კართან).' },

  // ================= 04 · აბაზანა (სტუმრის)
  { id: 'F7-v', code: 'F7', type: 'vanityF7', zone: '04', name: 'ნიჟარის კარადა 900 × 480 (F7)', r: [2715, 6235, 3195, 7135], face: 'x1', y: [350, 850], mat: 'taupeBath', basin: [150, 60, 600, 330],
    st: { w: 'pdf', d: 'pdf', h: 'vec', pos: 'vec', shape: 'render' }, ref: 'A05', sheets: ['A.16'], note: 'A.16: 900 × 480 × 500 (გეგმაზე 1000 × 485). რენდერი A05: ღარიანი ტაუპის კორპუსი, სქელი თეთრი ზედაპირი ჩაშენებული ნიჟარით.' },
  { id: 'F7-mirror', code: 'F7', type: 'mirror', zone: '04', name: 'სარკე 900 × 1600 LED-ით (F7)', r: [2700, 6235, 2720, 7135], face: 'x1', y: [1200, 2800], frame: false, ledBelow: true,
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A05', sheets: ['A.16'] },
  { id: 'IB-04', type: 'instBox', zone: '04', name: 'ინსტალაციის ყუთი ნიშით', r: [2715, 5415, 2865, 6185], face: 'x1', h: 3000, mat: 'porcelain', niche: [120, 650, 1300, 1650, 100], plate: 1000,
    st: { w: 'vec', d: 'vec', h: 'render', pos: 'vec', shape: 'render' }, ref: 'A05', sheets: ['A.9'], note: 'რენდერი A05: ჭერამდე, ჩაღრმავებული ნიშით (ნიშის ზომა შეფასებულია).' },
  { id: 'WC-04', type: 'wc', zone: '04', name: 'ჩამოკიდებული უნიტაზი', r: [2870, 5620, 3425, 5980], face: 'x1', st: V(), ref: 'A05', sheets: ['A.8'] },
  { id: 'GL-04', type: 'glass', zone: '04', name: 'საშხაპის მინის ტიხარი და კარი', r: [2715, 5390, 4000, 5410], face: 'y1', h: 2000, hinges: [650, 1220], edge: 'blackMetal',
    st: { w: 'vec', d: 'assumed', h: 'assumed', pos: 'vec', shape: 'render' }, ref: 'A05', sheets: ['A.8'] },
  { id: 'TR-04', type: 'towel', zone: '04', name: 'პირსახოცის საშრობი', r: [4195, 6540, 4285, 7000], face: 'x0', y: [450, 1750], st: V(), ref: 'A05', sheets: ['A.8', 'A.14'] },

  // ================= 05 · საძინებელი
  { id: 'BED-05', type: 'bedPanel', zone: '05', name: 'საწოლი 1900 × 2100 (თეთრი)', r: [12800, 1535, 14700, 3635], face: 'y0', st: P(), ref: 'A06', sheets: ['A.8'] },
  { id: 'WP-05', type: 'headWall', zone: '05', name: 'საწოლის კედლის მუხის პანელი LED-ით', r: [12450, 3635, 15050, 3650], face: 'y0', h: 2750, mat: 'oakGreige',
    st: R, ref: 'A06', note: 'მხოლოდ რენდერზეა (A06); სიგანე ≈2.6 მ და სიმაღლე ≈2.75 მ შეფასებულია.' },
  { id: 'NS-05a', type: 'chest', zone: '05', name: 'ტუმბო 3 უჯრით', r: [12300, 3335, 12800, 3635], face: 'y0', h: 550, drawers: 3, mat: 'white', st: V(), ref: 'A06', sheets: ['A.8'] },
  { id: 'NS-05b', type: 'chest', zone: '05', name: 'ტუმბო 3 უჯრით', r: [14700, 3335, 15200, 3635], face: 'y0', h: 550, drawers: 3, mat: 'white', st: V(), ref: 'A06', sheets: ['A.8'] },
  { id: 'F8', code: 'F8', type: 'wardrobe', zone: '05', name: 'კარადა ღია თაროებით (შებოლილი მუხა)', r: [15385, 315, 15985, 3635], face: 'x0', h: 3000, mat: 'smokedOak', inner: 'smokedOak',
    mods: ['700o', '524f', 524, 524, 524, 524], split: 990, flutePitch: 22, shelves: [500, 1000, 1500, 2000, 2500], dividers: [0.66, 0.34, 0.66, 0.34, 0.66], led: true,
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A06', sheets: ['A.16'],
    note: 'A.16: 700 (ღია) + 2620 = 3320 × 600 × 3000, ქვედა კარები 990-მდე. რენდერი A06: შებოლილი მუხა, თაროებთან ღარიანი კარი, თაროები LED-ით, სახელურების გარეშე.' },

  // ================= 06 · საძინებელი
  { id: 'BED-06', type: 'bedVelvet', zone: '06', name: 'საწოლი 1700 × 2100 (ნაცრისფერი ხავერდი)', r: [13500, 3765, 15200, 5865], face: 'y1', st: P(), ref: 'A07', sheets: ['A.8'] },
  { id: 'NS-06a', type: 'chest', zone: '06', name: 'ტუმბო 2 უჯრით', r: [13000, 3765, 13500, 4065], face: 'y1', h: 500, drawers: 2, mat: 'white', st: V(), ref: 'A07', sheets: ['A.8'] },
  { id: 'NS-06b', type: 'chest', zone: '06', name: 'ტუმბო 2 უჯრით', r: [15200, 3765, 15700, 4065], face: 'y1', h: 500, drawers: 2, mat: 'white', st: V(), ref: 'A07', sheets: ['A.8'] },
  { id: 'F7', code: 'F7', type: 'slidingWardrobe', zone: '06', name: 'კარადა გასაწევი კარებით', r: [12115, 3765, 12715, 5265], face: 'x1', h: 2300, doorW: 750, doors: [[450, 600], [750, 575]],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec', shape: 'render' }, ref: 'A07', sheets: ['A.16'],
    note: 'A.16: 1500 × 600 × 2300, ორი გასაწევი კარი. რენდერი A07: მუხის კორპუსი, თეთრი კარები მუხის ჰორიზონტალური ზოლით (≈0.9–1.2 მ), კარები ნაწილობრივ გაწეულია — ჩანს ჩამოსაკიდი ღია განყოფილება.' },
  { id: 'TC-06', type: 'dresser', zone: '06', name: 'კომოდი მარმარილოს ზედაპირით (TV-ის ქვეშ)', r: [13450, 6735, 15250, 7185], face: 'y0', y: [150, 760],
    st: { w: 'vec', d: 'vec', h: 'render', pos: 'vec', shape: 'render' }, ref: 'A07', sheets: ['A.8'], note: 'გეგმა: 1800 × 450. რენდერი A07: კაკლის კორპუსი, 2 კარი + 3 უჯრა ჩაღრმავებული სახელურებით, მარმარილოს ზედაპირი, დახრილი მუქი ფეხები.' },
  { id: 'TV-06', type: 'tv', zone: '06', name: 'ტელევიზორი', r: [13570, 7135, 15105, 7185], face: 'y0', y: [960, 1825], st: V(), ref: 'A07', sheets: ['A.8'] },

  // ================= ტერასა (მხოლოდ რენდერი A08 — გეგმაზე არ არის)
  { id: 'TS-1', type: 'outdoorSofa', zone: 'T', name: 'ტერასის ორადგილიანი დივანი', r: [4200, -850, 5600, -90], face: 'y0', mat: 'outdoorGrey',
    pillows: [[0.3, 'linenWhite'], [0.5, 'leafPillow'], [0.7, 'linenWhite']], st: R, ref: 'A08' },
  { id: 'TT-1', type: 'outdoorTable', zone: 'T', name: 'ტერასის დაბალი მაგიდა', r: [4450, -1600, 5350, -1100], face: 'y0', h: 350, st: R, ref: 'A08' },
  { id: 'RC-1', type: 'rattanChair', zone: 'T', name: 'რატანის სავარძელი', r: [3170, -1580, 3930, -820], tilt: 22, yaw: -60, mat: 'linenGreige', st: R, ref: 'A08' },
  { id: 'RC-2', type: 'rattanChair', zone: 'T', name: 'რატანის სავარძელი', r: [5870, -1580, 6630, -820], tilt: 22, yaw: 60, mat: 'linenGreige', st: R, ref: 'A08' },
  { id: 'TS-2', type: 'outdoorSofa', zone: 'T', name: 'ტერასის ორადგილიანი დივანი', r: [10900, -850, 12300, -90], face: 'y0', mat: 'outdoorGrey',
    pillows: [[0.3, 'leafPillow'], [0.5, 'linenWhite'], [0.7, 'leafPillow']], st: R, ref: 'A08' },
  { id: 'TT-2', type: 'outdoorTable', zone: 'T', name: 'ტერასის დაბალი მაგიდა', r: [11150, -1600, 12050, -1100], face: 'y0', h: 350, st: R, ref: 'A08' },
  { id: 'BT-1', type: 'bistroTable', zone: 'T', name: 'მრგვალი მაგიდა Ø800', r: [14500, -1850, 15300, -1050], h: 740, st: R, ref: 'A08' },
  { id: 'RP-1', type: 'ropeChair', zone: 'T', name: 'ნაწნავი სკამი', r: [14206, -2144, 14746, -1604], yaw: 45, st: R, ref: 'A08' },
  { id: 'RP-2', type: 'ropeChair', zone: 'T', name: 'ნაწნავი სკამი', r: [15054, -2144, 15594, -1604], yaw: 135, st: R, ref: 'A08' },
  { id: 'RP-3', type: 'ropeChair', zone: 'T', name: 'ნაწნავი სკამი', r: [15054, -1296, 15594, -756], yaw: 225, st: R, ref: 'A08' },
  { id: 'RP-4', type: 'ropeChair', zone: 'T', name: 'ნაწნავი სკამი', r: [14206, -1296, 14746, -756], yaw: 315, st: R, ref: 'A08' },
];
