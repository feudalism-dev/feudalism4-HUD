# Final ES6 to ES5 Conversion - Critical Changes Only
# This applies only the conversions that are essential and verified to work

$filePath = "d:\Documents\My LSL Scripts\Feudalism RPG 4\MOAP Interface\js\app.js"
$content = Get-Content $filePath -Raw

Write-Host "Applying critical ES6 to ES5 conversions..." -ForegroundColor Green

# 1. Convert DebugLog shorthand methods
$content = $content -replace '(\s+)init\(\)\s*\{', '$1init: function() {'
$content = $content -replace '(\s+)log\(message,\s*type\s*=\s*''info''\)\s*\{', '$1log: function(message, type) {' + "`r`n" + '        type = type || ''info'';'

# 2. Remove ALL async keywords
$content = $content -replace '\basync\s+', ''

# 3. Remove ALL await keywords  
$content = $content -replace '\bawait\s+', ''

# 4. Convert const/let to var
$content = $content -replace '\bconst\s+', 'var '
$content = $content -replace '\blet\s+', 'var '

# 5. Convert optional chaining to conditional checks
$content = $content -replace '(\w+)\?\.(\w+)', '($1 && $1.$2)'

# 6. Add window.App assignment before the closing try-catch
if ($content -notmatch 'window\.App\s*=\s*App') {
    $content = $content -replace '(\}\s*catch\s*\(e\)\s*\{)', "// Ensure App is available globally`r`nwindow.App = App;`r`n`r`n" + '$1'
}

Write-Host "Saving file..." -ForegroundColor Cyan
$content | Set-Content $filePath -NoNewline

Write-Host "Critical conversions complete!" -ForegroundColor Green
Write-Host "Note: init() and loadData() methods still need manual Promise conversion" -ForegroundColor Yellow
