param(
  [string]$TargetApiUrl = $env:TARGET_API_URL,
  [string]$ApiBearerToken = $env:API_BEARER_TOKEN,
  [Parameter(Mandatory = $true)]
  [string]$OutFile
)

if (-not $TargetApiUrl) { throw "TARGET_API_URL is required" }

$base = $TargetApiUrl.TrimEnd("/")
$headers = @{}
if ($ApiBearerToken) {
  $headers["Authorization"] = "Bearer $ApiBearerToken"
}

"check|result|http_status" | Set-Content -Path $OutFile

function Run-Check {
  param(
    [string]$Name,
    [string]$Path
  )

  try {
    $response = Invoke-WebRequest -Uri "$base$Path" -Headers $headers -Method Get -TimeoutSec 30
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
      "$Name|PASS|$($response.StatusCode)" | Add-Content -Path $OutFile
    } else {
      "$Name|FAIL|$($response.StatusCode)" | Add-Content -Path $OutFile
    }
  } catch {
    $statusCode = ""
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    "$Name|FAIL|$statusCode" | Add-Content -Path $OutFile
  }
}

Run-Check -Name "health" -Path "/health"
Run-Check -Name "bootstrap" -Path "/api/bootstrap"
Run-Check -Name "tasks" -Path "/api/tasks?paginated=true&limit=1&offset=0"
Run-Check -Name "documents" -Path "/api/documents?paginated=true&limit=1&offset=0"
Run-Check -Name "news" -Path "/api/news?paginated=true&limit=1&offset=0"

