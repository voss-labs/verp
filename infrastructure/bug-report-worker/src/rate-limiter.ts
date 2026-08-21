export interface RateLimitResponse {
  ok: boolean;
  remaining: number;
  reset_in_seconds: number;
}

const DAY_MS = 86_400_000;

export class RateLimiter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "5", 10);

    const nowMs = Date.now();
    const dayIndex = Math.floor(nowMs / DAY_MS);

    const stored = await this.state.storage.get<{ day: number; count: number }>("bucket");
    const bucket = stored && stored.day === dayIndex ? stored : { day: dayIndex, count: 0 };

    const resetIn = Math.max(1, 86_400 - Math.floor((nowMs % DAY_MS) / 1000));

    if (bucket.count >= limit) {
      return new Response(
        JSON.stringify({ ok: false, remaining: 0, reset_in_seconds: resetIn }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    bucket.count += 1;
    await this.state.storage.put("bucket", bucket);

    return new Response(
      JSON.stringify({
        ok: true,
        remaining: limit - bucket.count,
        reset_in_seconds: resetIn,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
}
