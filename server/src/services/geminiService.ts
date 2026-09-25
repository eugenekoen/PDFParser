import { GoogleGenAI } from '@google/genai';
import { Transaction } from '../types/statement';

export interface GeminiModelInfo {
  id: string;
  name: string;
  description?: string;
}

export class GeminiService {
  /**
   * Resolve API key from request override or environment variable
   */
  static getApiKey(overrideKey?: string): string {
    const key = (overrideKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) {
      throw new Error(
        'Gemini API Key is missing. Please set GEMINI_API_KEY in server/.env or configure it in the application settings.'
      );
    }
    return key;
  }

  static hasServerKey(): boolean {
    return Boolean((process.env.GEMINI_API_KEY || '').trim());
  }

  /**
   * Call the Google API to query all available models for this API key
   * and automatically identify the latest Flash model.
   */
  static async getAvailableModels(apiKey?: string): Promise<{
    models: GeminiModelInfo[];
    recommendedModel: string;
    hasServerKey: boolean;
  }> {
    const key = this.getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: key });

    try {
      const list = await ai.models.list();
      const models: GeminiModelInfo[] = [];

      for await (const m of list) {
        const rawName = m.name || '';
        const id = rawName.replace(/^models\//, '');

        const isGemini = id.startsWith('gemini-');
        const isFlashOrPro = id.includes('flash') || id.includes('pro');
        const isAudioOrTTS = id.includes('tts') || id.includes('audio') || id.includes('live') || id.includes('image');

        if (isGemini && isFlashOrPro && !isAudioOrTTS) {
          models.push({
            id,
            name: m.displayName || id,
            description: m.description,
          });
        }
      }

      const priorities = [
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.7-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
      ];

      let recommended: string | undefined;
      for (const p of priorities) {
        if (models.some((m) => m.id === p)) {
          recommended = p;
          break;
        }
      }
      if (!recommended && models.length > 0) {
        recommended = models[0].id;
      }
      if (!recommended) {
        recommended = 'gemini-3.8-flash';
      }

      return {
        models,
        recommendedModel: recommended,
        hasServerKey: this.hasServerKey(),
      };
    } catch (err: any) {
      throw new Error(`Failed to query Gemini models: ${err.message || err}`);
    }
  }

  /**
   * Test API key validity
   */
  static async testConnection(apiKey?: string, preferredModel?: string): Promise<{
    valid: boolean;
    model: string;
    models: GeminiModelInfo[];
    usingServerKey: boolean;
  }> {
    const { models, recommendedModel, hasServerKey } = await this.getAvailableModels(apiKey);
    const targetModel = preferredModel || recommendedModel;

    const key = this.getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: key });

    try {
      await ai.models.generateContent({
        model: targetModel,
        contents: 'Ping test. Reply with JSON: {"status": "ok"}',
        config: {
          responseMimeType: 'application/json',
        },
      });

      return {
        valid: true,
        model: targetModel,
        models,
        usingServerKey: !apiKey && hasServerKey,
      };
    } catch (err: any) {
      throw new Error(`Gemini API connection test failed on model ${targetModel}: ${err.message || err}`);
    }
  }

  /**
   * Multimodal direct PDF extraction with native OCR and automatic high-demand retry/fallback
   */
  static async extractFromPdfBuffer(
    pdfBuffer: Buffer,
    apiKey?: string,
    modelName?: string
  ): Promise<{ transactions: Transaction[]; rawResponse: string; modelUsed: string }> {
    const key = this.getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: key });

    let primaryModel = modelName;
    if (!primaryModel || primaryModel.includes('2.5-flash') && !primaryModel.includes('lite')) {
      primaryModel = 'gemini-3.8-flash';
    }

    // Models to try in sequence if a model experiences 503 high demand spikes
    const candidateModels = Array.from(new Set([
      primaryModel,
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ]));

    const systemPrompt = `You are a financial statement parser engine. Your task is to extract every transaction from the provided bank statement PDF into a clean JSON array.

IMPORTANT OCR & EXTRACTION INSTRUCTIONS:
1. The PDF may be a digital document, a scanned document, or an image-based statement. Use your visual document understanding to read all text, columns, and rows accurately.
2. For each transaction row, extract:
   - "date": string in YYYY-MM-DD format (if the year is missing or ambiguous in the row, infer it from the statement header, period, or nearby rows).
   - "description": string of the payee, merchant, or transaction narrative. Clean up any scanning noise, stray symbols, or broken line wraps.
   - "debit": positive number or null. Money leaving the account (purchases, payments, withdrawals, fees, charges, minus amounts, "DR"). Never negative.
   - "credit": positive number or null. Money entering the account (deposits, salary, refunds, interest, transfers in, plus amounts, "CR"). Never negative.
   - "balance": positive or negative number or null. The running balance after the transaction if displayed, else null.
3. If an amount is given in a single column:
   - Negative amounts, or amounts marked with "-" or "DR" are debits.
   - Positive amounts, or amounts marked with "+" or "CR" are credits.
4. Exclude non-transaction boilerplate such as opening/closing summary headers, bank addresses, interest disclosures, terms and conditions, and marketing footers.
5. Output format: Return ONLY a valid JSON array of transaction objects.

Example JSON output:
[
  {
    "date": "2024-01-15",
    "description": "GROCERY STORE PURCHASE",
    "debit": 45.20,
    "credit": null,
    "balance": 1250.80
  }
]`;

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBuffer.toString('base64'),
              },
            },
            {
              text: systemPrompt,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawText = response.text || '';
        const transactions = this.parseJsonTransactions(rawText);
        return { transactions, rawResponse: rawText, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || '') + ' ' + (typeof err === 'object' ? JSON.stringify(err) : '');
        const isHighDemand =
          msg.includes('high demand') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate limit') ||
          msg.includes('429') ||
          err.status === 503 ||
          err.status === 429;

        if (isHighDemand) {
          console.warn(`Model ${model} is experiencing high demand / unavailable. Automatically trying next fallback model...`);
          continue; // Try next candidate model
        } else {
          // Non-demand error (e.g. invalid key or unparseable), rethrow
          throw new Error(`Gemini PDF extraction error on ${model}: ${err.message || msg}`);
        }
      }
    }

    throw new Error(
      `All attempted Gemini models are currently experiencing high demand. Please select a different model in Settings or click Retry Extraction. (Details: ${lastError?.message || lastError})`
    );
  }

  /**
   * Text-based extraction with fallback
   */
  static async extractFromText(
    text: string,
    apiKey?: string,
    modelName?: string
  ): Promise<{ transactions: Transaction[]; rawResponse: string; modelUsed: string }> {
    const key = this.getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: key });

    let primaryModel = modelName;
    if (!primaryModel || primaryModel.includes('2.5-flash') && !primaryModel.includes('lite')) {
      primaryModel = 'gemini-3.8-flash';
    }

    const candidateModels = Array.from(new Set([
      primaryModel,
      'gemini-3.7-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
    ]));

    const prompt = `You are a financial statement parser engine. Extract every transaction row from the bank statement raw text below into a clean JSON array.

RULES:
- "date": YYYY-MM-DD
- "description": payee/details
- "debit": positive number or null (money out)
- "credit": positive number or null (money in)
- "balance": running balance or null
- Output ONLY a JSON array.

Raw statement text:
<<<
${text}
>>>`;

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawText = response.text || '';
        const transactions = this.parseJsonTransactions(rawText);
        return { transactions, rawResponse: rawText, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || '');
        if (msg.includes('high demand') || msg.includes('503') || err.status === 503) {
          continue;
        }
        throw new Error(`Gemini text extraction failed on ${model}: ${msg}`);
      }
    }

    throw new Error(
      `Gemini models currently busy due to high demand. Please click "Retry Extraction". (${lastError?.message || lastError})`
    );
  }

  private static parseJsonTransactions(raw: string): Transaction[] {
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
        throw new Error(`Failed to parse JSON response from Gemini. Raw snippet: ${clean.slice(0, 200)}`);
      }
    }

    let items: any[] = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const keys = ['transactions', 'data', 'items', 'rows', 'statement'];
      for (const k of keys) {
        if (Array.isArray(parsed[k])) {
          items = parsed[k];
          break;
        }
      }
      if (items.length === 0 && (parsed.date || parsed.description)) {
        items = [parsed];
      }
    }

    return items.map((item, idx) => {
      const parseNum = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : Math.abs(val);
        const str = String(val).replace(/[^0-9.-]/g, '');
        const n = parseFloat(str);
        return isNaN(n) ? null : Math.abs(n);
      };

      const parseSignedNum = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const str = String(val).replace(/[^0-9.-]/g, '');
        const n = parseFloat(str);
        return isNaN(n) ? null : n;
      };

      let debit = parseNum(item.debit ?? item.debit_amount ?? item.withdrawal ?? item.outflow);
      let credit = parseNum(item.credit ?? item.credit_amount ?? item.deposit ?? item.inflow);

      if (debit === null && credit === null && item.amount !== undefined) {
        const amt = parseSignedNum(item.amount);
        if (amt !== null) {
          if (amt < 0) {
            debit = Math.abs(amt);
          } else {
            credit = amt;
          }
        }
      }

      return {
        id: `tx_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        date: String(item.date || '').trim(),
        description: String(item.description || item.payee || item.details || '').trim(),
        debit,
        credit,
        balance: parseSignedNum(item.balance),
      };
    });
  }
}
