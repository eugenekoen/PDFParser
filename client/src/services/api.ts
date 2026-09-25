import type {
  AppSettings,
  GeminiModelInfo,
  ParsedPdfResult,
  Transaction,
} from '../types';

export async function uploadAndParsePdf(file: File): Promise<ParsedPdfResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/parse-pdf', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || `Server returned ${res.status}`);
  }

  return res.json();
}

/**
 * Check Gemini server status (whether server .env key is configured)
 */
export async function fetchGeminiStatus(): Promise<{
  hasServerKey: boolean;
  models: GeminiModelInfo[];
  recommendedModel: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/gemini/status');
    if (!res.ok) {
      return { hasServerKey: false, models: [], recommendedModel: 'gemini-3.8-flash' };
    }
    return await res.json();
  } catch {
    // If running statically on GitHub Pages without backend
    return { hasServerKey: false, models: [], recommendedModel: 'gemini-3.8-flash' };
  }
}

/**
 * Query live available models from Google API
 */
export async function fetchGeminiModels(apiKey?: string): Promise<{
  models: GeminiModelInfo[];
  recommendedModel: string;
  hasServerKey: boolean;
}> {
  try {
    const res = await fetch('/api/gemini/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback for static hosting
  }

  // Client direct query if no backend
  if (apiKey) {
    const directRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await directRes.json();
    if (data.models) {
      const models = data.models
        .filter((m: any) => m.name.includes('flash') || m.name.includes('pro'))
        .map((m: any) => ({
          id: m.name.replace(/^models\//, ''),
          name: m.displayName || m.name,
        }));
      return { models, recommendedModel: 'gemini-3.8-flash', hasServerKey: false };
    }
  }

  return { models: [], recommendedModel: 'gemini-3.8-flash', hasServerKey: false };
}

/**
 * Convert File to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Direct Gemini multimodal PDF extraction with native OCR
 * (Supports both Backend routing and Client direct fallback for GitHub Pages)
 */
export async function extractTransactionsWithGeminiPdf(
  file: File,
  settings: AppSettings
): Promise<{
  filename: string;
  transactions: Transaction[];
  rawModelResponse?: string;
  modelUsed?: string;
}> {
  const model = settings.model || 'gemini-3.8-flash';

  // 1. First try Backend
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);

    const headers: Record<string, string> = {};
    if (settings.apiKey) {
      headers['x-gemini-api-key'] = settings.apiKey;
    }

    const res = await fetch('/api/gemini/extract-pdf', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => null);
    if (errData && errData.error) {
      throw new Error(errData.error);
    }
  } catch (err: any) {
    // If backend gave a specific Gemini error, rethrow it
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
      throw err;
    }
    // If backend is unavailable (e.g. on GitHub Pages), fall through to client direct
  }

  // 2. Client Direct Fallback (For GitHub Pages static hosting)
  if (!settings.apiKey) {
    throw new Error(
      'Gemini API Key required for static hosting. Please click the settings icon and enter your Google AI Studio API key.'
    );
  }

  const base64Data = await fileToBase64(file);
  const systemPrompt = `You are a financial statement parser engine. Extract every transaction row from the bank statement PDF into a clean JSON array with keys: "date" (YYYY-MM-DD), "description" (merchant/narrative), "debit" (positive number or null for money leaving), "credit" (positive number or null for money entering), "balance" (number or null). Return ONLY valid JSON array.`;

  const candidateModels = Array.from(new Set([
    model,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.8-pro',
  ]));

  let lastError: any = null;

  for (const candidate of candidateModels) {
    try {
      const directRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${settings.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: base64Data,
                    },
                  },
                  { text: systemPrompt },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      );

      const data = await directRes.json();
      if (data.error) {
        const errorMsg = data.error.message || JSON.stringify(data.error);
        const isHighDemand =
          errorMsg.includes('high demand') ||
          errorMsg.includes('503') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('429');

        if (isHighDemand) {
          console.warn(`Model ${candidate} is unavailable or high demand. Trying next model...`);
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(errorMsg);
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const transactions = parseClientJson(rawText);

      return {
        filename: file.name,
        transactions,
        rawModelResponse: rawText,
        modelUsed: candidate,
      };
    } catch (err: any) {
      lastError = err;
      const msg = String(err.message || '');
      const isHighDemand =
        msg.includes('high demand') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('rate limit') ||
        msg.includes('429');

      if (isHighDemand) {
        console.warn(`Client direct model ${candidate} failed due to demand. Falling back...`);
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `All attempted Gemini models are currently experiencing high demand. Please select another model in settings or click Retry Extraction. (Details: ${lastError?.message || lastError})`
  );
}

function parseClientJson(raw: string): Transaction[] {
  let clean = raw.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  clean = clean.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const arrayMatch = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      parsed = JSON.parse(arrayMatch[0]);
    } else {
      throw new Error(`Failed to parse JSON response: ${clean.slice(0, 150)}`);
    }
  }

  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    for (const k of ['transactions', 'data', 'items', 'rows']) {
      if (Array.isArray(parsed[k])) {
        items = parsed[k];
        break;
      }
    }
  }

  return items.map((item, idx) => ({
    id: `tx_${Date.now()}_${idx + 1}`,
    date: String(item.date || '').trim(),
    description: String(item.description || item.payee || item.details || '').trim(),
    debit: item.debit !== undefined && item.debit !== null ? parseFloat(item.debit) : null,
    credit: item.credit !== undefined && item.credit !== null ? parseFloat(item.credit) : null,
    balance: item.balance !== undefined && item.balance !== null ? parseFloat(item.balance) : null,
  }));
}

/**
 * Gemini text-based extraction
 */
export async function extractTransactionsWithGeminiText(
  text: string,
  settings: AppSettings
): Promise<{ transactions: Transaction[]; rawModelResponse?: string; modelUsed?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers['x-gemini-api-key'] = settings.apiKey;
  }

  const res = await fetch('/api/gemini/extract-text', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      model: settings.model || 'gemini-3.8-flash',
      apiKey: settings.apiKey,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gemini text extraction failed');
  }

  return data;
}

/**
 * Test Gemini API connection & discover available models
 */
export async function testGeminiConnection(
  apiKey?: string,
  model?: string
): Promise<{
  status: string;
  model: string;
  models: GeminiModelInfo[];
  usingServerKey: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => null);
    if (errData && errData.error) {
      throw new Error(errData.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // Fallback for static hosting
  if (apiKey) {
    const directRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3.8-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping test. Reply with JSON: {"status": "ok"}' }] }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      }
    );
    const data = await directRes.json();
    if (data.error) {
      throw new Error(data.error.message || 'Direct Gemini API connection failed');
    }
    let discoveredModels: GeminiModelInfo[] = [];
    try {
      const modelsRes = await fetchGeminiModels(apiKey);
      discoveredModels = modelsRes.models;
    } catch {
      // Ignore if list query fails
    }

    return {
      status: 'connected',
      model: model || 'gemini-3.8-flash',
      models: discoveredModels,
      usingServerKey: false,
    };
  }

  throw new Error('API key is required.');
}

export function formatCsvLocally(transactions: Transaction[]): string {
  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

  const rows = transactions.map((t) => {
    const escape = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '';
      let str = typeof val === 'number' ? val.toFixed(2) : String(val);
      str = str.replace(/\r/g, '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      escape(t.date),
      escape(t.description),
      escape(t.debit),
      escape(t.credit),
      escape(t.balance),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
