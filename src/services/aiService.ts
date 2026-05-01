/**
 * AI service — calls aitunnel (OpenAI-compatible) to extract structured
 * person data from free-form voice/text input.
 */

export interface ExtractedPersonInfo {
  firstName?: string;
  lastName?: string;
  gender?: 'M' | 'F';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  education?: string;
  bio?: string;
  events?: Array<{ year: string; title: string; emoji: string }>;
  socials?: { vk?: string; instagram?: string; telegram?: string; facebook?: string };
}

const SYSTEM_PROMPT = `Ты помощник для заполнения карточки в семейном древе.
Из текста пользователя извлеки информацию о человеке и верни ТОЛЬКО валидный JSON объект.
Поля (все необязательные):
- firstName: имя
- lastName: фамилия
- gender: "M" или "F"
- birthDate: год рождения или дата (например "1990" или "12.03.1990")
- birthPlace: место рождения
- deathDate: год смерти если упомянуто
- deathPlace: место смерти если упомянуто
- occupation: профессия / род деятельности
- education: образование
- bio: короткая биография (1-3 предложения)
- events: массив ключевых событий [{year: "2015", title: "Женился", emoji: "💍"}]
- socials: объект {vk, instagram, telegram, facebook} — только если упомянуты ники/ссылки
Верни только JSON, без пояснений.`;

export async function extractPersonInfo(transcript: string): Promise<ExtractedPersonInfo> {
  const res = await fetch(`${import.meta.env.VITE_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_AI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash-preview-05-20',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content) as ExtractedPersonInfo;
}
