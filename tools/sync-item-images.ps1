param(
  [string]$SheetCsvUrl = "https://docs.google.com/spreadsheets/d/1YSE23y_C5d89gnkpGNfNltN0UQ1sMazzDA0W7FweBRI/export?format=csv&gid=0",
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$itemsDir = Join-Path $ProjectRoot "assets/items"
$manifestPath = Join-Path $itemsDir "manifest.json"
New-Item -ItemType Directory -Force -Path $itemsDir | Out-Null

function U {
  param([int[]]$Codes)
  return (-join ($Codes | ForEach-Object { [char]$_ }))
}

function Get-RecordValue {
  param(
    [pscustomobject]$Record,
    [object[]]$Names
  )

  foreach ($name in $Names) {
    $key = [string]$name
    if ($Record.PSObject.Properties.Name -contains $key) {
      $value = [string]$Record.$key
      if ($value.Trim()) {
        return $value.Trim()
      }
    }
  }
  return ""
}

function Get-LocalImageFileName {
  param([string]$Name)

  $fileName = $Name.Trim()
  foreach ($char in [System.IO.Path]::GetInvalidFileNameChars()) {
    $fileName = $fileName.Replace([string]$char, "_")
  }
  return "$fileName.png"
}

function Get-ImageUrl {
  param([string]$Source)

  $source = $Source.Trim()
  if (!$source) {
    return ""
  }

  $driveMatch = [regex]::Match($source, "drive\.google\.com/file/d/([^/]+)")
  if (!$driveMatch.Success) {
    $driveMatch = [regex]::Match($source, "[?&]id=([^&]+)")
  }

  if ($driveMatch.Success -and $source.Contains("drive.google.com")) {
    return "https://drive.google.com/thumbnail?id=$([uri]::EscapeDataString($driveMatch.Groups[1].Value))&sz=w800"
  }

  if ($source -match "^https?://") {
    return $source
  }

  return ""
}

function Get-FileHashSafe {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path)) {
    return ""
  }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$hType = U @(0x985e, 0x578b)
$hCategory = U @(0x985e, 0x5225)
$hName = U @(0x540d, 0x7a31)
$hName2 = U @(0x540d, 0x5b57)
$hItem = U @(0x7269, 0x54c1)
$hStatus = U @(0x72c0, 0x614b)
$hStatusCard = U @(0x72c0, 0x614b, 0x5361)
$hIcon = U @(0x5716, 0x793a)
$hAsset = U @(0x7d20, 0x6750)
$hImage = U @(0x5716, 0x7247)

$manifest = @{}
if (Test-Path -LiteralPath $manifestPath) {
  try {
    $existing = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($entry in @($existing)) {
      if ($entry.name) {
        $manifest[$entry.name] = $entry
      }
    }
  } catch {
    Write-Warning "manifest.json could not be read; it will be rebuilt."
  }
}

$csvText = (Invoke-WebRequest -Uri $SheetCsvUrl -UseBasicParsing).Content
$records = $csvText | ConvertFrom-Csv
$nextManifest = New-Object System.Collections.Generic.List[object]
$downloaded = 0
$skipped = 0
$failed = 0

foreach ($record in $records) {
  $type = (Get-RecordValue $record @("type", $hType)).ToLowerInvariant()
  $category = Get-RecordValue $record @("category", $hCategory)
  $name = Get-RecordValue $record @("name", $hName, $hName2, $hItem, $hStatus)
  $source = Get-RecordValue $record @("icon", $hIcon, $hAsset, $hImage)

  if (!$name -or !$source) {
    continue
  }

  if ($type -in @("condition", "status", $hStatus, $hStatusCard) -or $category -in @($hStatus, $hStatusCard)) {
    continue
  }

  $imageUrl = Get-ImageUrl $source
  if (!$imageUrl) {
    continue
  }

  $fileName = Get-LocalImageFileName $name
  $relativePath = "assets/items/$fileName"
  $targetPath = Join-Path $itemsDir $fileName
  $previous = $manifest[$name]
  $shouldDownload = !(Test-Path -LiteralPath $targetPath) -or !$previous -or $previous.source -ne $source

  if ($shouldDownload) {
    try {
      Invoke-WebRequest -Uri $imageUrl -OutFile $targetPath -UseBasicParsing
      $downloaded++
    } catch {
      $failed++
      Write-Warning "Failed to download '$name' from '$source': $($_.Exception.Message)"
    }
  } else {
    $skipped++
  }

  $updatedAt = ""
  if ($shouldDownload) {
    $updatedAt = (Get-Date).ToString("o")
  } elseif ($previous -and $previous.updatedAt) {
    $updatedAt = $previous.updatedAt
  }

  $nextManifest.Add([pscustomobject]@{
    name = $name
    path = $relativePath
    source = $source
    resolvedUrl = $imageUrl
    sha256 = Get-FileHashSafe $targetPath
    updatedAt = $updatedAt
  }) | Out-Null
}

$nextManifest |
  Sort-Object name |
  ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "Downloaded: $downloaded"
Write-Host "Skipped: $skipped"
Write-Host "Failed: $failed"
Write-Host "Manifest: $manifestPath"
