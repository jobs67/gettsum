param($out, $ms = 4000)
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.Form
$f.Text = 'GettsumTestForm'; $f.TopMost = $true; $f.StartPosition = 'CenterScreen'
$t = New-Object System.Windows.Forms.TextBox; $t.Width = 300; $t.Text = 'AB||CD'
$f.Controls.Add($t)
$f.Add_Shown({ $f.Activate(); $t.Focus(); $t.SelectionStart = 3; $t.SelectionLength = 0 })
$timer = New-Object System.Windows.Forms.Timer; $timer.Interval = $ms
$timer.Add_Tick({ [IO.File]::WriteAllText($out, $t.Text, [Text.Encoding]::UTF8); $f.Close() })
$timer.Start()
[void]$f.ShowDialog()
