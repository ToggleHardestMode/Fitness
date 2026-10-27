// Independently selected factual values from four cited published sources.
// Per published reference serving, NOT an exact hawker portion; no bulk SG FoodID data.
// Numeric facts curated in private FitnessPilot report on 2026-10-26.
export const SG_REFERENCE_SOURCES=Object.freeze({
  "NUP": {
    "name": "National University Polyclinics",
    "url": "https://www.nup.com.sg/Documents/Brochure/Carbohydrate%20Counting.pdf",
    "note": "Clinic portion reference; individual plate size can differ."
  },
  "YEO21": {
    "name": "Yeo et al. 2021 · Foods · CC BY 4.0",
    "url": "https://doi.org/10.3390/foods10071659",
    "note": "One sampled food-court serving; not a Singapore-wide average."
  },
  "SINGHEALTH": {
    "name": "SingHealth/KKH HealthXchange",
    "url": "https://www.healthxchange.sg/food-nutrition/food-tips/best-worst-singapore-hawker-malay-breakfast-foods-nasi-lemak-mee-siam-soto",
    "note": "Published reference portion; not guaranteed for another stall."
  },
  "HPB2016": {
    "name": "MOH–HPB obesity guideline 2016 Annex A",
    "url": "https://www.hpb.gov.sg/docs/default-source/pdf/obesity-cpg_main_for-online-30-aug.pdf",
    "note": "Reference ingredient/food portion; not necessarily a whole meal."
  }
});
export const SG_MACRO_REFERENCES=Object.freeze([
  {
    "id": "ref-nup-01",
    "name": "Chicken rice, skin removed",
    "portion": "1 plate",
    "kcal": 635,
    "protein": 26,
    "carbs": 84,
    "fat": 22,
    "sourceKey": "NUP",
    "aliases": [
      "chicken rice",
      "hainanese chicken rice",
      "白鸡饭"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-02",
    "name": "Char siew rice",
    "portion": "1 plate",
    "kcal": 605,
    "protein": 24,
    "carbs": 91,
    "fat": 16,
    "sourceKey": "NUP",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-03",
    "name": "Duck rice, skin removed",
    "portion": "1 plate",
    "kcal": 530,
    "protein": 24,
    "carbs": 84,
    "fat": 11,
    "sourceKey": "NUP",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-04",
    "name": "Mee rebus",
    "portion": "1 plate",
    "kcal": 559,
    "protein": 21,
    "carbs": 78,
    "fat": 18,
    "sourceKey": "NUP",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-05",
    "name": "Mee siam",
    "portion": "1 plate",
    "kcal": 562,
    "protein": 19,
    "carbs": 80,
    "fat": 18,
    "sourceKey": "NUP",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-06",
    "name": "Mutton briyani",
    "portion": "1 plate",
    "kcal": 752,
    "protein": 36,
    "carbs": 96,
    "fat": 25,
    "sourceKey": "NUP",
    "aliases": [
      "biryani",
      "nasi briyani mutton"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-07",
    "name": "Roti prata, plain",
    "portion": "1 piece",
    "kcal": 163,
    "protein": 5,
    "carbs": 20,
    "fat": 7,
    "sourceKey": "NUP",
    "aliases": [
      "prata plain",
      "roti prata",
      "prata"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-08",
    "name": "Nasi lemak, fried egg and anchovies",
    "portion": "1 plate",
    "kcal": 494,
    "protein": 13,
    "carbs": 80,
    "fat": 14,
    "sourceKey": "NUP",
    "aliases": [
      "nasi lemak"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-09",
    "name": "Chicken porridge",
    "portion": "1 bowl",
    "kcal": 181,
    "protein": 12,
    "carbs": 21,
    "fat": 6,
    "sourceKey": "NUP",
    "aliases": [
      "chicken congee"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-nup-10",
    "name": "Sliced fish bee hoon soup, no milk",
    "portion": "1 bowl",
    "kcal": 375,
    "protein": 32,
    "carbs": 53,
    "fat": 4,
    "sourceKey": "NUP",
    "aliases": [
      "fish bee hoon soup",
      "sliced fish bee hoon"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-11",
    "name": "Steamed chicken rice",
    "portion": "412 g sampled plate",
    "kcal": 778,
    "protein": 38,
    "carbs": 88,
    "fat": 30,
    "sourceKey": "YEO21",
    "aliases": [
      "chicken rice",
      "hainanese chicken rice",
      "白鸡饭"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-12",
    "name": "Roasted chicken rice",
    "portion": "285 g sampled plate",
    "kcal": 524,
    "protein": 24,
    "carbs": 67,
    "fat": 18,
    "sourceKey": "YEO21",
    "aliases": [
      "chicken rice",
      "roasted chicken rice",
      "烧鸡饭"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-13",
    "name": "Char kway teow",
    "portion": "362 g sampled plate",
    "kcal": 659,
    "protein": 15,
    "carbs": 99,
    "fat": 23,
    "sourceKey": "YEO21",
    "aliases": [
      "char kuay teow",
      "fried kway teow",
      "炒粿条"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-14",
    "name": "Fried carrot cake",
    "portion": "271 g sampled plate",
    "kcal": 475,
    "protein": 25,
    "carbs": 24,
    "fat": 31,
    "sourceKey": "YEO21",
    "aliases": [
      "chai tow kway",
      "carrot cake"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-15",
    "name": "Minced meat mee pok",
    "portion": "383 g sampled plate",
    "kcal": 620,
    "protein": 32,
    "carbs": 64,
    "fat": 26,
    "sourceKey": "YEO21",
    "aliases": [
      "bak chor mee",
      "bcm",
      "minced pork noodles"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-16",
    "name": "Laksa",
    "portion": "577 g sampled bowl",
    "kcal": 881,
    "protein": 46,
    "carbs": 106,
    "fat": 30,
    "sourceKey": "YEO21",
    "aliases": [
      "curry laksa"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-17",
    "name": "Fried Hokkien mee",
    "portion": "328 g sampled plate",
    "kcal": 446,
    "protein": 18,
    "carbs": 82,
    "fat": 5,
    "sourceKey": "YEO21",
    "aliases": [
      "hokkien mee",
      "hokkien prawn mee"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-18",
    "name": "Sin Chew bee hoon",
    "portion": "386 g sampled plate",
    "kcal": 635,
    "protein": 26,
    "carbs": 88,
    "fat": 20,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-19",
    "name": "Ayam penyet",
    "portion": "425 g sampled plate",
    "kcal": 862,
    "protein": 38,
    "carbs": 92,
    "fat": 38,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-20",
    "name": "Mee bandung",
    "portion": "466 g sampled bowl",
    "kcal": 693,
    "protein": 35,
    "carbs": 84,
    "fat": 24,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-21",
    "name": "Mee bakso",
    "portion": "435 g sampled bowl",
    "kcal": 635,
    "protein": 25,
    "carbs": 113,
    "fat": 9,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-22",
    "name": "Tahu goreng set",
    "portion": "402 g sampled portion",
    "kcal": 664,
    "protein": 41,
    "carbs": 35,
    "fat": 40,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-23",
    "name": "Nasi kampung goreng",
    "portion": "405 g sampled plate",
    "kcal": 772,
    "protein": 29,
    "carbs": 100,
    "fat": 29,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-24",
    "name": "Ikan penyet",
    "portion": "274 g sampled portion",
    "kcal": 502,
    "protein": 21,
    "carbs": 61,
    "fat": 19,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-25",
    "name": "Egg prata with chicken curry",
    "portion": "477 g sampled set",
    "kcal": 891,
    "protein": 37,
    "carbs": 110,
    "fat": 34,
    "sourceKey": "YEO21",
    "aliases": [
      "egg prata",
      "roti prata egg"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-26",
    "name": "Masala thosai",
    "portion": "569 g sampled set",
    "kcal": 971,
    "protein": 40,
    "carbs": 115,
    "fat": 39,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-27",
    "name": "Putu mayam",
    "portion": "193 g sampled portion",
    "kcal": 312,
    "protein": 4,
    "carbs": 63,
    "fat": 5,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "snack"
  },
  {
    "id": "ref-yeo21-28",
    "name": "Vegetable biryani",
    "portion": "640 g sampled portion",
    "kcal": 911,
    "protein": 27,
    "carbs": 120,
    "fat": 36,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-29",
    "name": "Idli set",
    "portion": "389 g sampled set",
    "kcal": 594,
    "protein": 24,
    "carbs": 68,
    "fat": 25,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-30",
    "name": "Nasi lemak (larger sampled meal)",
    "portion": "395 g sampled plate",
    "kcal": 741,
    "protein": 36,
    "carbs": 70,
    "fat": 35,
    "sourceKey": "YEO21",
    "aliases": [
      "nasi lemak"
    ],
    "occasion": "meal"
  },
  {
    "id": "ref-yeo21-31",
    "name": "Egg thosai",
    "portion": "325 g sampled set",
    "kcal": 484,
    "protein": 24,
    "carbs": 55,
    "fat": 19,
    "sourceKey": "YEO21",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-singhealth-32",
    "name": "Meehoon soto",
    "portion": "902 g reference bowl",
    "kcal": 359,
    "protein": 20,
    "carbs": 31,
    "fat": 17,
    "sourceKey": "SINGHEALTH",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-singhealth-33",
    "name": "Lontong with sayur lodeh",
    "portion": "775 g reference portion",
    "kcal": 798,
    "protein": 46,
    "carbs": 64,
    "fat": 40,
    "sourceKey": "SINGHEALTH",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-singhealth-34",
    "name": "Curry puff",
    "portion": "37 g reference piece",
    "kcal": 131,
    "protein": 4,
    "carbs": 11,
    "fat": 8,
    "sourceKey": "SINGHEALTH",
    "aliases": [],
    "occasion": "snack"
  },
  {
    "id": "ref-singhealth-35",
    "name": "Pisang goreng",
    "portion": "65 g reference piece",
    "kcal": 197,
    "protein": 1,
    "carbs": 36,
    "fat": 5,
    "sourceKey": "SINGHEALTH",
    "aliases": [],
    "occasion": "snack"
  },
  {
    "id": "ref-hpb2016-36",
    "name": "Chicken curry",
    "portion": "120 g",
    "kcal": 161,
    "protein": 20.1,
    "carbs": 8.7,
    "fat": 5.6,
    "sourceKey": "HPB2016",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-hpb2016-37",
    "name": "Chicken meat, boiled",
    "portion": "90 g",
    "kcal": 165,
    "protein": 26.3,
    "carbs": 0,
    "fat": 6.6,
    "sourceKey": "HPB2016",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-hpb2016-38",
    "name": "Egg omelette",
    "portion": "100 g",
    "kcal": 195,
    "protein": 10.9,
    "carbs": 0,
    "fat": 16.8,
    "sourceKey": "HPB2016",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-hpb2016-39",
    "name": "Popiah",
    "portion": "140 g",
    "kcal": 188,
    "protein": 7.6,
    "carbs": 14.3,
    "fat": 11.2,
    "sourceKey": "HPB2016",
    "aliases": [],
    "occasion": "meal"
  },
  {
    "id": "ref-hpb2016-40",
    "name": "Tau huay",
    "portion": "300 g",
    "kcal": 177,
    "protein": 6.9,
    "carbs": 33.3,
    "fat": 1.8,
    "sourceKey": "HPB2016",
    "aliases": [],
    "occasion": "snack"
  }
].map(row=>Object.freeze(row)));
