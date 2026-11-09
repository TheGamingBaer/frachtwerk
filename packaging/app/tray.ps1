# Frachtwerk – Symbol im Infobereich (neben der Uhr). Wird von Frachtwerk.exe unsichtbar gestartet.
param([int]$Port = 47842, [string]$Icon)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$base = "http://127.0.0.1:$Port"
$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8

function Send-Action([string]$name) {
  try { $c = New-Object System.Net.WebClient; [void]$c.UploadString("$base/tray/action?name=$name", 'POST', '') } catch { }
}

$ni = New-Object System.Windows.Forms.NotifyIcon
if ($Icon -and (Test-Path $Icon)) { $ni.Icon = New-Object System.Drawing.Icon($Icon) } else { $ni.Icon = [System.Drawing.SystemIcons]::Application }
$ni.Text = 'Frachtwerk'
$ni.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = New-Object System.Windows.Forms.ToolStripMenuItem('Frachtwerk öffnen')
$open.Font = New-Object System.Drawing.Font($open.Font, [System.Drawing.FontStyle]::Bold)
$open.add_Click({ Send-Action 'open' })
$map = New-Object System.Windows.Forms.ToolStripMenuItem('Live-Map')
$map.add_Click({ Send-Action 'map' })
$jobs = New-Object System.Windows.Forms.ToolStripMenuItem('Fahrtenbuch')
$jobs.add_Click({ Send-Action 'jobs' })
$status = New-Object System.Windows.Forms.ToolStripMenuItem('Starte …')
$status.Enabled = $false
$settings = New-Object System.Windows.Forms.ToolStripMenuItem('Status && Einstellungen')
$settings.add_Click({ Send-Action 'settings' })
$discord = New-Object System.Windows.Forms.ToolStripMenuItem('Discord-Status anzeigen')
$discord.add_Click({ Send-Action 'discord' })
$auto = New-Object System.Windows.Forms.ToolStripMenuItem('Mit Windows starten')
$auto.add_Click({ Send-Action 'autostart' })
$quit = New-Object System.Windows.Forms.ToolStripMenuItem('Beenden')
$quit.add_Click({ Send-Action 'quit' })
[void]$menu.Items.Add($open)
[void]$menu.Items.Add($map)
[void]$menu.Items.Add($jobs)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$menu.Items.Add($status)
[void]$menu.Items.Add($settings)
[void]$menu.Items.Add($discord)
[void]$menu.Items.Add($auto)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$menu.Items.Add($quit)
$ni.ContextMenuStrip = $menu
$ni.add_MouseClick({ param($s, $e) if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Send-Action 'open' } })
$ni.add_BalloonTipClicked({ Send-Action 'open' })

$script:fails = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.add_Tick({
  try {
    $s = $wc.DownloadString("$base/tray/state") | ConvertFrom-Json
    $script:fails = 0
    $tip = [string]$s.tooltip
    if ($tip.Length -gt 63) { $tip = $tip.Substring(0, 63) }
    $ni.Text = $tip
    $status.Text = [string]$s.status
    $auto.Checked = [bool]$s.autostart
    $discord.Checked = [bool]$s.discord
    foreach ($n in @($s.notifications)) {
      if ($n) { $ni.ShowBalloonTip(6000, [string]$n.title, [string]$n.text, [System.Windows.Forms.ToolTipIcon]::Info) }
    }
    if ($s.quit) { $timer.Stop(); $ni.Visible = $false; [System.Windows.Forms.Application]::Exit() }
  } catch {
    $script:fails++
    if ($script:fails -ge 6) { $timer.Stop(); $ni.Visible = $false; [System.Windows.Forms.Application]::Exit() }
  }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
$ni.Visible = $false
$ni.Dispose()
