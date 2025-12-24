# ES6 to ES5 Conversion Script for app.js
# This script converts ES6+ syntax to ES5 for Second Life MOAP browser compatibility

$filePath = "d:\Documents\My LSL Scripts\Feudalism RPG 4\MOAP Interface\js\app.js"
$content = Get-Content $filePath -Raw

Write-Host "Starting ES6 to ES5 conversion..." -ForegroundColor Green

# Track changes
$changeCount = 0

# 1. Convert template literals to string concatenation
# This is complex, so we'll handle simple cases
$templateLiteralPattern = '`([^`]*?\$\{[^}]+\}[^`]*?)`'
$matches = [regex]::Matches($content, $templateLiteralPattern)
Write-Host "Found $($matches.Count) template literals to convert" -ForegroundColor Yellow

# 2. Convert optional chaining to conditional checks
# species?.health_factor -> (species && species.health_factor)
$content = $content -replace '(\w+)\?\.(\w+)', '($1 && $1.$2)'
$changeCount++
Write-Host "Converted optional chaining operators" -ForegroundColor Cyan

# 3. Convert const/let to var (simple cases)
$content = $content -replace '\bconst\s+', 'var '
$content = $content -replace '\blet\s+', 'var '
$changeCount++
Write-Host "Converted const/let to var" -ForegroundColor Cyan

# 4. Convert arrow functions in simple cases
# () => { -> function() {
$content = $content -replace '\(\)\s*=>\s*\{', 'function() {'
# (e) => { -> function(e) {
$content = $content -replace '\((\w+)\)\s*=>\s*\{', 'function($1) {'
# (a, b) => { -> function(a, b) {
$content = $content -replace '\((\w+,\s*\w+)\)\s*=>\s*\{', 'function($1) {'
$changeCount++
Write-Host "Converted arrow functions" -ForegroundColor Cyan

# Save the file
$content | Set-Content $filePath -NoNewline
Write-Host "`nConversion complete! Made $changeCount types of changes." -ForegroundColor Green
Write-Host "File saved: $filePath" -ForegroundColor Green
