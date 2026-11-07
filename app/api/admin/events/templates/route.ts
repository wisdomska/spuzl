import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { EVENT_TEMPLATE_IDS, EVENT_TEMPLATES, templateWindow } from "@/lib/events/templates";
import { EVENT_COLS } from "@/lib/events/server";

/** GET /api/admin/events/templates: the ready-made events (R2-P5) with the dates a new draft would get. */
export const GET = handle(async () => {
  await requireAdmin("events.read");
  return ok({ rows: EVENT_TEMPLATE_IDS.map((id) => ({ ...EVENT_TEMPLATES[id], ...templateWindow(id) })) });
});

const Body = z.object({ template: z.enum(EVENT_TEMPLATE_IDS) }).strict();

/**
 * POST /api/admin/events/templates { template }: adds a ready-made event as a draft (inactive), with its next
 * edition's dates, name, accent, banner, bonus quest and quiz set. It never runs until the admin schedules it
 * (POST /api/admin/events/:id/schedule). Audited as event.template.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("events.write");
  const { template } = await body(req, Body);
  const t = EVENT_TEMPLATES[template];
  const w = templateWindow(template);
  const { data, error } = await ctx.db
    .from("events")
    .insert({
      name: t.name,
      starts_at: w.startsAt,
      ends_at: w.endsAt,
      accent: t.accent,
      banner: t.banner,
      quest: t.quest,
      quiz: t.quiz,
      template,
      draft: true,
      created_by: ctx.user.id,
    })
    .select(EVENT_COLS)
    .single();
  if (error) throw error;
  await audit(ctx, "event.template", `event:${data.id}`, { template, after: data });
  return ok(data);
});
