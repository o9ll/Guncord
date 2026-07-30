@echo off
:: Wrapper .bat pour lancer guncord-uninstall.ps1 facilement (double-clic)
title Guncord — Désinstallation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guncord-uninstall.ps1"
if %errorlevel% neq 0 pause

