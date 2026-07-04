@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

REM ============================================================
REM GEO Studio — Windows 一键启动脚本
REM 用法: start.bat [start^|stop^|restart^|status]
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PB_DIR=%SCRIPT_DIR%\pocketbase"
set "PB_DATA=%PB_DIR%\pb_data"
set "PB_BIN=%PB_DIR%\pocketbase.exe"
set "FE_DIR=%SCRIPT_DIR%\frontend"
set "PID_DIR=%SCRIPT_DIR%\.run"
set "PB_PID_FILE=%PID_DIR%\pb.pid"
set "VITE_PID_FILE=%PID_DIR%\vite.pid"

if not exist "%PID_DIR%" mkdir "%PID_DIR%"

set "PB_VER=0.39.4"
set "PB_URL=https://github.com/pocketbase/pocketbase/releases/download/v%PB_VER%/pocketbase_%PB_VER%_windows_amd64.zip"

goto :main

REM ---- 检查 PocketBase 可执行文件 ----
:ensure_pb
if not exist "%PB_BIN%" (
    echo [下载] PocketBase %PB_VER%...
    if not exist "%PB_DIR%" mkdir "%PB_DIR%"
    powershell -Command "try { Invoke-WebRequest -Uri '%PB_URL%' -OutFile '%PB_DIR%\pb.zip' -TimeoutSec 300 } catch { Write-Host '下载失败:' $_.Exception.Message; exit 1 }"
    if errorlevel 1 (
        echo [错误] PocketBase 下载失败，请检查网络后重试
        exit /b 1
    )
    powershell -Command "Expand-Archive -Path '%PB_DIR%\pb.zip' -DestinationPath '%PB_DIR%' -Force"
    del "%PB_DIR%\pb.zip"
    echo [完成] PocketBase 下载完成
)
if not exist "%PB_DATA%" (
    "%PB_BIN%" superuser upsert "admin@geo.local" "admin123456" --dir="%PB_DATA%" 2>nul
)
goto :eof

REM ---- 安装前端依赖 ----
:ensure_fe
if not exist "%FE_DIR%\node_modules" (
    echo [安装] 前端依赖...
    pushd "%FE_DIR%"
    call npm install --registry=https://registry.npmmirror.com
    popd
)
goto :eof

REM ---- 启动 PocketBase ----
:start_pb
if exist "%PB_PID_FILE%" (
    for /f %%i in (%PB_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        echo [警告] PocketBase 已在运行 ^(PID !PID!^)
        exit /b 0
    )
)
"%PB_BIN%" serve --http=127.0.0.1:8085 --dir="%PB_DATA%" > "%TEMP%\geo_pb.log" 2>&1 &
set "PID=!!"
echo !PID!> "%PB_PID_FILE%"
timeout /t 2 /nobreak > nul
tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
    echo [完成] PocketBase 已启动 ^(PID !PID!, 端口 8085^)
) || (
    echo [错误] PocketBase 启动失败，查看日志：%TEMP%\geo_pb.log
    del "%PB_PID_FILE%" 2>nul
    exit /b 1
)
goto :eof

REM ---- 启动 Vite ----
:start_vite
if exist "%VITE_PID_FILE%" (
    for /f %%i in (%VITE_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        echo [警告] Vite 已在运行 ^(PID !PID!^)
        exit /b 0
    )
)
pushd "%FE_DIR%"
start "GEO Studio Vite" /B cmd /c "npx vite --port 5175 --strictPort > %TEMP%\geo_vite.log 2>&1"
popd
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175" ^| findstr "LISTENING"') do (
    set "PID=%%a"
    goto :vite_pid_found
)
:vite_pid_found
if defined PID (
    echo !PID!> "%VITE_PID_FILE%"
    echo [完成] Vite 已启动 ^(PID !PID!, 端口 5175^)
) else (
    echo [警告] Vite 可能仍在启动中，查看日志：%TEMP%\geo_vite.log
)
goto :eof

REM ---- 停止 PocketBase ----
:stop_pb
if exist "%PB_PID_FILE%" (
    for /f %%i in (%PB_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        taskkill /PID !PID! /F >nul 2>&1
        echo [完成] PocketBase 已停止 ^(PID !PID!^)
    ) || (
        echo [警告] PocketBase 未运行
    )
    del "%PB_PID_FILE%" 2>nul
) else (
    echo [警告] PocketBase 未运行
)
goto :eof

REM ---- 停止 Vite ----
:stop_vite
if exist "%VITE_PID_FILE%" (
    for /f %%i in (%VITE_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        taskkill /PID !PID! /F >nul 2>&1
        echo [完成] Vite 已停止 ^(PID !PID!^)
    ) || (
        echo [警告] Vite 未运行
    )
    del "%VITE_PID_FILE%" 2>nul
) else (
    echo [警告] Vite 未运行
)
goto :eof

REM ---- 查看状态 ----
:status
echo.
echo PocketBase:
if exist "%PB_PID_FILE%" (
    for /f %%i in (%PB_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        echo   [运行中] PID !PID!
    ) || (
        echo   [已停止]
    )
) else (
    echo   [已停止]
)
echo Vite:
if exist "%VITE_PID_FILE%" (
    for /f %%i in (%VITE_PID_FILE%) do set "PID=%%i"
    tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul && (
        echo   [运行中] PID !PID!
    ) || (
        echo   [已停止]
    )
) else (
    echo   [已停止]
)
echo.
goto :eof

REM ---- 主命令分发 ----
:main
set "CMD=%~1"
if "%CMD%"=="" set "CMD=start"

if "%CMD%"=="start" (
    echo [启动] GEO Studio...
    echo.
    call :ensure_pb
    if errorlevel 1 exit /b 1
    call :ensure_fe
    call :start_pb
    call :start_vite
    echo.
    echo ============================================
    echo   GEO Studio 启动完成
    echo.
    echo   前端  http://localhost:5175
    echo   后端  http://127.0.0.1:8085
    echo.
    echo   预注册账号: user001 ~ user005
    echo   密码: test1234
    echo ============================================
) else if "%CMD%"=="stop" (
    echo [停止] GEO Studio...
    call :stop_pb
    call :stop_vite
) else if "%CMD%"=="restart" (
    echo [重启] GEO Studio...
    call :stop_pb
    call :stop_vite
    timeout /t 1 /nobreak > nul
    call :ensure_pb
    call :ensure_fe
    call :start_pb
    call :start_vite
    echo.
    echo ============================================
    echo   GEO Studio 重启完成
    echo   前端  http://localhost:5175
    echo   后端  http://127.0.0.1:8085
    echo ============================================
) else if "%CMD%"=="status" (
    call :status
) else (
    echo 用法: start.bat [start^|stop^|restart^|status]
    echo.
    echo   start   启动前端和后端
    echo   stop    停止前端和后端
    echo   restart 重启前端和后端
    echo   status  查看运行状态
    exit /b 1
)

endlocal
