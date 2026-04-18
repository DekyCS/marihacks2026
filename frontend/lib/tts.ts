const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const ELEVENLABS_API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

const audioCache = new Map<string, string>();

export async function generateTTS(text: string, stepNumber: number, signal?: AbortSignal): Promise<string> {
  const cacheKey = `step_${stepNumber}_${text.substring(0, 50)}`;

  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  try {
    const response = await fetch(ELEVENLABS_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText || response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    audioCache.set(cacheKey, audioUrl);
    return audioUrl;
  } catch (error) {
    throw error;
  }
}

export async function generateAssistantTTS(text: string, signal?: AbortSignal): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(ELEVENLABS_API_URL, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.5 },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`ElevenLabs error (${response.status}): ${errorText || response.statusText}`);
  }

  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
}
