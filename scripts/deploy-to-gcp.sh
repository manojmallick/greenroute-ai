#!/bin/bash
# GreenRoute AI — GCP Cloud Run Deployment Script

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  GreenRoute AI — GCP Deployment                           ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ gcloud CLI not found. Install it first:${NC}"
  echo "   https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Get GCP project
PROJECT_ID=$(gcloud config list --format='value(core.project)')
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ GCP project not configured${NC}"
  exit 1
fi

echo -e "${GREEN}✅ GCP Project: $PROJECT_ID${NC}"

# Prompt for configuration
read -p "Enter region (default: europe-west4): " REGION
REGION=${REGION:-europe-west4}

read -p "Enter Redis IP or Memorystore internal IP (e.g., 10.0.0.1): " REDIS_IP
if [ -z "$REDIS_IP" ]; then
  echo -e "${YELLOW}⚠️  No Redis IP provided. Using local testing mode (will fail on deployment).${NC}"
  REDIS_IP="10.0.0.1"
fi

read -p "Enter Google Gemini API Key (leave empty for fallback): " GEMINI_KEY
GEMINI_KEY=${GEMINI_KEY:-""}

read -p "Enter Google Maps API Key (leave empty to skip): " MAPS_KEY
MAPS_KEY=${MAPS_KEY:-""}

read -p "Enter Cloud Run URL suffix (e.g., greenroute-ew.a.run.app): " CLOUD_RUN_SUFFIX
CLOUD_RUN_SUFFIX=${CLOUD_RUN_SUFFIX:-"greenroute-$RANDOM.a.run.app"}

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Redis: redis://$REDIS_IP:6379"
echo "  Gemini Key: ${GEMINI_KEY:0:10}${GEMINI_KEY:+...}"
echo "  Maps Key: ${MAPS_KEY:0:10}${MAPS_KEY:+...}"
echo "  Cloud Run URL: https://api-gateway-$CLOUD_RUN_SUFFIX"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 1
fi

# Check Artifact Registry
echo ""
echo -e "${YELLOW}[1/4] Checking Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe greenroute --location=$REGION &> /dev/null; then
  echo -e "${YELLOW}Creating repository greenroute...${NC}"
  gcloud artifacts repositories create greenroute \
    --repository-format=docker \
    --location=$REGION \
    --description="GreenRoute AI container images"
  echo -e "${GREEN}✅ Repository created${NC}"
else
  echo -e "${GREEN}✅ Repository exists${NC}"
fi

# Configure Docker authentication
echo -e "${YELLOW}Setting up Docker authentication...${NC}"
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
echo -e "${GREEN}✅ Docker authenticated${NC}"

# Trigger Cloud Build
echo ""
echo -e "${YELLOW}[2/4] Triggering Cloud Build...${NC}"

BUILD_ID=$(gcloud builds submit \
  --config=infra/cloudbuild.yaml \
  --substitutions="_REGION=$REGION,_REDIS_URL=redis://$REDIS_IP:6379,_GEMINI_KEY=$GEMINI_KEY,_MAPS_KEY=$MAPS_KEY,_CLOUD_RUN_SUFFIX=$CLOUD_RUN_SUFFIX" \
  --format='value(id)' \
  --quiet \
  .)

echo -e "${GREEN}✅ Build triggered: $BUILD_ID${NC}"
echo ""
echo -e "${BLUE}Build is running. Monitoring progress...${NC}"
echo "View full logs with: ${YELLOW}gcloud builds log --stream $BUILD_ID${NC}"
echo ""

# Monitor build
gcloud builds log --stream $BUILD_ID --limit=100

# Check build status
BUILD_STATUS=$(gcloud builds describe $BUILD_ID --format='value(status)')
if [ "$BUILD_STATUS" != "SUCCESS" ]; then
  echo ""
  echo -e "${RED}❌ Build failed with status: $BUILD_STATUS${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"

# Show deployment results
echo ""
echo -e "${BLUE}[3/4] Getting deployment URLs...${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Deployment Complete!${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Get service URLs
for SERVICE in api-gateway frontend router-agent monitor-agent replanner-agent; do
  URL=$(gcloud run services describe greenroute-$SERVICE --region=$REGION --format='value(status.url)' 2>/dev/null || echo "DEPLOYING...")
  case $SERVICE in
    api-gateway)
      echo -e "  ${GREEN}API Gateway:${NC} $URL"
      ;;
    frontend)
      echo -e "  ${GREEN}Frontend:${NC} $URL"
      ;;
    router-agent)
      echo -e "  ${GREEN}Router Agent:${NC} $URL (internal)"
      ;;
    monitor-agent)
      echo -e "  ${GREEN}Monitor Agent:${NC} $URL (internal)"
      ;;
    replanner-agent)
      echo -e "  ${GREEN}Replanner Agent:${NC} $URL (internal)"
      ;;
  esac
done

echo ""
echo -e "${YELLOW}[4/4] Verifying deployment...${NC}"

# Wait for services to be ready
sleep 5

# Test API Gateway
API_URL=$(gcloud run services describe greenroute-api-gateway --region=$REGION --format='value(status.url)')
if curl -s "$API_URL/api/health" > /dev/null; then
  echo -e "${GREEN}✅ API Gateway responding${NC}"
else
  echo -e "${YELLOW}⚠️  API Gateway not yet responding (services may still be initializing)${NC}"
fi

# Show next steps
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Open the frontend:"
echo -e "   ${GREEN}$(gcloud run services describe greenroute-frontend --region=$REGION --format='value(status.url)')${NC}"
echo ""
echo "2. Monitor logs:"
echo -e "   ${YELLOW}gcloud logging read \"resource.type=cloud_run_revision\" --limit=100 --format=json${NC}"
echo ""
echo "3. Check service status:"
echo -e "   ${YELLOW}gcloud run services list --region=$REGION${NC}"
echo ""
echo "4. Rollback if needed:"
echo -e "   ${YELLOW}gcloud run deploy greenroute-frontend --image=<PREVIOUS_IMAGE> --region=$REGION${NC}"
echo ""

echo -e "${GREEN}Deployment complete! 🚀${NC}"
