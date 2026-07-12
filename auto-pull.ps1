param(
    [int]$Interval = 30
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$branch = (git branch --show-current).Trim()
$remote = (git remote get-url origin).Trim()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Git Auto-Pull Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Repo   : $remote" -ForegroundColor Gray
Write-Host "Branch : $branch" -ForegroundColor Gray
Write-Host "Interval: $Interval seconds" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

$checkCount = 0

while ($true) {
    $checkCount++
    $time = (Get-Date -Format "HH:mm:ss")

    try {
        git fetch origin --quiet 2>&1 | Out-Null

        $localHash  = (git rev-parse HEAD).Trim()
        $remoteHash = (git rev-parse "origin/$branch").Trim()

        if ($localHash -ne $remoteHash) {
            Write-Host ""
            Write-Host "[$time] New commits detected! Pulling..." -ForegroundColor Yellow

            $hasLocalChanges = -not [string]::IsNullOrWhiteSpace((git status --porcelain))
            if ($hasLocalChanges) {
                Write-Host "  -> Stashing local changes..." -ForegroundColor DarkYellow
                git stash push --include-untracked -m "auto-pull-$(Get-Date -Format 'yyyyMMdd-HHmmss')" | Out-Null
            }

            git pull --rebase origin $branch | Out-Null

            if ($hasLocalChanges) {
                git stash pop | Out-Null
                $conflicts = git diff --name-only --diff-filter=U 2>&1
                if (-not [string]::IsNullOrWhiteSpace($conflicts)) {
                    Write-Host "  -> [WARNING] Merge conflicts detected:" -ForegroundColor Red
                    Write-Host $conflicts -ForegroundColor Red
                } else {
                    Write-Host "  -> Local changes restored." -ForegroundColor DarkGreen
                }
            }

            $newCommits = git log --oneline "$localHash..HEAD" 2>&1
            if ($newCommits) {
                Write-Host "  -> New commits:" -ForegroundColor Cyan
                $newCommits -split "`n" | ForEach-Object { Write-Host "     $_" -ForegroundColor Cyan }
            }

            Write-Host "[$time] Pull complete! Refresh your browser to see changes." -ForegroundColor Green
            Write-Host ""

        } else {
            Write-Host "[$time] Up to date. (check #$checkCount)" -ForegroundColor DarkGray
        }

    } catch {
        Write-Host "[$time] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds $Interval
}
