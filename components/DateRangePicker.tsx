
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange, onClose, onApply }) => {
  // Initialize view based on start date or current date
  const [viewDate, setViewDate] = useState(() => {
    // We treat the input string as a local date component, avoiding timezone shifts
    if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date();
  });

  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Helper to format date string manually to avoid Timezone offsets
  const formatDateStr = (year: number, month: number, day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Helper to display date string DD/MM/YYYY without timezone conversion
  const displayDateStr = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleDayClick = (day: number) => {
    // Construct string manually: YYYY-MM-DD
    const clickedDate = formatDateStr(currentYear, currentMonth, day);

    if (!startDate || (startDate && endDate)) {
      // Start new selection
      onChange(clickedDate, '');
    } else {
      // Complete selection
      if (clickedDate < startDate) {
        onChange(clickedDate, startDate);
      } else {
        onChange(startDate, clickedDate);
      }
    }
  };

  // Helper to determine day styling
  const getDayClass = (day: number) => {
    const dateStr = formatDateStr(currentYear, currentMonth, day);
    const isSelected = dateStr === startDate || dateStr === endDate;
    const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;
    const isHoverRange = !endDate && startDate && hoverDate && (
       (dateStr > startDate && dateStr <= hoverDate) || (dateStr < startDate && dateStr >= hoverDate)
    );

    let baseClass = "w-8 h-8 flex items-center justify-center text-sm rounded-full cursor-pointer transition-all relative z-10 ";

    if (isSelected) {
      return baseClass + "bg-slate-900 text-white font-bold shadow-md";
    }
    if (isInRange) {
      return baseClass + "bg-blue-50 text-slate-900 rounded-none";
    }
    if (isHoverRange) {
      return baseClass + "bg-slate-100 text-slate-900";
    }

    return baseClass + "text-slate-700 hover:bg-slate-100";
  };

  return (
    <div 
      className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 w-[320px] z-50 animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
        <h3 className="font-bold text-slate-800">Selecionar Período</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-slate-900">
          {months[currentMonth]} {currentYear}
        </span>
        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-600">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDateStr(currentYear, currentMonth, day);
          return (
            <div 
              key={day} 
              className={getDayClass(day)}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        <div className="flex gap-2">
            <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
                <div className="text-sm font-medium text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    {displayDateStr(startDate)}
                </div>
            </div>
            <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
                <div className="text-sm font-medium text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    {displayDateStr(endDate)}
                </div>
            </div>
        </div>
        <button 
            type="button"
            disabled={!startDate || !endDate}
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            className="w-full mt-2 bg-slate-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            Aplicar Filtro
        </button>
      </div>
    </div>
  );
};
