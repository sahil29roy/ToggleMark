@echo off
echo Installing ToggleMark Extension...
echo.
echo To install this extension in Firefox:
echo.
echo 1. Open Firefox
echo 2. Navigate to about:debugging
echo 3. Click "This Firefox" on the left sidebar  
echo 4. Click "Load Temporary Add-on..."
echo 5. Navigate to this folder (%~dp0)
echo 6. Select the manifest.json file
echo.
echo The extension provides these features:
echo - Keyboard shortcut: Alt+Shift+B to toggle bookmarks
echo - Dedicated "⚡ Quick Saves" folder for toggled bookmarks
echo - Auto-expiring bookmarks (7-day cleanup)
echo.
pause