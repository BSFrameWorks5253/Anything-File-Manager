$ErrorActionPreference = "Stop"

$repo = "BSFrameWorks5253/Anything-File-Manager"
$releaseId = "434178509"

# Extract token from environment or git remote url
$token = $env:GH_TOKEN
if (-not $token) {
    $remoteUrl = git remote get-url origin
    if ($remoteUrl -match 'https://([^@]+)@github\.com') {
        $token = $matches[1]
    }
}

if (-not $token) {
    Write-Error "No GitHub token found in GH_TOKEN or git remote origin URL."
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "PowerShell-AFM"
}

# 1. Ensure setup.exe is copied
Copy-Item -Path "release\Anything-File-Manager-Setup-V-26.11.8.exe" -Destination "release\setup.exe" -Force
Write-Host "Copied Anything-File-Manager-Setup-V-26.11.8.exe -> release\setup.exe"

# 2. Get current assets from release
$releaseUrl = "https://api.github.com/repos/$repo/releases/$releaseId"
$release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers

# Delete existing setup.exe and installer if already present
$targetNames = @("setup.exe", "Anything-File-Manager-Setup-V-26.11.8.exe")
foreach ($asset in $release.assets) {
    if ($targetNames -contains $asset.name) {
        Write-Host "Deleting old asset $($asset.name) (ID: $($asset.id))..."
        $deleteUrl = "https://api.github.com/repos/$repo/releases/assets/$($asset.id)"
        Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers
        Write-Host "Deleted $($asset.name)."
    }
}

# 3. Upload new assets
$uploadBase = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets"

foreach ($file in @("release\setup.exe", "release\Anything-File-Manager-Setup-V-26.11.8.exe")) {
    $fileName = [System.IO.Path]::GetFileName($file)
    $uploadUrl = "$uploadBase`?name=$fileName"
    Write-Host "Uploading $fileName ($((Get-Item $file).Length) bytes)..."

    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $file).Path)
    
    $uploadHeaders = @{
        "Authorization"  = "Bearer $token"
        "Content-Type"   = "application/octet-stream"
        "User-Agent"     = "PowerShell-AFM"
    }

    $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes
    Write-Host "Successfully uploaded $fileName (Asset ID: $($response.id), State: $($response.state))"
}

Write-Host "GitHub Release asset upload completed successfully!"
