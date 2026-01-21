# ToggleMark Extension

A Firefox extension that provides enhanced bookmark toggling functionality with keyboard shortcuts, dedicated folder organization, and automatic cleanup.

## Features

### 1. Instant Bookmark Toggle
- Use the keyboard shortcut **Alt+Shift+B** (Windows/Linux) or **Cmd+Shift+B** (Mac) to instantly toggle bookmarks
- No dialog box interruption - just one quick keystroke

### 2. Smart Filing System
- All toggled bookmarks are automatically saved to a dedicated "⚡ Quick Saves" folder
- Organized placement in either Bookmarks Toolbar or Other Bookmarks
- Keeps temporary "working" bookmarks separate from your permanent collection

### 3. Auto-Expiring Bookmarks
- Bookmarks automatically expire after 7 days if not revisited
- Daily cleanup prevents bookmark hoarding
- Maintains a clean, organized bookmark collection

## Installation Instructions

### Method 1: Temporary Installation (Development)
1. Open Firefox
2. Navigate to `about:debugging`
3. Click "This Firefox" on the left sidebar
4. Click "Load Temporary Add-on..."
5. Navigate to the `ToggleMark` folder
6. Select the `manifest.json` file
7. The extension will be loaded temporarily

### Method 2: Packaged Installation
1. In Firefox, navigate to `about:addons`
2. Click the gear icon and select "Install Add-on From File..."
3. Navigate to your packaged extension (.xpi file)

## How to Use

### Browser Action
- Click the star icon in the toolbar to toggle bookmarks for the current page
- Icon will change to indicate bookmarked/unbookmarked state
- Tooltip will show "Add Bookmark" or "Remove Bookmark"

### Keyboard Shortcut
- Press **Alt+Shift+B** (Windows/Linux) or **Cmd+Shift+B** (Mac) to toggle the current page
- Works on any webpage to instantly add/remove bookmarks

### Bookmarks Organization
- All toggled bookmarks appear in the "⚡ Quick Saves" folder
- Access via Bookmarks Library (Ctrl+Shift+O) or Bookmarks Menu

### Cleanup Process
- Bookmarks older than 7 days are automatically removed daily
- No action required - the system manages itself

## Technical Details

This extension uses:
- Firefox WebExtension APIs
- Bookmarks API for managing bookmarks
- Storage API for configuration and metadata
- Alarms API for scheduled cleanup
- Commands API for keyboard shortcuts