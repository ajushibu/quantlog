/* Shared syllabus (mirrors tracker v5). Used by AI classify and, in
   phase 2, by the UI. kinds: c = class, s = practice set, d = drill */
const S = (id, name, items) => ({
  id, name,
  items: items.map(([kind, label], i) => ({ id: `${id}-${kind}${i}`, kind, name: label })),
});

export const SECTIONS = [
  S("arith", "Arithmetic", [
    ["c","Pre-requisites to Percentages"],["c","Basic Percentages"],["c","Successive %"],["c","Change of Base"],
    ["s","Percentages"],
    ["c","SI and CI"],["s","Interest"],
    ["c","Profit and Loss, Discount"],["c","Faulty Weights and Impurities"],["s","Profit & Loss"],
    ["c","Ratio Basics"],["c","Proportion Basics"],["c","Partnership"],["s","Ratio, Proportion and Variation"],
    ["c","Average"],["c","Mean, Median, Mode"],["c","Weighted Average"],["s","Averages"],
    ["c","Mixtures & Alligation"],["c","Mixtures & Replacement"],["s","Alligations"],
    ["c","Basics of Time and Work"],["c","Work with Units & Alternate Work"],["c","Efficiency"],["c","Negative Work"],["s","Time and Work"],
    ["c","TSD Basics"],["c","Average Speed"],["c","Relative Speed"],["c","Boats & Streams"],["c","Linear Races"],["c","Circular Tracks"],["s","Time, Speed and Distance"],
  ]),
  S("algebra", "Algebra", [
    ["c","Linear Equations"],["c","Polynomial Theory"],["c","Quadratic Equations 1"],["c","Quadratic Equations 2"],
    ["c","Quadratic Eq — Common Roots"],["c","Quadratic Eq — Max, Min & Inequalities"],
    ["s","Quadratic and Other Equations"],["s","Inequalities"],
    ["c","Functions 1"],["c","Functions 2"],["s","Functions"],
    ["c","Sequence 1"],["c","Sequence 2"],["c","Arithmetic Progression"],["c","Sequence 3"],["c","Sequence 4"],["s","Progressions"],
    ["c","Logarithms"],["s","Logarithms"],
    ["c","Modulus & Graphs 1"],["c","Modulus 2"],["c","Modulus 3"],["c","Modulus 4"],["c","Modulus 5"],["c","Maxima & Minima"],
  ]),
  S("geo", "Geometry", [
    ["c","Lines & Angles 1"],["c","Lines & Angles 2"],["c","Properties of Triangles"],["c","Similarity"],
    ["c","Quadrilaterals"],["c","Polygons"],["c","Circles 1"],["c","Circles 2"],
    ["c","Mensuration 2D"],["c","Mensuration 3D"],["s","Geometry and Mensuration"],
    ["c","Mass Points"],["s","Coordinate Geometry"],
  ]),
  S("num", "Number System", [
    ["c","Classification of Numbers 1"],["c","Classification of Numbers 2"],["c","Classification of Numbers 3"],
    ["c","Properties of Digits"],["c","Factors, Multiples, LCM & HCF"],
    ["c","Divisibility, Cyclicity & Remainders 1"],["c","Divisibility, Cyclicity & Remainders 2"],
    ["c","Factorials & Highest Power"],["c","Base Systems"],["c","Applications in Algebra"],["s","Number Systems"],
  ]),
  S("mod", "Modern Math", [
    ["c","Fundamentals of Counting"],["c","nCr & nPr — Permutations"],["c","Arrangements — Numbers"],
    ["c","Arrangements — Boys & Girls"],["c","Arrangements — Words"],["c","Selection & Committee"],
    ["c","Selection — Handshakes"],["c","Selection — Whole Number Solutions"],["c","Selection — Natural Numbers"],
    ["c","Selection — Shortest Path"],["s","Permutations and Combinations"],
    ["c","Probability Basics"],["c","Coins"],["c","Dice"],["c","Bayes' Theorem"],["s","Probability"],
    ["c","Binomial Theorem"],["s","Set Theory"],
  ]),
  {
    id: "varc", name: "VARC", groups: [
      { name: "Foundations", count: 9 },
      { name: "Reading & Sentences", count: 8 },
      { name: "Options & Traps", count: 6 },
      { name: "Question Types", count: 8 },
      { name: "Paragraph Skills", count: 11 },
    ],
    items: [
      "CAT RC Insights 1", "CAT RC Insights 2", "Verbal Ability Insights", "Non-CAT Verbal",
      "Analysis for Learning 1", "Analysis for Learning 2", "Orientation to Reading Lessons",
      "Vocab", "Grammar for CAT",
      "Handling Complex Sentences", "Decoding WHY of Sentence", "Mind the Red — Main Point",
      "Author's Attitude", "Find Their Attitude", "Reading Passage", "Navigating Tough Passage", "Tough One",
      "What Is Wrong Option", "Option Trap", "Picking Traps", "Global Question", "Local Closed Q", "Local Open Q",
      "Argument", "Inference", "Assumption", "New Evidences (Impact)", "Strengthening & Weakening",
      "Author Agreement", "Specific Function Questions", "Twisted Q",
      "3 Pillars of Paragraph", "Unity", "Cohesion — Echo", "Cohesion — Pronoun", "Cohesion — Signal",
      "Cohesion — Sentence Block", "Coherence Zooming", "Paragraph Summary", "Paragraph Jumble",
      "Odd Sentence in Para", "Sentence Placement",
    ].map((name, i) => ({ id: `varc-c${i}`, kind: "c", name })),
  },
];

export const ALL_ITEMS = SECTIONS.flatMap((s) =>
  s.items.map((it) => ({ ...it, sectionId: s.id, sectionName: s.name }))
);
export const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
export const CLASSIFY_LIST = ALL_ITEMS;
