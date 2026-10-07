import { createFileRoute } from "@tanstack/react-router";
import { connectTikTokLive } from "@/lib/live/tiktok.server";
import type { LiveEvent } from "@/lib/live/types";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const uniqueId = url.searchParams.get("uniqueId") ?? "";
        const diagnostic = url.searchParams.get("diagnostic") === "1";
        if (diagnostic) {
          console.log(`[TikTok LIVE][diagnostic] Request received for @${uniqueId.replace(/^@/, "").trim()}`);
        }
        if (!uniqueId.replace(/^@/, "").trim()) {
          return Response.json({ error: "Informe o @ da live." }, { status: 400 });
        }

        const encoder = new TextEncoder();
        let disconnect = () => {};
        let closed = false;

        const stream = new ReadableStream({
          start(controller) {
            const send = (event: LiveEvent) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                closed = true;
              }
            };

            const ping = setInterval(() => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`:ping\n\n`));
              } catch {
                closed = true;
              }
            }, 12000);

            const handle = connectTikTokLive(
              uniqueId,
              send,
              (message) => {
                send({ type: "status", connected: false, message });
                if (diagnostic) {
                  console.log(`[TikTok LIVE][diagnostic] Fatal: ${message}`);
                }
                clearInterval(ping);
                if (!closed) {
                  closed = true;
                  try {
                    controller.close();
                  } catch {
                    /* ignore */
                  }
                }
              },
              { diagnostic },
            );
            disconnect = () => {
              clearInterval(ping);
              handle.disconnect();
            };

            request.signal.addEventListener("abort", () => {
              disconnect();
              if (!closed) {
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* ignore */
                }
              }
            });
          },
          cancel() {
            disconnect();
            closed = true;
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
