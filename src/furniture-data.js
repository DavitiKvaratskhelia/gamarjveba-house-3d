// გამარჯვების სახლი — ავეჯის განლაგება და ზომები (მმ, გეგმის კოორდინატები — იხ. config.js).
//
// r — გეგმის კონტური A.8-დან („გეგმარება ავეჯით“, ვექტორებიდან). face — წინა მხარე: x0 (დასავლეთისკენ),
// x1 (აღმოსავლეთისკენ), y0 (ჩრდილოეთისკენ), y1 (სამხრეთისკენ). z0/h — ქვედა/ზედა ნიშნული იატაკიდან.
// st — ზომების სტატუსი: w — სიგრძე, d — სიღრმე, h — სიმაღლე, pos — მდებარეობა (pdf | vec | render | assumed).
// code — PDF-ის კოდი (F1…F9, A.15/A.16); სხვა ნივთებს კოდი არ აქვს — A.8-ზე მხოლოდ დახატულია.
// mods — ფასადის მოდულები (მმ) მცირე კოორდინატიდან დიდისკენ; 'o' — ღია თაროები, 'f' — ღარებიანი ფასადი.

const V = (h = 'assumed') => ({ w: 'vec', d: 'vec', h, pos: 'vec' });

export const FURNITURE = [
  // ---- საძინებელი 02 (მასტერი)
  { id: 'F4', code: 'F4', type: 'wardrobe', zone: '02', name: 'ჩაშენებული კარადა', r: [315, 1685, 915, 4385], h: 3000, face: 'x1', mat: 'taupe',
    mods: [470, '332o', 470, 470, 470, 470], split: 2100, handles: [2, 4], handleZ: [250, 1065],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' },
    note: 'A.15: 470 + 332 (ღია თაროები) + 470 × 4 = 2700, სიღრმე 600, სიმაღლე 3000. სახელურების სიმაღლე — ნახაზიდან.' },
  { id: 'F4-desk', code: 'F4', type: 'slab', zone: '02', name: 'სამუშაო მაგიდა (F4)', r: [315, 315, 915, 1685], z0: 612, h: 750, mat: 'oak',
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' }, note: 'A.15: სიგრძე 1370, ზედა ნიშნული 750, ფილის სისქე 138; კარადაზეა მიმაგრებული (ფეხების გარეშე).' },
  { id: 'CH-02', type: 'officeChair', zone: '02', name: 'სამუშაო სკამი', r: [665, 690, 1255, 1310], face: 'x0', h: 850, mat: 'fabricWarm', st: V() },
  { id: 'BED-02', type: 'bed', zone: '02', name: 'საწოლი 1900 × 2100', r: [1885, 1935, 3985, 3835], face: 'x1', h: 1100, mat: 'fabric',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'NS-02a', type: 'nightstand', zone: '02', name: 'ტუმბო', r: [3685, 1435, 3985, 1935], face: 'x0', h: 500, mat: 'white', st: V() },
  { id: 'NS-02b', type: 'nightstand', zone: '02', name: 'ტუმბო', r: [3685, 3835, 3985, 4335], face: 'x0', h: 500, mat: 'white', st: V() },

  // ---- მისაღები / სამზარეულო 01
  { id: 'F1', code: 'F1', type: 'kitchen', zone: '01', name: 'სამზარეულო', r: [4115, 1515, 4700, 5385], h: 3000, face: 'x1',
    mods: [636, 250, 898, 600, 600, 250, 636], base: 900, top: 40, upper: 1500, upperDepth: 350,
    hob: [2550, 3130], sink: [3990, 4490], ovens: [[565, 1165], [1165, 1765]],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' },
    note: 'A.15: 636 | 250 | 898 | 600 | 600 | 250 | 636 = 3870; ქვედა კარადები 900, ზურგი 600, ზედა კარადები 1500 — სულ 3000. ჩრდილოეთით ღუმელები (OV/MW), სამხრეთით მაცივარი (F). ზედა კარადების სიღრმე (350) — ვარაუდი.' },
  { id: 'TB-01', type: 'table', zone: '01', name: 'სასადილო მაგიდა 1600 × 800', r: [6100, 2575, 6900, 4175], h: 750, mat: 'worktop',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'CH-01a', type: 'chair', zone: '01', name: 'სკამი', r: [5780, 2800, 6230, 3250], face: 'x1', h: 820, mat: 'fabric', st: V() },
  { id: 'CH-01b', type: 'chair', zone: '01', name: 'სკამი', r: [5780, 3500, 6230, 3950], face: 'x1', h: 820, mat: 'fabric', st: V() },
  { id: 'CH-01c', type: 'chair', zone: '01', name: 'სკამი', r: [6770, 2800, 7220, 3250], face: 'x0', h: 820, mat: 'fabric', st: V() },
  { id: 'CH-01d', type: 'chair', zone: '01', name: 'სკამი', r: [6770, 3500, 7220, 3950], face: 'x0', h: 820, mat: 'fabric', st: V() },
  { id: 'CH-01e', type: 'chair', zone: '01', name: 'სკამი', r: [6275, 2220, 6725, 2670], face: 'y1', h: 820, mat: 'fabric', st: V() },
  { id: 'CH-01f', type: 'chair', zone: '01', name: 'სკამი', r: [6275, 4025, 6725, 4475], face: 'y0', h: 820, mat: 'fabric', st: V() },
  { id: 'SF-01', type: 'sofa', zone: '01', name: 'დივანი 2800 × 900', r: [8600, 1975, 9500, 4775], face: 'x1', h: 800, mat: 'fabric',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'AC-01a', type: 'armchair', zone: '01', name: 'სავარძელი', r: [9970, 1420, 10770, 2220], face: 'y1', h: 800, mat: 'fabricWarm', st: V() },
  { id: 'AC-01b', type: 'armchair', zone: '01', name: 'სავარძელი', r: [9970, 4530, 10770, 5330], face: 'y0', h: 800, mat: 'fabricWarm', st: V() },
  { id: 'CT-01', type: 'coffee', zone: '01', name: 'ჟურნალების მაგიდა 1000 × 500', r: [10150, 2875, 10650, 3875], h: 400, mat: 'worktop',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'F2', code: 'F2', type: 'console', zone: '01', name: 'TV-კონსოლი (ჩამოკიდებული)', r: [11515, 1515, 11985, 5235], z0: 145, h: 500, face: 'x0', mat: 'oak', drawers: 5,
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec' }, note: 'A.15: 3720 × 500 × 355, ზედა ნიშნული H 500, ქვემოთ — LED ლენტი.' },
  { id: 'F2-shelf', code: 'F2', type: 'slab', zone: '01', name: 'თარო LED-ით (F2)', r: [11735, 1875, 11985, 4875], z0: 2000, h: 2100, mat: 'oak',
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'vec' }, note: 'A.15: სიგრძე 3000, სისქე 100, H 2100; სიღრმე (250) — ვარაუდი, თარო ნიშის ცენტრშია.' },
  { id: 'F2-panel', code: 'F2', type: 'slab', zone: '01', name: 'ნიშის ხის პანელი', r: [11975, 1500, 12000, 5250], z0: 0, h: 3000, mat: 'oakDark',
    st: { w: 'pdf', d: 'assumed', h: 'assumed', pos: 'render' }, note: 'რენდერი A01: TV-ს კედელი ხის პანელით.' },
  { id: 'TV-01', type: 'tv', zone: '01', name: 'ტელევიზორი', r: [11845, 2605, 11895, 4145], z0: 867, h: 1733, face: 'x0', st: V() },
  { id: 'F9', code: 'F9', type: 'slats', zone: '01', name: 'ღარებიანი ტიხარი (შესასვლელი)', r: [6300, 5400, 8500, 5500], h: 3000, n: 31, slat: 37, mat: 'oak',
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec' }, note: 'A.16: 1368 + 828 = 2196, სიმაღლე 3000; A.8: 31 ლამელი.' },
  { id: 'F9-bench', code: 'F9', type: 'slab', zone: '01', name: 'სკამი (F9)', r: [6300, 5500, 7670, 5800], z0: 340, h: 400, mat: 'oak',
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec' }, note: 'A.16: 1368, სიმაღლე 400.' },
  { id: 'F9-shelf', code: 'F9', type: 'slab', zone: '01', name: 'თარო (F9)', r: [6666, 5500, 7666, 5800], z0: 1680, h: 1800, mat: 'white',
    st: { w: 'pdf', d: 'assumed', h: 'vec', pos: 'vec' }, note: 'A.16: 1000 × 120; სიმაღლე — ნახაზიდან, სიღრმე — ვარაუდი.' },
  { id: 'F9-mirror', code: 'F9', type: 'mirror', zone: '01', name: 'სარკე (F9)', r: [7670, 5500, 8500, 5535], z0: 0, h: 3000, face: 'y1',
    st: { w: 'pdf', d: 'vec', h: 'pdf', pos: 'vec' }, note: 'A.16: 828 × 3000.' },
  { id: 'F3', code: 'F3', type: 'wardrobe', zone: '01', name: 'შესასვლელის კარადა', r: [10515, 6485, 11985, 7185], h: 3000, face: 'x0', mat: 'white',
    mods: [18, '650f', 392, 392, 18], split: 2210, st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' },
    note: 'A.15: 650 (ღარებიანი) + 392 + 392 = 1470, სიღრმე 700, სიმაღლე 3000.' },

  // ---- აბაზანა 03
  { id: 'F6', code: 'F6', type: 'vanity', zone: '03', name: 'ნიჟარის კარადა 1570 × 500', r: [315, 4515, 815, 6085], z0: 450, h: 900, face: 'x1', mat: 'taupe',
    basin: [395, 5010, 715, 5585], basinH: 130, fluted: true,
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' }, note: 'A.16: 1570 × 500 × 450, ზედა ნიშნული H 900; ზედ — ჭურჭლისებრი ნიჟარა.' },
  { id: 'F6-mirror', code: 'F6', type: 'mirror', zone: '03', name: 'სარკე 1150 × 1500 (F6)', r: [300, 4722, 320, 5872], z0: 1050, h: 2550, face: 'x1',
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'assumed' }, note: 'A.16: 1150 × 1500, მომრგვალებული კუთხეები; დაკიდების სიმაღლე და ადგილი — ვარაუდი (ნიჟარის ცენტრში).' },
  { id: 'F5', code: 'F5', type: 'wardrobe', zone: '03', name: 'მაღალი კარადა', r: [2285, 4515, 2585, 5185], h: 3000, face: 'x0', mat: 'white', mods: [670],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' }, note: 'A.16: 670 × 300 × 3000.' },
  { id: 'F5-A', code: 'F5-A', type: 'box', zone: '03', name: 'ინსტალაციის ყუთი (F5-A)', r: [2435, 5315, 2600, 6085], h: 1500, mat: 'oak',
    st: { w: 'vec', d: 'pdf', h: 'pdf', pos: 'vec' }, note: 'A.16: 800 × 200 × 1500; გეგმაზე 770 × 165 (A.9 „165“).' },
  { id: 'WC-03', type: 'wc', zone: '03', name: 'ჩამოკიდებული უნიტაზი', r: [1875, 5520, 2430, 5880], face: 'x0', st: V() },
  { id: 'GL-03', type: 'glass', zone: '03', name: 'საშხაპის მინის კარი', r: [835, 6140, 2065, 6160], h: 2000,
    st: { w: 'pdf', d: 'assumed', h: 'assumed', pos: 'vec' } },

  // ---- აბაზანა 04
  { id: 'F7-v', code: 'F7', type: 'vanity', zone: '04', name: 'ნიჟარის კარადა 900 × 480 (F7)', r: [2715, 6235, 3195, 7135], z0: 350, h: 850, face: 'x1', mat: 'white',
    basin: [2770, 6385, 3140, 6985], basinH: 0,
    st: { w: 'pdf', d: 'pdf', h: 'vec', pos: 'vec' }, note: 'A.16: 900 × 480 × 500 (გეგმაზე წერია 1000 × 485 — იხ. წინააღმდეგობები). ჯაჭვი 500 / 350 / 1600 → კორპუსი ≈0.35–0.85 მ.' },
  { id: 'F7-mirror', code: 'F7', type: 'mirror', zone: '04', name: 'სარკე 900 × 1600 (F7)', r: [2700, 6235, 2720, 7135], z0: 1200, h: 2800, face: 'x1',
    st: { w: 'pdf', d: 'assumed', h: 'pdf', pos: 'vec' } },
  { id: 'WC-04', type: 'wc', zone: '04', name: 'ჩამოკიდებული უნიტაზი', r: [2870, 5620, 3425, 5980], face: 'x1', st: V() },
  { id: 'IB-04', type: 'box', zone: '04', name: 'ინსტალაციის ყუთი', r: [2715, 5415, 2865, 6185], h: 1200, mat: 'porcelain', st: V() },
  { id: 'GL-04', type: 'glass', zone: '04', name: 'საშხაპის მინის ტიხარი', r: [2715, 5390, 4000, 5410], h: 2000, st: { w: 'vec', d: 'assumed', h: 'assumed', pos: 'vec' } },
  { id: 'TR-04', type: 'towel', zone: '04', name: 'პირსახოცის საშრობი', r: [4195, 6540, 4285, 7000], z0: 400, h: 1600, st: V() },

  // ---- საძინებელი 05
  { id: 'BED-05', type: 'bed', zone: '05', name: 'საწოლი 1900 × 2100', r: [12800, 1535, 14700, 3635], face: 'y1', h: 1100, mat: 'fabric',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'NS-05a', type: 'nightstand', zone: '05', name: 'ტუმბო', r: [12300, 3335, 12800, 3635], face: 'y0', h: 500, mat: 'white', st: V() },
  { id: 'NS-05b', type: 'nightstand', zone: '05', name: 'ტუმბო', r: [14700, 3335, 15200, 3635], face: 'y0', h: 500, mat: 'white', st: V() },
  { id: 'F8', code: 'F8', type: 'wardrobe', zone: '05', name: 'კარადა ღია თაროებით', r: [15385, 315, 15985, 3635], h: 3000, face: 'x0', mat: 'oakDark',
    mods: ['700o', 524, 524, 524, 524, 524], split: 990, st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' },
    note: 'A.16: 700 (ღია თაროები) + 2620 = 3320, სიღრმე 600, სიმაღლე 3000.' },

  // ---- საძინებელი 06
  { id: 'BED-06', type: 'bed', zone: '06', name: 'საწოლი 1700 × 2100', r: [13500, 3765, 15200, 5865], face: 'y0', h: 1100, mat: 'fabric',
    st: { w: 'pdf', d: 'pdf', h: 'assumed', pos: 'vec' } },
  { id: 'NS-06a', type: 'nightstand', zone: '06', name: 'ტუმბო', r: [13000, 3765, 13500, 4065], face: 'y1', h: 500, mat: 'white', st: V() },
  { id: 'NS-06b', type: 'nightstand', zone: '06', name: 'ტუმბო', r: [15200, 3765, 15700, 4065], face: 'y1', h: 500, mat: 'white', st: V() },
  { id: 'F7', code: 'F7', type: 'wardrobe', zone: '06', name: 'კარადა გასაწევი კარებით', r: [12115, 3765, 12715, 5265], h: 2300, face: 'x1', mat: 'oak', mods: [750, 750],
    st: { w: 'pdf', d: 'pdf', h: 'pdf', pos: 'vec' }, note: 'A.16: 1500 × 600 × 2300, ორი გასაწევი კარი.' },
  { id: 'TC-06', type: 'console', zone: '06', name: 'TV-კომოდი', r: [13450, 6735, 15250, 7185], z0: 150, h: 600, face: 'y0', mat: 'oakDark', drawers: 3, legs: true, st: V() },
  { id: 'TV-06', type: 'tv', zone: '06', name: 'ტელევიზორი', r: [13570, 7135, 15105, 7185], z0: 900, h: 1765, face: 'y0', st: V() },
];
