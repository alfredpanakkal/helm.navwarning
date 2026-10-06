$text = Get-Content package.json -Raw
$pattern = [regex]::Escape('    "vite": "^6.2.3",')
$matches = [regex]::Matches($text, $pattern)
if ($matches.Count -ge 2) {
    $match = $matches[$matches.Count-1]
    $newText = $text.Substring(0, $match.Index) + $text.Substring($match.Index + $match.Length)
    Set-Content -Path package.json -Value $newText
}