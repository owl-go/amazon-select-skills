param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$InstallerArgs
)
$ErrorActionPreference = 'Stop'
$installerPath = Join-Path $PSScriptRoot 'scripts/install_skills.py'
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python $installerPath @InstallerArgs
    exit $LASTEXITCODE
}
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 $installerPath @InstallerArgs
    exit $LASTEXITCODE
}
throw 'Python 3.8+ is required. Install Python and retry.'
