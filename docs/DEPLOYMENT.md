
# Deployment Guide

## Database Configuration

This application supports two methods for configuring the database connection string, optimized for both Development and Production (EC2) environments.

### 1. Environment Variables (Development / Simple)

For local development or simple setups, you can continue using the `.env` file or export the variable directly.

**Variable:** `DATABASE_URL`

```bash
# Example .env content
DATABASE_URL=postgresql://user:password@localhost/dbname
```

### 2. AWS Parameter Store (Production / EC2)

For a more secure production setup on AWS EC2, you can store the connection string in AWS Systems Manager (SSM) Parameter Store. This avoids hardcoding secrets in files.

**Variable:** `DB_SSM_PARAM_NAME`

#### Step 1: Create Parameter in AWS

1.  Go to the [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/parameters).
2.  Click **Create parameter**.
3.  **Name**: `/my-app/prod/database-url` (or any name you prefer).
4.  **Tier**: Standard.
5.  **Type**: SecureString.
6.  **KMS key source**: My current account (default).
7.  **Value**: Your full PostgreSQL connection string (e.g., `postgresql://user:pass@db-endpoint:5432/dbname`).
8.  Click **Create parameter**.

#### Step 2: Configure EC2 IAM Role

Your EC2 instance needs permission to read this parameter.

1.  Go to the [IAM Console](https://console.aws.amazon.com/iam).
2.  Create a new Role for **EC2**.
3.  Add a custom policy with the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "ssm:GetParameter",
            "Resource": "arn:aws:ssm:ap-south-1:YOUR_ACCOUNT_ID:parameter/my-app/prod/database-url"
        }
    ]
}
```
*(Replace `YOUR_ACCOUNT_ID` and the parameter name with your actual values)*

4.  Attach this IAM Role to your EC2 instance.

#### Step 3: Run Application

## Running with Docker on EC2

To restart the application with the new changes:

1.  **Pull the latest code**:
    ```bash
    git pull origin main
    ```

2.  **Rebuild the image**:
    ```bash
    docker build -t stock_servs .
    ```

3.  **Stop old container** (if running):
    ```bash
    docker stop stock_servs_container || true
    docker rm stock_servs_container || true
    ```

4.  **Run the new container**:
    We pass the `DB_SSM_PARAM_NAME` so the app knows where to look. We also pass `AWS_REGION`.
    ```bash
    docker run -d \
      --name stock_servs_container \
      --restart always \
      -p 8000:8000 \
      -e DB_SSM_PARAM_NAME="/my-app/prod/database-url" \
      -e AWS_REGION="us-east-1" \
      stock_servs
    ```
    *(Note: If your EC2 has the IAM Role attached, you do NOT need to pass AWS credentials. The SDK handles it automatically.)*
