import React, { createContext, useContext, useState } from 'react';

interface FilterState {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
}

const FilterContext = createContext<FilterState | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  return (
    <FilterContext.Provider value={{ selectedCompanyId, setSelectedCompanyId }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
}
