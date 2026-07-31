@echo off
title Guncord Installer - Build
cd /d "%~dp0"

echo.
echo  ====================================
echo   Guncord Installer - Build (Electron)
echo  ====================================
echo.

:: Check that node is available
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Kill any running installer instance to unlock files
taskkill /F /IM Guncord.exe /IM Guncord-Installer.exe >nul 2>&1

:: Create the output folder if needed
if not exist "release\installer" mkdir "release\installer"

:: Enter installer
cd installer

:: Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo  [1/3] Installing npm dependencies...
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        cd ..
        pause
        exit /b 1
    )
    echo  [1/3] Dependencies installed.
) else (
    echo  [1/3] Dependencies already present.
)

:: Webpack compilation
echo.
echo  [2/3] Compiling electron-webpack...
call npm run compile
if errorlevel 1 (
    echo  [ERROR] Webpack compilation failed.
    cd ..
    pause
    exit /b 1
)
echo  [2/3] Webpack compilation succeeded.

:: Kill any installer instance again before packaging
taskkill /F /IM Guncord.exe /IM Guncord-Installer.exe >nul 2>&1

:: Try to clean win-unpacked if it exists
if exist "..\release\installer\win-unpacked" (
    rmdir /S /Q "..\release\installer\win-unpacked" >nul 2>&1
)

:: Packaging electron-builder -> Guncord-Installer.exe in release/installer
echo.
echo  [3/3] Packaging electron-builder...
call npx electron-builder --win -p never
if errorlevel 1 (
    echo  [ERROR] electron-builder failed.
    cd ..
    pause
    exit /b 1
)

cd ..

:: Verify
if not exist "release\installer\Guncord-Installer.exe" (
    echo.
    echo  [ERROR] Guncord-Installer.exe not found after compilation.
    pause
    exit /b 1
)

for %%F in ("release\installer\Guncord-Installer.exe") do (
    echo.
    echo  [OK] Build succeeded!
    echo  File : release\installer\Guncord-Installer.exe (%%~zF bytes)
    echo.
)

:: Open the output folder
explorer release\installer

pause
