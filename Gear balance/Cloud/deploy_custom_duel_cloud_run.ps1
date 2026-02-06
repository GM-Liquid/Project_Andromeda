param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory = $false)]
    [string]$ServiceName = "andromeda-custom-duel",

    [Parameter(Mandatory = $false)]
    [string]$ApiKey = "",

    [Parameter(Mandatory = $false)]
    [string]$Repository = "andromeda-sim",

    [Parameter(Mandatory = $false)]
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

function Invoke-Gcloud {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed: gcloud $($Args -join ' ')"
    }
}

$registryHost = "$Region-docker.pkg.dev"
$image = "$registryHost/$ProjectId/$Repository/$ServiceName`:$ImageTag"

Write-Host "Using project: $ProjectId"
Invoke-Gcloud config set project $ProjectId | Out-Null

Write-Host "Enabling required APIs"
Invoke-Gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com | Out-Null

Write-Host "Ensuring Artifact Registry repository exists: $Repository ($Region)"
$repoExists = $false
try {
    Invoke-Gcloud artifacts repositories describe $Repository `
        --location $Region `
        --format "value(name)" | Out-Null
    $repoExists = $true
} catch {
    $repoExists = $false
}
if (-not $repoExists) {
    Invoke-Gcloud artifacts repositories create $Repository `
        --repository-format docker `
        --location $Region `
        --description "Project Andromeda custom duel images"
}

Write-Host "Building image: $image"
Invoke-Gcloud builds submit `
    --config "Gear balance/cloudbuild.custom-duel.yaml" `
    --substitutions "_IMAGE=$image" `
    .

$envArg = "ANDROMEDA_SIM_API_KEY=$ApiKey"

Write-Host "Deploying Cloud Run service: $ServiceName ($Region)"
Invoke-Gcloud run deploy $ServiceName `
    --image $image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --cpu 1 `
    --memory 512Mi `
    --timeout 300 `
    --set-env-vars $envArg

Write-Host ""
Write-Host "Deployment completed."
Write-Host "Use this URL in Google Apps Script CONFIG.endpointUrl: https://<service-url>/simulate"
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "API key is empty. Consider redeploying with -ApiKey for basic protection."
} else {
    Write-Host "Set the same key in Apps Script CONFIG.apiKey."
}
