# DaVinci Resolve automation on Windows

Blackmagic requires Resolve Studio for a Python script to control Resolve from PowerShell. In Studio, open **Preferences → System → General**, set **External Scripting Using** to **Local**, save and restart Resolve. If you use the free edition, first test the in-app Python console. The check reports whether that installation exposes the Resolve API there. Resolve must be open, and its Python bridge must support your installed 64-bit Python. The script uses the bridge shipped with Resolve and requires no pip packages. [Blackmagic Resolve Reference Manual](https://documents.blackmagicdesign.com/UserManuals/DaVinciResolveReferenceManual.pdf)

## Check the connection

Run these commands from the repository root. The check prints the detected installation and bridge paths, then reports the product name and version if Resolve accepts the connection.

```powershell
py tools/resolve/resolve_automation.py check
```

For an installation Windows can't locate automatically, pass `--install-dir 'D:\Apps\DaVinci Resolve'` before `check`. If the scripting files are also in a custom location, set `RESOLVE_SCRIPT_API` to the installed `Scripting` folder containing `Modules\DaVinciResolveScript.py`.

To check from inside Resolve, run the command below, then paste the printed line into **Workspace → Console** with **Py3** selected. If Py3 cannot start, check the Python requirements in the scripting README supplied with that Resolve installation.

```powershell
py tools/resolve/resolve_automation.py --console-command check
```

## Prepare a vertical edit

Select the intended project library and folder in Resolve before running the script. Give the project a new name and list your source videos in editing order. The script imports each source and places full clips end to end with their source audio. It defaults to a 1080 × 1920 timeline at 30 fps and accepts `--size` and `--fps` overrides.

```powershell
py tools/resolve/resolve_automation.py prepare `
  --project 'IRONMIND Draft 01' `
  --timeline 'Vertical assembly' `
  --output "$env:USERPROFILE\Videos\IRONMIND Draft 01.mp4" `
  'D:\Video\opening.mp4' 'D:\Video\app-demo.mp4' 'D:\Video\end-card.mp4'
```

For the console route, add `--console-command` before `prepare` and paste the printed line into the Py3 console. The script saves the project and queues a single MP4/H.264 job. Open the Edit page to review the cut and return to Deliver when you're ready to render. If you edit the timeline after queuing, replace the queued job with one using the updated edit. If the script reports a problem after creating the project, you can inspect that project in Resolve or retry with a fresh name.
