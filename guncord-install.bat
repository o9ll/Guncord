@echo off
:: .bat wrapper to easily launch guncord-install.ps1 (double-click)
title Guncord — Install
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guncord-install.ps1"
if %errorlevel% neq 0 pause

