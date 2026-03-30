"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

interface EditorScene {
    id: string; sceneNumber: string; sceneName: string;
    intExt: string; dayNight: string; pageCount: number; synopsis: string | null;
    scriptPageRef: string | null;
}

export function SceneEditor({
    projectId,
    scene,
    open,
    onOpenChange,
}: {
    projectId: string;
    scene?: EditorScene | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const queryClient = useQueryClient();
    const isEditing = !!scene;

    const [formData, setFormData] = useState({
        sceneNumber: "",
        sceneName: "",
        intExt: "INT",
        dayNight: "DAY",
        pageCount: "1",
        synopsis: "",
        scriptPageRef: "",
    });

    useEffect(() => {
        if (scene) {
            setFormData({
                sceneNumber: scene.sceneNumber || "",
                sceneName: scene.sceneName || "",
                intExt: scene.intExt || "INT",
                dayNight: scene.dayNight || "DAY",
                pageCount: scene.pageCount?.toString() || "1",
                synopsis: scene.synopsis || "",
                scriptPageRef: scene.scriptPageRef || "",
            });
        } else {
            setFormData({
                sceneNumber: "",
                sceneName: "",
                intExt: "INT",
                dayNight: "DAY",
                pageCount: "1",
                synopsis: "",
                scriptPageRef: "",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, open]);

    const saveMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const url = isEditing
                ? `/api/projects/${projectId}/scenes/${scene.id}`
                : `/api/projects/${projectId}/scenes`;

            const res = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    pageCount: parseFloat(data.pageCount) || 1,
                }),
            });

            if (!res.ok) throw new Error("Failed to save scene");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scenes", projectId] });
            onOpenChange(false);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-[#111] border border-[#333] p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <Dialog.Title className="text-xl font-bold text-white">
                            {isEditing ? "Edit Scene" : "Add New Scene"}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-[#888] hover:text-white transition-colors bg-[#222] hover:bg-[#333] p-2 rounded-full">
                                <X size={16} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1 space-y-1.5">
                                <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">Number</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]"
                                    value={formData.sceneNumber}
                                    onChange={e => setFormData({ ...formData, sceneNumber: e.target.value })}
                                    placeholder="1A"
                                />
                            </div>
                            <div className="col-span-3 space-y-1.5">
                                <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">Scene Name</label>
                                <input
                                    required
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]"
                                    value={formData.sceneName}
                                    onChange={e => setFormData({ ...formData, sceneName: e.target.value })}
                                    placeholder="INT. COFFEE SHOP"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">INT/EXT</label>
                                <select
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f59e0b]"
                                    value={formData.intExt}
                                    onChange={e => setFormData({ ...formData, intExt: e.target.value })}
                                >
                                    <option value="INT">INT</option>
                                    <option value="EXT">EXT</option>
                                    <option value="I/E">I/E</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">DAY/NIGHT</label>
                                <select
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f59e0b]"
                                    value={formData.dayNight}
                                    onChange={e => setFormData({ ...formData, dayNight: e.target.value })}
                                >
                                    <option value="DAY">DAY</option>
                                    <option value="NIGHT">NIGHT</option>
                                    <option value="MORNING">MORNING</option>
                                    <option value="EVENING">EVENING</option>
                                    <option value="MAGIC HOUR">MAGIC HOUR</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">PAGES</label>
                                <input
                                    type="number"
                                    step="0.125"
                                    min="0.125"
                                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f59e0b]"
                                    value={formData.pageCount}
                                    onChange={e => setFormData({ ...formData, pageCount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">Synopsis</label>
                            <textarea
                                rows={3}
                                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#f59e0b] resize-none"
                                value={formData.synopsis}
                                onChange={e => setFormData({ ...formData, synopsis: e.target.value })}
                                placeholder="Brief description of the action in this scene..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[#aaa] uppercase tracking-wider">Script Page Ref</label>
                            <input
                                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#f59e0b]"
                                value={formData.scriptPageRef}
                                onChange={e => setFormData({ ...formData, scriptPageRef: e.target.value })}
                                placeholder="e.g. 12-14"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[#333]">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm font-medium text-[#bbb] hover:text-white hover:bg-[#222] rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="px-4 py-2 text-sm font-semibold text-black bg-[#f59e0b] hover:bg-[#d97706] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {saveMutation.isPending && (
                                    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {isEditing ? "Save Changes" : "Create Scene"}
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
