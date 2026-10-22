'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search emails by recipient, subject, or content (Elasticsearch)...',
}) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(value.trim());
    }, 350);

    return () => clearTimeout(handler);
  }, [value, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0E111B]/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 shadow-inner transition-all duration-200"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
