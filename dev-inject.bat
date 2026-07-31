@echo off
title Guncord — Dev Rebuild + Inject
cd /d "%~dp0"

echo.
echo  [1/4] Closing Discord...
taskkill /F /IM Discord.exe /T >nul 2>&1
taskkill /F /IM DiscordPTB.exe /T >nul 2>&1
taskkill /F /IM DiscordCanary.exe /T >nul 2>&1
taskkill /F /IM Update.exe /T >nul 2>&1
ping 127.0.0.1 -n 4 >nul
:waitloop
tasklist /FI "IMAGENAME eq Discord.exe" 2>nul | find /i "Discord.exe" >nul
if not errorlevel 1 (
    ping 127.0.0.1 -n 2 >nul
    goto :waitloop
)
echo        Discord closed.

echo.
echo  [2/4] Building...
call pnpm build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] pnpm build failed. Stopping.
    pause
    exit /b 1
)
echo        Build finished.

echo.
echo  [3/4] Injecting...
call pnpm inject
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] pnpm inject failed. Stopping.
    pause
    exit /b 1
)
echo        Injection finished.

echo.
echo  [4/4] Restarting Discord...
set "DISCORD_PATH=%LOCALAPPDATA%\Discord"
if exist "%DISCORD_PATH%\Update.exe" (
    start "" "%DISCORD_PATH%\Update.exe" --processStart Discord.exe
    echo        Discord restarted via Update.exe.
) else (
    for /f "delims=" %%i in ('dir /b /ad /o-n "%DISCORD_PATH%\app-*" 2^>nul') do (
        set "LATEST_APP=%%i"
        goto :found
    )
    :found
    if defined LATEST_APP (
        start "" "%DISCORD_PATH%\%LATEST_APP%\Discord.exe"
        echo        Discord restarted via direct app.
    ) else (
        echo  [WARN] Discord not found in %DISCORD_PATH%, manual restart required.
    )
)

echo.
echo  ================================================
echo   Guncord updated and injected successfully!
echo  ================================================
echo.
timeout /t 3 /nobreak >nul

