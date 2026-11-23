// What counts as "frontier tech" for the Frontier mandate: companies whose core is new technology, not an app
// that uses it. AI labs and model builders count; software "powered by AI" does not. Used by build_data.mjs,
// with hand corrections in research/frontier_manual.json ({ "<company id>": true | false }).
const DEEP = new RegExp([
  // robots, vehicles, air and space
  String.raw`\brobot\w*|\bhumanoid|self-driving|driverless|drive themselves|autonomous (vehicle|truck|car|driving|flight|ship|boat|tractor|deliver|mobile)\w*|\blidar\b|\bdrones?\b|\buavs?\b|\bevtol|air taxi|electric (aircraft|plane|vtol)|\baircraft|jet engine|supersonic|hypersonic|\brockets?\b|launch vehicle|\bsatellites?\b|spacecraft|\borbit(al)?\b|space station|\blunar\b|microgravity|space (tug|debris|manufactur|launch|company)`,
  // compute
  String.raw`semiconductor|chipmaker|\b(ai|computer|photonic|optical|analog|inference|training|edge|memory|neuromorphic|custom|rf|5g|radar)[ -]chips?\b|\bchip (design|startup|maker)|silicon (photonics|carbide|wafer)|photonic|\bquantum\b|superconduct|\b(computer|ai|graphics|neural|quantum|edge|optical) processors?\b|\bgpus?\b|\bwafers?\b|lithograph|neuromorphic|optical comput|data ?cent(er|re) (hardware|cooling|chips)`,
  // energy, climate hardware, materials
  String.raw`\bfusion\b|\bfission\b|\bnuclear\b|\breactors?\b|\bbatter(y|ies)\b|solid-state|electroly[sz]|\bhydrogen\b|geothermal|carbon (capture|removal)|direct air capture|\bco2 into|grid-scale|energy storage|solar (cells?|panels?|modules?|tech)|perovskite|tokamak|superconducting magnets|\bcement\b|green steel|\bsteel\b|\bgraphite\b|green chemicals|\bchemicals? (from|using|made)|new materials?|materials (science|discovery)|metamaterial|desalination|heat pumps?|thermal storage|\bev charging hardware|electric (motors?|trucks?|boats?|ships?)`,
  // biology
  String.raw`\bgenes?\b|genom|crispr|\bmrna\b|\brna\b|\bdna\b|proteins?\b(?! bars?)|antibod|therapeut|gene therap|drug (discovery|development|candidates?|design)|(makes|developing|develops|our) drugs|drugs (that|for|to)|cell therap|synthetic biolog|\benzym|microb(e|ial|iome)|\bmolecul|vaccine|tumou?r|cancer (drug|therap|detection|test|screening)|clinical-stage|biotech|lab-grown|cultivated meat|precision fermentation|peptide|brain-computer|neural interface|neurotech|\bimplant|longevity (biotech|therap|drug)|organoid|bioprint|diagnostic (device|test|tests)|blood test|sequenc(ing|er)|biomanufactur|plant-based (meat|protein)|alternative protein`,
  // AI at the frontier: models, labs and compute, not apps built on them
  String.raw`foundation models?|^large language models|large language models (for|that)|\b(builds?|building|trains?|training|develops?) (its own |their own |open |small |frontier |large |custom )?(language |foundation |ai |generative )?models\b|frontier (ai )?lab|ai (research )?lab\b|open-weight|\bagi\b|superintelligence|ai research (lab|company)|gpu cloud|ai (compute|chips?|supercomput)|non-transformer|world models?|\bml platform|machine learning platform|train(ing)? (and|&) deploy(ing)? (ml|machine learning|ai) models|model training`,
  // defence and advanced manufacturing
  String.raw`\bdefen[cs]e (tech|technology|hardware|startup|contractor|company|systems?)|missiles?|counter-drone|munitions|3d[- ]print|additive manufactur|nanotech|\blasers?\b|smart glasses|ar glasses|holograph`,
].join('|'), 'i');

// sector labels that are frontier on their own
const DEEP_SECTOR = /^(robotics|aerospace|space|quantum computing|deep tech|therapeutics|biotech|bio|synthetic biology|genomics|semiconductors|chips|fusion|nuclear|batteries|defen[cs]e|drones|autonomous vehicles|self-driving|green chemicals|materials|neurotech|ai models|foundation models|seafood robotics|agri robotics|medical robotics)$/i;
// YC's own tags that mean deep tech. Broad ones (Generative AI, Hardware, Climate, Manufacturing) don't count alone.
const DEEP_TAGS = new Set(['Robotics', 'Biotech', 'Biotechnology', 'Aerospace', 'Therapeutics', 'Defense', 'AI-powered Drug Discovery',
  'Drones', 'Drug discovery', 'Synthetic Biology', 'Genomics', 'Satellites', 'Space Exploration', 'Neurotechnology', 'Semiconductors',
  'Gene Therapy', 'Energy Storage', 'Carbon Capture and Removal', 'Autonomous Trucking', 'Autonomous Delivery', 'Advanced Materials',
  'Cellular Agriculture', 'Drug Delivery', 'Commercial Space Launch', 'Self-Driving Vehicles', 'Unmanned Vehicle', 'Cell Therapy',
  'Medical Robotics', 'CRISPR', 'Edge Computing Semiconductors', 'Genetic Engineering', 'Quantum Computing', 'Rocketry', 'Robotic Surgery',
  'Hydrogen Energy', 'Swarm Robotics', 'Fusion Energy', 'Bioplastic', 'Alternative Battery Tech', 'Autonomous Shipping', 'Lab-on-a-chip',
  'Lidar', 'Vaccines', 'Nuclear', 'Autonomous Vehicles']);
// look like deep tech, aren't
const NOT_DEEP = /robotic process automation|\brpa\b|software robots?|robo-?advis|robocall|\bbots? for\b|phone batter|battery (rental|sharing)|word processors?|payment processors?/i;

export function isFrontier(c, manual = {}) {
  if (c.id in manual) return !!manual[c.id];
  const text = `${c.p || ''} ${c.s || ''}`;
  if (NOT_DEEP.test(text)) return false;
  if (DEEP_SECTOR.test((c.s || '').trim())) return true;
  if ((c.tags || []).some((t) => DEEP_TAGS.has(t))) return true;
  return DEEP.test(c.p || '') || DEEP.test(c.s || '');
}
