@echo off
:: Wrapper .bat pour lancer guncord-install.ps1 facilement (double-clic)
title Guncord — Installation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guncord-install.ps1"
if %errorlevel% neq 0 pause

