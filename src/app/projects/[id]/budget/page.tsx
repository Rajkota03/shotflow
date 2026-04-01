"use client";
import "./budget.css";
import React, { useState, useEffect, use, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, amountToWords } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  BarChart3,
  Lightbulb,
  Minus,
  Pencil,
  Check,
  Loader2,
  Filter,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

type RateType = "daily" | "weekly" | "flat";

interface LineItem {
  id: string;
  name: string;
  rate: number;
  quantity: number;
  rateType: RateType;
  subcategory?: string;
}

interface BudgetCategory {
  id: string;
  label: string;
  icon: string;
  items: LineItem[];
  collapsed: boolean;
}

/* ── Constants ─────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  talent: "var(--budget-talent)",
  crew: "var(--budget-crew)",
  equipment: "var(--budget-equipment)",
  locations: "var(--budget-locations)",
  art: "var(--budget-art)",
  post: "var(--budget-post)",
  operations: "var(--budget-operations)",
};

/* ── Defaults ──────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeItem(name: string, rate: number, quantity: number, rateType: RateType = "daily", subcategory?: string): LineItem {
  return { id: uid(), name, rate, quantity, rateType, ...(subcategory ? { subcategory } : {}) };
}

function getDefaultCategories(): BudgetCategory[] {
  return [
    {
      id: "talent", label: "Talent", icon: "🎭", collapsed: false,
      items: [
        makeItem("Lead Actor", 5000, 2, "daily"),
        makeItem("Supporting Actor", 2500, 3, "daily"),
        makeItem("Day Player", 1000, 2, "daily"),
        makeItem("Extras/Background", 500, 5, "daily"),
      ],
    },
    {
      id: "crew", label: "Crew", icon: "🎬", collapsed: false,
      items: [
        makeItem("Director", 5000, 1, "daily", "production"),
        makeItem("Assistant Director", 2500, 1, "daily", "production"),
        makeItem("Producer", 4000, 1, "daily", "production"),
        makeItem("Script Supervisor", 1500, 1, "daily", "production"),
        makeItem("DP / Cinematographer", 3500, 1, "daily", "camera"),
        makeItem("1st AC", 1800, 1, "daily", "camera"),
        makeItem("2nd AC", 1200, 1, "daily", "camera"),
        makeItem("Gaffer", 2000, 1, "daily", "lighting"),
        makeItem("Best Boy Electric", 1500, 1, "daily", "lighting"),
        makeItem("Key Grip", 1800, 1, "daily", "grip"),
        makeItem("Dolly Grip", 1200, 1, "daily", "grip"),
        makeItem("Sound Mixer", 2000, 1, "daily", "sound"),
        makeItem("Boom Operator", 1200, 1, "daily", "sound"),
      ],
    },
    {
      id: "equipment", label: "Equipment", icon: "📷", collapsed: false,
      items: [
        makeItem("Camera Package", 3000, 1, "daily"),
        makeItem("Lighting Package", 1500, 1, "daily"),
        makeItem("Grip Package", 800, 1, "daily"),
        makeItem("Sound Package", 600, 1, "daily"),
      ],
    },
    {
      id: "locations", label: "Locations", icon: "📍", collapsed: false,
      items: [
        makeItem("Location Permits", 2000, 1, "daily"),
        makeItem("Location Rental", 5000, 1, "daily"),
        makeItem("Parking/Base Camp", 500, 1, "daily"),
      ],
    },
    {
      id: "art", label: "Art & Design", icon: "🎨", collapsed: false,
      items: [
        makeItem("Production Designer", 2500, 1, "daily"),
        makeItem("Art Director", 1800, 1, "daily"),
        makeItem("Props", 1000, 1, "flat"),
        makeItem("Wardrobe", 1500, 1, "flat"),
        makeItem("Hair & Makeup", 1200, 2, "daily"),
      ],
    },
    {
      id: "post", label: "Post-Production", icon: "🖥️", collapsed: false,
      items: [
        makeItem("Editor", 3000, 1, "weekly"),
        makeItem("Color Grading", 15000, 1, "flat"),
        makeItem("Sound Design & Mix", 20000, 1, "flat"),
        makeItem("VFX", 25000, 1, "flat"),
        makeItem("Music / Score", 15000, 1, "flat"),
      ],
    },
    {
      id: "operations", label: "Operations", icon: "🚛", collapsed: false,
      items: [
        makeItem("Transportation", 1500, 1, "daily"),
        makeItem("Catering / Craft Services", 2000, 1, "daily"),
        makeItem("Insurance", 10000, 1, "flat"),
        makeItem("Contingency (10%)", 0, 1, "flat"),
      ],
    },
  ];
}

/* ── localStorage persistence ─────────────────────── */

function loadBudget(projectId: string): BudgetCategory[] | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(`shotflow-budget-${projectId}`);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveBudget(projectId: string, categories: BudgetCategory[]) {
  localStorage.setItem(`shotflow-budget-${projectId}`, JSON.stringify(categories));
}

/* ── Cost calculation ─────────────────────────────── */

function getItemTotal(item: LineItem, shootDays: number): number {
  switch (item.rateType) {
    case "daily":
      return item.rate * item.quantity * shootDays;
    case "weekly":
      return item.rate * item.quantity * Math.ceil(shootDays / 5);
    case "flat":
      return item.rate * item.quantity;
  }
}

function getCategoryTotal(cat: BudgetCategory, shootDays: number): number {
  return cat.items.reduce((sum, item) => sum + getItemTotal(item, shootDays), 0);
}

function computeEffectiveCategories(categories: BudgetCategory[], shootDays: number): BudgetCategory[] {
  const subtotal = categories.reduce((sum, cat) => {
    return sum + cat.items.reduce((s, item) => {
      if (item.name.toLowerCase().includes("contingency")) return s;
      return s + getItemTotal(item, shootDays);
    }, 0);
  }, 0);

  return categories.map((cat) => {
    if (cat.id !== "operations") return cat;
    return {
      ...cat,
      items: cat.items.map((item) => {
        if (!item.name.toLowerCase().includes("contingency")) return item;
        return { ...item, rate: Math.round(subtotal * 0.1) };
      }),
    };
  });
}

function computeGrandTotal(categories: BudgetCategory[], shootDays: number): number {
  const eff = computeEffectiveCategories(categories, shootDays);
  return eff.reduce((sum, cat) => sum + getCategoryTotal(cat, shootDays), 0);
}

/* ── Page ──────────────────────────────────────────── */

type Tab = "budget" | "top-sheet" | "compare";

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("budget");
  const qc = useQueryClient();
  const [categories, setCategories] = useState<BudgetCategory[]>(getDefaultCategories);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [editingCap, setEditingCap] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [scheduleOnly, setScheduleOnly] = useState(false);

  const updateCapMutation = useMutation({
    mutationFn: async (newCap: number) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetCap: newCap }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setEditingCap(false);
      toast("Budget cap updated", "success");
    },
  });

  useEffect(() => {
    const saved = loadBudget(id);
    if (saved) setCategories(saved);
  }, [id]);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  // Fetch cast members to populate talent section with real character names
  interface CastData {
    id: string;
    name: string;
    characterName: string | null;
    roleType: string;
    dayRate: number;
    sceneLinks: { scene: { id: string } }[];
  }

  const { data: castMembers } = useQuery<CastData[]>({
    queryKey: ["cast", id],
    queryFn: () => fetch(`/api/projects/${id}/cast`).then((r) => r.json()),
  });

  interface CrewData {
    id: string; name: string; department: string; role: string;
    dayRate: number; contractedDays: number;
  }

  const { data: crewMembers } = useQuery<CrewData[]>({
    queryKey: ["crew", id],
    queryFn: () => fetch(`/api/projects/${id}/crew`).then((r) => r.json()),
  });

  const { data: schedules } = useQuery({
    queryKey: ["schedules", id],
    queryFn: () => fetch(`/api/projects/${id}/schedules`).then((r) => r.json()),
  });

  const activeSchedule = activeScheduleId
    ? (schedules || []).find((s: ScheduleData) => s.id === activeScheduleId)
    : null;
  const shootDays = activeSchedule
    ? activeSchedule.shootDays?.length || 1
    : project?.shootDays?.length || 1;

  // Scene IDs in the active schedule (for scoped budgeting)
  const scheduleScopeSceneIds = useMemo(() => {
    if (!scheduleOnly || !activeSchedule) return null;
    const ids = new Set<string>();
    for (const day of activeSchedule.shootDays || []) {
      for (const scene of day.scenes || []) {
        ids.add(scene.id);
      }
    }
    return ids;
  }, [scheduleOnly, activeSchedule]);

  // Filtered cast: only characters appearing in scheduled scenes
  const scopedCastMembers = useMemo(() => {
    if (!castMembers) return castMembers;
    if (!scheduleScopeSceneIds) return castMembers;
    return castMembers.filter((cm) =>
      cm.sceneLinks.some((link) => scheduleScopeSceneIds.has(link.scene.id))
    );
  }, [castMembers, scheduleScopeSceneIds]);

  // When cast data loads, populate talent category with real character names (always ALL cast)
  useEffect(() => {
    if (!castMembers || castMembers.length === 0) return;

    setCategories((prev) => {
      const talentIdx = prev.findIndex((c) => c.id === "talent");
      if (talentIdx === -1) return prev;

      const existing = prev[talentIdx].items;
      const hasGenericDefaults = existing.some((item) =>
        ["Lead Actor", "Supporting Actor", "Day Player", "Extras/Background"].includes(item.name)
      );
      if (!hasGenericDefaults) return prev;

      const relevantCast = castMembers.filter((cm) =>
        ["lead", "supporting", "day_player"].includes(cm.roleType)
      );

      const talentItems: LineItem[] = relevantCast.map((cm) => {
        const displayName = cm.name
          ? `${cm.characterName || "Unknown"} (${cm.name})`
          : cm.characterName || "Unknown Character";
        return makeItem(displayName, cm.dayRate || 0, 1, "daily");
      });

      const extrasCount = castMembers.filter((cm) => cm.roleType === "extra").length;
      if (extrasCount > 0) {
        talentItems.push(makeItem(`Extras (${extrasCount} characters)`, 500, extrasCount, "daily"));
      }

      if (talentItems.length === 0) return prev;

      const updated = [...prev];
      updated[talentIdx] = { ...updated[talentIdx], items: talentItems };
      saveBudget(id, updated);
      return updated;
    });
  }, [castMembers, id]);

  // When crew data loads, populate crew category with real crew members grouped by department
  useEffect(() => {
    if (!crewMembers || crewMembers.length === 0) return;

    setCategories((prev) => {
      const crewIdx = prev.findIndex((c) => c.id === "crew");
      if (crewIdx === -1) return prev;

      const existing = prev[crewIdx].items;
      const hasGenericDefaults = existing.some((item) =>
        ["Director", "Assistant Director", "Producer", "DP / Cinematographer"].includes(item.name)
      );
      if (!hasGenericDefaults) return prev;

      const crewItems: LineItem[] = crewMembers.map((cm) => {
        const displayName = cm.role ? `${cm.name} (${cm.role})` : cm.name;
        return makeItem(displayName, cm.dayRate || 0, cm.contractedDays || 1, "daily", cm.department || "production");
      });

      if (crewItems.length === 0) return prev;

      const updated = [...prev];
      updated[crewIdx] = { ...updated[crewIdx], items: crewItems };
      saveBudget(id, updated);
      return updated;
    });
  }, [crewMembers, id]);

  // When project loads, auto-populate locations from script data (always ALL locations)
  useEffect(() => {
    if (!project?.locations || project.locations.length === 0) return;

    setCategories((prev) => {
      const locIdx = prev.findIndex((c) => c.id === "locations");
      if (locIdx === -1) return prev;

      const existing = prev[locIdx].items;
      const hasGenericLocations = existing.some((item) =>
        ["Location Permits", "Location Rental", "Parking/Base Camp"].includes(item.name)
      );
      if (!hasGenericLocations) return prev;

      const locItems: LineItem[] = (project.locations as { id: string; name: string; locationType: string; dailyRentalCost: number }[]).map((loc) => {
        return makeItem(loc.name, loc.dailyRentalCost || 0, 1, "daily");
      });

      if (locItems.length === 0) return prev;

      const updated = [...prev];
      updated[locIdx] = { ...updated[locIdx], items: locItems };
      saveBudget(id, updated);
      return updated;
    });
  }, [project, id]);

  // Derive scoped categories as a view filter (no mutation, no save)
  const scopedCategories = useMemo(() => {
    if (!scheduleOnly || !scheduleScopeSceneIds) return categories;

    // Build sets of scoped character names and location names
    const scopedCharNames = new Set<string>();
    if (scopedCastMembers) {
      for (const cm of scopedCastMembers) {
        if (cm.characterName) scopedCharNames.add(cm.characterName.toLowerCase());
        if (cm.name) scopedCharNames.add(cm.name.toLowerCase());
      }
    }

    const scopedLocNames = new Set<string>();
    if (project?.scenes) {
      for (const scene of (project.scenes as { id: string; sceneName?: string }[])) {
        if (scheduleScopeSceneIds.has(scene.id) && scene.sceneName) {
          scopedLocNames.add(scene.sceneName.toLowerCase());
        }
      }
    }

    return categories.map((cat) => {
      if (cat.id === "talent" && scopedCharNames.size > 0) {
        return {
          ...cat,
          items: cat.items.filter((item) => {
            // Keep extras line and items whose name contains a scoped character
            if (item.name.toLowerCase().includes("extras")) return true;
            return scopedCharNames.has(item.name.toLowerCase()) ||
              [...scopedCharNames].some((n) => item.name.toLowerCase().includes(n));
          }),
        };
      }
      if (cat.id === "locations" && scopedLocNames.size > 0) {
        return {
          ...cat,
          items: cat.items.filter((item) => scopedLocNames.has(item.name.toLowerCase())),
        };
      }
      return cat;
    });
  }, [categories, scheduleOnly, scheduleScopeSceneIds, scopedCastMembers, project]);

  // Auto-populate props/wardrobe/vehicles from breakdown elements
  useEffect(() => {
    if (!project) return;
    const allScenes = [...(project.scenes || []), ...(project.shootDays?.flatMap((d: { scenes: unknown[] }) => d.scenes) || [])];
    if (allScenes.length === 0) return;

    // Collect unique elements by category
    const elementsByCategory = new Map<string, Set<string>>();
    for (const scene of allScenes) {
      try {
        const els = JSON.parse((scene as { elementsJson?: string }).elementsJson || "[]");
        for (const el of els) {
          const cat = (el.category || "").toLowerCase();
          if (!elementsByCategory.has(cat)) elementsByCategory.set(cat, new Set());
          elementsByCategory.get(cat)!.add(el.name);
        }
      } catch { /* skip */ }
    }

    if (elementsByCategory.size === 0) return;

    setCategories((prev) => {
      let updated = [...prev];
      let changed = false;

      // Map breakdown categories to budget categories
      const categoryMap: Record<string, { budgetId: string; label: string; icon: string }> = {
        props: { budgetId: "art", label: "Art & Design", icon: "🎨" },
        wardrobe: { budgetId: "art", label: "Art & Design", icon: "🎨" },
        vehicles: { budgetId: "operations", label: "Operations", icon: "🚛" },
        vfx: { budgetId: "post", label: "Post-Production", icon: "🖥️" },
      };

      for (const [cat, names] of elementsByCategory) {
        const mapping = categoryMap[cat];
        if (!mapping) continue;

        const catIdx = updated.findIndex((c) => c.id === mapping.budgetId);
        if (catIdx === -1) continue;

        // Check if these elements are already in the budget
        const existingNames = new Set(updated[catIdx].items.map((i) => i.name.toLowerCase()));
        const newItems: LineItem[] = [];

        for (const name of names) {
          if (!existingNames.has(name.toLowerCase())) {
            newItems.push(makeItem(name, 0, 1, "flat"));
          }
        }

        if (newItems.length > 0) {
          updated[catIdx] = {
            ...updated[catIdx],
            items: [...updated[catIdx].items, ...newItems],
          };
          changed = true;
        }
      }

      if (changed) saveBudget(id, updated);
      return changed ? updated : prev;
    });
  }, [project, id]);

  const currency = project?.currency || "INR";
  const fmt = useCallback((n: number) => formatCurrency(n, currency), [currency]);
  const budgetCap = project?.budgetCap || 0;

  // Auto-select first schedule if none selected
  useEffect(() => {
    if (!activeScheduleId && schedules?.length > 0) {
      setActiveScheduleId(schedules[0].id);
    }
  }, [activeScheduleId, schedules]);

  // Use scopedCategories for all display/calculations (filtered view when scoped)
  const displayCategories = scopedCategories;

  const subtotalBeforeContingency = useMemo(() => {
    return displayCategories.reduce((sum, cat) => {
      return sum + cat.items.reduce((s, item) => {
        if (item.name.toLowerCase().includes("contingency")) return s;
        return s + getItemTotal(item, shootDays);
      }, 0);
    }, 0);
  }, [displayCategories, shootDays]);

  const effectiveCategories = useMemo(() => {
    return computeEffectiveCategories(displayCategories, shootDays);
  }, [displayCategories, shootDays, subtotalBeforeContingency]);

  const grandTotal = useMemo(() => {
    return effectiveCategories.reduce((sum, cat) => sum + getCategoryTotal(cat, shootDays), 0);
  }, [effectiveCategories, shootDays]);

  const dailyBurn = useMemo(() => {
    return effectiveCategories.reduce((sum, cat) => {
      return sum + cat.items.reduce((s, item) => {
        if (item.rateType === "daily") return s + item.rate * item.quantity;
        return s;
      }, 0);
    }, 0);
  }, [effectiveCategories]);

  const budgetRatio = budgetCap > 0 ? grandTotal / budgetCap : 0;
  const healthStatus = budgetCap === 0 ? "no-cap" : budgetRatio > 0.9 ? "critical" : budgetRatio > 0.7 ? "warning" : "healthy";

  /* ── Insights ────────────────────────────────── */

  const insights = useMemo(() => {
    const items: { text: string; type: "saving" | "warning" | "info" }[] = [];

    if (shootDays > 1) {
      const currentTotal = computeGrandTotal(displayCategories, shootDays);
      const oneLess = computeGrandTotal(displayCategories, shootDays - 1);
      const savings = currentTotal - oneLess;
      if (savings > 0) {
        items.push({ text: `Cutting 1 shoot day saves ${fmt(savings)}`, type: "saving" });
      }
    }

    if (scheduleOnly && scheduleScopeSceneIds) {
      const totalCast = castMembers?.length || 0;
      const scopedCast = scopedCastMembers?.length || 0;
      items.push({
        text: `Schedule scope: ${scheduleScopeSceneIds.size} scenes, ${scopedCast}/${totalCast} cast members`,
        type: "info",
      });
    }

    if (budgetCap > 0 && grandTotal > budgetCap) {
      items.push({ text: `Over budget by ${fmt(grandTotal - budgetCap)}`, type: "warning" });
    }

    const sorted = effectiveCategories
      .map((c) => ({ label: c.label, total: getCategoryTotal(c, shootDays) }))
      .sort((a, b) => b.total - a.total);
    if (sorted.length > 0 && grandTotal > 0) {
      const topPct = (sorted[0].total / grandTotal) * 100;
      if (topPct > 40) {
        items.push({ text: `${sorted[0].label} is ${topPct.toFixed(0)}% of total budget`, type: "info" });
      }
    }

    return items;
  }, [displayCategories, effectiveCategories, shootDays, grandTotal, budgetCap, fmt, scheduleOnly, scheduleScopeSceneIds, castMembers, scopedCastMembers]);

  /* ── Mutations ─────────────────────────────────── */

  const persist = useCallback((next: BudgetCategory[]) => {
    setCategories(next);
    saveBudget(id, next);
  }, [id]);

  const toggleCollapse = (catId: string) => {
    persist(categories.map((c) => c.id === catId ? { ...c, collapsed: !c.collapsed } : c));
  };

  const updateItem = (catId: string, itemId: string, field: keyof LineItem, value: string | number) => {
    persist(categories.map((c) => {
      if (c.id !== catId) return c;
      return {
        ...c,
        items: c.items.map((i) => i.id === itemId ? { ...i, [field]: value } : i),
      };
    }));
  };

  const addItem = (catId: string, subcategory?: string) => {
    persist(categories.map((c) => {
      if (c.id !== catId) return c;
      const newItem = makeItem("New Item", 0, 1, "daily", subcategory);
      if (subcategory) {
        // Insert after last item in same subcategory
        const lastIdx = c.items.reduce((idx, item, i) => item.subcategory === subcategory ? i : idx, -1);
        const items = [...c.items];
        items.splice(lastIdx + 1, 0, newItem);
        return { ...c, items, collapsed: false };
      }
      return { ...c, items: [...c.items, newItem], collapsed: false };
    }));
  };

  const deleteItem = (catId: string, itemId: string) => {
    persist(categories.map((c) => {
      if (c.id !== catId) return c;
      return { ...c, items: c.items.filter((i) => i.id !== itemId) };
    }));
  };

  const resetDefaults = () => {
    persist(getDefaultCategories());
    toast("Budget reset to defaults", "success");
  };

  const addCustomDay = () => {
    const next = customDays.length > 0 ? customDays[customDays.length - 1] + 1 : shootDays - 2;
    if (next > 0) setCustomDays([...customDays, next]);
  };

  /* ── Render helpers ─────────────────────────────── */

  const renderBudgetRow = (item: LineItem, catId: string) => {
    const isContingency = item.name.toLowerCase().includes("contingency");
    const itemTotal = getItemTotal(item, shootDays);
    return (
      <tr key={item.id} className={cn(isContingency && "budget-table__auto-row")}>
        <td>
          <input
            className="budget-inline-input budget-inline-input--name"
            value={item.name}
            onChange={(e) => updateItem(catId, item.id, "name", e.target.value)}
          />
        </td>
        <td>
          {isContingency ? (
            <span className="budget-auto-label">auto 10%</span>
          ) : (
            <input
              className="budget-inline-input budget-inline-input--num"
              type="number"
              min={0}
              value={item.rate}
              onChange={(e) => updateItem(catId, item.id, "rate", Number(e.target.value))}
            />
          )}
        </td>
        <td>
          <select
            className="budget-inline-select"
            value={item.rateType}
            onChange={(e) => updateItem(catId, item.id, "rateType", e.target.value)}
            disabled={isContingency}
          >
            <option value="daily">/ day</option>
            <option value="weekly">/ week</option>
            <option value="flat">flat</option>
          </select>
        </td>
        <td>
          {isContingency ? (
            <span className="budget-auto-label">—</span>
          ) : (
            <input
              className="budget-inline-input budget-inline-input--num budget-inline-input--qty"
              type="number"
              min={0}
              value={item.quantity}
              onChange={(e) => updateItem(catId, item.id, "quantity", Number(e.target.value))}
            />
          )}
        </td>
        <td className="text-right">
          <span className="budget-cell-total">{fmt(itemTotal)}</span>
        </td>
        <td>
          {!isContingency && (
            <button
              type="button"
              className="budget-delete-btn"
              onClick={() => deleteItem(catId, item.id)}
            >
              <Trash2 size={12} />
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="budget-topbar">
        <div className="budget-topbar__tabs">
          <button onClick={() => setTab("budget")} className={cn("budget-tab", tab === "budget" && "is-active")}>
            Line Items
          </button>
          <button onClick={() => setTab("top-sheet")} className={cn("budget-tab", tab === "top-sheet" && "is-active")}>
            Top Sheet
          </button>
          <button onClick={() => setTab("compare")} className={cn("budget-tab", tab === "compare" && "is-active")}>
            Compare
          </button>
        </div>
        <div className="budget-topbar__stats">
          {/* Schedule selector + scope toggle */}
          {schedules?.length > 0 && (
            <div className="budget-topbar__schedule-group">
              <select
                className="budget-topbar__schedule-select"
                value={activeScheduleId || ""}
                onChange={(e) => setActiveScheduleId(e.target.value || null)}
              >
                {(schedules || []).map((s: ScheduleData) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.shootDays?.length || 0}d)
                  </option>
                ))}
              </select>
              <div className="budget-scope-switch">
                <button
                  type="button"
                  className={cn("budget-scope-switch__opt", !scheduleOnly && "is-active")}
                  onClick={() => setScheduleOnly(false)}
                >
                  All
                </button>
                <button
                  type="button"
                  className={cn("budget-scope-switch__opt", scheduleOnly && "is-active")}
                  onClick={() => setScheduleOnly(true)}
                >
                  <Filter size={9} />
                  {scheduleScopeSceneIds ? `${scheduleScopeSceneIds.size} scenes` : "Scoped"}
                </button>
              </div>
            </div>
          )}
          <div className="budget-topbar__stat">
            <span className="budget-topbar__stat-label">Daily Burn</span>
            <span className="budget-topbar__stat-value">{fmt(dailyBurn)}</span>
          </div>
          <div className="budget-topbar__stat">
            <span className="budget-topbar__stat-label">{shootDays} Days</span>
            <span className="budget-topbar__stat-value budget-topbar__stat-value--accent">{fmt(grandTotal)}</span>
          </div>
          <div className="budget-topbar__stat budget-topbar__stat--cap">
            <span className="budget-topbar__stat-label">Budget Cap</span>
            {editingCap ? (
              <form
                className="budget-topbar__cap-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = Number(capInput.replace(/[^0-9.]/g, ""));
                  if (val >= 0) updateCapMutation.mutate(val);
                }}
              >
                <input
                  className="budget-topbar__cap-input"
                  autoFocus
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingCap(false); }}
                  placeholder="e.g. 10000000"
                />
                <button type="submit" className="budget-topbar__cap-save"><Check size={11} /></button>
              </form>
            ) : (
              <button
                className="budget-topbar__stat-value budget-topbar__cap-btn"
                onClick={() => { setEditingCap(true); setCapInput(String(budgetCap)); }}
                title="Click to edit budget cap"
              >
                {budgetCap > 0 ? fmt(budgetCap) : "Set Cap"}
                <Pencil size={9} className="budget-topbar__cap-pencil" />
              </button>
            )}
            {budgetCap > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', display: 'block' }}>
                {amountToWords(budgetCap, currency)}
              </span>
            )}
          </div>
          {budgetCap > 0 && (
            <div className={cn("budget-topbar__stat", grandTotal > budgetCap ? "budget-topbar__stat--over" : "budget-topbar__stat--under")}>
              <span className="budget-topbar__stat-label">
                {grandTotal > budgetCap ? "Over Budget" : "Remaining"}
              </span>
              <span className="budget-topbar__stat-value">
                {fmt(Math.abs(budgetCap - grandTotal))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Health Bar */}
      <div className={cn("budget-healthbar", `budget-healthbar--${healthStatus}`)}>
        <div className="budget-healthbar__row">
          <div className="budget-healthbar__track">
            {effectiveCategories.map((cat) => {
              const catTotal = getCategoryTotal(cat, shootDays);
              const w = (budgetCap > 0 ? catTotal / budgetCap : grandTotal > 0 ? catTotal / grandTotal : 0) * 100;
              return (
                <div
                  key={cat.id}
                  className="budget-healthbar__segment"
                  style={{ width: `${Math.min(w, 100)}%`, backgroundColor: CATEGORY_COLORS[cat.id] }}
                  title={`${cat.label}: ${fmt(catTotal)}`}
                />
              );
            })}
          </div>
          {budgetCap > 0 && (
            <span className="budget-healthbar__pct">
              {(budgetRatio * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="budget-healthbar__legend">
          {effectiveCategories.map((cat) => (
            <div key={cat.id} className="budget-healthbar__legend-item">
              <span className="budget-healthbar__dot" style={{ background: CATEGORY_COLORS[cat.id] }} />
              <span>{cat.label}</span>
            </div>
          ))}
          {budgetCap > 0 && (
            <div className="budget-healthbar__legend-item budget-healthbar__legend-item--cap">
              <span>Cap: {fmt(budgetCap)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="budget-insights">
          {insights.map((ins, i) => (
            <div key={i} className={cn("budget-insight", `budget-insight--${ins.type}`)}>
              {ins.type === "saving" && <TrendingDown size={12} />}
              {ins.type === "warning" && <AlertTriangle size={12} />}
              {ins.type === "info" && <Info size={12} />}
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ background: "var(--bg-app)" }}>
        {tab === "budget" && (
          <div className="budget-content">
            {effectiveCategories.map((cat) => {
              const catTotal = getCategoryTotal(cat, shootDays);
              const pct = grandTotal > 0 ? (catTotal / grandTotal) * 100 : 0;

              return (
                <div key={cat.id} className="budget-category">
                  <button
                    type="button"
                    className="budget-category__header"
                    onClick={() => toggleCollapse(cat.id)}
                  >
                    <div className="budget-category__left">
                      {cat.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="budget-category__icon">{cat.icon}</span>
                      <span className="budget-category__label">{cat.label}</span>
                      <span className="budget-category__count">{cat.items.length}</span>
                    </div>
                    <div className="budget-category__progress">
                      <div
                        className="budget-category__progress-fill"
                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: CATEGORY_COLORS[cat.id] }}
                      />
                    </div>
                    <div className="budget-category__right">
                      <span className="budget-category__pct">{pct.toFixed(0)}%</span>
                      <span className="budget-category__total">{fmt(catTotal)}</span>
                    </div>
                  </button>

                  {!cat.collapsed && (
                    <div className="budget-category__body">
                      <table className="budget-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th style={{ width: 110 }}>Rate</th>
                            <th style={{ width: 90 }}>Type</th>
                            <th style={{ width: 70 }}>Qty</th>
                            <th style={{ width: 120 }} className="text-right">Total</th>
                            <th style={{ width: 36 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const hasSubcategories = cat.id === "crew" && cat.items.some((i) => i.subcategory);
                            if (!hasSubcategories) {
                              return cat.items.map((item) => renderBudgetRow(item, cat.id));
                            }
                            // Group by subcategory
                            const groups: { sub: string; items: LineItem[] }[] = [];
                            const seen = new Set<string>();
                            for (const item of cat.items) {
                              const sub = item.subcategory || "other";
                              if (!seen.has(sub)) {
                                seen.add(sub);
                                groups.push({ sub, items: [] });
                              }
                              groups.find((g) => g.sub === sub)!.items.push(item);
                            }
                            return groups.map((group) => {
                              const subTotal = group.items.reduce((s, i) => s + getItemTotal(i, shootDays), 0);
                              return (
                                <React.Fragment key={group.sub}>
                                  <tr className="budget-table__subcategory-row">
                                    <td colSpan={5}>
                                      <span className="budget-subcategory-label">{group.sub}</span>
                                      <span className="budget-subcategory-total">{fmt(subTotal)}</span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="budget-add-btn budget-add-btn--inline"
                                        onClick={() => addItem(cat.id, group.sub)}
                                        title={`Add to ${group.sub}`}
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </td>
                                  </tr>
                                  {group.items.map((item) => renderBudgetRow(item, cat.id))}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                      {cat.id === "crew" && cat.items.some((i) => i.subcategory) ? (
                        <div className="budget-add-crew-dept">
                          <select
                            className="budget-inline-select"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addItem(cat.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="" disabled>+ Add crew to department...</option>
                            {["production", "camera", "lighting", "grip", "sound", "art", "costume", "makeup", "post"].map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="budget-add-btn"
                          onClick={() => addItem(cat.id)}
                        >
                          <Plus size={12} />
                          Add line item
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="budget-footer">
              <button type="button" className="budget-reset-btn" onClick={resetDefaults}>
                Reset to defaults
              </button>
            </div>
          </div>
        )}

        {tab === "top-sheet" && (
          <div className="budget-topsheet">
            <h2 className="budget-topsheet__title">Budget Top Sheet</h2>
            <p className="budget-topsheet__subtitle">
              {project?.title || "Project"} — {shootDays} shoot day{shootDays !== 1 ? "s" : ""}
            </p>

            <div className="budget-topsheet__categories">
              {effectiveCategories.map((cat) => {
                const catTotal = getCategoryTotal(cat, shootDays);
                const pct = grandTotal > 0 ? (catTotal / grandTotal) * 100 : 0;
                return (
                  <div key={cat.id} className="budget-topsheet__row">
                    <div className="budget-topsheet__row-left">
                      <span className="budget-topsheet__row-icon">{cat.icon}</span>
                      <span className="budget-topsheet__row-label">{cat.label}</span>
                    </div>
                    <div className="budget-topsheet__row-bar">
                      <div
                        className="budget-topsheet__row-fill"
                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: CATEGORY_COLORS[cat.id] }}
                      />
                    </div>
                    <div className="budget-topsheet__row-right">
                      <span className="budget-topsheet__row-pct">{pct.toFixed(0)}%</span>
                      <span className="budget-topsheet__row-amount">{fmt(catTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="budget-topsheet__cards">
              <div className="budget-topsheet__card">
                <div className="budget-topsheet__card-icon"><DollarSign size={16} /></div>
                <div>
                  <div className="budget-topsheet__card-label">Daily Burn Rate</div>
                  <div className="budget-topsheet__card-value">{fmt(dailyBurn)}</div>
                </div>
              </div>
              <div className="budget-topsheet__card">
                <div className="budget-topsheet__card-icon"><TrendingUp size={16} /></div>
                <div>
                  <div className="budget-topsheet__card-label">Total Projected</div>
                  <div className="budget-topsheet__card-value budget-topsheet__card-value--accent">{fmt(grandTotal)}</div>
                </div>
              </div>
            </div>

            <div className="budget-topsheet__split">
              <div className="budget-topsheet__split-row">
                <span>Above the Line</span>
                <span className="budget-topsheet__split-val">
                  {fmt(getCategoryTotal(effectiveCategories.find((c) => c.id === "talent")!, shootDays))}
                </span>
              </div>
              <div className="budget-topsheet__split-row">
                <span>Below the Line</span>
                <span className="budget-topsheet__split-val">
                  {fmt(
                    effectiveCategories
                      .filter((c) => ["crew", "equipment", "locations", "art", "operations"].includes(c.id))
                      .reduce((s, c) => s + getCategoryTotal(c, shootDays), 0)
                  )}
                </span>
              </div>
              <div className="budget-topsheet__split-row">
                <span>Post-Production</span>
                <span className="budget-topsheet__split-val">
                  {fmt(getCategoryTotal(effectiveCategories.find((c) => c.id === "post")!, shootDays))}
                </span>
              </div>
              <div className="budget-topsheet__split-row budget-topsheet__split-row--total">
                <span>Grand Total</span>
                <span className="budget-topsheet__split-val">{fmt(grandTotal)}</span>
              </div>
            </div>

            {budgetCap > 0 && (
              <div className={cn(
                "budget-topsheet__cap",
                grandTotal > budgetCap ? "budget-topsheet__cap--over" : "budget-topsheet__cap--under",
              )}>
                <div className="budget-topsheet__cap-row">
                  {grandTotal > budgetCap ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  <span>Budget Cap</span>
                  <span className="budget-topsheet__cap-val">{fmt(budgetCap)}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginLeft: 4 }}>
                    {amountToWords(budgetCap, currency)}
                  </span>
                </div>
                <div className="budget-topsheet__cap-row">
                  <span>{grandTotal > budgetCap ? "Over by" : "Remaining"}</span>
                  <span className="budget-topsheet__cap-val">{fmt(Math.abs(budgetCap - grandTotal))}</span>
                </div>
                <div className="budget-topsheet__cap-bar">
                  <div
                    className="budget-topsheet__cap-fill"
                    style={{ width: `${Math.min(100, (grandTotal / budgetCap) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "compare" && (
          <CompareTab
            categories={categories}
            effectiveCategories={effectiveCategories}
            schedules={schedules || []}
            shootDays={shootDays}
            activeScheduleId={activeScheduleId}
            customDays={customDays}
            setCustomDays={setCustomDays}
            addCustomDay={addCustomDay}
            fmt={fmt}
            budgetCap={budgetCap}
            projectId={id}
            onScheduleCloned={() => qc.invalidateQueries({ queryKey: ["schedules", id] })}
          />
        )}
      </div>
    </div>
  );
}

/* ── Compare Tab ──────────────────────────────────── */

interface ScheduleData {
  id: string;
  name: string;
  shootDays: { id: string; scenes: { id: string }[] }[];
}

function CompareTab({
  categories,
  effectiveCategories,
  schedules,
  shootDays,
  activeScheduleId,
  customDays,
  setCustomDays,
  addCustomDay,
  fmt,
  budgetCap,
  projectId,
  onScheduleCloned,
}: {
  categories: BudgetCategory[];
  effectiveCategories: BudgetCategory[];
  schedules: ScheduleData[];
  shootDays: number;
  activeScheduleId: string | null;
  customDays: number[];
  setCustomDays: (d: number[]) => void;
  addCustomDay: () => void;
  fmt: (n: number) => string;
  budgetCap: number;
  projectId: string;
  onScheduleCloned: () => void;
}) {
  const [cloning, setCloning] = useState<string | null>(null);

  const cloneSchedule = async (scheduleId: string) => {
    setCloning(scheduleId);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedules/${scheduleId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Clone failed");
      onScheduleCloned();
    } catch { /* ignore */ }
    setCloning(null);
  };

  // Build comparison columns: active schedule + each other schedule + custom scenarios
  const columns = useMemo(() => {
    const cols: { label: string; days: number; scheduleId?: string; isCurrent?: boolean }[] = [];

    // Active schedule first
    const active = schedules.find((s) => s.id === activeScheduleId);
    if (active) {
      cols.push({ label: active.name, days: active.shootDays?.length || 1, scheduleId: active.id, isCurrent: true });
    } else {
      cols.push({ label: "Current", days: shootDays, isCurrent: true });
    }

    // All other schedules
    schedules.forEach((s: ScheduleData) => {
      if (s.id === activeScheduleId) return; // skip active, already added
      const days = s.shootDays?.length || 0;
      if (days > 0) {
        cols.push({ label: s.name, days, scheduleId: s.id });
      }
    });

    // Custom what-if scenarios
    customDays.forEach((d) => {
      if (!cols.some((c) => c.days === d && !c.scheduleId)) {
        cols.push({ label: `${d}-Day Plan`, days: d });
      }
    });

    return cols;
  }, [schedules, shootDays, customDays, activeScheduleId]);

  const currentTotal = computeGrandTotal(categories, shootDays);

  return (
    <div className="budget-compare">
      <div className="budget-compare__header">
        <div>
          <h2 className="budget-compare__title">Schedule Comparison</h2>
          <p className="budget-compare__subtitle">Compare budgets across schedules and what-if scenarios</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {schedules.length > 0 && (
            <button
              type="button"
              className="budget-compare__add-btn"
              onClick={() => {
                const active = schedules.find((s) => s.id === activeScheduleId) || schedules[0];
                if (active) cloneSchedule(active.id);
              }}
              disabled={cloning !== null}
              title="Clone current schedule as a new variation"
            >
              {cloning ? <Loader2 size={13} className="budget-compare__spin" /> : <Plus size={13} />}
              Clone Schedule
            </button>
          )}
          <button type="button" className="budget-compare__add-btn budget-compare__add-btn--secondary" onClick={addCustomDay}>
            <Plus size={13} />
            What-if
          </button>
        </div>
      </div>

      {/* What-if day count inputs */}
      {customDays.length > 0 && (
        <div className="budget-compare__scenarios">
          {customDays.map((d, i) => (
            <div key={i} className="budget-compare__scenario-chip">
              <input
                type="number"
                min={1}
                value={d}
                className="budget-compare__day-input"
                onChange={(e) => {
                  const next = [...customDays];
                  next[i] = Math.max(1, Number(e.target.value));
                  setCustomDays(next);
                }}
              />
              <span className="budget-compare__day-label">days</span>
              <button
                type="button"
                className="budget-compare__remove-btn"
                onClick={() => setCustomDays(customDays.filter((_, j) => j !== i))}
              >
                <Minus size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {columns.length < 2 && schedules.length === 0 && customDays.length === 0 && (
        <div className="budget-compare__empty">
          <BarChart3 size={32} />
          <p>Create schedules to compare their budget impact.</p>
          <p className="budget-compare__empty-hint">
            Go to <strong>Schedule</strong> → create multiple schedules with different date ranges, then come back here to compare costs.
          </p>
        </div>
      )}

      {columns.length >= 1 && (
        <div className="budget-compare__grid">
          <table className="budget-compare__table">
            <thead>
              <tr>
                <th>Category</th>
                {columns.map((col, i) => (
                  <th key={i}>
                    <span className="budget-compare__col-label">
                      {col.label}
                      {col.isCurrent && <span className="budget-compare__active-badge">Active</span>}
                    </span>
                    <span className="budget-compare__col-days">{col.days} shoot days</span>
                    {col.scheduleId && !col.isCurrent && (
                      <button
                        className="budget-compare__clone-mini"
                        onClick={() => cloneSchedule(col.scheduleId!)}
                        disabled={cloning === col.scheduleId}
                        title="Clone this schedule"
                      >
                        {cloning === col.scheduleId ? "..." : "Clone"}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveCategories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <span className="budget-compare__cat-dot" style={{ background: CATEGORY_COLORS[cat.id] }} />
                    {cat.label}
                  </td>
                  {columns.map((col, i) => {
                    const eff = computeEffectiveCategories(categories, col.days);
                    const effCat = eff.find((c) => c.id === cat.id)!;
                    const total = getCategoryTotal(effCat, col.days);
                    const currentCatTotal = getCategoryTotal(cat, shootDays);
                    const delta = total - currentCatTotal;
                    return (
                      <td key={i}>
                        <span className="budget-compare__amount">{fmt(total)}</span>
                        {!col.isCurrent && delta !== 0 && (
                          <span className={cn("budget-compare__delta", delta < 0 ? "budget-compare__delta--save" : "budget-compare__delta--over")}>
                            {delta < 0 ? "−" : "+"}{fmt(Math.abs(delta))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="budget-compare__total-row">
                <td>Grand Total</td>
                {columns.map((col, i) => {
                  const total = computeGrandTotal(categories, col.days);
                  const delta = total - currentTotal;
                  return (
                    <td key={i}>
                      <span className="budget-compare__amount">{fmt(total)}</span>
                      {!col.isCurrent && delta !== 0 && (
                        <span className={cn("budget-compare__delta", delta < 0 ? "budget-compare__delta--save" : "budget-compare__delta--over")}>
                          {delta < 0 ? "−" : "+"}{fmt(Math.abs(delta))}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {budgetCap > 0 && (
                <tr className="budget-compare__cap-row">
                  <td>vs Budget Cap</td>
                  {columns.map((col, i) => {
                    const total = computeGrandTotal(categories, col.days);
                    const diff = budgetCap - total;
                    return (
                      <td key={i}>
                        <span className={cn(
                          "budget-compare__cap-badge",
                          diff >= 0 ? "budget-compare__cap-badge--under" : "budget-compare__cap-badge--over"
                        )}>
                          {diff >= 0 ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                          {diff >= 0 ? `${fmt(diff)} under` : `${fmt(Math.abs(diff))} over`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {/* Savings callout */}
      {columns.length >= 2 && (() => {
        const best = columns.reduce((min: { label: string; days: number; isCurrent?: boolean; total: number }, col) => {
          const total = computeGrandTotal(categories, col.days);
          return total < min.total ? { ...col, total } : min;
        }, { ...columns[0], total: computeGrandTotal(categories, columns[0].days) });
        const savings = currentTotal - best.total;
        if (savings > 0 && !best.isCurrent) {
          return (
            <div className="budget-compare__callout">
              <Lightbulb size={14} />
              <span>
                <strong>{best.label}</strong> ({best.days} days) saves {fmt(savings)} compared to current schedule
              </span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
