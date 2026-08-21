@echo off
set "DEMO_DIR=%~dp0"
set "EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE_PATH%" (
  start "" "%EDGE_PATH%" --app="file:///%DEMO_DIR:\=/%index.html" --start-maximized
) else (
  start "" "%DEMO_DIR%index.html"
)
