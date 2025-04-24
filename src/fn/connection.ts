import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const client = new Client({
  name: "mezon-bot",
  version: "1.0.0",
  capabilities: {
    tools: ["send-message", "read-messages", "ask-gemini"],
  },
});

export const connectClient = async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./build/index.js"],
  });

  await client.connect(transport);
  console.log("✅ Successfully connected to MCP server");

  return transport;
};
