@echo off
rem Abre o jogo usando o Godot que estiver nesta pasta (ex.: Godot_v4.3-stable_win64.exe)
cd /d "%~dp0"
for %%G in (Godot*.exe) do (
  start "" "%%G" --path "%~dp0"
  exit /b
)
echo Coloque o executavel do Godot 4.3+ (Godot_v4.x-stable_win64.exe) nesta pasta,
echo ou abra o projeto pelo Godot (Importar ^> project.godot) e aperte F5.
pause
