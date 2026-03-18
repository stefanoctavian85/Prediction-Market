import { Elysia } from "elysia";

const clients = new Set<(data: string) => void>(); 

export const serverSentEventsPlugin = new Elysia()
    .get("/sse", ({ request }) => {
        let send: (data: string) => void;

        const stream = new ReadableStream({
            start(controller) {
                send = (data: string) => {
                    try {
                        controller.enqueue(`data: ${data}\n\n`);
                    } catch {
                        clients.delete(send);
                    }
                };

                clients.add(send);

                request.signal.addEventListener("abort", () => {
                    clients.delete(send);
                    controller.close();
                });
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    });

export function broadcast(data: object) {
    const message = JSON.stringify(data);
    clients.forEach((send) => send(message));
}