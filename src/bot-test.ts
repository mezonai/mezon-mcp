import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({
    name: "test-client",
    version: "1.0.0",
    capabilities: {
        tools: [ "send-message", "read-messages"]
    }
});

async function main() {
    let transport;
    try {
        transport = new StdioClientTransport({
            command: "node",
            args: ["./build/index.js"],
        });

        await client.connect(transport);
        const listTools = await client.listTools();
  
        const sendMessageResult = await client.callTool({
          name: "send-message",
          arguments: {
            server: "hello888",
            channel: "1840681202449649664",
            message: "Hello from MCP client!",
          },
        });
        console.log("Send message result:\n", sendMessageResult);

        const readMessagesResult = await client.callTool({
          name: "read-messages",
          arguments: {
            server: "hello888",
            channel: "1840681202449649664",
            limit: 5,
          },
        });
        console.log("Read messages result:\n", readMessagesResult);

    } catch (err) {
        if (transport) {
            await transport.close();
        }
        process.exit(1);
    } finally {
        if (transport) {
            await transport.close();
        }
    }
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
