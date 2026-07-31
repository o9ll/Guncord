@echo off
:: .bat wrapper to easily launch guncord-uninstall.ps1 (double-click)
title Guncord — Uninstall
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guncord-uninstall.ps1"
if %errorlevel% neq 0 pause

