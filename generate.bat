@echo off
cd /d "%~dp0v7.0"
node index.js generate %1
pause