// Vercel serverless function: AI briefing + talking points via Groq (free tier).
// The Groq key stays on the server. Callers must be signed in to Supabase.
// Personal data is minimised by the client before it reaches here: first names only,
// no phone numbers, no emails and no prayer requests.

const SYSTEM = `You are "Elevation AI", a warm, practical assistant for the guest follow-up team of The Elevation Church, Lekki (Lagos, Nigeria).
The church journey is: New guest -> Followed up (called) -> Started Greatness Track -> Completed Greatness Track -> Joined a department -> Joined Greatness Community.
Every new guest should be called within the follow-up window after their first Sunday (default: by Wednesday).
Be specific, use the numbers and first names you are given, never invent people or numbers, keep a caring pastoral tone, and keep every sentence short.
Always reply with valid JSON only.`;

function digestPrompt(d) {
  return `Here is today's data (JSON):
${JSON.stringify(d)}

Write the team's briefing. Reply as JSON:
{"headline": "one sentence summary for ${d.viewer_first_name || 'the team'} (max 22 words)",
 "items": [ {"tone": "urgent|action|insight|celebrate", "title": "max 9 words", "detail": "max 30 words, mention names/numbers from the data", "action": "overdue|due|callbacks|stalled|ready_gt|yes_not_called|guests|team|null"} ]}
Give 4 or 5 items, most urgent first: overdue follow-ups, guests who said "Yes" to joining but have not been reached, callbacks due, stalled Greatness Track, people ready to be invited to Greatness Track, team workload balance, and one encouraging trend if there is one.`;
}

function guestPrompt(g) {
  return `Guest profile (JSON):
${JSON.stringify(g)}

Help the team member who is about to contact this guest. Reply as JSON:
{"opener": "a warm first sentence to say on the call, using their first name (max 30 words)",
 "points": ["3 short talking points tailored to their occupation, interests, needs and journey stage"],
 "next_step": "the single best next step for this person in the church journey (max 20 words)",
 "suggested_department": "one department from this list that fits them best: ${g.departments || ''}"}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY } = process.env;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (!GROQ_API_KEY) return res.status(503).json({ error: 'AI is not configured (GROQ_API_KEY missing).' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(503).json({ error: 'Supabase is not configured.' });

  // only signed-in team members may use the AI
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in required' });
  const who = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  if (!who.ok) return res.status(401).json({ error: 'Sign in required' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { mode, data } = body;
  if (!data || JSON.stringify(data).length > 40000) return res.status(400).json({ error: 'Invalid request' });
  const prompt = mode === 'guest' ? guestPrompt(data) : digestPrompt(data);

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j?.error?.message || 'Groq request failed' });
    const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...out, model, source: 'groq' });
  } catch (e) {
    return res.status(502).json({ error: 'AI is unavailable right now' });
  }
}
