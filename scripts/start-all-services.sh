#!/bin/bash
# GreenRoute AI — Complete Service Startup
# Starts all agents and infrastructure in the correct order

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  GreenRoute AI — Complete Startup                         ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if port is in use
port_in_use() {
  lsof -i ":$1" > /dev/null 2>&1
}

# Kill any existing processes on our ports
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
pkill -f "api-gateway" || true
pkill -f "monitor-agent" || true
pkill -f "replanner-agent" || true
pkill -f "router-agent" || true
pkill -f "vite" || true
sleep 2

# Start API Gateway (port 3000)
echo -e "${YELLOW}[1/5] Starting API Gateway on port 3000...${NC}"
cd "$PROJECT_DIR/packages/api-gateway"
npm start > /tmp/api-gateway.log 2>&1 &
API_PID=$!
sleep 2

if port_in_use 3000; then
  echo -e "${GREEN}✅ API Gateway started${NC}"
else
  echo -e "${RED}❌ API Gateway failed to start${NC}"
  cat /tmp/api-gateway.log
  exit 1
fi

# Start Monitor Agent (port 8080)
echo -e "${YELLOW}[2/5] Starting Monitor Agent on port 8080...${NC}"
cd "$PROJECT_DIR/packages/monitor-agent"
PORT=8080 npm start > /tmp/monitor-agent.log 2>&1 &
MONITOR_PID=$!
sleep 2

if port_in_use 8080; then
  echo -e "${GREEN}✅ Monitor Agent started${NC}"
else
  echo -e "${RED}❌ Monitor Agent failed to start${NC}"
  cat /tmp/monitor-agent.log
  exit 1
fi

# Start Replanner Agent (port 8081)
echo -e "${YELLOW}[3/5] Starting Replanner Agent on port 8081...${NC}"
cd "$PROJECT_DIR/packages/replanner-agent"
PORT=8081 npm start > /tmp/replanner-agent.log 2>&1 &
REPLANNER_PID=$!
sleep 2

if port_in_use 8081; then
  echo -e "${GREEN}✅ Replanner Agent started${NC}"
else
  echo -e "${RED}❌ Replanner Agent failed to start${NC}"
  cat /tmp/replanner-agent.log
  exit 1
fi

# Start Router Agent (port 8082)
echo -e "${YELLOW}[4/5] Starting Router Agent on port 8082...${NC}"
cd "$PROJECT_DIR/packages/router-agent"
PORT=8082 npm start > /tmp/router-agent.log 2>&1 &
ROUTER_PID=$!
sleep 2

if port_in_use 8082; then
  echo -e "${GREEN}✅ Router Agent started${NC}"
else
  echo -e "${RED}❌ Router Agent failed to start${NC}"
  cat /tmp/router-agent.log
  exit 1
fi

# Start Frontend (port 5173)
echo -e "${YELLOW}[5/5] Starting Frontend Dev Server on port 5173...${NC}"
cd "$PROJECT_DIR/packages/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

if port_in_use 5173; then
  echo -e "${GREEN}✅ Frontend started${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend may still be starting, check /tmp/frontend.log${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 All Services Started Successfully!${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Open your browser to:"
echo -e "  ${GREEN}http://localhost:5173${NC}"
echo ""
echo "Services running:"
echo "  • Frontend:       http://localhost:5173"
echo "  • API Gateway:    http://localhost:3000"
echo "  • Monitor Agent:  http://localhost:8080"
echo "  • Replanner:      http://localhost:8081"
echo "  • Router:         http://localhost:8082"
echo ""
echo "Logs:"
echo "  tail -f /tmp/api-gateway.log"
echo "  tail -f /tmp/monitor-agent.log"
echo "  tail -f /tmp/replanner-agent.log"
echo "  tail -f /tmp/router-agent.log"
echo "  tail -f /tmp/frontend.log"
echo ""
echo "To stop all services:"
echo "  pkill -f 'api-gateway|monitor-agent|replanner-agent|router-agent' && pkill -f 'npm run dev'"
echo ""
