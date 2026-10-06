$lines = Get-Content package.json
$inDev = $false
$new = @()
foreach ($line in $lines) {
    if ($line -match '^\s*""devDependencies"":\s*{$') { $inDev = $true }
    if ($inDev -and $line -match '^\s*}\s*,?$') { $inDev = $false }
    if ($inDev -and $line -match '^\s*""vite"":\s*""^6\.2\.3"",') { continue }
    $new += $line
}
Set-Content -Path package.json -Value $new