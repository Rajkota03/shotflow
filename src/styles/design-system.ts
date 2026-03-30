export const colors = {
  bg: {
    void: "#05070A",
    app: "#07090D",
    surface1: "#0C1017",
    surface2: "#111620",
    surface3: "#171D2A",
    surface4: "#1E2536",
    overlay: "rgba(5, 7, 10, 0.7)",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.04)",
    default: "rgba(255, 255, 255, 0.07)",
    strong: "rgba(255, 255, 255, 0.12)",
    focus: "rgba(59, 130, 246, 0.5)",
  },
  text: {
    primary: "#D8DAE0",
    secondary: "#7C8091",
    tertiary: "#454A58",
    inverse: "#07090D",
  },
  blue: {
    primary: "#3B82F6",
    hover: "#4B8FF7",
    subtle: "rgba(59, 130, 246, 0.08)",
    border: "rgba(59, 130, 246, 0.25)",
  },
  green: { solid: "#34D399", subtle: "rgba(52, 211, 153, 0.08)" },
  amber: { solid: "#FBBF24", subtle: "rgba(251, 191, 36, 0.08)" },
  red: { solid: "#F87171", subtle: "rgba(248, 113, 113, 0.08)" },
  purple: { solid: "#A78BFA", subtle: "rgba(167, 139, 250, 0.08)" },
  strip: {
    intDay: "#2A6B4A",
    extDay: "#2A4B6B",
    intNight: "#6B4A2A",
    extNight: "#4A2A6B",
    break: "#3A3A3A",
    meal: "rgba(251, 191, 36, 0.3)",
  },
  category: {
    cast: "#FACC15",
    extras: "#FB923C",
    props: "#3B82F6",
    wardrobe: "#34D399",
    vehicles: "#EC4899",
    vfx: "#A78BFA",
    makeup: "#F97316",
    locations: "#22D3EE",
    stunts: "#F87171",
    equipment: "#6B7280",
  },
} as const;

export const typography = {
  fontFamily: {
    ui: '"Inter", -apple-system, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    screenplay: '"Courier Prime", "Courier New", monospace',
  },
  fontSize: {
    xs: "11px",
    sm: "13px",
    base: "14px",
    md: "15px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
    "3xl": "36px",
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.2",
    normal: "1.5",
    relaxed: "1.7",
  },
} as const;

export const spacing = {
  px: "1px",
  0.5: "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const radius = {
  sm: "4px",
  md: "6px",
  lg: "10px",
  xl: "14px",
  full: "9999px",
} as const;
