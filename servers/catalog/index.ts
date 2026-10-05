// The five Lakeshore Labs MCP servers, in port order (base port + index).
import type { ToolDef } from "../tool.ts";
import { chat } from "./chat.ts";
import { ci } from "./ci.ts";
import { deploy } from "./deploy.ts";
import { docs } from "./docs.ts";
import { issues } from "./issues.ts";

export interface ServerSpec { name: string; tools: ToolDef[] }

export const SERVERS: ServerSpec[] = [
  { name: "issues", tools: issues },
  { name: "ci", tools: ci },
  { name: "deploy", tools: deploy },
  { name: "docs", tools: docs },
  { name: "chat", tools: chat },
];
