# QUICK DEPLOY: Deploy MOAP Interface files to PUBLIC repository (GitHub Pages)
# This script pushes MOAP Interface files WITHOUT images (for faster deployment)
# Use this for most deployments. Only use full deploy when images have changed.

Write-Host "QUICK DEPLOY: Deploying MOAP Interface files to PUBLIC repository (excluding images)..." -ForegroundColor Cyan

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "ERROR: Not in a git repository!" -ForegroundColor Red
    exit 1
}

# Get the current branch (we'll stay on it)
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow

# Check if pages remote exists
$pagesRemote = git remote get-url pages 2>$null
if (-not $pagesRemote) {
    Write-Host "ERROR: 'pages' remote not found!" -ForegroundColor Red
    Write-Host "Please add it with: git remote add pages https://github.com/feudalism-dev/feudalism4-HUD.git" -ForegroundColor Yellow
    exit 1
}

Write-Host "PUBLIC repo (pages): $pagesRemote" -ForegroundColor Yellow

# Create a temporary directory for the public repo worktree
$tempDir = Join-Path $env:TEMP "feudalism4-public-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

try {
    Write-Host "`nCreating temporary worktree..." -ForegroundColor Cyan
    git worktree add -f "$tempDir" pages/main 2>&1 | Out-Null
    
    if (-not $?) {
        # If worktree fails, try to checkout the branch directly in temp
        Write-Host "Worktree failed, trying alternative method..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "$tempDir" -ErrorAction SilentlyContinue
        git clone --branch main --single-branch "$pagesRemote" "$tempDir" 2>&1 | Out-Null
    }
    
    Write-Host "Copying MOAP Interface files (excluding images)..." -ForegroundColor Cyan
    
    # Copy all files from MOAP Interface to root of temp directory (EXCEPT images folder)
    $moapSource = "MOAP Interface"
    if (-not (Test-Path $moapSource)) {
        Write-Host "ERROR: MOAP Interface directory not found!" -ForegroundColor Red
        exit 1
    }
    
    # Copy all files and folders from MOAP Interface to root, excluding images
    Get-ChildItem "$moapSource" -Recurse | Where-Object {
        # Exclude images folder and its contents
        $_.FullName -notmatch '\\images\\' -and $_.Name -ne 'images'
    } | ForEach-Object {
        $relativePath = $_.FullName.Substring((Resolve-Path $moapSource).Path.Length + 1)
        $destPath = Join-Path $tempDir $relativePath
        
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        } else {
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item $_.FullName -Destination $destPath -Force
            Write-Host "  Copied: $relativePath" -ForegroundColor Gray
        }
    }
    
    Write-Host "`nCommitting changes..." -ForegroundColor Cyan
    Push-Location $tempDir
    try {
        git add -A
        $commitMessage = "QUICK UPDATE: MOAP Interface files (no images)`n`nDeployed from private repository branch: $currentBranch"
        git commit -m "$commitMessage" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Pushing to PUBLIC repository..." -ForegroundColor Cyan
            git push origin main
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nSuccessfully deployed to PUBLIC repository!" -ForegroundColor Green
                Write-Host "Note: Images were NOT updated. Use full deploy script if images changed." -ForegroundColor Yellow
            } else {
                Write-Host "`nFailed to push to PUBLIC repository" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "No changes to commit" -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }
    
} finally {
    Write-Host "`nCleaning up temporary directory..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "$tempDir" -ErrorAction SilentlyContinue
    git worktree prune 2>&1 | Out-Null
    Write-Host "Done!" -ForegroundColor Green
}
