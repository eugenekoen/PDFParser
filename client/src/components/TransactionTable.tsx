import React, { useState } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Search,
  TrendingDown,
  TrendingUp,
  Scale,
  Hash,
} from 'lucide-react';
import type { Transaction } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, field: keyof Transaction, value: any) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: () => void;
}

/**
 * Format numbers strictly as ###,###,###.##
 */
export const formatAmountDisplay = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '';
  const parts = Math.abs(val).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (val < 0 ? '-' : '') + parts.join('.');
};

interface AmountCellProps {
  value: number | null;
  onChange: (newVal: number | null) => void;
  className?: string;
  placeholder?: string;
}

const AmountCell: React.FC<AmountCellProps> = ({ value, onChange, className = '', placeholder = '0.00' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState(value !== null && value !== undefined ? value.toString() : '');

  const handleFocus = () => {
    setIsFocused(true);
    setLocalText(value !== null && value !== undefined ? value.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    const clean = localText.replace(/[^0-9.-]/g, '');
    if (clean === '' || clean === '-') {
      onChange(null);
    } else {
      const num = parseFloat(clean);
      onChange(isNaN(num) ? null : Math.round(num * 100) / 100);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalText(e.target.value);
    const clean = e.target.value.replace(/[^0-9.-]/g, '');
    if (clean === '' || clean === '-') {
      onChange(null);
    } else {
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  return (
    <input
      type="text"
      className={`cell-input num-input ${className}`}
      value={isFocused ? localText : formatAmountDisplay(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
    />
  );
};

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate summary metrics
  const totalDebit = transactions.reduce((acc, t) => acc + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((acc, t) => acc + (t.credit || 0), 0);
  const netMovement = totalCredit - totalDebit;

  const filteredTransactions = transactions.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.description.toLowerCase().includes(term) ||
      t.date.toLowerCase().includes(term) ||
      (t.debit && t.debit.toString().includes(term)) ||
      (t.credit && t.credit.toString().includes(term))
    );
  });

  return (
    <div className="card transaction-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="icon-badge icon-emerald">
            <Table size={20} />
          </div>
          <div>
            <h2 className="card-title">Extracted Transactions Review & Edit</h2>
            <p className="card-subtitle">
              Amounts displayed in South African Rand (R) formatted as ###,###,###.##
            </p>
          </div>
        </div>

        <div className="card-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddTransaction}>
            <Plus size={16} /> Add Row
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap rose">
            <TrendingDown size={18} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Debits (Outflows)</span>
            <span className="kpi-value text-rose">
              R {formatAmountDisplay(totalDebit)}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap emerald">
            <TrendingUp size={18} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Credits (Inflows)</span>
            <span className="kpi-value text-emerald">
              R {formatAmountDisplay(totalCredit)}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap cyan">
            <Scale size={18} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Net Statement Change</span>
            <span className={`kpi-value ${netMovement >= 0 ? 'text-emerald' : 'text-rose'}`}>
              {netMovement >= 0 ? '+' : '-'}R {formatAmountDisplay(Math.abs(netMovement))}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap violet">
            <Hash size={18} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Transactions</span>
            <span className="kpi-value">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Table Filter Bar */}
      <div className="table-filter-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Filter by description, date, or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-count">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      </div>

      {/* Table Component */}
      <div className="table-responsive">
        <table className="statement-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>#</th>
              <th style={{ width: '130px' }}>Date</th>
              <th>Description</th>
              <th style={{ width: '150px', textAlign: 'right' }}>Debit (R)</th>
              <th style={{ width: '150px', textAlign: 'right' }}>Credit (R)</th>
              <th style={{ width: '150px', textAlign: 'right' }}>Balance (R)</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-table-cell">
                  {transactions.length === 0
                    ? 'No transactions extracted yet. Click "Extract Statement with Gemini OCR" above.'
                    : 'No transactions match your search filter.'}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => (
                <tr key={tx.id}>
                  <td className="cell-index">{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="cell-input date-input"
                      value={tx.date}
                      onChange={(e) => onUpdateTransaction(tx.id, 'date', e.target.value)}
                      placeholder="dd/mm/yyyy"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="cell-input desc-input"
                      value={tx.description}
                      onChange={(e) => onUpdateTransaction(tx.id, 'description', e.target.value)}
                      placeholder="Transaction Description"
                    />
                  </td>
                  <td>
                    <AmountCell
                      value={tx.debit}
                      onChange={(newVal) => onUpdateTransaction(tx.id, 'debit', newVal)}
                      className="text-rose"
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <AmountCell
                      value={tx.credit}
                      onChange={(newVal) => onUpdateTransaction(tx.id, 'credit', newVal)}
                      className="text-emerald"
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <AmountCell
                      value={tx.balance}
                      onChange={(newVal) => onUpdateTransaction(tx.id, 'balance', newVal)}
                      className="text-cyan"
                      placeholder="0.00"
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="row-del-btn"
                      onClick={() => onDeleteTransaction(tx.id)}
                      title="Delete this row"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
