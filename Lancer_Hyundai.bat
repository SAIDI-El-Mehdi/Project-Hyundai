@echo off
title Serveur Hyundai
echo =======================================
echo   Demarrage du Systeme Hyundai...
echo =======================================

echo ⚙️ Demarrage du Moteur (Backend)...
cd /d "C:\Users\USER\Desktop\Projet_Hyundai\hyundai-backend"
start "Backend Hyundai" cmd /c "node server.js"

echo 💻 Demarrage de l'Interface (Frontend)...
cd /d "C:\Users\USER\Desktop\Projet_Hyundai\hyundai-frontend"
start "Frontend Hyundai" cmd /c "npm run dev"

echo 🌐 Ouverture de l'application...
timeout /t 3 /nobreak > NUL
start http://localhost:5173