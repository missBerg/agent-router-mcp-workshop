import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Attendee-editable files.
export const WORKSPACE = path.join(ROOT, "workspace");
export const ROUTE_FILE = path.join(WORKSPACE, "mcproute.yaml");
export const TELEMETRY_FILE = path.join(WORKSPACE, "telemetry.env");
export const CURRENT_LAB_FILE = path.join(WORKSPACE, ".current-lab");

// Lab material.
export const LABS = path.join(ROOT, "labs");
export const BASE = path.join(LABS, "base");
export const KEYS = path.join(LABS, "keys");
export const LAB_DIRS: Record<number, string> = { 1: "01-aggregate", 2: "02-authorize", 3: "03-observe" };

// Runtime state (gitignored).
export const STATE = path.join(ROOT, ".lab");
export const BIN = path.join(STATE, "bin");
export const CONFIG_OUT = path.join(STATE, "config.yaml");
export const ACCESS_LOG = path.join(STATE, "access.log");
export const ROUTER_LOG = path.join(STATE, "router.log");
export const ROUTER_STATE = path.join(STATE, "router.json");
export const SERVERS_LOG = path.join(STATE, "servers.log");
export const AIGW_STATE_HOME = path.join(STATE, "aigw");
export const BACKUPS = path.join(STATE, "backups");
export const ENV_FILE = path.join(ROOT, ".env");

export const PORTS = { router: 1975, admin: 1064, otlp: 4318, firstServer: 3001 };
export const ROUTER_URL = `http://localhost:${PORTS.router}`;
export const MCP_URL = `${ROUTER_URL}/mcp`;

export const SERVERS = ["issues", "ci", "deploy", "docs", "chat"] as const;
export const serverUrl = (i: number) => `http://localhost:${PORTS.firstServer + i}/mcp`;
export const serverBase = (i: number) => `http://localhost:${PORTS.firstServer + i}`;

export const rel = (p: string) => path.relative(process.cwd(), p) || ".";
