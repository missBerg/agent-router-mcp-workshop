// Starts the five Lakeshore Labs MCP servers: `node servers/index.ts`
//   SERVERS_BASE_PORT  first port (default 3001); the servers use base+0 .. base+4
//   SERVERS_HOST       interface to bind (default 0.0.0.0)

import { startServers } from "./http.ts";

const basePort = Number(process.env.SERVERS_BASE_PORT ?? 3001);
const host = process.env.SERVERS_HOST ?? "0.0.0.0";

try {
  const { servers, close } = await startServers({ basePort, host, log: (line) => console.log(line) });
  for (const s of servers) console.log(`[${s.name}] lakeshore-${s.name} ${s.url} · ${s.tools} tools`);
  console.log(`${servers.reduce((sum, s) => sum + s.tools, 0)} tools across ${servers.length} servers`);

  const stop = () => void close().then(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (err) {
  const e = err as NodeJS.ErrnoException & { port?: number };
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${e.port} is already in use - are the servers already running? Stop them, or set SERVERS_BASE_PORT.`);
  } else {
    console.error(err);
  }
  process.exit(1);
}
