@echo off
cd /d "%~dp0v7.0"
node index.js train %1
pause