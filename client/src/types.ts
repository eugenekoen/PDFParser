export interface GeminiModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface AppSettings {
  apiKey: string;
  model: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  pageNumber?: number;
  rawText?: string;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
  lineCount: number;
  characterCount: number;
  estimatedTokens: number;
}

export interface ParsedPdfResult {
  filename: string;
  totalPages: number;
  totalCharacters: number;
  estimatedTotalTokens: number;
  pages: ParsedPage[];
  fullText: string;
}
