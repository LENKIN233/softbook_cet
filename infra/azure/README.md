# Azure Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/platform-contract.json`, `spec/runtime-boundaries.json`.

`product_truth`: the app requires phone/SMS authentication before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: this Azure setup is only a portable staging runtime. The service must remain deployable as a regular container with PostgreSQL so it can move from Azure Global to the final work server later.

## Default Shape

- Cloud: Azure Global (`AzureCloud`)
- Region: `eastasia`
- Resource group: `softbook-cet-dev`
- Budget: USD 100 monthly budget filtered to the dev resource group
- API runtime: Azure Container Apps environment
- Image registry: Azure Container Registry Basic SKU
- Database: Azure Database for PostgreSQL Flexible Server, Burstable `Standard_B1ms`, 32 GiB, 7-day backup retention

The Azure budget is a cost-management alerting boundary, not a hard spending cap. Delete the resource group when the dev server is no longer needed:

```bash
az group delete --name softbook-cet-dev --yes
```

## Usage

Install and log in:

```bash
az login --use-device-code
az account set --subscription "<subscription-id-or-name>"
```

Bootstrap:

```bash
infra/azure/bootstrap-dev.sh
```

Optional overrides:

```bash
AZURE_LOCATION=southeastasia \
AZURE_BUDGET_AMOUNT=100 \
infra/azure/bootstrap-dev.sh
```

The script writes local connection metadata to `infra/azure/softbook-cet-dev.local.env`. That file is ignored by Git because it may contain database credentials.

