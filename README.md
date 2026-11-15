# VoiceVerse

**Turn any written story into a cinematic audio experience.**

VoiceVerse is an AI-powered audio-story studio. Paste or upload a story and it finds the scenes and characters, gives every character a voice, adds a narrator, scores each scene with mood music, places sound effects, and mixes it all into one audio story you can play, edit and download.

Built by **Team Byte Busters** for the **GeNarrative** hackathon.

![Home screen](docs/screens/01-home.png)

## The problem

Writers, storytellers, podcasters and audiobook creators increasingly want their stories to be *heard*, not just read. But turning a written story into a good audio drama is slow, expensive and technical:

- **It needs a whole crew.** A narrator, a separate voice for every character, a composer or music library, a sound designer and an audio editor.
- **It needs skills most writers don't have.** Casting voices, timing dialogue, choosing music that fits each scene's mood, placing sound effects, and mixing it all so the voices stay clear.
- **It takes days, even for a few minutes of audio.** That puts audio storytelling out of reach for independent creators, students and small teams.
- **Plain text-to-speech isn't enough.** It reads a story in one flat voice, with no characters, no emotion, no music and no atmosphere.

## Our solution

**VoiceVerse turns any written story into a cinematic, multi-voice audio experience in minutes, with no audio skills needed.** The writer pastes a story and the AI does the work of the whole production crew:

| Production job | How VoiceVerse does it |
|---|---|
| **Script editor** | Gemini reads the story, splits it into scenes, and tags every line with its speaker and emotion |
| **Casting director** | Gemini reads each character's lines and recommends the best-fitting voice from the catalogue, explaining why |
| **Voice actors** | ElevenLabs performs every line with emotion-aware settings (afraid, whispering, joyful…) |
| **Composer** | Each scene gets a music bed that fits its mood (calm, tense, mysterious, epic…) |
| **Sound designer** | Sound effects the story mentions (rain, thunder, doors, footsteps, magic…) are placed on the right line |
| **Audio editor** | Everything is mixed with the music ducking under voices, then exported as MP3 or WAV |

The writer stays in control: they can rename characters, change any scene's mood, swap voices, tune speed, tone and emotion, and move, change or remove sound effects on a multi-track timeline before downloading.

It also works with **no API keys at all**. A built-in offline story reader and the browser's own voices keep the full flow working for anyone, anywhere.

## Try it

**Live demo:** https://himanxhuwq.github.io/VoiceVerse/

Run it locally:

```bash
npm install
npm run dev
```

Then open http://localhost:5173. No keys are needed: without them VoiceVerse runs in **demo mode** with the built-in story reader and your browser's voices. For the full AI pipeline, click **Demo mode → AI keys** and paste a [Gemini](https://aistudio.google.com/apikey) key and an [ElevenLabs](https://elevenlabs.io) key. Keys stay in your browser and are sent only to Google and ElevenLabs.

## What it does

| Step | What happens |
|---|---|
| **1. Story** | Paste text, upload a `.txt`, or have Gemini write a story from an idea |
| **2. Analysis** | AI splits the story into scenes and speaker-tagged lines, finds characters (gender, age), mood per scene, genre, narration style and sound cues |
| **3. Voices** | Gemini recommends the best voice for each character from their lines, with a reason; tune speed, tone and emotion, and preview any line |
| **4. Build** | Lines are recorded with ElevenLabs (3 in parallel), music is scored per mood, effects are placed, everything is mixed |
| **5. Timeline** | Multi-track editor: narration, dialogue, music and effects. Change a scene's music, swap, move, re-level or remove effects, reassign a line's speaker |
| **6. Listen** | Player with live lyrics, scene chapters, seekable waveform and "who's speaking" cast |
| **7. Export** | Download MP3 or WAV, or copy the full script |

## Architecture

```mermaid
flowchart LR
  A[Story text] --> B{Gemini key?}
  B -- yes --> C[Gemini Flash<br/>structured JSON analysis]
  B -- no --> D[Built-in reader<br/>rule-based NLP]
  C --> E[Scenes · lines · characters<br/>moods · SFX cues]
  D --> E
  E --> F[Auto-casting<br/>voice per character]
  F --> G{ElevenLabs key?}
  G -- yes --> H[ElevenLabs TTS<br/>recorded per line]
  G -- no --> I[Web Speech API<br/>live voices]
  E --> J[Procedural music<br/>per scene mood]
  E --> K[Procedural SFX<br/>17 synthesised effects]
  H --> L[Offline mixer<br/>ducking + compression]
  J --> L
  K --> L
  I --> M[Live playback engine]
  J --> M
  K --> M
  L --> N[Player · Timeline · MP3/WAV export]
  M --> N
```

### How the AI is used

- **Story analysis (Gemini).** One structured-output call (`responseMimeType: application/json`) returns the whole breakdown: characters with gender and age, 2–5 scenes with a mood from a fixed list, every line of the story in order tagged with its speaker and an emotion, and sound-effect cues anchored to the line where they happen. The reply is validated and normalised (unknown speakers fall back to the narrator, cue indexes are clamped). All prompts live in [`src/ai/prompts.js`](src/ai/prompts.js).
- **Story generation (Gemini).** Writes an original 300–380-word story shaped for audio drama: named characters, quoted dialogue with clear tags, and sounds a listener can hear.
- **AI voice casting (Gemini).** After analysis, Gemini acts as casting director: it reads each character's role and their own lines, compares them with the full voice catalogue (gender, age, accent, description), and picks the best-fitting voice for every character with a one-line reason, shown in the app as an "AI pick". Prompt: `castingPrompt` in [`src/ai/prompts.js`](src/ai/prompts.js).
- **Rule-based casting fallback.** Without Gemini, characters are matched to voices by gender, age (elder, young) and role (an ElevenLabs "narration" voice for the narrator); spirits get a slower, deeper whisper.
- **Emotional speech (ElevenLabs).** Each line's emotion maps to ElevenLabs `stability` and `style` settings (or rate, pitch and volume for browser voices), so an *afraid* line sounds different from a *calm* one.
- **Offline fallback.** If Gemini is unavailable, a rule-based reader ([`src/ai/localReader.js`](src/ai/localReader.js)) attributes dialogue from speech verbs and pronouns, infers gender and age, splits scenes at time words, and scores mood, genre and sound cues from keywords, so the demo never breaks.

### Audio engine

All music and sound effects are **synthesised in the browser with the Web Audio API**: no audio files, no licensing. Each mood (calm, tense, mysterious, hopeful, sad, happy, epic) has its own chord progression and texture, and 17 effects (rain, thunder, wind, doors, footsteps, magic, bells…) are built from filtered noise and oscillators. The mixer renders the story with an `OfflineAudioContext`, ducks the music under every voice, and runs a compressor on the master bus. Export encodes WAV directly and MP3 with lamejs.

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite |
| Animation | Motion (Framer Motion): page transitions, staggered reveals, shared-layout highlights, animated progress and waveforms |
| Story AI | Google Gemini Flash (structured JSON output; automatically switches to the newest Flash model if one is retired) |
| Voices | ElevenLabs Text-to-Speech, or the browser's Web Speech API |
| Music & SFX | Web Audio API (procedural synthesis) |
| Mixing | OfflineAudioContext with ducking and compression |
| Export | WAV encoder + lamejs (MP3) |
| Hosting | GitHub Pages via GitHub Actions |

## Project structure

```
src/
├─ main.jsx                 entry: restores the session, mounts <App>
├─ App.jsx                  shell: top bar, animated view switching, keyboard shortcuts
├─ ai/
│  ├─ prompts.js            Gemini prompt templates
│  ├─ gemini.js             Gemini client: analysis + story generation
│  ├─ localReader.js        offline rule-based story analyser
│  ├─ voices.js             voice lists, auto-casting, emotion → speech params
│  └─ tts.js                ElevenLabs + browser text-to-speech, previews
├─ audio/
│  ├─ nodes.js              Web Audio building blocks
│  ├─ music.js              procedural music per mood
│  ├─ sfx.js                17 procedural sound effects
│  ├─ mixer.js              timeline layout + offline mix rendering
│  ├─ playback.js           playback engine (mixed or live) + usePlayback hook
│  └─ exporter.js           WAV / MP3 encoding, script export
├─ state/
│  ├─ store.js              session state, persistence, API keys
│  ├─ navigation.js         step navigation, analyse / new story actions
│  ├─ build.js              the build pipeline + useBuild hook
│  └─ toast.js              notifications
├─ views/                   one component per step: Home, Story, Analysis,
│                           Voices, Build, Timeline, Player, Export
├─ components/              TopBar, SettingsModal, Toast, shared UI
├─ data/                    constants and sample stories
└─ styles/global.css        design tokens and layout
docs/                       progress report, spec, screenshots, first prototype
```

## Screens

| | | |
|---|---|---|
| ![Home](docs/screens/01-home.png) | ![Story input](docs/screens/02-story-input.png) | ![Analysis](docs/screens/03-analysis.png) |
| ![Voice studio](docs/screens/04-voice-studio.png) | ![Building audio](docs/screens/05-building-audio.png) | ![Timeline](docs/screens/06-timeline.png) |
| ![Player](docs/screens/07-player.png) | ![Export](docs/screens/08-export.png) | ![Phone player](docs/screens/09-phone-player.png) |

## Docs

- [Progress report (PDF)](docs/VoiceVerse%20progress%20report.pdf)
- [Product spec with pipeline diagram](docs/VoiceVerse%20spec%20with%20diagram.docx)
- [All UI screens](docs/ui-screens.html)
- [First single-file prototype](docs/prototype/voiceverse-single-file-prototype.html), kept for reference

## Roadmap

- PDF upload and Bengali support (once Bengali TTS quality is tested)
- A small backend to keep API keys server-side
- Shareable story links, with Supabase for saved stories
- Royalty-free recorded music and effect library alongside the synthesised one
