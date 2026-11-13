@echo off
rem Modo de compatibilidade (OpenGL 3.3) para PCs antigos sem Vulkan (Celeron, Intel HD antiga)
cd /d "%~dp0"
for %%G in (Godot*.exe) do (
  start "" "%%G" --path "%~dp0" --rendering-driver opengl3 --rendering-method gl_compatibility
  exit /b
)
echo Coloque o executavel do Godot 4.3+ nesta pasta.
pause
