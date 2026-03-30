"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Bell, AlertTriangle, AlertCircle, Info, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { ConflictReport, ScheduleWarning } from "@/lib/conflict-engine";

export function WarningsBell() {
    const params = useParams();
    const projectId = params?.id as string | undefined;
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: report, isLoading } = useQuery<ConflictReport>({
        queryKey: ["conflicts", projectId],
        queryFn: () => fetch(`/api/projects/${projectId}/conflicts`).then(res => res.json()),
        enabled: !!projectId,
        refetchInterval: 10000, // Poll every 10s for real-time vibe
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!projectId) return <Bell size={20} className="opacity-50" />;

    // Use a custom icon import
    const renderIcon = (severity: string) => {
        if (severity === 'critical') return <AlertCircle size={16} className="text-red-500" />;
        if (severity === 'warning') return <AlertTriangle size={16} className="text-amber-500" />;
        return <Info size={16} className="text-blue-400" />;
    };

    const hasWarnings = report && report.warnings.length > 0;
    const badgeColor = report?.criticalCount ? 'bg-red-500' : (report?.warningCount ? 'bg-amber-500' : 'bg-blue-500');

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setOpen(!open)}
                className={`relative p-2 rounded-lg transition-colors flex items-center gap-1 ${open ? 'bg-[#333]' : 'hover:bg-[#222]'}`}
            >
                {hasWarnings && (
                    <div className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${badgeColor} border-2 border-[#111]`} />
                )}
                <Bell size={20} className={hasWarnings && report?.criticalCount ? "text-red-400" : (hasWarnings ? "text-amber-400" : "text-[#888]")} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-[#161a22] border border-[#232a36] rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#232a36] bg-[#0f131a] flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">Schedule Health</h3>
                        {hasWarnings && (
                            <span className="bg-[#232a36] text-xs px-2 py-0.5 rounded text-[#888]">
                                {report.warnings.length} issues
                            </span>
                        )}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-6 text-center text-[#555] text-sm">Analyzing schedule...</div>
                        ) : !hasWarnings ? (
                            <div className="p-8 text-center">
                                <div className="w-12 h-12 rounded-full border border-green-900/50 bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                                    <Check size={20} className="text-green-500" />
                                </div>
                                <p className="text-sm text-green-400 font-medium">All clear</p>
                                <p className="text-xs text-[#555] mt-1">No conflicts detected.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#232a36]">
                                {report.warnings.map((warning: ScheduleWarning) => (
                                    <div key={warning.id} className="p-4 hover:bg-[#1b2330] transition-colors flex gap-3">
                                        <div className="shrink-0 mt-0.5">
                                            {renderIcon(warning.severity)}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium leading-tight mb-1 ${
                                                warning.severity === 'critical' ? 'text-red-100' : 
                                                warning.severity === 'warning' ? 'text-amber-100' : 'text-blue-100'
                                            }`}>
                                                {warning.message}
                                            </p>
                                            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">
                                                {warning.category} CONFLICT
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
