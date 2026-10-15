import type { CanvasResult } from "../../shared/canvas/contracts";
import type { CanvasAccess, CanvasService } from "./canvas-service";
import type { IncomingMessage, ServerResponse } from "node:http";

const statuses = {
    INVALID_ARGUMENT: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    REVISION_CONFLICT: 409,
    REQUEST_ID_REUSED: 409,
    UNAVAILABLE: 503,
} as const;
function send(response: ServerResponse, result: CanvasResult): void {

    response.writeHead(result.ok ? 200 : statuses[result.error.code], {
        "content-type": "application/json",
        "cache-control": "no-store",
    }).end(JSON.stringify(result));
}
export async function serveCanvasHttp(request: IncomingMessage, response: ServerResponse, service: CanvasService, access: CanvasAccess, authorized: () => boolean): Promise<void> {

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/v1/events" && request.method === "GET") {
        response.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-store",
            connection: "keep-alive",
        });
        let sequence = 0;
        const write = (event: ReturnType<CanvasService["reset"]>) => {

            if (!authorized() || response.writableLength > 262144) {
                response.destroy();

                return;
            }
            if (!event.canvasId || access.canvasIds === "all" || access.canvasIds.includes(event.canvasId)) {
                response.write(`data: ${JSON.stringify({
                    ...event,
                    sequence: ++sequence,
                })}\n\n`);
            }
        };
        const unsubscribe = service.subscribe(write);
        response.on("close", unsubscribe);
        write(service.reset());

        return;
    }
    try {
        let input: Record<string, unknown> = {};
        if (request.method === "POST") {
            if (request.headers["content-type"] !== "application/json") {
                throw new Error("Invalid content type");
            }
            let body = "";
            request.setEncoding("utf8");
            for await (const chunk of request) {
                body += String(chunk);
                if (Buffer.byteLength(body) > 300000) {
                    response.writeHead(413).end();

                    return;
                }
            }
            const parsed: unknown = JSON.parse(body);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("Invalid request");
            }
            input = parsed as Record<string, unknown>;
        }
        if (!authorized()) {
            send(response, {
                ok: false,
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Authentication required.",
                },
            });

            return;
        }
        const parts = url.pathname.split("/").slice(2)
            .map(decodeURIComponent);
        let command: unknown;
        if (parts[0] === "canvases" && parts.length === 1) {
            if (request.method === "GET") {
                command = {
                    type: "list",
                    ...(url.searchParams.has("query") ? { query: url.searchParams.get("query") } : {}),
                    ...(url.searchParams.has("cursor") ? { cursor: url.searchParams.get("cursor") } : {}),
                    ...(url.searchParams.has("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
                };
            } else if (request.method === "POST") {
                command = {
                    ...input,
                    type: "create",
                };
            }
        } else if (parts[0] === "canvases" && parts.length === 2 && request.method === "GET") {
            command = {
                type: "read",
                canvasId: parts[1],
            };
        } else if (parts[0] === "canvases" && parts.length === 3 && request.method === "POST" && parts[2] === "rename") {
            command = {
                ...input,
                type: "rename",
                canvasId: parts[1],
            };
        } else if (parts[0] === "requests" && parts.length === 2 && request.method === "GET") {
            command = {
                type: "receipt",
                requestId: parts[1],
            };
        }
        if (!command) {
            send(response, {
                ok: false,
                error: {
                    code: "NOT_FOUND",
                    message: "Endpoint is unavailable.",
                },
            });

            return;
        }
        send(response, await service.execute(access, command));
    } catch {
        send(response, {
            ok: false,
            error: {
                code: "INVALID_ARGUMENT",
                message: "Invalid canvas request.",
            },
        });
    }
}
