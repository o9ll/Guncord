# Stream Blur Privacy

## Description

Stream Blur Privacy is a Discord plugin that automatically blurs all messages, images, links, and content in selected private conversations when you're streaming. This protects your privacy by hiding sensitive information from stream viewers.

## Features

- **Selective conversation blurring**: Choose which DM conversations to blur via the context menu (right-click)
- **Auto stream detection**: Automatically detects when you start/stop streaming to apply the blur
- **Persistent settings**: Your blur preferences are saved and restored after restart
- **Manual and automatic control**: Works automatically during streams and can also be controlled manually
- **Customizable blur intensity**: Adjust blur intensity from 1 to 30 pixels (default: 10px)
- **Low performance impact**: Uses CSS blur instead of DOM manipulation
- **Debug mode**: Optional console logging for troubleshooting

## Installation

1. Place this folder in your Vencord plugins directory: `src/userplugins/streamBlurPrivacy/`
2. Reload Discord or run the plugin injector
3. Enable the plugin in Vencord settings

## Usage

### Enable blur for a conversation

1. Open a DM or private group
2. Right-click on the conversation name
3. Select "Stream blur: OFF - [Conversation name]"
4. The conversation is now marked for blurring

### Start a stream

Once a conversation is marked for blurring:
1. Start a stream on Discord (screen share)
2. All messages, images, links, and content in that conversation will be automatically blurred
3. Blur stays active until you stop streaming or disable the plugin

### Disable blur for a conversation

1. Right-click the conversation again
2. Select "Stream blur: ON - [Conversation name]" to disable blur
3. All content becomes immediately visible

## Settings

### Blur intensity
- **Type**: Numeric slider (1-30 pixels)
- **Default**: 10 pixels
- **Description**: Controls the strength of the blur effect. Higher values = stronger blur

### Auto blur on stream
- **Type**: Boolean toggle
- **Default**: Enabled
- **Description**: If enabled, blur applies automatically during streaming if the conversation is marked

### Show notifications
- **Type**: Boolean toggle
- **Default**: Enabled
- **Description**: Shows notification messages when toggling blur on/off

### Debug mode
- **Type**: Boolean toggle
- **Default**: Disabled
- **Description**: Enables detailed console logging for debugging stream detection and state changes

## Technical details

### How it works

1. **Stream detection**: Monitors Discord stream status via multiple methods:
   - StreamStore API (primary method)
   - RTC connection state (secondary method)
   - Periodic safety check every 2 seconds

2. **CSS injection**: When streaming and a conversation is marked for blurring:
   - Injects a dynamic `<style>` element with CSS blur rules
   - Targets message containers by unique ID
   - Applies `filter: blur(Xpx)` to all text, images, links, and embeds

3. **State management**:
   - Stores blurred channel IDs in Vencord's DataStore
   - Loads persisted settings on plugin startup
   - Saves changes immediately when toggling blur

4. **Flux event monitoring**:
   - `STREAM_CREATE`/`STREAM_START`: Detects stream start
   - `STREAM_STOP`/`STREAM_DELETE`: Detects stream end
   - `CHANNEL_SELECT`: Detects conversation changes
   - Safety interval (2s): Fallback stream detection

### CSS selector strategy

The plugin targets only messages in the chat message list using:
```css
ol[data-list-id="chat-messages"] div[id*="message-content"],
ol[data-list-id="chat-messages"] div[id*="message-accessories"],
ol[data-list-id="chat-messages"] div[role="article"]
```

This ensures:
- Only specified conversations are affected
- All message content types are blurred
- No impact on other conversations or the Discord UI

## Troubleshooting

### Blur not applying during stream

1. **Check that the conversation is marked**: The right-click menu should show "Stream blur: ON"
2. **Enable debug mode**:
   - Go to plugin settings
   - Enable "Debug mode"
   - Open DevTools (Ctrl+Shift+I)
   - Check for `[StreamBlurPrivacy]` logs in the console
3. **Check stream detection**:
   - The console should show "Stream detected" when you're streaming
   - If not detected, stream detection may be failing
4. **Restart the plugin**: Disable and re-enable the plugin

### Settings not persisting after restart

1. Make sure "Stream Blur Privacy" is enabled in Vencord plugins
2. Make sure browser storage isn't being cleared on close
3. Try toggling blur on a conversation again (should re-save)

### Performance issues

1. Reduce blur intensity
2. Blur fewer conversations
3. Check that no other plugin conflicts with message rendering

## Console log examples

### Debug mode enabled

```
[StreamBlurPrivacy 14:23:45] Loaded 3 blurred conversations from storage
[StreamBlurPrivacy 14:23:47] Channel changed: null -> 123456789
[StreamBlurPrivacy 14:23:50] Stream detected via getActiveStreamForUser
[StreamBlurPrivacy 14:23:50] Blur CSS injected for channel 123456789 with intensity 10px
[StreamBlurPrivacy 14:25:15] STREAM_STOP event
[StreamBlurPrivacy 14:25:15] Removing blur for channel 123456789
```

## Limitations

- Only affects DM and Group DM conversations (not servers)
- Blur effect is visual only (doesn't block screen reader access)
- Performance depends on Discord's message rendering performance
- Does not blur avatars or usernames (only message content)

## Privacy note

This plugin provides visual privacy during streams but should not be your only privacy measure. Consider:
- Using Discord's native stream quality settings
- Monitoring what's visible on your screen
- Being aware of what shows in your taskbar/notifications
- Using a physical privacy filter if needed

## FAQ

### Does it work on servers?

No, currently only supported for DM and Group DM channels. Server support may be added in future versions.

### Will my own messages be blurred?

Yes, if you're in a blurred conversation while streaming, your own messages will also be blurred. This is intentional for complete privacy.

### Can I blur multiple conversations?

Yes, you can right-click and enable blur on as many conversations as you want. Each is saved independently.

### What formats are blurred?

- Text messages
- Images and image embeds
- Links and link embeds
- Video content
- Rich embeds (YouTube, etc.)

---

**Last updated**: April 2026 - CSS selector optimization and English translation

### Is the blur saved after I close Discord?

Yes, the list of blurred conversations is saved to Vencord's DataStore and automatically loaded when Discord starts.

### Can I blur without streaming?

Currently, blur only applies during active streams. You can request manual blur mode in plugin settings if needed.

### How intensive is this on my CPU?

CSS-based blur is very efficient. The performance impact is minimal, even with multiple conversations blurred.
