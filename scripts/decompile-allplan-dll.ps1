param([string]$dllPath)

$asm = [System.Reflection.Assembly]::LoadFrom($dllPath)
Write-Host "=== $(Split-Path $dllPath -Leaf) ==="
Write-Host "Total types: $($asm.GetExportedTypes().Count)`n"

foreach ($t in $asm.GetExportedTypes() | Sort-Object FullName) {
    $isInternal = $t.FullName -like "*+*"
    if ($isInternal -and $t.FullName -notmatch "(delegate_proxy|ShowModalResult|e3D|BiegForm|SelectedView|OnAktiv|Inconsistent|HoehenbezugValidator)") { continue }
    
    Write-Host "--- $($t.FullName) ---" -ForegroundColor Yellow
    if ($t.BaseType -and $t.BaseType.FullName -ne "System.Object" -and $t.BaseType.FullName -ne "System.ValueType" -and $t.BaseType.FullName -ne "System.Enum") {
        Write-Host "  Base: $($t.BaseType.FullName)"
    }
    if ($t.IsEnum) { Write-Host "  [ENUM]" -ForegroundColor Cyan }
    if ($t.IsValueType -and !$t.IsEnum) { Write-Host "  [STRUCT]" -ForegroundColor Cyan }
    
    $methods = $t.GetMethods([System.Reflection.BindingFlags]"Public,Instance,DeclaredOnly")
    foreach ($m in $methods | Select-Object -First 15) {
        $paramStr = ($m.GetParameters() | % { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
        Write-Host "  $($m.ReturnType.Name) $($m.Name)($paramStr)"
    }
    if ($methods.Count -gt 15) { Write-Host "  ... +$($methods.Count - 15) more methods" }
    
    Write-Host ""
}