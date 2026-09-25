import { Transaction } from '../types/statement';

export class CsvService {
  /**
   * Generates a 5-column RFC 4180 compliant CSV:
   * Date,Description,Debit,Credit,Balance
   */
  static generateCsv(transactions: Transaction[]): string {
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

    const rows = transactions.map((t) => {
      const escape = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '';
        let str = typeof val === 'number' ? val.toFixed(2) : String(val);
        // Clean any stray carriage returns
        str = str.replace(/\r/g, '');
        // If string contains comma, quote, or newline, wrap in quotes and escape quotes
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
}
