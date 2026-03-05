"use client";
import { create } from "zustand";
import type { ProjectBudget } from "@/lib/budget-engine";

interface BudgetStore {
  budget: ProjectBudget | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  selectedDayId: string | null;
  isWhatIfMode: boolean;
  whatIfBudget: ProjectBudget | null;

  setBudget: (budget: ProjectBudget) => void;
  setLoading: (loading: boolean) => void;
  setSelectedDay: (dayId: string | null) => void;
  toggleWhatIfMode: () => void;
  setWhatIfBudget: (budget: ProjectBudget | null) => void;
  refreshBudget: (projectId: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budget: null,
  isLoading: false,
  lastUpdated: null,
  selectedDayId: null,
  isWhatIfMode: false,
  whatIfBudget: null,

  setBudget: (budget) => set({ budget, lastUpdated: new Date() }),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedDay: (selectedDayId) => set({ selectedDayId }),
  toggleWhatIfMode: () => set((s) => ({ isWhatIfMode: !s.isWhatIfMode })),
  setWhatIfBudget: (whatIfBudget) => set({ whatIfBudget }),

  refreshBudget: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/projects/${projectId}/budget`);
      if (res.ok) {
        const data = await res.json();
        set({ budget: data, lastUpdated: new Date(), isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
