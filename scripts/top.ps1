while ($true) {
    Clear-Host
    Write-Host "=== TOP PROCESSUS (Node/Python/Shell) ===" -ForegroundColor Cyan
    Get-Process | Where-Object { $_.Name -match 'node|python|powershell|pwsh|cmd' } | Sort-Object CPU -Descending | Select-Object Id, ProcessName, @{Name='CPU(s)';Expression={$_.CPU.ToString("N1")}}, @{Name='Mem(MB)';Expression={($_.WorkingSet/1MB).ToString("N0")}}, MainWindowTitle -First 15 | Format-Table -AutoSize
    Start-Sleep -Seconds 2
}
