import { challengeCodeOf } from "@/lib/share/challenge-card";

/**
 * GET /c/:code: the short challenge link printed on cards and share texts. Redirects to /challenge/<code>, whose
 * title and image link previews read. Anything that is not a challenge code goes to the Grid.
 */
export async function GET(req: Request, ctx: RouteContext<"/c/[code]">): Promise<Response> {
  const code = challengeCodeOf((await ctx.params).code);
  return Response.redirect(new URL(code ? `/challenge/${code}` : "/", req.url), 308);
}
