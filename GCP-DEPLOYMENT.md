# GCP Deployment Guide

## Prerequisites

Before deploying to GCP, ensure you have:

1. **GCP Project** with Cloud Run, Cloud Build, and Memorystore enabled
2. **gcloud CLI** installed and authenticated:
   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Redis Instance** (Google Memorystore):
   ```bash
   gcloud redis instances create greenroute-redis \
     --region=europe-west4 \
     --size=2 \
     --redis-version=7.0
   ```

4. **Container Registry** (Artifact Registry):
   ```bash
   gcloud artifacts repositories create greenroute \
     --repository-format=docker \
     --location=europe-west4
   ```

## Deployment

### Option 1: Automatic Deployment with Cloud Build

Trigger the build from the command line:

```bash
gcloud builds submit \
  --config=infra/cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_REDIS_URL=redis://<REDIS_IP>:6379,_GEMINI_KEY=<YOUR_GEMINI_KEY>,_MAPS_KEY=<YOUR_MAPS_KEY>,_CLOUD_RUN_SUFFIX=<SUFFIX> \
  .
```

**Example with actual values:**
```bash
gcloud builds submit \
  --config=infra/cloudbuild.yaml \
  --substitutions=_REGION=europe-west4,_REDIS_URL=redis://10.192.0.2:6379,_GEMINI_KEY=sk-...,_MAPS_KEY=AIzaSy...,_CLOUD_RUN_SUFFIX=greenroute-ew.a.run.app \
  .
```

### Option 2: Manual Deployment (Step by Step)

```bash
# 1. Get Redis IP
REDIS_IP=$(gcloud redis instances describe greenroute-redis \
  --region=europe-west4 \
  --format='value(host)')

# 2. Build and push all images
docker build -t europe-west4-docker.pkg.dev/YOUR_PROJECT/greenroute/api-gateway packages/api-gateway/
docker push europe-west4-docker.pkg.dev/YOUR_PROJECT/greenroute/api-gateway

# 3. Deploy API Gateway
gcloud run deploy greenroute-api-gateway \
  --image=europe-west4-docker.pkg.dev/YOUR_PROJECT/greenroute/api-gateway \
  --region=europe-west4 \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --allow-unauthenticated \
  --set-env-vars=REDIS_URL=redis://$REDIS_IP:6379

# Repeat for other services...
```

## Configuration

### Redis Connection
Get your Memorystore Redis IP:
```bash
gcloud redis instances describe greenroute-redis \
  --region=europe-west4 \
  --format='value(host)'
```

Use in deployment: `redis://YOUR_REDIS_IP:6379`

### API Keys
Generate these before deployment:
- **Google Gemini API Key**: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com
- **Google Maps API Key**: https://console.cloud.google.com/apis/library/maps_backend.googleapis.com

### Frontend URL
The frontend Dockerfile will automatically use the API Gateway URL built from `_CLOUD_RUN_SUFFIX`:
```
https://api-gateway-<SUFFIX>
```

Example: `https://api-gateway-greenroute-ew.a.run.app`

## Monitoring

### Check Deployment Status
```bash
gcloud run services list --region=europe-west4
gcloud run services describe greenroute-api-gateway --region=europe-west4
```

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=greenroute-api-gateway" --limit=50 --format=json

# Or use the Cloud Console
```

### Test Deployed Services
```bash
# Get API Gateway URL
API_URL=$(gcloud run services describe greenroute-api-gateway --region=europe-west4 --format='value(status.url)')

# Test health check
curl $API_URL/api/health

# Test route optimization
curl -X POST $API_URL/api/route/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "originId": "AMS-CS",
    "destinationId": "AMS-ZUI",
    "vehicle": { "id": "VAN-001", "type": "diesel_van" }
  }'
```

## Networking

### VPC Connector (for Redis access)
If Redis is in a VPC, create a VPC connector:

```bash
gcloud compute networks vpc-access connectors create greenroute-connector \
  --region=europe-west4 \
  --subnet=default

# Then deploy services with:
gcloud run deploy SERVICE_NAME \
  --vpc-connector=greenroute-connector
```

### Network Policies
- API Gateway: Public (allow-unauthenticated)
- Frontend: Public (allow-unauthenticated)
- Agents: Private (requires service account authentication)

## Autoscaling

Services are configured with:
- **Min instances**: 1 (to keep warm)
- **Max instances**: 100 (Cloud Run default)
- **Memory**: Varies by service (256MB-1GB)
- **CPU**: 1 per service

Adjust in cloudbuild.yaml as needed.

## Troubleshooting

### Redis Connection Error
```
Error: ECONNREFUSED (Redis not accessible)
```
Solution: Ensure VPC connector is used OR open firewall rules for Cloud Run VPC

### Build Failures
```bash
# Check build logs
gcloud builds log --stream
```

### Container Image Issues
```bash
# Debug by running locally
docker run -it europe-west4-docker.pkg.dev/YOUR_PROJECT/greenroute/api-gateway:latest
```

## Cost Estimation

Typical monthly costs (for demo deployment):
- **Cloud Run**: ~$5-10 (0.5-1M requests/month, small payloads)
- **Memorystore (2GB)**: ~$10/month
- **Artifact Registry**: ~$1
- **Cloud Build**: Free tier covers this
- **Total**: ~$16-20/month

## Rollback

If deployment fails:
```bash
# Deploy previous version
gcloud run deploy greenroute-api-gateway \
  --image=europe-west4-docker.pkg.dev/YOUR_PROJECT/greenroute/api-gateway:previous-sha
```

## CI/CD Integration

To automatically deploy on git push, configure Cloud Build to trigger:

```bash
gcloud builds connect \
  --repository-name=greenroute-ai \
  --github-owner=manojmallick
```

This will trigger cloudbuild.yaml on every push to main.

---

**Ready to deploy?** Run:
```bash
./scripts/deploy-to-gcp.sh
```

(Script creates all infrastructure and deploys)
