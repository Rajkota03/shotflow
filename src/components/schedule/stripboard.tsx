"use client";

import type { ScheduleBoardState, ScheduleScene, ScheduleShootDay } from "./types";

interface StripboardProps {
  board: ScheduleBoardState;
  shootDays: ScheduleShootDay[];
  onBoardChange: (board: ScheduleBoardState) => void;
}

const INT_DAY_COLOR = "var(--strip-int-day, #2C3E50)";
const INT_NIGHT_COLOR = "var(--strip-int-night, #1A2744)";
const EXT_DAY_COLOR = "var(--strip-ext-day, #2E5939)";
const EXT_NIGHT_COLOR = "var(--strip-ext-night, #1F3A2A)";

function getStripColor(scene: ScheduleScene): string {
  const isExt = scene.intExt === "EXT";
  const isNight = scene.dayNight === "NIGHT";
  if (isExt && isNight) return EXT_NIGHT_COLOR;
  if (isExt) return EXT_DAY_COLOR;
  if (isNight) return INT_NIGHT_COLOR;
  return INT_DAY_COLOR;
}

function SceneStrip({ scene }: { scene: ScheduleScene }) {
  const cast = scene.castLinks.map((l) => l.castMember.name).join(", ");

  return (
    <div className="stripboard-strip" style={{ background: getStripColor(scene) }}>
      <span className="stripboard-strip__num">{scene.sceneNumber}</span>
      <span className="stripboard-strip__ie">{scene.intExt}</span>
      <span className="stripboard-strip__name">{scene.sceneName}</span>
      <span className="stripboard-strip__dn">{scene.dayNight}</span>
      <span className="stripboard-strip__pages">{scene.pageCount}</span>
      <span className="stripboard-strip__cast" title={cast}>{cast || "—"}</span>
    </div>
  );
}

function DayBanner({ day, pageTotal }: { day: ScheduleShootDay; pageTotal: number }) {
  const dateStr = day.date
    ? new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "TBD";

  return (
    <div className="stripboard-day-banner">
      <span className="stripboard-day-banner__label">DAY {day.dayNumber}</span>
      <span className="stripboard-day-banner__date">{dateStr}</span>
      <span className="stripboard-day-banner__pages">{pageTotal.toFixed(1)} pgs</span>
      {day.location && <span className="stripboard-day-banner__loc">{day.location.name}</span>}
    </div>
  );
}

export function Stripboard({ board, shootDays, onBoardChange }: StripboardProps) {
  const unscheduled = board["unscheduled"] || [];

  return (
    <div className="stripboard">
      {/* Header row */}
      <div className="stripboard-header">
        <span className="stripboard-header__col">SC#</span>
        <span className="stripboard-header__col">I/E</span>
        <span className="stripboard-header__col stripboard-header__col--name">Scene</span>
        <span className="stripboard-header__col">D/N</span>
        <span className="stripboard-header__col">PGS</span>
        <span className="stripboard-header__col stripboard-header__col--cast">Cast</span>
      </div>

      {/* Scheduled days */}
      {shootDays.map((day) => {
        const scenes = board[day.id] || [];
        const pageTotal = scenes.reduce((sum, s) => sum + s.pageCount, 0);

        return (
          <div key={day.id} className="stripboard-day">
            <DayBanner day={day} pageTotal={pageTotal} />
            {scenes.length === 0 ? (
              <div className="stripboard-empty">No scenes assigned</div>
            ) : (
              scenes.map((scene) => <SceneStrip key={scene.id} scene={scene} />)
            )}
          </div>
        );
      })}

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="stripboard-day">
          <div className="stripboard-day-banner stripboard-day-banner--unscheduled">
            <span className="stripboard-day-banner__label">UNSCHEDULED</span>
            <span className="stripboard-day-banner__pages">{unscheduled.length} scenes</span>
          </div>
          {unscheduled.map((scene) => (
            <SceneStrip key={scene.id} scene={scene} />
          ))}
        </div>
      )}
    </div>
  );
}
