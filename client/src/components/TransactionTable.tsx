import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Search,
  TrendingDown,
  TrendingUp,
  Scale,
  Hash,
  ChevronDown,
  ChevronUp,
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

interface TextCellProps {
  value: string;
  onChange: (newVal: string) => void;
  className?: string;
  placeholder?: string;
}

const TextCell: React.FC<TextCellProps> = ({ value, onChange, className = '', placeholder = '' }) => {
  const [localText, setLocalText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalText(value);
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (localText !== value) {
      onChange(localText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      className={`cell-input ${className}`}
      value={localText}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onChange={(e) => setLocalText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
    />
  );
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

  useEffect(() => {
    if (!isFocused) {
      setLocalText(value !== null && value !== undefined ? value.toString() : '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setLocalText(value !== null && value !== undefined ? value.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    const clean = localText.replace(/[^0-9.-]/g, '');
    if (clean === '' || clean === '-') {
      if (value !== null) onChange(null);
    } else {
      const num = parseFloat(clean);
      const rounded = isNaN(num) ? null : Math.round(num * 100) / 100;
      if (rounded !== value) onChange(rounded);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalText(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
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
      onKeyDown={handleKeyDown}
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
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_LIMIT = 15;

  // Memoize summary metrics to avoid recalculation on unrelated re-renders
  const totalDebit = useMemo(() => transactions.reduce((acc, t) => acc + (t.debit || 0), 0), [transactions]);
  const totalCredit = useMemo(() => transactions.reduce((acc, t) => acc + (t.credit || 0), 0), [transactions]);
  const netMovement = totalCredit - totalDebit;

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((t) =>
      t.description.toLowerCase().includes(term) ||
      t.date.toLowerCase().includes(term) ||
      (t.debit && t.debit.toString().includes(term)) ||
      (t.credit && t.credit.toString().includes(term))
    );
  }, [transactions, searchTerm]);

  const displayedTransactions = useMemo(() => {
    return isExpanded
      ? filteredTransactions
      : filteredTransactions.slice(0, INITIAL_LIMIT);
  }, [filteredTransactions, isExpanded]);

  return (
    <div className="card transaction-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="icon-badge icon-emerald">
            <Table size={20} />
          </div>
          <div>
            <h2 className="card-title">Extracted Transactions Review & Edit</h2>
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
          {filteredTransactions.length > INITIAL_LIMIT && !isExpanded ? (
            <>
              Showing <strong>{displayedTransactions.length}</strong> of <strong>{filteredTransactions.length}</strong> transactions
            </>
          ) : (
            <>
              Showing <strong>{filteredTransactions.length}</strong> of <strong>{transactions.length}</strong> transactions
            </>
          )}
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
              displayedTransactions.map((tx, idx) => (
                <tr key={tx.id}>
                  <td className="cell-index">{idx + 1}</td>
                  <td>
                    <TextCell
                      value={tx.date}
                      onChange={(newVal) => onUpdateTransaction(tx.id, 'date', newVal)}
                      className="date-input"
                      placeholder="dd/mm/yyyy"
                    />
                  </td>
                  <td>
                    <TextCell
                      value={tx.description}
                      onChange={(newVal) => onUpdateTransaction(tx.id, 'description', newVal)}
                      className="desc-input"
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

      {/* Expand / Collapse Button if more than 15 rows */}
      {filteredTransactions.length > INITIAL_LIMIT && (
        <div className="table-expand-wrapper">
          <button
            type="button"
            className="btn-table-expand"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={16} />
                <span>Show Less (First {INITIAL_LIMIT})</span>
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                <span>Show All {filteredTransactions.length} Transactions ({filteredTransactions.length - INITIAL_LIMIT} more)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
