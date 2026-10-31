"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useBuy, useEquip, useShop, type ShopItem } from "@/lib/client/social";
import { HttpError, useMe } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { ErrorState, PageTitle, PillTabs } from "@/components/meta/ui";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BOARD_THEMES } from "@/lib/gamification/cosmetics";
import { Skeleton } from "@/components/ui/Skeleton";
import { SHOP_TABS, purchaseState, tabOf, type ShopTab } from "@/lib/meta";
import { formatNumber } from "@/lib/format";
import { play } from "@/lib/audio";

const THEMES = BOARD_THEMES;

function itemIcon(i: ShopItem): { icon: string; color: string } {
  if (i.type === "hat")
    return {
      icon: i.payload.hat === "crown" ? "crown-simple" : i.payload.hat === "kente" ? "baseball-cap" : "confetti",
      color: i.payload.hat === "kente" ? "#FF8A3D" : "#FFC93C",
    };
  if (i.type === "skin") return { icon: i.payload.effect === "prism" ? "sparkle" : "drop", color: String(i.payload.color ?? "#B8F23A") };
  if (i.type === "board_theme") return { icon: "grid-four", color: THEMES[String(i.payload.theme)]?.mark ?? "#B8F23A" };
  if (i.type === "title") return { icon: "text-aa", color: "var(--text)" };
  if (i.type === "freeze") return { icon: "snowflake", color: "var(--freeze)" };
  return { icon: "lightbulb", color: "var(--gold)" };
}

/** S5 Shop: try-on on Spuz before buying, Sparks only, inventory and equip, "not enough Sparks". */
export default function ShopPage() {
  const q = useShop();
  const me = useMe();
  const buy = useBuy();
  const equip = useEquip();
  const [tab, setTab] = useState<ShopTab>("hat");
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ color?: string; hat?: string | null; theme?: string; title?: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const request = useRef<{ item: string; id: string } | null>(null);
  const d = q.data;
  const items = useMemo(() => (d?.items ?? []).filter((i) => tabOf(i.type) === tab), [d, tab]);
  const freeze = d?.items.find((i) => i.type === "freeze");
  const item = d?.items.find((i) => i.id === sel) ?? null;

  const wearing = d?.wearing;
  const color = preview?.color ?? wearing?.color ?? me.data?.avatar_color ?? "#B8F23A";
  const hat = preview && "hat" in preview ? preview.hat : (wearing?.hat ?? null);

  const pick = (i: ShopItem) => {
    setSel(i.id);
    setNote(null);
    buy.reset();
    if (i.type === "skin") setPreview({ color: String(i.payload.color) });
    else if (i.type === "hat") setPreview({ hat: String(i.payload.hat) });
    else if (i.type === "board_theme") setPreview({ theme: String(i.payload.theme) });
    else if (i.type === "title") setPreview({ title: i.name });
    else setPreview(null);
  };

  const state =
    item && d
      ? purchaseState(
          {
            price: item.price,
            owned: item.owned,
            unlockLevel: item.unlockLevel,
            consumable: item.type === "freeze" || item.type === "hint_pack",
          },
          d.sparks,
          d.level,
          d.freezesHeld,
          item.type === "freeze",
        )
      : null;

  const doBuy = async () => {
    if (!item) return;
    // One request id per item until it succeeds, so a retry after a dropped response is never charged twice.
    if (request.current?.item !== item.id) request.current = { item: item.id, id: crypto.randomUUID() };
    try {
      await buy.mutateAsync({ itemId: item.id, requestId: request.current.id });
      request.current = null;
      play("jingle");
      setNote(
        item.type === "freeze"
          ? "Freeze ready. It covers one missed day."
          : item.type === "hint_pack"
            ? "Hints added for practice."
            : `${item.name} is yours.`,
      );
    } catch (e) {
      setNote(e instanceof HttpError && e.message !== e.code ? e.message : "Purchase failed. Your Sparks were not taken.");
    }
  };
  const doEquip = async (on: boolean) => {
    if (!item) return;
    await equip.mutateAsync({ itemId: item.id, equip: on });
    play(on ? "pop" : "tick");
    setPreview(null);
  };

  return (
    <TabPage label="Shop">
      <PageTitle
        right={
          <span
            data-wallet
            className="bg-surface-raised flex h-10 items-center gap-1.5 rounded-[14px] px-3"
            aria-label={`${formatNumber(d?.sparks ?? me.data?.sparks ?? 0)} Sparks`}
          >
            <Icon name="lightning" size={18} className="text-gold" />
            <span className="num text-gold text-[17px] font-semibold">{formatNumber(d?.sparks ?? me.data?.sparks ?? 0)}</span>
          </span>
        }
      >
        Shop
      </PageTitle>

      <section
        aria-label="Try-on"
        className="bg-surface relative flex h-[230px] items-center justify-center overflow-hidden rounded-[28px]"
      >
        <div aria-hidden className="dotgrid on-surface absolute inset-0" />
        {preview?.theme ? (
          <div
            className="relative grid grid-cols-4 gap-1.5 rounded-[18px] p-2"
            style={{ background: THEMES[preview.theme]?.bg }}
            role="img"
            aria-label={`${item?.name} preview`}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="flex size-9 items-center justify-center rounded-[8px]"
                style={{ background: THEMES[preview.theme!]?.cell }}
              >
                {[1, 6, 11, 12].includes(i) && <Icon name="crown-simple" size={18} style={{ color: THEMES[preview.theme!]?.mark }} />}
              </span>
            ))}
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            <SpuzWear
              size={preview?.title ? 160 : 190}
              color={color}
              hat={hat}
              mood={preview ? "party" : "idle"}
              label={`Spuz${hat ? " wearing a hat" : ""}`}
            />
            {(preview?.title ?? wearing?.title) && (
              <span className="font-display bg-bg -mt-2 rounded-[10px] px-2.5 py-1 text-[13px] font-extrabold">
                {preview?.title ?? wearing?.title}
              </span>
            )}
          </div>
        )}
        {preview && (
          <>
            <span className="bg-bg absolute top-3.5 left-3.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-semibold">Trying on</span>
            <button
              onClick={() => {
                setPreview(null);
                setSel(null);
              }}
              className="press bg-bg absolute top-2.5 right-2.5 flex h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold"
            >
              <Icon name="arrow-counter-clockwise" size={14} />
              Reset
            </button>
          </>
        )}
      </section>

      <PillTabs label="Shop sections" items={SHOP_TABS} value={tab} onChange={setTab} />

      {q.isPending ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-[18px]" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <div role="listbox" aria-label="Items" className="grid grid-cols-3 gap-2">
          {items.map((i) => {
            const on = sel === i.id;
            const ic = itemIcon(i);
            const locked = i.unlockLevel !== null && d!.level < i.unlockLevel;
            const consumable = i.type === "freeze" || i.type === "hint_pack";
            const price = i.equipped
              ? { icon: "check-circle", text: "Wearing", color: "var(--accent)" }
              : i.owned && !consumable
                ? { icon: "check", text: "Owned", color: "var(--accent)" }
                : locked
                  ? { icon: "lock-simple", text: `Level ${i.unlockLevel}`, color: "var(--text-muted)" }
                  : i.price === 0
                    ? { icon: "gift", text: "Free", color: "var(--accent)" }
                    : { icon: "lightning", text: formatNumber(i.price), color: "var(--gold)" };
            return (
              <button
                key={i.id}
                role="option"
                aria-selected={on}
                onClick={() => pick(i)}
                aria-label={`${i.name}, ${price.text}${i.type === "freeze" ? `, you hold ${d!.freezesHeld} of 2` : ""}`}
                className="press flex flex-col items-center gap-1.5 rounded-[18px] p-2.5"
                style={{
                  background: on ? "var(--success-tint)" : "var(--surface)",
                  boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined,
                }}
              >
                <span className="bg-surface-raised flex size-14 items-center justify-center rounded-[16px]" style={{ color: ic.color }}>
                  <Icon name={ic.icon} size={28} />
                </span>
                <span className="text-center text-[13px] leading-tight font-semibold">{i.name}</span>
                <span className="num flex items-center gap-1 text-[13px] font-semibold" style={{ color: price.color }}>
                  <Icon name={price.icon} size={13} />
                  {price.text}
                </span>
              </button>
            );
          })}
          {items.length === 0 && <p className="text-muted col-span-3 py-6 text-center text-[15px]">Sold out. Back Monday.</p>}
        </div>
      )}

      <div aria-hidden className="h-[132px] lg:hidden" />
      <div className="fixed inset-x-4 bottom-[92px] z-20 mx-auto flex max-w-[528px] flex-col gap-2 lg:sticky lg:inset-x-auto lg:bottom-4 lg:w-full lg:max-w-none">
        {freeze && tab !== "extra" && (
          <button
            onClick={() => {
              setTab("extra");
              pick(freeze);
            }}
            className="bg-surface flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5"
            aria-label={`Streak Freeze, you hold ${d!.freezesHeld} of 2, ${freeze.price} Sparks`}
          >
            <Icon name="snowflake" size={22} className="text-freeze" />
            <span className="flex-1 text-left text-[15px] font-semibold">Streak Freeze</span>
            <span className="text-muted text-[13px] font-medium">own {d!.freezesHeld} · max 2</span>
            <span className="num text-gold text-[14px] font-semibold">{freeze.price}</span>
          </button>
        )}
        {note && (
          <p role="status" className="bg-surface rounded-[12px] px-3 py-2 text-center text-[14px] font-medium">
            {note}
          </p>
        )}
        {item && state ? (
          state.kind === "owned" && item.type !== "freeze" && item.type !== "hint_pack" ? (
            <Button
              size="lg"
              variant={item.equipped ? "secondary" : "primary"}
              className="w-full"
              loading={equip.isPending}
              onClick={() => doEquip(!item.equipped)}
            >
              {item.equipped ? `Take off ${item.name}` : `Wear ${item.name}`}
            </Button>
          ) : state.kind === "locked" ? (
            <Button size="lg" variant="secondary" className="w-full" disabled icon="lock-simple">
              Unlocks at level {item.unlockLevel}
            </Button>
          ) : state.kind === "full" ? (
            <Button size="lg" variant="secondary" className="w-full" disabled icon="snowflake">
              You hold 2 Freezes, the most you can
            </Button>
          ) : state.kind === "short" ? (
            <div className="flex flex-col gap-1.5">
              <Button size="lg" variant="secondary" className="w-full" disabled icon="lightning">
                Need {formatNumber(state.short!)} more Sparks
              </Button>
              <Link href="/quests" className="text-accent text-center text-[14px] font-semibold">
                Earn Sparks with quests
              </Link>
            </div>
          ) : (
            <Button size="lg" className="w-full" loading={buy.isPending} error={buy.isError} onClick={doBuy}>
              {state.kind === "free" ? `Get ${item.name}` : `Buy ${item.name}`}
              {state.kind === "buy" && (
                <span className="num ml-1 inline-flex items-center gap-1">
                  <Icon name="lightning" size={16} />
                  {formatNumber(item.price)}
                </span>
              )}
            </Button>
          )
        ) : (
          <p className="text-muted bg-surface rounded-[14px] px-3 py-3 text-center text-[14px]">Tap an item to try it on.</p>
        )}
      </div>
    </TabPage>
  );
}
