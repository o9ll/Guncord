$dest = "C:\Users\o9\Documents\Githubb\Guncord\src\plugins"
$srcVencord = "C:\Users\o9\Desktop\vencord&equicord\vencord\src\plugins"
$srcEquicord = "C:\Users\o9\Desktop\vencord&equicord\equicord\src\plugins"

$destDirs = Get-ChildItem -Path $dest -Directory

$copiedCount = 0

foreach ($dir in $destDirs) {
    $pluginName = $dir.Name
    $srcPath = ""

    if (Test-Path "$srcVencord\$pluginName") {
        $srcPath = "$srcVencord\$pluginName"
    } elseif (Test-Path "$srcEquicord\$pluginName") {
        $srcPath = "$srcEquicord\$pluginName"
    }

    if ($srcPath -ne "") {
        Remove-Item -Path $dir.FullName -Recurse -Force
        Copy-Item -Path $srcPath -Destination $dest -Recurse -Force
        $copiedCount++
    }
}
