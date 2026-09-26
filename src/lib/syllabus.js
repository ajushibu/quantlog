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
  /* Algebra: rebuilt from Rodha's "Algebra for CAT 2027" playlist (101
     videos) instead of the earlier placeholder class names. 6 videos
     dropped as off-topic for this section (3 Statistics, 1 Number System,
     2 Trigonometry-flavored practice videos mixed into the same playlist).
     No practice-set checkpoints in this playlist, so — like VARC — it's
     modeled as thematic groups over a flat class list rather than S(). */
  {
    id: "algebra", name: "Algebra", groups: [
      { name: "Algebraic Identities", count: 6 },
      { name: "Simple Equations", count: 6 },
      { name: "Quadratic & Cubic Equations", count: 6 },
      { name: "Inequalities", count: 9 },
      { name: "Progressions (AP/GP)", count: 6 },
      { name: "Indices & Surds", count: 5 },
      { name: "Functions", count: 10 },
      { name: "Graphs", count: 4 },
      { name: "Logarithms", count: 1 },
      { name: "Algebra Practice Sessions", count: 16 },
      { name: "Advanced Mixed Practice", count: 20 },
      { name: "Algebra Workshop (CAT 2022)", count: 6 },
    ],
    items: [
      // Algebraic Identities (6)
      "Algebraic Identities 1", "Algebraic Identities 2: Applications", "Algebraic Identities 3: Rationalization",
      "Algebraic Identities 4: Exponential Equations", "Algebraic Identities 5: Standard Forms",
      "Range of K and Exponents",
      // Simple Equations (6)
      "Simple Equations 1: Linear Equation Solutions", "Simple Equations 2: Integer Solutions",
      "Simple Equations 3: Integral Solutions Shortcuts", "Simple Equations 4: Reciprocal Equations",
      "Simple Equations 5: Digit-Based Problems", "Simple Equations 6: Reverse Order Strategy",
      // Quadratic & Cubic Equations (6)
      "Quadratic Equations 1: Fundamentals & Inequalities", "Quadratic Equations 2: Nature of Roots",
      "Quadratic Equations 3: Imaginary & Common Roots", "Cubic Equations 1: Roots",
      "Cubic Equations 2: Roots & Coefficients", "Quadratic Equations 4: Minimum Value",
      // Inequalities (9)
      "Inequalities 1: Rules & Applications", "Inequalities 2: Min/Max Sum Given Product",
      "Inequalities 3: Sum of Number & Reciprocal", "Inequalities 4: AM-GM-HM Applications",
      "Inequalities 5: AM-HM Applications", "Inequalities 6: Polynomial & Rational Inequalities",
      "Inequalities 7: AM-GM for Minimum Value", "Inequalities 8: AM-HM Application",
      "Inequalities 9: Rational Inequality & Quadratic Range",
      // Progressions AP/GP (6)
      "Arithmetic Progression 1: AP Average Funda", "Arithmetic Progression 2: Sum of an AP",
      "Sequence & Series: Nth Term", "Geometric Progression 1: Basics",
      "Geometric Progression 2: Three Numbers in GP", "Geometric Progression 3: Combined AP & GP",
      // Indices & Surds (5)
      "Indices & Surds 1: Comparing Surds (Constant Sum)", "Indices & Surds 2: Comparing Surds",
      "Indices & Surds 3: Square Root of Surds", "Indices & Surds 4: Square Root of Surds (contd.)",
      "Indices & Surds 5: Comparing Exponential Expressions",
      // Functions (10)
      "Functions 1: Domain, Range & Types", "Functions 2: Onto & Bijective Functions",
      "Functions 3: Subset Counting & Functional Equations", "Functions 4: General Solutions",
      "Functions 5: Composite & Even-Odd Functions", "Functions 6: Greatest Integer Function Series",
      "Functions 7: Domain of Logarithmic Functions", "Functions 8: GIF & Log Remainders",
      "Functions 9: AM-GM Inequality Application", "Functions 10: Functional Equations by Pattern",
      // Graphs (4)
      "Graphs 1: Basic Function Graphs", "Graphs 2: Modulus Graph Area",
      "Graphs 3: Number of Solutions Graphically", "Graphs 4: Graphing Quadratic Equations",
      // Logarithms (1)
      "Logarithms: Logarithm Properties",
      // Algebra Practice Sessions (16, sessions 9 & 15 don't exist in the playlist)
      "Practice Session 1: AM-GM Inequality Application", "Practice Session 2: Exponents & Powers",
      "Practice Session 3: Comparing Exponential Expressions", "Practice Session 4: Logarithmic & Quadratic Graphs",
      "Practice Session 5: Symmetric Polynomial Equations", "Practice Session 6: Geometric Mean of GP",
      "Practice Session 7: Domain of Logarithmic Functions", "Practice Session 8: Greatest Integer Function Logarithms",
      "Practice Session 10: Range of Algebraic Functions", "Practice Session 11: Splitting Denominators Series",
      "Practice Session 12: Sum of Squares Property", "Practice Session 13: Range of Rational Function",
      "Practice Session 14: Logarithm Base Conversion", "Practice Session 16: Greatest Integer Function Sums",
      "Practice Session 17: Greatest Integer Function Series", "Practice Session 18: Greatest Integer Function Equations",
      // Advanced Mixed Practice (20)
      "Quadratics: Roots & Coefficients", "Maxima-Minima: AM-GM With Quadratics",
      "Quadratics: Advanced Inequalities", "Inequalities: AM-GM With Three Terms",
      "Max-Min: Symmetric Expressions", "Logarithms & GP: Logs & Progressions",
      "Logarithms & Series: Log-Series Equations", "Cubic Equations: Roots of Cubics",
      "Logarithms: Tough Log Equations", "Indices & Surds: Exponential Equations",
      "Logarithms: Product of Roots", "Inequalities: Factoring Higher Powers 1",
      "Inequalities: Factoring Higher Powers 2", "Functions: Domain of Log Inequalities",
      "Functions: Functional Equations f(x+y)", "Polynomials: Higher-Degree Roots",
      "Equations: Linear, Quadratic & Cubic", "Series: Advanced Summation",
      "Progressions: Product Series Simplification", "Advanced Practice: Symmetry (CAT 2024)",
      // Algebra Workshop CAT 2022 (6)
      "Workshop 1: Advanced Algebra Questions", "Workshop 2: Advanced Algebra Questions",
      "Workshop 3: Advanced Algebra Questions", "Workshop 4: Advanced Algebra Questions",
      "Workshop 5: Factorizing Degree-4 Equations", "Workshop 6: Multiple Roots, 2 Eq. 3 Variables",
    ].map((name, i) => ({ id: `algebra-c${i}`, kind: "c", name })),
  },
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

/* ---------------- LRDI ----------------
   No LOD practice sets (nothing to grade beyond "watched it"), so each
   topic is a run of numbered video-chips rather than named classes.
   Counts and the one known gap (Games & Tournaments #7 is unlisted/
   missing) are taken directly from the Rodha playlist. */
export const LRDI_TOPICS = [
  { id: "lrdi-lca", name: "Linear & Circular Arrangement", count: 5 },
  { id: "lrdi-cubes", name: "Cubes", count: 4 },
  { id: "lrdi-ns", name: "Number Series", count: 6 },
  { id: "lrdi-qbp", name: "Quant Based Puzzle", count: 22 },
  { id: "lrdi-venn", name: "Venn Diagram", count: 9 },
  { id: "lrdi-maxmin1", name: "Maxi & Minim", count: 2 },
  { id: "lrdi-choc", name: "Chocolate Distribution", count: 2 },
  { id: "lrdi-games", name: "Games & Tournament", count: 8, gaps: [7] },
  { id: "lrdi-pie", name: "Pie Chart", count: 5 },
  { id: "lrdi-tab", name: "Tabular Set", count: 1 },
  { id: "lrdi-routes", name: "Routes & Network", count: 3 },
  { id: "lrdi-maxmin2", name: "Maxima Minima", count: 2 },
  { id: "lrdi-cal", name: "Calendars", count: 3 },
  { id: "lrdi-prac", name: "Practice Set", count: 13 },
];
