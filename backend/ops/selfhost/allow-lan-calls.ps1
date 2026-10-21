# One-time private-LAN access for the API, mediasoup worker and owned TURN relay.
# Run in an Administrator PowerShell. No public-profile or internet-wide rule is added.
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$fableRules = @(
    @{ Name = 'Fable-LAN-API'; Protocol = 'TCP'; Ports = '5000' },
    @{ Name = 'Fable-LAN-Calls-TCP'; Protocol = 'TCP'; Ports = @('3478', '40000-40100') },
    @{ Name = 'Fable-LAN-Calls-UDP'; Protocol = 'UDP'; Ports = @('3478', '40000-40100', '49160-49260') }
)
foreach ($fableRule in $fableRules) {
    $fableExisting = Get-NetFirewallRule -Name $fableRule.Name -ErrorAction SilentlyContinue
    if ($fableExisting) {
        if ($fableExisting.Group -ne 'Fable local calling') {
            throw "An unrelated rule uses $($fableRule.Name); it will not be changed."
        }
        Set-NetFirewallRule -Name $fableRule.Name -Enabled True -Profile Private -Direction Inbound -Action Allow
        Get-NetFirewallRule -Name $fableRule.Name | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet
        Get-NetFirewallRule -Name $fableRule.Name | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol $fableRule.Protocol -LocalPort $fableRule.Ports
    } else {
        New-NetFirewallRule -Name $fableRule.Name -DisplayName $fableRule.Name -Group 'Fable local calling' -Direction Inbound -Action Allow -Enabled True -Profile Private -Protocol $fableRule.Protocol -LocalPort $fableRule.Ports -RemoteAddress LocalSubnet | Out-Null
    }
}
Write-Output 'Fable call ports are allowed from the local subnet on Private networks.'
