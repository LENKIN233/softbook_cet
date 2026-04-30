#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-softbook-cet-dev}"
LOCATION="${AZURE_LOCATION:-eastasia}"
BUDGET_AMOUNT="${AZURE_BUDGET_AMOUNT:-100}"
BUDGET_NAME="${AZURE_BUDGET_NAME:-softbook-cet-dev-budget}"
CREATE_POSTGRES="${CREATE_POSTGRES:-1}"

POSTGRES_DB="${POSTGRES_DB:-softbook_cet}"
POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-softbook_admin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${SCRIPT_DIR}/${RESOURCE_GROUP}.local.env"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command az
require_command curl
require_command openssl
require_command python3
require_command shasum

az cloud set --name AzureCloud >/dev/null

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI is not logged in. Run: az login --use-device-code" >&2
  exit 1
fi

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"
SUFFIX="$(printf "%s" "${SUBSCRIPTION_ID}" | shasum | awk '{print substr($1, 1, 8)}')"

ACR_NAME="${AZURE_ACR_NAME:-softbookcet${SUFFIX}}"
CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-softbook-cet-dev-env-${SUFFIX}}"
POSTGRES_SERVER="${POSTGRES_SERVER:-softbook-cet-pg-${SUFFIX}}"

START_DATE="$(python3 - <<'PY'
from datetime import date
print(date.today().isoformat())
PY
)"
END_DATE="$(python3 - <<'PY'
from datetime import date
try:
    print(date(date.today().year + 1, date.today().month, date.today().day).isoformat())
except ValueError:
    print(date(date.today().year + 1, date.today().month, 28).isoformat())
PY
)"

echo "Azure subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"
echo "Resource group: ${RESOURCE_GROUP}"
echo "Location: ${LOCATION}"
echo "Budget: USD ${BUDGET_AMOUNT} monthly, filtered to ${RESOURCE_GROUP}"

az group create \
  --name "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --tags project=softbook-cet env=dev portability=docker-postgres budget="${BUDGET_AMOUNT}usd" \
  --output none

if az consumption budget show --budget-name "${BUDGET_NAME}" >/dev/null 2>&1; then
  echo "Budget guard already exists: ${BUDGET_NAME}"
else
  echo "Creating budget guard before billable resources..."
  if ! az consumption budget create \
    --budget-name "${BUDGET_NAME}" \
    --category cost \
    --amount "${BUDGET_AMOUNT}" \
    --start-date "${START_DATE}" \
    --end-date "${END_DATE}" \
    --time-grain monthly \
    --resource-group-filter "${RESOURCE_GROUP}" \
    --output none; then
    echo "Budget creation failed. Stopping before creating billable resources." >&2
    echo "Fix Azure Cost Management permissions or set SKIP_BUDGET=1 intentionally." >&2
    if [[ "${SKIP_BUDGET:-0}" != "1" ]]; then
      exit 1
    fi
  fi
fi

echo "Registering Azure resource providers..."
for provider in \
  Microsoft.App \
  Microsoft.ContainerRegistry \
  Microsoft.DBforPostgreSQL \
  Microsoft.OperationalInsights \
  Microsoft.Consumption; do
  az provider register --namespace "${provider}" --wait >/dev/null
done

if ! az acr show --name "${ACR_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  echo "Creating Azure Container Registry: ${ACR_NAME}"
  az acr create \
    --name "${ACR_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --sku Basic \
    --admin-enabled false \
    --tags project=softbook-cet env=dev \
    --output none
else
  echo "Azure Container Registry already exists: ${ACR_NAME}"
fi

if ! az containerapp env show --name "${CONTAINERAPPS_ENV}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  echo "Creating Azure Container Apps environment: ${CONTAINERAPPS_ENV}"
  az containerapp env create \
    --name "${CONTAINERAPPS_ENV}" \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --enable-workload-profiles false \
    --logs-destination log-analytics \
    --tags project=softbook-cet env=dev \
    --output none
else
  echo "Container Apps environment already exists: ${CONTAINERAPPS_ENV}"
fi

POSTGRES_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-}"
POSTGRES_CREATED=0

if [[ "${CREATE_POSTGRES}" == "1" ]]; then
  if ! az postgres flexible-server show --name "${POSTGRES_SERVER}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    if [[ -z "${POSTGRES_PASSWORD}" ]]; then
      POSTGRES_PASSWORD="$(python3 - <<'PY'
import secrets
import string

alphabet = string.ascii_letters + string.digits
print("".join(secrets.choice(alphabet) for _ in range(24)) + "Aa1_")
PY
)"
    fi

    CURRENT_IP="$(curl -fsSL https://api.ipify.org || true)"
    if [[ -z "${CURRENT_IP}" ]]; then
      echo "Could not detect current public IP for PostgreSQL firewall." >&2
      exit 1
    fi

    echo "Creating PostgreSQL Flexible Server: ${POSTGRES_SERVER}"
    az postgres flexible-server create \
      --resource-group "${RESOURCE_GROUP}" \
      --name "${POSTGRES_SERVER}" \
      --location "${LOCATION}" \
      --admin-user "${POSTGRES_ADMIN_USER}" \
      --admin-password "${POSTGRES_PASSWORD}" \
      --database-name "${POSTGRES_DB}" \
      --version 16 \
      --tier Burstable \
      --sku-name Standard_B1ms \
      --storage-size 32 \
      --storage-auto-grow Disabled \
      --backup-retention 7 \
      --geo-redundant-backup Disabled \
      --zonal-resiliency Disabled \
      --public-access "${CURRENT_IP}" \
      --tags project=softbook-cet env=dev \
      --yes \
      --output none

    az postgres flexible-server firewall-rule create \
      --resource-group "${RESOURCE_GROUP}" \
      --name "${POSTGRES_SERVER}" \
      --rule-name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0 \
      --output none

    POSTGRES_CREATED=1
  else
    echo "PostgreSQL Flexible Server already exists: ${POSTGRES_SERVER}"
  fi
fi

{
  echo "AZURE_CLOUD=AzureCloud"
  echo "AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}"
  echo "AZURE_RESOURCE_GROUP=${RESOURCE_GROUP}"
  echo "AZURE_LOCATION=${LOCATION}"
  echo "AZURE_ACR_NAME=${ACR_NAME}"
  echo "AZURE_CONTAINERAPPS_ENV=${CONTAINERAPPS_ENV}"
  echo "POSTGRES_SERVER=${POSTGRES_SERVER}"
  echo "POSTGRES_DB=${POSTGRES_DB}"
  echo "POSTGRES_ADMIN_USER=${POSTGRES_ADMIN_USER}"
  if [[ "${POSTGRES_CREATED}" == "1" ]]; then
    echo "DATABASE_URL=postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_PASSWORD}@${POSTGRES_SERVER}.postgres.database.azure.com:5432/${POSTGRES_DB}?sslmode=require"
  else
    echo "DATABASE_URL=postgresql://${POSTGRES_ADMIN_USER}:<existing-password>@${POSTGRES_SERVER}.postgres.database.azure.com:5432/${POSTGRES_DB}?sslmode=require"
  fi
} >"${LOCAL_ENV_FILE}"
chmod 600 "${LOCAL_ENV_FILE}"

echo "Azure dev environment bootstrap complete."
echo "Local metadata written to ${LOCAL_ENV_FILE}"
echo "Keep this file private; it may contain database credentials."
