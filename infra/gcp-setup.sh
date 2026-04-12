#!/usr/bin/env bash
# infra/gcp-setup.sh — One-command GCP project setup for GreenRoute AI
# Usage: bash infra/gcp-setup.sh YOUR_PROJECT_ID eu github-org/greenroute-ai
set -euo pipefail

PROJECT_ID="${1:-greenroute-ai-hackathon}"
REGION="${2:-europe-west4}"
GITHUB_REPO="${3:-your-org/greenroute-ai}"

echo "╔═══════════════════════════════════════════╗"
echo "║  GreenRoute AI — GCP Setup                ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "GitHub:   $GITHUB_REPO"
echo ""

# ── APIs ───────────────────────────────────────────────────────────────────────
echo "🔧 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com \
  redis.googleapis.com \
  --project=$PROJECT_ID

# ── Artifact Registry ─────────────────────────────────────────────────────────
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create greenroute \
  --repository-format=docker \
  --location=$REGION \
  --description="GreenRoute AI container images" \
  --project=$PROJECT_ID || echo "(already exists)"

# ── Service Account ───────────────────────────────────────────────────────────
SA_NAME="greenroute-deployer"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "👤 Creating service account..."
gcloud iam service-accounts create $SA_NAME \
  --display-name="GreenRoute Deployer" \
  --project=$PROJECT_ID || echo "(already exists)"

# Grant Cloud Run and Artifact Registry permissions
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" --quiet
done

# ── Workload Identity Federation (keyless GitHub Actions) ─────────────────────
echo "🔑 Configuring Workload Identity Federation..."
POOL_NAME="greenroute-github-pool"
PROVIDER_NAME="greenroute-github-provider"

gcloud iam workload-identity-pools create $POOL_NAME \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool" || echo "(already exists)"

# Clean GITHUB_REPO just in case a full URL was passed
CLEAN_REPO=$(echo "$GITHUB_REPO" | sed -e 's|https://github.com/||' -e 's|\.git$||')

gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL_NAME \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '$CLEAN_REPO'" \
  --issuer-uri="https://token.actions.githubusercontent.com" || echo "(already exists)"

POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_NAME \
  --project=$PROJECT_ID --location=global --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/$CLEAN_REPO"

PROVIDER_ID=$(gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
  --project=$PROJECT_ID --location=global \
  --workload-identity-pool=$POOL_NAME \
  --format="value(name)")

echo ""
echo "✅ Add these as GitHub Actions secrets:"
echo "   GCP_PROJECT_ID      = $PROJECT_ID"
echo "   GCP_WIF_PROVIDER    = $PROVIDER_ID"
echo "   GCP_SA_EMAIL        = $SA_EMAIL"
echo "   REDIS_URL           = redis://<memorystore-ip>:6379"
echo "   GOOGLE_MAPS_API_KEY = <your-key>"
echo "   GOOGLE_GEMINI_API_KEY = <your-key>"
echo ""
echo "🚀 Then push to main to trigger deploy!"
