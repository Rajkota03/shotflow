"use client";

import { useState, useMemo, useEffect } from "react";
import { Check, X, AlertOctagon, BrainCircuit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
interface Element {
    id: string;
    name: string;
    category: string;
    status: "accepted" | "pending" | "rejected";
    source?: string;
    confidence?: number;
}

// Extracted from original Scene types
interface Scene {
    id: string;
    sceneNumber: string;
    sceneName: string;
    intExt: string;
    dayNight: string;
    synopsis: string | null;
    elementsJson?: string | null;
}

interface ReviewQueueModalProps {
    projectId: string;
    scenes: Scene[];
    open: boolean;
    onClose: () => void;
}

export function ReviewQueueModal({ projectId, scenes, open, onClose }: ReviewQueueModalProps) {
    const queryClient = useQueryClient();

    // Flatten pending elements across all scenes
    const pendingItems = useMemo(() => {
        const items: { scene: Scene; element: Element; elementIndex: number }[] = [];
        scenes.forEach((scene) => {
            if (scene.elementsJson) {
                try {
                    const elements: Element[] = JSON.parse(scene.elementsJson);
                    elements.forEach((el, index) => {
                        if (el.status === 'pending') {
                            items.push({ scene, element: el, elementIndex: index });
                        }
                    });
                } catch (e) {
                    console.error("Failed to parse elementsJson for scene", scene.id);
                }
            }
        });
        return items;
    }, [scenes]);

    const [currentIndex, setCurrentIndex] = useState(0);

    // Reset index if open changes
    useEffect(() => {
        if (open) setCurrentIndex(0);
    }, [open]);

    const updateSceneMutation = useMutation({
        mutationFn: async ({ sceneId, elementsJson }: { sceneId: string, elementsJson: string }) => {
            const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ elementsJson }),
            });
            if (!res.ok) throw new Error("Failed to update scene elements");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scenes", projectId] });
        }
    });

    const handleAction = (status: "accepted" | "rejected") => {
        const currentItem = pendingItems[currentIndex];
        if (!currentItem) return;

        // Parse scene elements again to update
        let elements: Element[] = [];
        try {
            elements = JSON.parse(currentItem.scene.elementsJson || "[]");
        } catch { }

        // Update the status of the specific element
        const elementId = currentItem.element.id;
        const updatedElements = elements.map(el => 
            el.id === elementId ? { ...el, status } : el
        );

        // Fire mutation
        updateSceneMutation.mutate({ 
            sceneId: currentItem.scene.id, 
            elementsJson: JSON.stringify(updatedElements) 
        });

        // Optimistically move to next item
        setCurrentIndex(prev => prev + 1);
    };

    if (!open) return null;

    // Remaining items from the current index onwards
    const remainingCount = pendingItems.length - currentIndex;
    const currentItem = pendingItems[currentIndex];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#111] border border-[#222] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#1a1a1a]">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-900/30 text-blue-400 p-2 rounded-lg border border-blue-900/50">
                            <BrainCircuit size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">AI Breakdown Review</h2>
                            <p className="text-sm text-[#888]">Human-in-the-loop Validation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#555] hover:text-white p-2 rounded-md hover:bg-[#333] transition-colors"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="p-8 flex-1">
                    {remainingCount <= 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-900/50">
                                <Check size={32} className="text-green-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Review Complete</h3>
                            <p className="text-[#888]">All AI-extracted elements have been validated.</p>
                            <button 
                                onClick={onClose}
                                className="mt-8 px-6 py-2.5 bg-[#333] hover:bg-[#444] text-white rounded-lg font-medium transition-colors"
                            >
                                Back to Breakdown
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between text-sm text-[#888] mb-4">
                                <span>Item {currentIndex + 1} of {pendingItems.length}</span>
                                <span className="bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-1 rounded font-medium text-xs border border-[#f59e0b]/20 flex items-center gap-1.5">
                                    <AlertOctagon size={12} /> Needs Review
                                </span>
                            </div>

                            {/* Scene Context Card */}
                            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="bg-[#fef08a] text-black font-extrabold px-2 py-0.5 rounded text-xs">
                                        {currentItem.scene.sceneNumber || "-"}
                                    </span>
                                    <h4 className="text-sm font-bold text-[#60a5fa] uppercase tracking-wide">
                                        {currentItem.scene.intExt}. {currentItem.scene.sceneName} - {currentItem.scene.dayNight}
                                    </h4>
                                </div>
                                <p className="text-[#aaa] text-sm italic leading-relaxed border-l-2 border-[#333] pl-3 py-1">
                                    "{currentItem.scene.synopsis || "No action text available for this scene."}"
                                </p>
                            </div>

                            {/* Element to Review */}
                            <div className="text-center py-8">
                                <p className="text-sm text-[#888] mb-2 uppercase tracking-wide font-medium">Extracted {currentItem.element.category}</p>
                                <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
                                    {currentItem.element.name}
                                </h1>
                                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                                    Confidence: <span className="font-mono pl-1" style={{ color: "var(--text-primary)" }}>{((currentItem.element.confidence ?? 0) * 100).toFixed(0)}%</span>
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <button
                                    onClick={() => handleAction("rejected")}
                                    className="flex w-32 items-center justify-center gap-2 px-6 py-4 bg-[#222] hover:bg-red-900/30 text-[#aaa] hover:text-red-400 rounded-xl font-bold transition-all border border-[#333] hover:border-red-900/50"
                                >
                                    <X size={18} />
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleAction("accepted")}
                                    className="flex w-40 items-center justify-center gap-2 px-6 py-4 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl font-bold transition-all shadow-lg hover:shadow-[#f59e0b]/20"
                                >
                                    <Check size={18} />
                                    Accept
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
