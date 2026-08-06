# TITAN Bambu Studio Slicer Agent

The slicer agent lets TITAN use the real Bambu Studio CLI on a Windows, macOS,
or Linux computer. This is optional because Bambu Studio itself is not installed
inside the TITAN Docker container.

The official Bambu Studio CLI accepts STL/3MF inputs plus full machine, process,
and filament JSON profiles. TITAN reads filament weight and Bambu's model/total
time from the generated G-code header.

## Requirements

- Bambu Studio installed on the slicer computer.
- Node.js 22 or newer.
- The complete Project TITAN repository (for the `fflate` dependency).
- Full exported machine, process, and filament profiles. Inherited partial
  resource profiles are not sufficient for the CLI.
- A long random shared token.

Copy `profiles.example.json` to a private file outside the GitHub repository and
replace every path with the actual exported profile path.

## Windows PowerShell

```powershell
$env:BAMBU_STUDIO_CLI="C:\Program Files\Bambu Studio\bambu-studio.exe"
$env:BAMBU_PROFILE_MAP="C:\TITAN-Bambu-Profiles\profiles.json"
$env:TITAN_SLICER_TOKEN="PASTE_THE_SAME_LONG_RANDOM_TOKEN"
$env:PORT="1240"
node services/slicer-agent/server.mjs
```

Allow TCP port `1240` only from the TITAN server's LAN address. Do not expose the
slicer agent to the public internet.

## TITAN `.env`

```env
TITAN_SLICER_URL=http://SLICER_COMPUTER_LAN_IP:1240
TITAN_SLICER_TOKEN=PASTE_THE_SAME_LONG_RANDOM_TOKEN
```

Recreate the app container after changing `.env`.

## Accuracy

Results depend on the selected Bambu machine, nozzle, process, filament, support,
orientation, and arrangement settings. TITAN records the profile and slicing
time with the quote. Always review a draft quote before sending it.
