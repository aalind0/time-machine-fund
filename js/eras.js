// "It's 2016": one line per year on what the world looked like then, shown above each deal so players can
// judge timing. Only things that were known that year. Both cards in a deal share it, so it can't favour either.
export const ERAS = {
  2012: ['Facebook goes public', 'Instagram sells for $1B', 'a neural net wins ImageNet'],
  2013: ['Bitcoin passes $1,000', 'Snapchat turns down $3B', 'Tesla posts its first profit'],
  2014: ['Facebook buys WhatsApp for $19B', 'Oculus sells for $2B', 'Uber is valued at $40B'],
  2015: ['OpenAI starts as a nonprofit', 'Apple Watch ships', 'the WSJ questions Theranos'],
  2016: ['AlphaGo beats a Go champion', 'Pokémon Go goes viral', 'the Model 3 gets 400,000 pre-orders'],
  2017: ['Bitcoin nears $20,000', 'ICOs raise billions', 'Google publishes the Transformer'],
  2018: ['Crypto winter: bitcoin falls 70%+', 'GDPR takes effect', 'scooters flood the sidewalks'],
  2019: ['Uber and Lyft go public', 'WeWork’s IPO collapses', 'VC funding near record highs'],
  2020: ['COVID lockdowns', 'everyone is on Zoom', 'SPACs and remote work boom'],
  2021: ['A record $600B+ of venture money', 'NFTs peak', 'a new unicorn almost every day'],
  2022: ['Interest rates jump, valuations fall', 'FTX collapses', 'ChatGPT launches'],
  2023: ['The generative AI gold rush', 'Silicon Valley Bank fails', 'GPT-4 launches'],
  2024: ['About a third of VC goes to AI', 'Nvidia passes $3T', 'humanoid robots are the hype'],
  2025: ['AI labs raise record rounds', 'AI agents in every pitch', 'robotaxis reach more cities'],
  2026: ['AI agents everywhere', 'robots leave the lab', 'everyone is raising for AI'],
};

export function eraLine(year) {
  const y = Math.max(2012, Math.min(2026, year));
  return ERAS[y];
}
