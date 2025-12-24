# Comprehensive ES6 to ES5 Async/Await Converter
# This script specifically handles async/await conversions

$filePath = "d:\Documents\My LSL Scripts\Feudalism RPG 4\MOAP Interface\js\app.js"
$content = Get-Content $filePath -Raw

Write-Host "Converting async/await patterns..." -ForegroundColor Green

# Remove all 'async ' keywords before function declarations
$content = $content -replace '\basync\s+([\w]+:?\s*function)', '$1'

# Add window.App assignment at the end if not present
if ($content -notmatch 'window\.App\s*=\s*App') {
    # Find the closing of the App object and add assignment
    $content = $content -replace '(\}\s*catch\s*\(e\)\s*\{[^}]+\}[^}]*\})\s*$', '$1' + "`r`n`r`n// Ensure App is available globally`r`nwindow.App = App;`r`n"
}

Write-Host "Saving file..." -ForegroundColor Cyan
$content | Set-Content $filePath -NoNewline

Write-Host "Async keyword removal complete!" -ForegroundColor Green
Write-Host "Note: await statements still need manual Promise conversion" -ForegroundColor Yellow
