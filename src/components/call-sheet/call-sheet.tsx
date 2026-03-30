"use client";

import { useMemo } from "react";
import {
  Calendar,
  Clock3,
  MapPin,
  CloudRain,
  Users,
  Film,
  FileText,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./call-sheet.css";

interface CallSheetProps {
  project: {
    id: string;
    title: string;
    genre: string | null;
    format: string | null;
    currency: string;
    defaultCallTime: string | null;
    defaultWrapTime: string | null;
  };
  day: {
    id: string;
    dayNumber: number;
    date: string | null;
    callTime: string | null;
    estimatedWrap: string | null;
    dayType: string;
    isTravelDay: boolean;
    weatherContingency: string | null;
    notes: string | null;
    location: {
      name: string;
      address: string | null;
      hasParking: boolean;
      hasPower: boolean;
    } | null;
    scenes: {
      id: string;
      sceneNumber: string;
      sceneName: string;
      intExt: string;
      dayNight: string;
      pageCount: number;
      synopsis: string | null;
      order: number;
      castLinks: {
        castMember: {
          id: string;
          name: string;
          characterName: string | null;
          roleType: string;
        };
      }[];
    }[];
  };
  castMembers: {
    id: string;
    name: string;
    characterName: string | null;
    roleType: string;
  }[];
  crewMembers: {
    id: string;
    name: string;
    department: string;
    role: string;
  }[];
  equipment: {
    id: string;
    name: string;
    category: string;
    quantity: number;
  }[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CallSheet({
  project,
  day,
  crewMembers,
  equipment,
}: CallSheetProps) {
  const sortedScenes = useMemo(
    () => [...day.scenes].sort((a, b) => a.order - b.order),
    [day.scenes]
  );

  // Collect unique cast from all scenes, sorted alphabetically, assign numbers
  const castNumberMap = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; characterName: string | null; roleType: string }>();
    for (const scene of day.scenes) {
      for (const link of scene.castLinks) {
        if (!seen.has(link.castMember.id)) {
          seen.set(link.castMember.id, link.castMember);
        }
      }
    }
    const sorted = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, number>();
    sorted.forEach((member, i) => map.set(member.id, i + 1));
    return { map, sorted };
  }, [day.scenes]);

  const totalPages = useMemo(
    () => sortedScenes.reduce((sum, s) => sum + s.pageCount, 0),
    [sortedScenes]
  );

  const callTime = day.callTime || project.defaultCallTime || "TBD";
  const wrapTime = day.estimatedWrap || project.defaultWrapTime || "TBD";

  // Group crew by department
  const crewByDept = useMemo(() => {
    const groups = new Map<string, typeof crewMembers>();
    for (const member of [...crewMembers].sort((a, b) => a.name.localeCompare(b.name))) {
      const dept = member.department;
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(member);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [crewMembers]);

  // Group equipment by category
  const equipByCategory = useMemo(() => {
    const groups = new Map<string, typeof equipment>();
    for (const item of equipment) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category)!.push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  const meta = [project.genre, project.format].filter(Boolean).join(" / ");

  return (
    <div className="call-sheet">
      <div className="call-sheet-document">
        <div className="call-sheet-document__inner">
          {/* Header */}
          <div className="call-sheet-header">
            <div>
              <h1 className="call-sheet-header__title">{project.title}</h1>
              {meta && (
                <div className="call-sheet-header__meta">
                  <span>{meta}</span>
                </div>
              )}
            </div>
            <div className="call-sheet-header__day-info">
              <div className="call-sheet-header__day-info__day-label">
                {day.isTravelDay ? "Travel Day" : "Shoot Day"}
              </div>
              <div className="call-sheet-header__day-info__day-number">
                DAY {day.dayNumber}
              </div>
              <div className="call-sheet-header__day-info__date">
                <Calendar size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                {formatDate(day.date)}
              </div>
              <div className="call-sheet-header__day-info__times">
                <span>
                  Call: <strong>{callTime}</strong>
                </span>
                <span>
                  Wrap: <strong>{wrapTime}</strong>
                </span>
              </div>
              {day.weatherContingency && (
                <div className="call-sheet-header__day-info__weather">
                  <CloudRain size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                  {day.weatherContingency}
                </div>
              )}
            </div>
          </div>

          {/* General Crew Call */}
          <div className="call-sheet-general-call">
            <span className="call-sheet-general-call__label">
              <Clock3 size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
              General Crew Call
            </span>
            <span className="call-sheet-general-call__time">{callTime}</span>
          </div>

          {/* Shooting Schedule */}
          {sortedScenes.length > 0 && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <Film size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Shooting Schedule
              </h2>
              <table className="call-sheet-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>I/E</th>
                    <th>Scene</th>
                    <th>D/N</th>
                    <th>Cast</th>
                    <th style={{ textAlign: "right" }}>Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScenes.map((scene) => {
                    const castNums = scene.castLinks
                      .map((l) => castNumberMap.map.get(l.castMember.id)!)
                      .filter(Boolean)
                      .sort((a, b) => a - b);
                    const isExt = scene.intExt.toUpperCase().startsWith("EXT");
                    const isNight = scene.dayNight.toUpperCase().includes("NIGHT");

                    return (
                      <tr key={scene.id} className="call-sheet-scene-row">
                        <td className="call-sheet-scene-row__number">
                          {scene.sceneNumber}
                        </td>
                        <td>
                          <span
                            className={cn(
                              "call-sheet-scene-row__ie",
                              isExt && "call-sheet-scene-row__ie--ext"
                            )}
                          >
                            {scene.intExt}
                          </span>
                        </td>
                        <td>{scene.sceneName}</td>
                        <td>
                          <span
                            className={cn(
                              "call-sheet-scene-row__dn",
                              isNight && "call-sheet-scene-row__dn--night"
                            )}
                          >
                            {scene.dayNight}
                          </span>
                        </td>
                        <td>
                          {castNums.map((n) => (
                            <span
                              key={n}
                              className="call-sheet-cast-table__number"
                              style={{ marginRight: 3, display: "inline-flex" }}
                            >
                              {n}
                            </span>
                          ))}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                          {scene.pageCount.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "right", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}
                    >
                      Total Pages
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {totalPages.toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Cast */}
          {castNumberMap.sorted.length > 0 && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <Users size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Cast
              </h2>
              <table className="call-sheet-cast-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Character</th>
                    <th>Actor</th>
                    <th>Status</th>
                    <th>Call Time</th>
                  </tr>
                </thead>
                <tbody>
                  {castNumberMap.sorted.map((member) => {
                    const num = castNumberMap.map.get(member.id)!;
                    return (
                      <tr key={member.id}>
                        <td>
                          <span className="call-sheet-cast-table__number">{num}</span>
                        </td>
                        <td>{member.characterName || member.name}</td>
                        <td>{member.name}</td>
                        <td>
                          <span className="call-sheet-cast-table__status call-sheet-cast-table__status--w">
                            W
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11 }}>
                          {callTime}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Crew */}
          {crewByDept.length > 0 && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <Users size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Crew
              </h2>
              <div className="call-sheet-crew-grid">
                {crewByDept.map(([dept, members]) => (
                  <div key={dept} className="call-sheet-dept">
                    <div className="call-sheet-dept__title">{dept}</div>
                    {members.map((m) => (
                      <div key={m.id} className="call-sheet-dept__member">
                        <span>{m.name}</span>
                        <span className="call-sheet-dept__member-role">{m.role}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {day.location && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <MapPin size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Location
              </h2>
              <div className="call-sheet-location-box">
                <div className="call-sheet-location-box__item call-sheet-location-box__item--full">
                  <span className="call-sheet-location-box__label">Name</span>
                  <span className="call-sheet-location-box__value">{day.location.name}</span>
                </div>
                {day.location.address && (
                  <div className="call-sheet-location-box__item call-sheet-location-box__item--full">
                    <span className="call-sheet-location-box__label">Address</span>
                    <span className="call-sheet-location-box__value">{day.location.address}</span>
                  </div>
                )}
                <div className="call-sheet-location-box__item">
                  <span className="call-sheet-location-box__label">Parking</span>
                  <span className="call-sheet-location-box__value">
                    {day.location.hasParking ? "Yes" : "No"}
                  </span>
                </div>
                <div className="call-sheet-location-box__item">
                  <span className="call-sheet-location-box__label">Power</span>
                  <span className="call-sheet-location-box__value">
                    {day.location.hasPower ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Equipment */}
          {equipByCategory.length > 0 && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <Wrench size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Equipment
              </h2>
              <div className="call-sheet-crew-grid">
                {equipByCategory.map(([category, items]) => (
                  <div key={category} className="call-sheet-dept">
                    <div className="call-sheet-dept__title">{category}</div>
                    {items.map((item) => (
                      <div key={item.id} className="call-sheet-dept__member">
                        <span>{item.name}</span>
                        <span className="call-sheet-dept__member-role">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {day.notes && (
            <div className="call-sheet-section">
              <h2 className="call-sheet-section__title">
                <FileText size={10} style={{ display: "inline", marginRight: 6, verticalAlign: "-1px" }} />
                Notes
              </h2>
              <div className="call-sheet-notes">{day.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div className="call-sheet-footer">
            <span className="call-sheet-footer__confidential">
              Confidential — For Production Use Only
            </span>
            <span className="call-sheet-footer__page-info">Generated by ShotFlow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
