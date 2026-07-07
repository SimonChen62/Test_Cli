$ErrorActionPreference = "Stop"

param(
  [string]$Message = ""
)

function Stop-WithMessage($message) {
  Write-Host ""
  Write-Host $message -ForegroundColor Red
  Write-Host ""
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$branch = (git branch --show-current).Trim()
if (-not $branch) {
  Stop-WithMessage "当前目录不是有效 Git 分支。"
}

$remote = (git remote get-url origin).Trim()
Write-Host "Repository: $remote"
Write-Host "Branch: $branch"

Write-Host ""
Write-Host "Step 1/5: 暂存本地未提交改动，避免 pull 覆盖..."
$hasLocalChanges = -not [string]::IsNullOrWhiteSpace((git status --porcelain))
if ($hasLocalChanges) {
  git stash push --include-untracked -m "callilens-auto-sync"
}

Write-Host ""
Write-Host "Step 2/5: 拉取远端最新内容..."
git fetch origin
git pull --rebase origin $branch

Write-Host ""
Write-Host "Step 3/5: 恢复本地改动..."
if ($hasLocalChanges) {
  git stash pop
}

$conflicts = git diff --name-only --diff-filter=U
if (-not [string]::IsNullOrWhiteSpace($conflicts)) {
  Write-Host "发现冲突文件：" -ForegroundColor Yellow
  Write-Host $conflicts
  Stop-WithMessage "请先手动解决冲突，然后重新运行 .\sync-git.ps1"
}

Write-Host ""
Write-Host "Step 4/5: 检查是否有需要提交的改动..."
$changes = git status --porcelain
if ([string]::IsNullOrWhiteSpace($changes)) {
  Write-Host "没有本地改动需要提交。"
} else {
  if ([string]::IsNullOrWhiteSpace($Message)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "Update CalliLens demo ($timestamp)"
  }

  git add -A
  git commit -m $Message
}

Write-Host ""
Write-Host "Step 5/5: 推送到远端..."
git push origin $branch

Write-Host ""
Write-Host "同步完成。"

