# Mezon MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with Mezon channels, allowing them to send and read messages through Mezon's API. Using this server, LLMs like Claude can directly interact with Mezon channels while maintaining user control and security.

## Features

- Send messages to Mezon channels
- Read recent messages from channels
- Automatic clan and channel discovery
- Support for both channel names and IDs
- Proper error handling and validation

## Prerequisites

- Node.js 16.x or higher
- A Mezon bot token
- The bot must be invited to your clan with proper permissions:
  - Read Messages/View Channels
  - Send Messages
  - Read Message History

## Setup

1. Clone this repository:
```bash
git clone git@github.com:nccasia/mezon-mcp.git
cd mezon-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Mezon bot token:
```
MEZON_TOKEN=your_bot_token_here
```

4. Build the server:
```bash
npm run build
```

## Usage with Claude for Desktop

1. Open your Claude for Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the Mezon MCP server configuration:
```json
{
  "mcpServers": {
    "mezon": {
      "command": "node",
      "args": ["path/to/mezon-mcp/build/index.js"],
      "env": {
        "MEZON_TOKEN": "your_bot_token_here"
      }
    }
  }
}
```

3. Restart Claude for Desktop

## Available Tools

### send-message
Sends a message to a specified Mezon channel.

Parameters:
- `clan` (optional): Clan ID (required if bot is in multiple clans)
- `channel`: Channel name (e.g., "general") or ID
- `message`: Message content to send

Example:
```json
{
  "channel": "general",
  "message": "Hello from MCP!"
}
```

### read-messages
Reads recent messages from a specified Mezon channel.

Parameters:
- `clan` (optional): clan ID (required if bot is in multiple clans)
- `channel`: Channel name (e.g., "general") or ID
- `limit` (optional): Number of messages to fetch (default: 50, max: 100)

Example:
```json
{
  "channel": "general",
  "limit": 10
}
```

## Development

1. Install development dependencies:
```bash
npm install --save-dev typescript @types/node
```

2. Start the server in development mode:
```bash
npm run dev
```

## Testing

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Examples

Here are some example interactions you can try with Claude after setting up the Mezon MCP server:

1. "Can you read the last 5 messages from the general channel?"
2. "Please send a message to the announcements channel saying 'Meeting starts in 10 minutes'"
3. "What were the most recent messages in the development channel about the latest release?"

Claude will use the appropriate tools to interact with Mezon while asking for your approval before sending any messages.

## Security Considerations

- The bot requires proper Mezon permissions to function
- All message sending operations require explicit user approval
- Environment variables should be properly secured
- Token should never be committed to version control
- Channel access is limited to channels the bot has been given access to

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:
1. Check the GitHub Issues section
2. Consult the MCP documentation at https://modelcontextprotocol.io
3. Open a new issue with detailed reproduction steps