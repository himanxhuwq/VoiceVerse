// Domain constants: moods, sound effects, voice emotions and the app's steps.

export const MOODS = ['calm', 'tense', 'mysterious', 'hopeful', 'sad', 'happy', 'epic'];

export const SFX_TYPES = {
  rain: 'Rain',
  thunder: 'Thunder',
  wind: 'Wind',
  door: 'Door',
  knock: 'Knock',
  steps: 'Footsteps',
  waves: 'Waves',
  birds: 'Birds',
  magic: 'Magic',
  fire: 'Fire',
  bell: 'Bell',
  sword: 'Sword',
  crowd: 'Crowd',
  horse: 'Horse',
  heartbeat: 'Heartbeat',
  clock: 'Clock tick',
  horn: 'Ship horn',
};

export const SFX_ICON = {
  rain: 'cloud-rain',
  thunder: 'cloud-lightning',
  wind: 'wind',
  door: 'door-open',
  knock: 'hand-fist',
  steps: 'footprints',
  waves: 'waves',
  birds: 'bird',
  magic: 'sparkle',
  fire: 'fire',
  bell: 'bell',
  sword: 'sword',
  crowd: 'users-three',
  horse: 'horse',
  heartbeat: 'heartbeat',
  clock: 'clock',
  horn: 'megaphone',
};

/** Default length in seconds of each synthesised sound effect. */
export const SFX_DUR = {
  rain: 9,
  thunder: 4.5,
  wind: 8,
  door: 1.6,
  knock: 1.2,
  steps: 3.2,
  waves: 9,
  birds: 6,
  magic: 2.6,
  fire: 7,
  bell: 3.5,
  sword: 1.4,
  crowd: 6,
  horse: 4,
  heartbeat: 5,
  clock: 4,
  horn: 4,
};

/** Emotion presets: browser rate/pitch/volume and ElevenLabs stability/style. */
export const EMO = {
  calm: { r: 0.95, p: 1, stab: 0.75, style: 0.05 },
  determined: { r: 1.04, p: 1, stab: 0.45, style: 0.35 },
  afraid: { r: 1.1, p: 1.12, stab: 0.3, style: 0.55 },
  joyful: { r: 1.06, p: 1.12, stab: 0.35, style: 0.5 },
  whisper: { r: 0.86, p: 0.92, vol: 0.65, stab: 0.6, style: 0.2 },
  sad: { r: 0.86, p: 0.9, stab: 0.5, style: 0.4 },
  angry: { r: 1.08, p: 0.92, stab: 0.3, style: 0.6 },
};

export const COLORS = ['var(--nar)', 'var(--acc)', 'var(--mus)', 'var(--sfx)', '#B9A6FF', '#7FB2FF', '#FF9EC4', '#9BE37A'];

export const STEPS = [
  ['story', 'Story'],
  ['analysis', 'Analysis'],
  ['voices', 'Voices'],
  ['build', 'Build'],
  ['timeline', 'Timeline'],
  ['player', 'Listen'],
  ['export', 'Export'],
];

/** Silence between lines and between scenes, in seconds. */
export const GAP = 0.38;
export const SCENE_GAP = 1.4;

export const GENRE_OPTIONS = ['auto', 'Fantasy', 'Adventure', 'Mystery', 'Sci-fi', 'Horror', 'Fairy tale', 'Drama'];

// Google's rolling alias for its current Flash model; if it ever stops working the app finds a replacement itself.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_ELEVEN_MODEL = 'eleven_multilingual_v2';
