import pdfParse from 'pdf-parse';
import { ParsedPdfResult, ParsedPage } from '../types/statement';

export async function parsePdfBuffer(buffer: Buffer, filename: string): Promise<ParsedPdfResult> {
  const pages: ParsedPage[] = [];

  const pagerender = (pageData: any) => {
    return pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    }).then((textContent: any) => {
      let lastY: number | null = null;
      let text = '';
      for (const item of textContent.items) {
        // When Y coordinate changes significantly, treat as new line
        if (lastY === null || Math.abs(lastY - item.transform[5]) < 2) {
          text += (text.length > 0 && !text.endsWith(' ') ? ' ' : '') + item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }

      const cleanText = text.replace(/\r\n/g, '\n').trim();
      const lines = cleanText.split('\n').filter(l => l.trim().length > 0);
      const pageNumber = (pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : pages.length + 1);

      pages.push({
        pageNumber,
        text: cleanText,
        lineCount: lines.length,
        characterCount: cleanText.length,
        estimatedTokens: Math.ceil(cleanText.length / 3.8),
      });

      return cleanText;
    });
  };

  try {
    const data = await pdfParse(buffer, { pagerender });

    // Ensure pages are sorted
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    // If pagerender did not capture any pages (fallback)
    if (pages.length === 0) {
      const fallbackText = (data.text || '').replace(/\r\n/g, '\n').trim();
      pages.push({
        pageNumber: 1,
        text: fallbackText,
        lineCount: fallbackText.split('\n').length,
        characterCount: fallbackText.length,
        estimatedTokens: Math.ceil(fallbackText.length / 3.8),
      });
    }

    const fullText = pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    const totalCharacters = pages.reduce((acc, p) => acc + p.characterCount, 0);
    const estimatedTotalTokens = pages.reduce((acc, p) => acc + p.estimatedTokens, 0);

    return {
      filename,
      totalPages: pages.length,
      totalCharacters,
      estimatedTotalTokens,
      pages,
      fullText,
      info: data.info,
    };
  } catch (err: any) {
    throw new Error(`Failed to parse PDF document: ${err.message || err}`);
  }
}
