"use strict";
/* ============================================================================
   gbfilter.js — the guest book's quiet doorman.
   Blocks profanity/hate speech including leetspeak ($, 0, @…), misspellings
   and stretched letters. No lectures: a rejected line simply never takes.
   gbClean(text) → true if the line may enter the book.
   ============================================================================ */
(function () {

/* leet / symbol normalization */
const MAP = { "$": "s", "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a",
  "@": "a", "5": "s", "7": "t", "8": "b", "9": "g", "+": "t", "€": "e", "£": "l",
  "¢": "c", "*": "", ".": "", "-": "", "_": "", "'": "", "\"": "", "`": "" };

function normalize(s) {
  s = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  let sub = "", strip = "";
  for (const ch of s) {
    sub += (ch in MAP) ? MAP[ch] : ch;                     // $→s, 0→o …
    strip += /[a-z ]/.test(ch) ? ch : "";                  // decoration junked entirely
  }
  const variants = [];
  for (const v of [sub, strip]) {
    const squeezed = v.replace(/[^a-z]/g, "");
    variants.push(squeezed, squeezed.replace(/(.)\1+/g, "$1"));   // fuuuck → fuck
  }
  return { variants, spaced: sub.replace(/[^a-z ]/g, " ") };
}

/* substring stems — unambiguous, match anywhere, any spelling-stretch */
/* innocent words that contain a stem — pardoned before judgment */
const ALLOW = ["scunthorpe", "cockpit", "hancock", "hitchcock", "peacock", "cocktail",
               "shitake", "matsushita", "dickens", "dickinson"];

const SUB = [
  "fuck", "fuk", "fck", "fvck", "phuck", "phuk", "shit", "sh1t", "bitch", "cunt", "nigg", "nigga", "niger",
  "faggot", "fagot", "kike", "spic", "wetback", "chink", "gook", "beaner",
  "tranny", "trannie", "whore", "slut", "cock", "dick", "pussy", "pusy",
  "asshole", "ashole", "rape", "rapist", "nazi", "hitler", "kkk", "lynch",
  "molest", "pedo", "paedo", "porn", "penis", "vagina", "cum", "jizz",
  "blowjob", "handjob", "tits", "boob", "dildo", "retard", "r3tard", "spastic",
  "coon", "darkie", "towelhead", "raghead", "goyim", "shemale", "dyke",
];
/* whole-word only — short stems that live inside innocent words (class, assess…) */
const WORD = [
  "ass", "arse", "fag", "hoe", "ho", "tit", "sex", "gay", "homo", "jew",
  "anal", "nude", "milf", "thot", "simp", "incel", "twat", "wank", "bollocks",
  "prick", "screw you", "kys", "kill yourself", "die",
];

/* the strong stems also match with ONE smuggled letter between characters
   (fu$$ck → "fusck" still reads as what it is) */
const GAPPED = SUB.filter(s => s.length >= 4)
  .map(s => new RegExp(s.split("").join("[a-z]?")));

window.gbClean = function (text) {
  if (!text || !text.trim()) return false;
  let src = text.toLowerCase();
  for (const ok of ALLOW) src = src.split(ok).join(" ");
  const { variants, spaced } = normalize(src);
  for (const v of variants) {
    for (const s of SUB) if (v.includes(s)) return false;
    for (const rx of GAPPED) if (rx.test(v)) return false;
  }
  const words = spaced.split(/\s+/).filter(Boolean);
  for (const w of WORD) {
    if (w.includes(" ")) { if (spaced.includes(w)) return false; }
    else if (words.includes(w)) return false;
  }
  return true;
};

})();
