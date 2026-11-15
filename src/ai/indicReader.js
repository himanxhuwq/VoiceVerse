// Hindi and Bengali rules for the built-in reader: who is speaking a quoted line,
// a character's gender from verb endings, and sound-effect words.
// The AI handles all of this better; these rules keep demo mode useful without a key.

const W = '[^\\s,.!?।॥"“”\'’‘:;]+'; // one word in any script
const ONE = `(${W})`;
const TWO = `(${W}(?:\\s${W})?)`; // up to two words ("बूढ़े बाबा")
// the words before a speech verb ("हवा की आत्मा फुसफुसाई", "मीरा धीरे से बोली"); adverbs are trimmed later
const NAMEV = `(${W}(?:\\s${W}){0,3}?)`;
const LEAD = '^\\s*[,.!?।]?\\s*';

/** Patterns for the text right after a quote, and right before it. Each captures the speaker's name. */
const SAY = {
  hi: {
    after: [`${LEAD}${TWO}\\s+ने\\s`, `${LEAD}${NAMEV}\\s+(?:बोली|बोला|बोले|चिल्लाई|चिल्लाया|फुसफुसाई|फुसफुसाया|पूछने)`],
    before: [`${TWO}\\s+ने\\s+(?:${W}\\s+){0,2}(?:कहा|पूछा)[,:।]?\\s*$`, `${TWO}\\s+(?:बोली|बोला|बोले)[,:।]?\\s*$`],
  },
  bn: {
    after: [
      `${LEAD}${NAMEV}\\s+(?:বলল|বললেন|বলে|ডাকল|ডাকলেন|জিজ্ঞেস|চেঁচিয়ে|ফিসফিস)`,
      `${LEAD}(?:বলল|বললেন|ডাকল|ডাকলেন)\\s+${ONE}`,
    ],
    before: [`${TWO}\\s+(?:বলল|বললেন)[,:।]?\\s*$`],
  },
};

/** Pronouns and other words that look like a name in those positions but are not one. */
const NOT_NAMES = new Set(
  'वह वे वो उसने उसे मैंने मैं हम तुम आप उन्होंने उसकी उसका यह फिर तब धीरे से সে তিনি আমি তুমি ও এবং তখন তারা'.split(' '),
);

/** Joining words that can sit before a name. */
const LEADING = new Set('और फिर तब तभी पर लेकिन আর এবং তখন কিন্তু'.split(' '));

/** Adverbs that sit between a name and the speech verb. */
const FILLER = new Set(
  'धीरे से ज़ोर जोर हँसकर मुस्कुराकर गुस्से में फिर तब भी बहुत डरकर काँपती काँपते हुए आवाज़ हळूच हळू जोरात हसत আস্তে জোরে হেসে মেতুவாக மெதுவாக మెల్లగా ધીમેથી آہستہ زور'.split(
    ' ',
  ),
);

/** The speaker of a quoted line from the text around it, or null. */
export function indicSpeaker(after, before, lang) {
  const rules = SAY[lang];
  if (!rules) return null;
  for (const [text, list] of [
    [after, rules.after],
    [before, rules.before],
  ]) {
    for (const p of list) {
      const m = text.match(new RegExp(p, 'u'));
      if (!m) continue;
      let parts = m[1].trim().split(/\s+/);
      while (parts.length > 1 && FILLER.has(parts[parts.length - 1])) parts.pop();
      if (parts.length > 3) parts = parts.slice(0, 2);
      while (parts.length > 1 && LEADING.has(parts[0])) parts.shift(); // "और मीरा" → "मीरा"
      if (parts.some((w) => NOT_NAMES.has(w))) return null;
      return parts.join(' ');
    }
  }
  return null;
}

/** Verb endings that mark a female or male subject. */
const GENDER_VERBS = {
  hi: {
    female: 'बोली|चिल्लाई|फुसफुसाई|गई|थी|आई|मुस्कुराई|रोई|हँसी|कहने लगी|सोचने लगी|उठी|बैठी',
    male: 'बोला|बोले|चिल्लाया|चिल्लाए|फुसफुसाया|गया|था|आया|मुस्कुराया|रोया|हँसा|कहने लगा|सोचने लगा|उठा|बैठा',
  },
};

/** Family and title words that give away gender ("रामू काका", "ঠাকুমা"). */
const FEMALE_WORDS =
  /माँ|मां|दादी|नानी|काकी|चाची|मौसी|बहन|दीदी|रानी|देवी|लड़की|মা|ঠাকুমা|দিদিমা|দিদি|মাসি|পিসি|বোন|দেবী|রানি|মেয়ে/;
const MALE_WORDS = /काका|चाचा|बाबा|दादा|नाना|भाई|भैया|राजा|पिता|लड़का|বাবা|দাদু|দাদা|কাকা|মামা|ভাই|রাজা|ছেলে/;

/** 'female' | 'male' | 'unknown' from the name itself or the verbs that follow it in the story. */
export function indicGender(text, name, lang) {
  if (FEMALE_WORDS.test(name)) return 'female';
  if (MALE_WORDS.test(name)) return 'male';
  const g = GENDER_VERBS[lang];
  if (!g) return 'unknown';
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const near = (verbs) => (text.match(new RegExp(`${esc}\\s+(?:${W}\\s+){0,3}(?:${verbs})`, 'gu')) || []).length;
  const f = near(g.female);
  const m = near(g.male);
  return f > m ? 'female' : m > f ? 'male' : 'unknown';
}

/** Sound-effect words per language (matched anywhere in a line). */
export const INDIC_SFX = {
  hi: {
    rain: ['बारिश', 'वर्षा', 'बरसात', 'बूँद'],
    thunder: ['बिजली', 'गरज', 'कड़क'],
    wind: ['हवा', 'आँधी', 'तूफ़ान', 'तूफान'],
    door: ['दरवाज़ा', 'दरवाजा', 'दरवाज़े', 'दरवाजे', 'किवाड़'],
    knock: ['खटखट', 'दस्तक'],
    steps: ['कदम', 'आहट', 'सीढ़ी', 'सीढ़ियाँ'],
    waves: ['समुद्र', 'लहर', 'सागर', 'किनारे'],
    birds: ['चिड़िया', 'पक्षी', 'कोयल', 'कौआ', 'मोर'],
    magic: ['जादू', 'चमक', 'रोशनी'],
    fire: ['आग', 'अलाव', 'मशाल', 'दीया', 'दीपक'],
    bell: ['घंटी', 'घंटा', 'घंटियाँ'],
    crowd: ['भीड़', 'बाज़ार', 'बाजार', 'मेला'],
    horse: ['घोड़ा', 'घोड़े'],
    heartbeat: ['धड़कन', 'दिल धड़'],
    clock: ['घड़ी', 'टिक'],
  },
  bn: {
    rain: ['বৃষ্টি'],
    thunder: ['বজ্র', 'বিদ্যুৎ'],
    wind: ['হাওয়া', 'বাতাস', 'ঝড়'],
    door: ['দরজা'],
    waves: ['সমুদ্র', 'ঢেউ'],
    birds: ['পাখি'],
    fire: ['আগুন', 'প্রদীপ'],
    bell: ['ঘণ্টা'],
  },
};
