# Deploy to Staging / Production

## Prerequisites
- Docker Hub credentials configured
- EC2 SSH access configured
- GitHub Secrets set: `DATABASE_URL`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`

## Automatic Deployment (CI/CD)
1. Push to `main` branch
2. GitHub Actions (`.github/workflows/deploy.yml`) triggers automatically
3. Builds Docker image and pushes to Docker Hub
4. SSH deploys to EC2 instance

## Manual Deployment
1. Build: `docker build -t stock_servs .`
2. Tag: `docker tag stock_servs <dockerhub-user>/stock_servs:latest`
3. Push: `docker push <dockerhub-user>/stock_servs:latest`
4. SSH into EC2 and pull/restart container

## Post-Deploy Checks
- Hit `/health` endpoint
- Check `/scheduler/status` for background jobs
- Verify frontend loads at root URL

---
**Changelog**
- 2026-02-07: Initial version
