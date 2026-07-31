# Token Display Plugin

This plugin adds a `/mytoken` slash command that displays the Discord account token for the current session.

## Features

- **Slash command `/mytoken`**: Displays the connected account token
- **Private response**: The token is only shown to you (ephemeral)
- **Configurable settings**:
  - Enable/disable the command
  - Allow usage in private messages (DMs)

## Installation

1. Place the `@token` folder in your Vencord plugins directory
2. Restart Vencord or reload plugins
3. Enable the plugin in settings

## Usage

1. Type `/mytoken` in any Discord channel
2. Your account token will be displayed in a private response
3. ⚠️ **Important**: Never share your token with anyone!

## Settings

- **Enable /mytoken command**: Turns the command on or off
- **Allow usage in DMs**: Permits the command in private messages

## Security

- The token is only shown to you (ephemeral response)
- A security warning is included in the response
- The command can be disabled at any time

## Troubleshooting

If the command doesn't work:
1. Check that the plugin is enabled
2. Make sure you're logged into Discord
3. Check the plugin settings
4. Restart Vencord if needed

## Warning

This plugin displays sensitive information (authentication token). Use with caution and never share your token with anyone.
