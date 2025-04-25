import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const client = new Client({
  name: "mezon-bot",
  version: "1.0.0",
  capabilities: {
    tools: ["send-message", "read-messages", "ask-gemini"],
  },
});

let currentTransport: StdioClientTransport | null = null;
let isConnecting = false;

export const connectClient = async () => {
  if (currentTransport) {
    return currentTransport;
  }

  if (isConnecting) {
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return currentTransport;
  }

  try {
    isConnecting = true;
    const transport = new StdioClientTransport({
      command: "node",
      args: ["./build/index.js"],
    });

    await client.connect(transport);
    console.log("✅ Successfully connected to MCP server");
    currentTransport = transport;
    return transport;
  } catch (error) {
    console.error("Failed to connect to MCP server:", error);
    throw error;
  } finally {
    isConnecting = false;
  }
};

export const disconnectClient = async () => {
  if (currentTransport) {
    await currentTransport.close();
    currentTransport = null;
  }
};
