export type WarningSeverity = 'info' | 'warning' | 'critical';
export type WarningCategory = 'overlap' | 'move' | 'turnaround' | 'data' | 'capacity';

export interface ScheduleWarning {
    id: string;
    dayId?: string;
    sceneId?: string;
    category: WarningCategory;
    severity: WarningSeverity;
    message: string;
}

export interface ConflictReport {
    warnings: ScheduleWarning[];
    criticalCount: number;
    warningCount: number;
    infoCount: number;
}

/**
 * Analyzes the schedule and returns a list of warnings
 */
export function analyzeSchedule(days: any[], scenes: any[]): ConflictReport {
    const warnings: ScheduleWarning[] = [];
    const sceneMap = new Map<string, any>(scenes.map(s => [s.id, s]));

    for (let i = 0; i < days.length; i++) {
        const day = days[i];
        
        // Items scheduled on this day
        // Day has relation "scenes" if fetched from Prisma, or we can filter scenes by shootDayId
        const dayScenes = scenes.filter(s => s.shootDayId === day.id);

        // 1. Missing Data (Scheduled but missing location or D/N)
        dayScenes.forEach(scene => {
            if (!scene.sceneName || scene.sceneName.trim() === '') {
                warnings.push({
                    id: `data-loc-${scene.id}`,
                    dayId: day.id,
                    sceneId: scene.id,
                    category: 'data',
                    severity: 'warning',
                    message: `Scene ${scene.sceneNumber} missing setting/location`,
                });
            }
            if (!scene.dayNight) {
                warnings.push({
                    id: `data-tod-${scene.id}`,
                    dayId: day.id,
                    sceneId: scene.id,
                    category: 'data',
                    severity: 'info',
                    message: `Scene ${scene.sceneNumber} missing Day/Night`,
                });
            }
        });

        // 2. Company Move (Multiple physical locations in one day based on sceneName)
        const uniqueLocations = new Set(dayScenes.map(s => s.sceneName).filter(l => l && l.trim() !== ''));
        if (uniqueLocations.size > 2) {
            warnings.push({
                id: `move-heavy-${day.id}`,
                dayId: day.id,
                category: 'move',
                severity: 'warning',
                message: `Day ${day.dayNumber} has ${uniqueLocations.size} locations (heavy company moves)`,
            });
        }

        // 3. Day Capacity (> 8 pages a day is critical, > 5 is warning)
        const totalPages = dayScenes.reduce((sum, s) => sum + (s.pageCount || 1), 0);
        if (totalPages > 8) {
            warnings.push({
                id: `cap-crit-${day.id}`,
                dayId: day.id,
                category: 'capacity',
                severity: 'critical',
                message: `Day ${day.dayNumber} is overloaded (${Math.round(totalPages * 10)/10} pages)`,
            });
        } else if (totalPages > 5) {
            warnings.push({
                id: `cap-warn-${day.id}`,
                dayId: day.id,
                category: 'capacity',
                severity: 'warning',
                message: `Day ${day.dayNumber} is pressure-heavy (${Math.round(totalPages * 10)/10} pages)`,
            });
        }

        // 4. Turnaround (if calendar dates exist and are consecutive)
        if (i > 0 && day.date && days[i-1].date) {
            const prev = days[i-1];
            if (prev.estimatedWrap && day.callTime) {
                // very simple heuristic: if prev ends at 22:00 and this starts at 06:00
                const prevEnd = parseInt(prev.estimatedWrap.split(':')[0]);
                const currStart = parseInt(day.callTime.split(':')[0]);
                const restHours = (24 - prevEnd) + currStart;
                if (restHours < 10 && restHours > 0) {
                    warnings.push({
                        id: `turnaround-${day.id}`,
                        dayId: day.id,
                        category: 'turnaround',
                        severity: 'critical',
                        message: `Day ${day.dayNumber}: Only ${restHours} hours turnaround from Day ${prev.dayNumber}`,
                    });
                }
            }
        }
    }

    // 5. Unscheduled items Warning (optional)
    const unscheduled = scenes.filter(s => !s.shootDayId);
    if (unscheduled.length > 0) {
        warnings.push({
            id: `unscheduled-${unscheduled.length}`,
            category: 'capacity',
            severity: 'info',
            message: `${unscheduled.length} scenes are currently unscheduled.`,
        });
    }

    return {
        warnings,
        criticalCount: warnings.filter(w => w.severity === 'critical').length,
        warningCount: warnings.filter(w => w.severity === 'warning').length,
        infoCount: warnings.filter(w => w.severity === 'info').length,
    };
}
