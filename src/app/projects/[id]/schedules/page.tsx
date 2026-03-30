"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface BlockedDate { id: string; date: string; reason: string }
interface ShootDayBasic { id: string; dayNumber: number; date: string | null; scenes: { id: string }[] }
interface Schedule {
    id: string; name: string; startDate: string; endDate: string;
    shootDays: ShootDayBasic[];
    blockedDates: BlockedDate[];
}

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const qc = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [form, setForm] = useState({ name: "", startDate: "", endDate: "", blockSundays: true });

    const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
        queryKey: ["schedules", id],
        queryFn: () => fetch(`/api/projects/${id}/schedules`).then(r => r.json()),
    });

    const createMutation = useMutation({
        mutationFn: (data: typeof form) =>
            fetch(`/api/projects/${id}/schedules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    blockedWeekdays: data.blockSundays ? [0] : [],
                }),
            }).then(r => r.json()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["schedules", id] });
            setCreateOpen(false);
            setForm({ name: "", startDate: "", endDate: "", blockSundays: true });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (scheduleId: string) =>
            fetch(`/api/projects/${id}/schedules/${scheduleId}`, { method: "DELETE" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["schedules", id] });
            setSelectedSchedule(null);
        },
    });

    const blockDateMutation = useMutation({
        mutationFn: ({ scheduleId, date }: { scheduleId: string; date: string }) =>
            fetch(`/api/projects/${id}/schedules/${scheduleId}/blocked-dates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date }),
            }).then(r => r.json()),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules", id] }),
    });

    const unblockDateMutation = useMutation({
        mutationFn: ({ scheduleId, date }: { scheduleId: string; date: string }) =>
            fetch(`/api/projects/${id}/schedules/${scheduleId}/blocked-dates`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date }),
            }).then(r => r.json()),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules", id] }),
    });

    function formatDate(d: string) {
        return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }

    function renderCalendar(schedule: Schedule) {
        const startStr = new Date(schedule.startDate).toISOString().split("T")[0];
        const endStr = new Date(schedule.endDate).toISOString().split("T")[0];
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = firstDay.getDay();

        const blockedSet = new Set(schedule.blockedDates.map(b => b.date.split("T")[0]));
        const shootDayMap = new Map<string, ShootDayBasic>();
        schedule.shootDays.forEach(sd => {
            if (sd.date) shootDayMap.set(sd.date.split("T")[0], sd);
        });

        const cells: React.ReactNode[] = [];

        // Empty cells before month starts
        for (let i = 0; i < startDow; i++) {
            cells.push(<div key={`empty-${i}`} className="h-14" />);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const inRange = isoDate >= startStr && isoDate <= endStr;
            const isBlocked = blockedSet.has(isoDate);
            const shootDay = shootDayMap.get(isoDate);
            const isSunday = date.getDay() === 0;
            const isToday = isoDate === new Date().toISOString().split("T")[0];

            let bg = "bg-transparent";
            let text = "text-[#555]";
            let border = "border-transparent";
            let cursor = "";

            if (inRange) {
                if (isBlocked) {
                    bg = "bg-red-900/20";
                    text = "text-red-400";
                    border = "border-red-900/30";
                    cursor = "cursor-pointer hover:bg-red-900/30";
                } else if (shootDay) {
                    bg = "bg-emerald-900/20";
                    text = "text-emerald-400";
                    border = "border-emerald-900/30";
                    cursor = "cursor-pointer hover:bg-emerald-900/30";
                }
            }

            if (isToday) border = "border-[#f59e0b]";

            function handleClick() {
                if (!inRange) return;
                if (isBlocked) {
                    unblockDateMutation.mutate({ scheduleId: schedule.id, date: isoDate });
                } else if (shootDay) {
                    if (confirm(`Block Day ${shootDay.dayNumber} (${isoDate})? ${shootDay.scenes.length > 0 ? "Scenes will be unassigned." : ""}`)) {
                        blockDateMutation.mutate({ scheduleId: schedule.id, date: isoDate });
                    }
                }
            }

            cells.push(
                <div
                    key={day}
                    onClick={handleClick}
                    className={`h-14 rounded-lg border ${bg} ${text} ${border} ${cursor} flex flex-col items-center justify-center transition-colors relative`}
                >
                    <span className={`text-sm font-bold ${isToday ? "text-[#f59e0b]" : ""}`}>{day}</span>
                    {inRange && shootDay && (
                        <span className="text-[9px] font-semibold mt-0.5">Day {shootDay.dayNumber}</span>
                    )}
                    {inRange && isBlocked && (
                        <span className="text-[8px] mt-0.5 uppercase tracking-wide">{isSunday ? "Sun" : "Off"}</span>
                    )}
                    {shootDay && shootDay.scenes.length > 0 && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                    )}
                </div>
            );
        }

        return cells;
    }

    if (isLoading) return <div className="p-8 text-white">Loading schedules...</div>;

    const active = selectedSchedule ? schedules.find(s => s.id === selectedSchedule.id) || selectedSchedule : null;

    return (
        <div className="flex flex-col h-full bg-[#111]">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#222] bg-[#1a1a1a] shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Schedules</h1>
                    <p className="text-sm text-[#888]">
                        {schedules.length > 0 ? `${schedules.length} schedule${schedules.length > 1 ? "s" : ""} created` : "Create a schedule to start planning shoot days"}
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-black font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg"
                >
                    <Plus size={18} />
                    <span>New Schedule</span>
                </button>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-7xl mx-auto">
                    {schedules.length === 0 && !createOpen ? (
                        <div className="text-center py-24 bg-[#1a1a1a] rounded-xl border border-[#222]">
                            <div className="w-20 h-20 bg-[#222] rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Calendar size={32} className="text-[#555]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No schedules yet</h3>
                            <p className="text-[#888] mb-8 max-w-md mx-auto">
                                Create a schedule with start and end dates. Sundays will be automatically blocked.
                            </p>
                            <button onClick={() => setCreateOpen(true)}
                                className="flex items-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-black font-semibold px-6 py-3 rounded-lg transition-colors mx-auto">
                                <Plus size={18} /><span>Create Schedule</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Schedule list */}
                            <div className="space-y-3">
                                {schedules.map(schedule => {
                                    const totalShootDays = schedule.shootDays.length;
                                    const scenesScheduled = schedule.shootDays.reduce((s, d) => s + d.scenes.length, 0);
                                    const isSelected = active?.id === schedule.id;

                                    return (
                                        <div
                                            key={schedule.id}
                                            onClick={() => { setSelectedSchedule(schedule); setCalendarMonth(new Date(schedule.startDate)); }}
                                            className={`p-4 rounded-xl border cursor-pointer transition-colors ${isSelected ? "bg-[#1a2e4a] border-[#2a4a6a] shadow-lg" : "bg-[#1a1a1a] border-[#222] hover:border-[#333]"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-white font-semibold text-sm">{schedule.name}</h3>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm("Delete this schedule?")) deleteMutation.mutate(schedule.id); }}
                                                    className="text-[#555] hover:text-red-400 p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <p className="text-[#888] text-xs mb-2">
                                                {formatDate(schedule.startDate)} → {formatDate(schedule.endDate)}
                                            </p>
                                            <div className="flex items-center gap-3 text-[10px]">
                                                <span className="text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded font-medium">{totalShootDays} shoot days</span>
                                                <span className="text-red-400 bg-red-900/20 px-2 py-0.5 rounded font-medium">{schedule.blockedDates.length} blocked</span>
                                                <span className="text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded font-medium">{scenesScheduled} scenes</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Calendar view */}
                            {active && (
                                <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#222] rounded-xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-white font-semibold">{active.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                                                className="p-1.5 bg-[#222] text-[#888] hover:text-white rounded-lg"><ChevronLeft size={16} /></button>
                                            <span className="text-white text-sm font-medium min-w-[120px] text-center">
                                                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                            </span>
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                                                className="p-1.5 bg-[#222] text-[#888] hover:text-white rounded-lg"><ChevronRight size={16} /></button>
                                        </div>
                                    </div>

                                    {/* Day labels */}
                                    <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                            <div key={d} className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 ${d === "Sun" ? "text-red-400" : "text-[#555]"}`}>
                                                {d}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar grid */}
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {renderCalendar(active)}
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 mt-6 pt-4 border-t border-[#222]">
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <div className="w-3 h-3 rounded bg-emerald-900/30 border border-emerald-900/50" />
                                            <span className="text-[#888]">Shoot Day</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <div className="w-3 h-3 rounded bg-red-900/30 border border-red-900/50" />
                                            <span className="text-[#888]">Blocked</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <div className="w-3 h-3 rounded border border-[#f59e0b]" />
                                            <span className="text-[#888]">Today</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                                            <span className="text-[#888]">Has Scenes</span>
                                        </div>
                                        <span className="text-[#555] text-[10px] ml-auto">Click a day to block/unblock</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Schedule Modal */}
            {createOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111] border border-[#222] rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-4">Create Schedule</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-[#888] block mb-1.5 font-medium">Schedule Name</label>
                                <input className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#f59e0b]"
                                    placeholder="Main Schedule" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-[#888] block mb-1.5 font-medium">Start Date</label>
                                    <input type="date" className="sf-date-input"
                                        value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-[#888] block mb-1.5 font-medium">End Date</label>
                                    <input type="date" className="sf-date-input"
                                        value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer py-1">
                                <input type="checkbox" checked={form.blockSundays}
                                    onChange={e => setForm(f => ({ ...f, blockSundays: e.target.checked }))}
                                    className="rounded border-[#444] bg-[#111] text-[#f59e0b] w-4 h-4" />
                                <span className="text-sm text-[#ccc]">Auto-block Sundays</span>
                            </label>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 bg-[#222] text-[#888] text-sm rounded-lg hover:bg-[#333]">Cancel</button>
                            <button
                                onClick={() => createMutation.mutate(form)}
                                disabled={!form.startDate || !form.endDate || createMutation.isPending}
                                className="flex-1 py-2.5 bg-[#f59e0b] text-black text-sm font-semibold rounded-lg hover:bg-[#d97706] disabled:opacity-50"
                            >
                                {createMutation.isPending ? "Creating..." : "Create Schedule"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
