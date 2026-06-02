export default {
  fetch(_req: Request): Response {
    return new Response("vpn-proxy ok", { status: 200 });
  },
};
