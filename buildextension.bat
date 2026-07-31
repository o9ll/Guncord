@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo BUILDER EXTENSION FIREFOX GUNCORD
echo ========================================================
echo.
echo List of ignored plugins read from blacklist.txt
echo.
echo Enter the new version (e.g. 1.20.0) :
set /p NEW_VERSION=

if "!NEW_VERSION!"=="" (
    echo Invalid version, aborting.
    pause
    exit /b
)

echo.
echo Updating package.json to version !NEW_VERSION!...
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"!NEW_VERSION!\"' | Set-Content package.json"

echo.
echo Building the Firefox extension (may take a few moments)...
call pnpm buildWeb

echo.
echo ========================================================
echo DONE! The extension is ready in:
echo   dist\browser\firefox-unpacked  (unpacked extension)
echo   dist\extension-firefox.zip     (zip for publishing)
echo ========================================================
pause

