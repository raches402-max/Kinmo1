#!/bin/bash

echo "🔧 Fixing Replit Preview Issues..."
echo ""

# 1. Kill any existing node/npm processes
echo "1️⃣ Killing existing Node processes..."
pkill -9 node 2>/dev/null
pkill -9 npm 2>/dev/null
pkill -9 tsx 2>/dev/null
sleep 2

# 2. Clear any port locks
echo "2️⃣ Checking for port conflicts..."
if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":5000 "; then
        echo "   Port 5000 is in use, attempting to free it..."
        fuser -k 5000/tcp 2>/dev/null || true
        sleep 1
    fi

    if netstat -tuln 2>/dev/null | grep -q ":5173 "; then
        echo "   Port 5173 is in use, attempting to free it..."
        fuser -k 5173/tcp 2>/dev/null || true
        sleep 1
    fi
else
    echo "   Skipping port check (netstat not available)"
fi

# 3. Clear build caches
echo "3️⃣ Clearing build caches..."
rm -rf node_modules/.vite 2>/dev/null
rm -rf dist 2>/dev/null
rm -rf .vite 2>/dev/null
rm -rf client/dist 2>/dev/null

# 4. Check for zombie processes
echo "4️⃣ Checking for zombie processes..."
ZOMBIE_COUNT=$(ps aux | grep -E "defunct|<zombie>" | grep -v grep | wc -l)
if [ "$ZOMBIE_COUNT" -gt 0 ]; then
    echo "   Found $ZOMBIE_COUNT zombie processes (they'll clean up automatically)"
fi

# 5. Verify environment
echo "5️⃣ Verifying environment..."
if [ ! -f ".env" ]; then
    echo "   ⚠️  Warning: .env file not found!"
else
    echo "   ✅ .env file exists"
fi

# 6. Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  Warning: node_modules not found, you may need to run 'npm install'"
else
    echo "   ✅ node_modules exists"
fi

echo ""
echo "✅ Cleanup complete! Now try running: npm run dev"
echo ""
