$lines = Get-Content package.json
$new = $lines[0..41] + $lines[43..($lines.Count-1)]
Set-Content -Path package.json -Value $new