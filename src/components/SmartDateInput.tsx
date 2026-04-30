import { useState } from 'react';

/**
 * SmartDateInput — auto-formatting date field.
 *
 * Accepts: digits only, auto-inserts dots.
 * Formats:
 *   - YYYY (year only: "1920")
 *   - MM.YYYY (month + year: "05.1920")
 *   - DD.MM.YYYY (full date: "12.05.1920")
 *
 * Validates in real-time:
 *   - Non-existent dates (30.02)
 *   - Future dates
 *   - Invalid months/days
 */

interface SmartDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const SmartDateInput = ({ label, value, onChange }: SmartDateInputProps) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (raw: string) => {
    // Strip everything except digits
    let digits = raw.replace(/[^\d]/g, '');

    // Auto-format: insert dots
    let formatted = '';
    if (digits.length <= 4) {
      // Could be year OR start of DD or MM
      formatted = digits;
    } else if (digits.length <= 6) {
      // MM.YYYY pattern
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    } else {
      // DD.MM.YYYY pattern
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4, 8);
    }

    onChange(formatted);
    validateDate(formatted);
  };

  const validateDate = (val: string) => {
    setError(null);
    if (!val) return;

    const now = new Date();
    const currentYear = now.getFullYear();

    // Year only: "1920"
    if (/^\d{4}$/.test(val)) {
      const year = parseInt(val, 10);
      if (year > currentYear) setError('Год в будущем');
      else if (year < 1000) setError('Слишком ранний год');
      return;
    }

    // Month.Year: "05.1920"
    if (/^\d{2}\.\d{4}$/.test(val)) {
      const mm = parseInt(val.slice(0, 2), 10);
      const yyyy = parseInt(val.slice(3), 10);
      if (mm < 1 || mm > 12) setError('Несуществующий месяц');
      else if (yyyy > currentYear) setError('Дата в будущем');
      return;
    }

    // Full date: "12.05.1920"
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
      const [dd, mm, yyyy] = val.split('.').map(Number);
      const date = new Date(yyyy, mm - 1, dd);
      if (date.getDate() !== dd || date.getMonth() !== mm - 1) {
        setError('Несуществующая дата');
      } else if (date > now) {
        setError('Дата в будущем');
      }
      return;
    }

    // Partial input — don't show error while typing
    if (val.length >= 4 && !/^\d{1,2}\.?\d{0,2}\.?\d{0,4}$/.test(val)) {
      setError('Формат: ГГГГ, ММ.ГГГГ или ДД.ММ.ГГГГ');
    }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{
        display: 'block',
        fontSize: 8,
        fontWeight: 700,
        color: error ? 'var(--color-error)' : 'var(--color-text-muted)',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}>
        {label}
      </label>
      <input
        type="text"
        className="nodrag nopan nowheel"
        inputMode="numeric"
        placeholder="ГГГГ"
        value={value}
        onChange={e => handleChange(e.target.value)}
        maxLength={10}
        style={{
          width: '100%',
          height: 28,
          padding: '0 8px',
          border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          outline: 'none',
          fontFamily: 'var(--font-family)',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
      />
      {error && (
        <div style={{
          fontSize: 10,
          color: 'var(--color-error)',
          marginTop: 3,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}
    </div>
  );
};
