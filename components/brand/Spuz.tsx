import type { CSSProperties } from "react";

/**
 * Spuz, the mascot. Port of design/Spuz.dc.html (geometry in em, so `size` scales everything).
 * Mirrors the Rive rig contract: mood 0..11 (or name), intensity 0..1, lookAt -1..1.
 * Spuz never sits on top of an active board.
 */
export const MOOD_NAMES = [
  "idle",
  "wave",
  "thinking",
  "cheer",
  "proud",
  "fire",
  "sleepy",
  "squish",
  "rage",
  "shocked",
  "sad",
  "party",
] as const;
export type SpuzMood = (typeof MOOD_NAMES)[number];

interface MoodDef {
  eyes: "round" | "big" | "happy" | "sleepy" | "x";
  mouth: "smile" | "grin" | "flat" | "o" | "frown";
  arm?: boolean;
  cheeks?: boolean | "rage";
  look?: [number, number];
  brows?: [string, string];
  bubble?: boolean;
  tuftSpin?: boolean;
  confetti?: boolean;
  hop?: boolean;
  sparkles?: boolean;
  t?: string;
  flame?: boolean;
  zzz?: boolean;
  slow?: boolean;
  tuftT?: string;
  still?: boolean;
  steam?: boolean;
  shake?: boolean;
  sweat?: boolean;
  tear?: boolean;
  hat?: boolean;
}

const MOODS: Record<SpuzMood, MoodDef> = {
  idle: { eyes: "round", mouth: "smile" },
  wave: { eyes: "round", mouth: "grin", arm: true, cheeks: true },
  thinking: {
    eyes: "round",
    mouth: "flat",
    look: [0.6, -0.8],
    brows: ["rotate(-10deg) translateY(-.2em)", "rotate(0)"],
    bubble: true,
    tuftSpin: true,
  },
  cheer: { eyes: "happy", mouth: "grin", confetti: true, hop: true, cheeks: true },
  proud: { eyes: "happy", mouth: "smile", sparkles: true, cheeks: true, t: "scale(1.05,1.02)" },
  fire: { eyes: "round", mouth: "grin", flame: true, look: [0, -0.3] },
  sleepy: { eyes: "sleepy", mouth: "o", zzz: true, slow: true, tuftT: "rotate(30deg)" },
  squish: { eyes: "x", mouth: "flat", t: "scale(1.34,.5)", still: true },
  rage: { eyes: "round", mouth: "frown", brows: ["rotate(20deg)", "rotate(-20deg)"], cheeks: "rage", steam: true, shake: true },
  shocked: { eyes: "big", mouth: "o", sweat: true, t: "translateY(-.35em) scale(.95,1.07)" },
  sad: {
    eyes: "round",
    mouth: "frown",
    brows: ["rotate(-16deg)", "rotate(16deg)"],
    tear: true,
    look: [0, 0.7],
    tuftT: "rotate(44deg)",
    t: "scale(1.03,.95)",
    slow: true,
  },
  party: { eyes: "happy", mouth: "grin", hat: true, confetti: true, hop: true, cheeks: true },
};

export interface SpuzProps {
  mood?: SpuzMood | number;
  /** px, default 120 */
  size?: number;
  /** skin colour, default lime */
  color?: string;
  lookX?: number;
  lookY?: number;
  /** freeze all motion (low-data, thumbnails, share cards) */
  still?: boolean;
  className?: string;
  style?: CSSProperties;
  /** decorative instances should be hidden from assistive tech */
  decorative?: boolean;
}

const INK = "#0E0F1A";

export function Spuz({
  mood = "idle",
  size = 120,
  color = "#B8F23A",
  lookX = 0,
  lookY = 0,
  still,
  className,
  style,
  decorative,
}: SpuzProps) {
  const name: SpuzMood = typeof mood === "number" ? MOOD_NAMES[Math.max(0, Math.min(11, Math.round(mood)))] : MOODS[mood] ? mood : "idle";
  const m = MOODS[name];
  const isStill = still || m.still;
  const lx = m.look ? m.look[0] : Math.max(-1, Math.min(1, lookX));
  const ly = m.look ? m.look[1] : Math.max(-1, Math.min(1, lookY));
  const big = m.eyes === "big";
  const pupil = big ? 0.7 : 1.05;
  const pupilR = pupil * 0.8;
  const lookL = `translate(${((lx + (m.look ? 0 : 0.35)) * 0.4).toFixed(2)}em,${((ly - (m.look ? 0 : 0.25)) * 0.45).toFixed(2)}em)`;
  const lookR = `translate(${((lx - (m.look ? 0 : 0.45)) * 0.28).toFixed(2)}em,${((ly + (m.look ? 0 : 0.4)) * 0.3).toFixed(2)}em)`;
  const cheek = m.cheeks === "rage" ? "rgba(255,59,59,.85)" : "rgba(255,122,138,.5)";
  const bodyAnim = isStill ? "" : m.shake ? "spuz-shake" : m.slow ? "spuz-breatheSlow" : "spuz-breathe";
  const shade = "inset -.55em -.65em 0 rgba(0,0,0,.16),inset .45em .4em 0 rgba(255,255,255,.28)";
  const star = "polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)";

  return (
    <div
      className={`spuz-root ${className ?? ""}`}
      data-still={isStill ? "true" : "false"}
      data-mood={name}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Spuz the mascot, ${name} mood`}
      style={{ fontSize: size / 12, ...style }}
    >
      <div style={{ left: "2.4em", bottom: ".45em", width: "7.2em", height: ".9em", borderRadius: "50%", background: "rgba(0,0,0,.28)" }} />
      <div className={m.hop && !isStill ? "spuz-hop" : undefined} style={{ inset: 0 }}>
        {/* feet */}
        <div
          style={{
            left: "2.6em",
            bottom: ".8em",
            width: "2.3em",
            height: "1.1em",
            transform: "rotate(-14deg)",
            borderRadius: "1.1em 1em .6em .6em",
            background: color,
            boxShadow: "inset 0 -.32em 0 rgba(0,0,0,.28)",
          }}
        />
        <div
          style={{
            left: "6.5em",
            bottom: ".85em",
            width: "1.7em",
            height: "1.3em",
            transform: "rotate(10deg)",
            borderRadius: "1em 1em .6em .6em",
            background: color,
            boxShadow: "inset 0 -.32em 0 rgba(0,0,0,.28)",
          }}
        />
        <div
          style={{ left: "1.5em", bottom: "1.35em", width: "9em", height: "7.6em", transformOrigin: "50% 100%", transform: m.t ?? "none" }}
        >
          <div className={bodyAnim} style={{ inset: 0, transformOrigin: "50% 100%" }}>
            {!m.flame && !m.hat && (
              <div
                style={{
                  left: "3.9em",
                  top: "-2.9em",
                  width: "1.3em",
                  height: "3.4em",
                  transformOrigin: "50% 100%",
                  transform: m.tuftT ?? "none",
                }}
              >
                <div
                  className={isStill ? undefined : m.tuftSpin ? "spuz-spin" : "spuz-flop"}
                  style={{ inset: 0, transformOrigin: "50% 100%" }}
                >
                  <div
                    style={{
                      left: ".25em",
                      top: ".9em",
                      width: ".8em",
                      height: "2.6em",
                      borderRadius: ".4em",
                      background: color,
                      boxShadow: "inset -.2em 0 0 rgba(0,0,0,.14)",
                    }}
                  />
                  <div
                    style={{
                      left: "-.25em",
                      top: "-.2em",
                      width: "1.8em",
                      height: "1.6em",
                      borderRadius: "52% 48% 46% 54% / 56% 50% 50% 44%",
                      background: color,
                      boxShadow: "inset -.3em -.25em 0 rgba(0,0,0,.14),inset .2em .2em 0 rgba(255,255,255,.3)",
                    }}
                  />
                </div>
              </div>
            )}
            {m.flame && (
              <>
                <div
                  className={"spuz-flicker"}
                  style={{
                    left: "3.3em",
                    top: "-2.5em",
                    width: "2.5em",
                    height: "2.5em",
                    borderRadius: "50% 0 50% 50%",
                    background: "linear-gradient(45deg,#FF6B2C,#FFC93C)",
                    transform: "rotate(-45deg)",
                  }}
                >
                  <div
                    style={{
                      left: ".7em",
                      top: ".7em",
                      width: "1.1em",
                      height: "1.1em",
                      borderRadius: "50% 0 50% 50%",
                      background: "#FFF1B8",
                    }}
                  />
                </div>
                <div
                  className={"spuz-rise"}
                  style={{ left: "3.6em", top: "-2.6em", width: ".35em", height: ".35em", borderRadius: "50%", background: "#FFC93C" }}
                />
                <div
                  className={"spuz-rise"}
                  style={{
                    left: "5.2em",
                    top: "-2.2em",
                    width: ".28em",
                    height: ".28em",
                    borderRadius: "50%",
                    background: "#FF8A3D",
                    animationDuration: "1.8s",
                    animationDelay: ".5s",
                  }}
                />
              </>
            )}
            {m.hat && (
              <div
                style={{
                  left: "3.1em",
                  top: "-2.9em",
                  width: "2.8em",
                  height: "3.2em",
                  transform: "rotate(-12deg)",
                  transformOrigin: "50% 100%",
                }}
              >
                <div
                  style={{
                    inset: 0,
                    clipPath: "polygon(50% 0,100% 100%,0 100%)",
                    background: "repeating-linear-gradient(135deg,#FFC93C 0 .45em,#FF5A5F .45em .9em)",
                  }}
                />
                <div style={{ left: ".95em", top: "-.5em", width: ".9em", height: ".9em", borderRadius: "50%", background: "#F4F5FB" }} />
              </div>
            )}
            {/* side tab */}
            <div
              style={{
                left: "8em",
                top: "2.6em",
                width: "2.1em",
                height: "2.1em",
                borderRadius: "50%",
                background: color,
                boxShadow: "inset -.4em -.3em 0 rgba(0,0,0,.14)",
              }}
            />
            {m.arm && (
              <div
                className={isStill ? undefined : "spuz-wave"}
                style={{
                  left: "8.5em",
                  top: ".2em",
                  width: "1.3em",
                  height: "2.7em",
                  borderRadius: ".7em",
                  background: color,
                  boxShadow: "inset -.25em 0 0 rgba(0,0,0,.14)",
                  transformOrigin: "50% 100%",
                }}
              />
            )}
            {/* body */}
            <div style={{ inset: 0, borderRadius: "3.6em 2.6em 3em 3.3em / 3.4em 3em 2.5em 2.9em", background: color, boxShadow: shade }} />
            <div key={name} className={"spuz-face"}>
              {m.cheeks && (
                <>
                  <div style={{ left: "1.05em", top: "4.3em", width: "1.4em", height: ".75em", borderRadius: "50%", background: cheek }} />
                  <div style={{ left: "6.55em", top: "4.3em", width: "1.4em", height: ".75em", borderRadius: "50%", background: cheek }} />
                </>
              )}
              {(m.eyes === "round" || big) && (
                <>
                  <Eye
                    left={big ? 1.5 : 1.7}
                    top={big ? 1.4 : 1.65}
                    w={big ? 2.8 : 2.4}
                    h={big ? 3 : 2.6}
                    pupil={pupil}
                    look={lookL}
                    anim={isStill ? undefined : "spuz-blinkL"}
                  />
                  <Eye
                    left={big ? 4.95 : 5.15}
                    top={big ? 2 : 2.25}
                    w={big ? 2 : 1.6}
                    h={big ? 2.2 : 1.75}
                    pupil={pupilR}
                    look={lookR}
                    anim={isStill ? undefined : "spuz-blinkR"}
                  />
                </>
              )}
              {m.eyes === "happy" && (
                <>
                  <div
                    style={{
                      left: "1.8em",
                      top: "2.6em",
                      width: "2.2em",
                      height: "1.1em",
                      border: `.36em solid ${INK}`,
                      borderBottom: "none",
                      borderRadius: "1em 1em 0 0",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      left: "5.15em",
                      top: "3em",
                      width: "1.5em",
                      height: ".8em",
                      border: `.36em solid ${INK}`,
                      borderBottom: "none",
                      borderRadius: "1em 1em 0 0",
                      boxSizing: "border-box",
                    }}
                  />
                </>
              )}
              {m.eyes === "sleepy" && (
                <>
                  <div
                    style={{
                      left: "2.1em",
                      top: "3.05em",
                      width: "1.8em",
                      height: ".9em",
                      border: `.34em solid ${INK}`,
                      borderTop: "none",
                      borderRadius: "0 0 1em 1em",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      left: "5.15em",
                      top: "3.3em",
                      width: "1.5em",
                      height: ".75em",
                      border: `.34em solid ${INK}`,
                      borderTop: "none",
                      borderRadius: "0 0 1em 1em",
                      boxSizing: "border-box",
                    }}
                  />
                </>
              )}
              {m.eyes === "x" && (
                <>
                  <XEye left={2.1} />
                  <XEye left={5.05} />
                </>
              )}
              {m.brows && (
                <>
                  <div
                    style={{
                      left: "2.05em",
                      top: "1.35em",
                      width: "1.9em",
                      height: ".36em",
                      borderRadius: ".2em",
                      background: INK,
                      transform: m.brows[0],
                    }}
                  />
                  <div
                    style={{
                      left: "5.05em",
                      top: "1.35em",
                      width: "1.9em",
                      height: ".36em",
                      borderRadius: ".2em",
                      background: INK,
                      transform: m.brows[1],
                    }}
                  />
                </>
              )}
              {m.mouth === "smile" && (
                <>
                  <div
                    style={{
                      left: "3.2em",
                      top: "4.55em",
                      width: "2.7em",
                      height: "1em",
                      border: `.34em solid ${INK}`,
                      borderTop: "none",
                      borderRadius: "0 0 1.4em 1em",
                      boxSizing: "border-box",
                      transform: "rotate(-6deg)",
                    }}
                  />
                  <div
                    style={{
                      left: "4.15em",
                      top: "5.38em",
                      width: ".62em",
                      height: ".62em",
                      borderRadius: "0 0 .18em .18em",
                      background: "#fff",
                      boxShadow: `0 0 0 .13em ${INK}`,
                      transform: "rotate(-6deg)",
                    }}
                  />
                </>
              )}
              {m.mouth === "grin" && (
                <div
                  style={{
                    left: "3.1em",
                    top: "4.45em",
                    width: "2.8em",
                    height: "1.35em",
                    borderRadius: ".3em .5em 1.4em 1.2em",
                    background: INK,
                    transform: "rotate(-5deg)",
                  }}
                >
                  <div
                    style={{ left: ".3em", top: 0, width: ".55em", height: ".45em", borderRadius: "0 0 .15em .15em", background: "#fff" }}
                  />
                  <div
                    style={{
                      left: "1.35em",
                      top: ".75em",
                      width: "1em",
                      height: "1.15em",
                      borderRadius: ".2em .2em .55em .55em",
                      background: "#FF7A8A",
                      boxShadow: `0 0 0 .13em ${INK}`,
                    }}
                  />
                </div>
              )}
              {m.mouth === "o" && (
                <div style={{ left: "4em", top: "4.75em", width: "1em", height: "1.2em", borderRadius: "50%", background: INK }} />
              )}
              {m.mouth === "flat" && (
                <div style={{ left: "3.8em", top: "5.05em", width: "1.4em", height: ".34em", borderRadius: ".2em", background: INK }} />
              )}
              {m.mouth === "frown" && (
                <div
                  style={{
                    left: "3.7em",
                    top: "4.95em",
                    width: "1.6em",
                    height: ".8em",
                    border: `.34em solid ${INK}`,
                    borderBottom: "none",
                    borderRadius: "1em 1em 0 0",
                    boxSizing: "border-box",
                  }}
                />
              )}
              {m.tear && (
                <div
                  style={{
                    left: "1.6em",
                    top: "4.55em",
                    width: ".7em",
                    height: ".7em",
                    borderRadius: "0 50% 50% 50%",
                    background: "#6FB6FF",
                    transform: "rotate(45deg)",
                  }}
                />
              )}
              {m.sweat && (
                <div
                  style={{
                    left: ".6em",
                    top: "1em",
                    width: ".85em",
                    height: ".85em",
                    borderRadius: "0 50% 50% 50%",
                    background: "#6FB6FF",
                    transform: "rotate(45deg)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
        {m.confetti && (
          <>
            <Bit cls={"spuz-twinkle"} st={{ left: "2.2em", top: ".6em", width: ".55em", height: ".55em", background: "#FFC93C" }} />
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "8.6em",
                top: ".9em",
                width: ".5em",
                height: ".5em",
                borderRadius: "50%",
                background: "#2FD3E0",
                animationDuration: "1.2s",
                animationDelay: ".2s",
              }}
            />
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "1.1em",
                top: "2.6em",
                width: ".45em",
                height: ".45em",
                borderRadius: "50%",
                background: "#FF5A5F",
                animationDuration: ".9s",
                animationDelay: ".4s",
              }}
            />
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "9.9em",
                top: "2.5em",
                width: ".55em",
                height: ".55em",
                background: "#8B7CFF",
                animationDuration: "1.1s",
                animationDelay: ".1s",
              }}
            />
            <Bit
              cls={"spuz-twinkle"}
              st={{ left: "6.9em", top: ".1em", width: ".4em", height: ".4em", background: "#F4F5FB", animationDelay: ".3s" }}
            />
          </>
        )}
        {m.sparkles && (
          <>
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "1em",
                top: "1.4em",
                width: "1em",
                height: "1em",
                clipPath: star,
                background: "#FFC93C",
                animationDuration: "1.4s",
              }}
            />
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "9.6em",
                top: ".8em",
                width: "1.3em",
                height: "1.3em",
                clipPath: star,
                background: "#FFC93C",
                animationDuration: "1.4s",
                animationDelay: ".5s",
              }}
            />
            <Bit
              cls={"spuz-twinkle"}
              st={{
                left: "10.2em",
                top: "4em",
                width: ".7em",
                height: ".7em",
                clipPath: star,
                background: "#F4F5FB",
                animationDuration: "1.4s",
                animationDelay: ".9s",
              }}
            />
          </>
        )}
        {m.zzz && (
          <>
            <div
              className={"spuz-rise"}
              style={{ left: "8.6em", top: "1.6em", font: "900 1.1em var(--font-display)", color: "#A2A6C2", animationDuration: "2.4s" }}
            >
              z
            </div>
            <div
              className={"spuz-rise"}
              style={{
                left: "9.6em",
                top: "1.2em",
                font: "900 1.5em var(--font-display)",
                color: "#A2A6C2",
                animationDuration: "2.4s",
                animationDelay: ".8s",
              }}
            >
              Z
            </div>
          </>
        )}
        {m.steam && (
          <>
            <Bit
              cls={"spuz-rise"}
              st={{
                left: "3.4em",
                top: "1.4em",
                width: "1em",
                height: "1em",
                borderRadius: "50%",
                background: "#C9CCDD",
                animationDuration: "1.1s",
              }}
            />
            <Bit
              cls={"spuz-rise"}
              st={{
                left: "5.6em",
                top: "1.2em",
                width: "1.3em",
                height: "1.3em",
                borderRadius: "50%",
                background: "#C9CCDD",
                animationDuration: "1.1s",
                animationDelay: ".35s",
              }}
            />
            <Bit
              cls={"spuz-rise"}
              st={{
                left: "4.5em",
                top: ".8em",
                width: ".8em",
                height: ".8em",
                borderRadius: "50%",
                background: "#C9CCDD",
                animationDuration: "1.1s",
                animationDelay: ".7s",
              }}
            />
          </>
        )}
        {m.bubble && (
          <>
            <div style={{ left: "9.2em", top: "2.6em", width: ".5em", height: ".5em", borderRadius: "50%", background: "#A2A6C2" }} />
            <div style={{ left: "9.8em", top: "1.5em", width: ".8em", height: ".8em", borderRadius: "50%", background: "#A2A6C2" }} />
            <div style={{ left: "10.5em", top: ".1em", width: "1.3em", height: "1.3em", borderRadius: "50%", background: "#A2A6C2" }} />
          </>
        )}
      </div>
    </div>
  );
}

function Eye({
  left,
  top,
  w,
  h,
  pupil,
  look,
  anim,
}: {
  left: number;
  top: number;
  w: number;
  h: number;
  pupil: number;
  look: string;
  anim?: string;
}) {
  return (
    <div
      className={anim}
      style={{
        left: `${left}em`,
        top: `${top}em`,
        width: `${w}em`,
        height: `${h}em`,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: `0 0 0 .16em ${INK}`,
        overflow: "hidden",
      }}
    >
      <div
        className={"spuz-pupil"}
        style={{
          left: "50%",
          top: "50%",
          width: `${pupil}em`,
          height: `${pupil}em`,
          margin: `${-pupil / 2}em`,
          borderRadius: "50%",
          background: INK,
          transform: look,
        }}
      >
        <div style={{ left: "18%", top: "16%", width: "32%", height: "32%", borderRadius: "50%", background: "#fff" }} />
      </div>
    </div>
  );
}

function XEye({ left }: { left: number }) {
  const bar: CSSProperties = { left: 0, top: ".73em", width: "1.8em", height: ".34em", borderRadius: ".2em", background: INK };
  return (
    <div style={{ left: `${left}em`, top: "2.4em", width: "1.8em", height: "1.8em" }}>
      <div style={{ ...bar, transform: "rotate(45deg)" }} />
      <div style={{ ...bar, transform: "rotate(-45deg)" }} />
    </div>
  );
}

function Bit({ cls, st }: { cls: string; st: CSSProperties }) {
  return <div className={cls} style={st} />;
}
