#!/bin/bash

# Start script for Replit
# Backend runs on port 3000, Frontend (Vite) runs on port 5000

echo "🚀 Starting Replit Event Planning App..."
echo "======================================"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5000 (Replit Preview)"
echo "======================================"

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
pkill -f "tsx server/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start backend on port 3000
echo "🔧 Starting backend server on port 3000..."
PORT=3000 npm run server &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 5

# Start frontend on port 5000
echo "🎨 Starting frontend on port 5000..."
npm run client &
FRONTEND_PID=$!

echo "======================================"
echo "✅ Both servers started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "======================================"
echo ""
echo "📱 Access your app at the Replit preview URL"
echo "🔧 Backend API: http://localhost:3000/api"
echo ""

# Keep the script running
wait $BACKEND_PID $FRONTEND_PID