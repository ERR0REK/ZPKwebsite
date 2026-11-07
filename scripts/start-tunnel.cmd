@echo off
setlocal enabledelayedexpansion
rem ============================================================
rem  ZPK — tunel ngrok do lokalnego "npm run dev" (port 8888)
rem
rem  Użycie:
rem    1) okno 1:  npm run dev        (strona + funkcje + lokalne Blobs)
rem    2) okno 2:  scripts\start-tunnel.cmd   (albo: npm run tunnel)
rem
rem  STAŁA DOMENA: wpisz zarezerwowaną domenę do scripts\ngrok-domain.txt
rem  (jedna linia, np. zpk-xxxx.ngrok-free.app, bez https://).
rem  Wtedy adres tunelu jest zawsze ten sam i login Discorda
rem  (OAuth redirect) działa bez zmian w panelu Discorda.
rem
rem  Bez pliku z domeną tunel wystartuje z adresem LOSOWYM
rem  (zmienia się przy każdym uruchomieniu — wtedy trzeba
rem  zaktualizować redirect w Discord Developer Portal).
rem ============================================================

set NGROK_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe
if not exist "%NGROK_EXE%" (
    echo [BLAD] Nie znaleziono ngrok.exe pod %NGROK_EXE%
    pause
    exit /b 1
)

set DOMAIN_FILE=%~dp0ngrok-domain.txt
set DOMAIN_ARG=
if exist "%DOMAIN_FILE%" (
    set /p NGROK_DOMAIN=<"%DOMAIN_FILE%"
    rem obetnij ewentualne spacje/https://
    set NGROK_DOMAIN=!NGROK_DOMAIN:https://=!
    if not "!NGROK_DOMAIN!"=="" (
        set DOMAIN_ARG=--domain=!NGROK_DOMAIN!
        echo [OK] Uzywam stalej domeny: https://!NGROK_DOMAIN!
    )
)

if "!DOMAIN_ARG!"=="" (
    echo [UWAGA] Brak scripts\ngrok-domain.txt — adres tunelu bedzie LOSOWY.
    echo         Zarezerwuj domene: dashboard.ngrok.com -^> Cloud Edge -^> Domains
)

echo.
echo [i] Tunel: ngrok http 8888   (inspektor: http://127.0.0.1:4040)
echo [i] Najpierw odpal "npm run dev" w innym oknie!
echo.
"%NGROK_EXE%" http 8888 %DOMAIN_ARG%
pause
