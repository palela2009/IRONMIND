import argparse
import importlib
import os
from pathlib import Path
import sys


class ResolveError(RuntimeError):
    pass


def registered_installations():
    if os.name != "nt":
        return []

    import winreg

    locations = []
    uninstall_key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
    app_path_key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Resolve.exe"
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        for view in (winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY):
            access = winreg.KEY_READ | view
            try:
                with winreg.OpenKey(hive, app_path_key, 0, access) as entry:
                    executable, _ = winreg.QueryValueEx(entry, "")
                    locations.append(Path(executable.strip('"')).parent)
            except OSError:
                pass

            try:
                with winreg.OpenKey(hive, uninstall_key, 0, access) as entries:
                    for index in range(winreg.QueryInfoKey(entries)[0]):
                        try:
                            name = winreg.EnumKey(entries, index)
                            with winreg.OpenKey(entries, name, 0, access) as entry:
                                label, _ = winreg.QueryValueEx(entry, "DisplayName")
                                if label.startswith("DaVinci Resolve"):
                                    location, _ = winreg.QueryValueEx(entry, "InstallLocation")
                                    if location:
                                        locations.append(Path(location.strip('"')))
                        except OSError:
                            continue
            except OSError:
                continue
    return locations


def find_bridge(install_dir):
    explicit_library = os.getenv("RESOLVE_SCRIPT_LIB")
    candidates = [install_dir] if install_dir else []
    if explicit_library and not install_dir:
        candidates.append(Path(explicit_library).parent)

    if not install_dir:
        candidates.extend(registered_installations())
        for variable, suffix in (
            ("ProgramW6432", "Blackmagic Design/DaVinci Resolve"),
            ("ProgramFiles", "Blackmagic Design/DaVinci Resolve"),
            ("LOCALAPPDATA", "Programs/Blackmagic Design/DaVinci Resolve"),
        ):
            if os.getenv(variable):
                candidates.append(Path(os.environ[variable]) / suffix)

    install = next((p for p in candidates if p and (p / "Resolve.exe").is_file()), None)
    library = Path(explicit_library) if explicit_library else None
    if install and (install_dir or library is None):
        library = install / "fusionscript.dll"

    modules = []
    if os.getenv("RESOLVE_SCRIPT_API"):
        configured = Path(os.environ["RESOLVE_SCRIPT_API"])
        modules.extend((configured / "Modules", configured))
    if os.getenv("ProgramData"):
        modules.append(
            Path(os.environ["ProgramData"])
            / "Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting/Modules"
        )
    if install:
        modules.append(install / "Developer/Scripting/Modules")
    module = next((p for p in modules if (p / "DaVinciResolveScript.py").is_file()), None)
    return install, module, library


def connect(install_dir):
    if globals().get("resolve"):
        return globals()["resolve"], "Resolve console"
    console_bridge = globals().get("bmd")
    if console_bridge:
        connection = console_bridge.scriptapp("Resolve")
        if connection:
            return connection, "Resolve console"

    install, module, library = find_bridge(install_dir)
    print(f"Resolve installation: {install or 'not detected'}")
    if not module or not library or not library.is_file():
        raise ResolveError(
            "Resolve's scripting bridge was not found. Install Resolve, or supply "
            "--install-dir and the RESOLVE_SCRIPT_API path for a custom installation."
        )

    print(f"Scripting module: {module / 'DaVinciResolveScript.py'}")
    print(f"Scripting library: {library}")
    os.environ["RESOLVE_SCRIPT_API"] = str(module.parent if module.name == "Modules" else module)
    os.environ["RESOLVE_SCRIPT_LIB"] = str(library)
    sys.path.insert(0, str(module))
    try:
        sdk = importlib.import_module("DaVinciResolveScript")
        connection = sdk.scriptapp("Resolve")
    except (ImportError, OSError, AttributeError) as error:
        raise ResolveError(f"Python could not load the installed Resolve bridge: {error}") from error
    finally:
        sys.path.pop(0)

    if not connection:
        raise ResolveError(
            "The bridge loaded, but Resolve did not accept the connection. Open Resolve. "
            "For an external terminal in Studio, set Preferences > System > General > "
            "External Scripting Using to Local, then restart Resolve."
        )
    return connection, "external Python"


def dimensions(text):
    try:
        width, height = (int(value) for value in text.lower().split("x"))
        if width > 0 and height > 0 and width % 2 == 0 and height % 2 == 0:
            return width, height
    except ValueError:
        pass
    raise argparse.ArgumentTypeError("use WIDTHxHEIGHT with positive, even dimensions")


def media_and_output(args):
    media = [path.expanduser().resolve() for path in args.videos]
    missing = [str(path) for path in media if not path.is_file()]
    if missing:
        raise ResolveError("Input video file(s) missing: " + ", ".join(missing))
    output = args.output.expanduser().resolve()
    if output.suffix.lower() != ".mp4" or output.stem != output.stem.rstrip(". "):
        raise ResolveError("Specify an output filename ending in .mp4 without a trailing dot or space.")
    if any(character in output.name for character in '<>:"/\\|?*'):
        raise ResolveError(f"Invalid Windows output filename: {output.name}")
    if output.exists():
        raise ResolveError(f"Output already exists: {output}")
    return media, output


def require(result, message):
    if not result:
        raise ResolveError(message)
    return result


def set_project_dimensions(project, width, height, fps):
    for name, value in (
        ("timelineFrameRate", fps),
        ("timelineResolutionWidth", width),
        ("timelineResolutionHeight", height),
    ):
        project.SetSetting(name, str(value))
        actual = project.GetSetting(name)
        try:
            matches = float(actual) == value
        except (TypeError, ValueError):
            matches = False
        require(matches, f"Resolve did not apply project setting {name}={value}; reported {actual!r}.")


def select_mp4(project):
    codecs = project.GetRenderCodecs("mp4") or {}
    for label, codec in codecs.items():
        if any("h264" in value.lower().replace(".", "") for value in (label, codec)):
            if project.SetCurrentRenderFormatAndCodec("mp4", codec):
                return
    raise ResolveError("The installed edition or hardware did not offer MP4/H.264 rendering.")


def prepare_project(connection, manager, args, media, output):
    if args.project in (manager.GetProjectListInCurrentFolder() or []):
        raise ResolveError(f"Project already exists in this library folder: {args.project}")
    output.parent.mkdir(parents=True, exist_ok=True)
    project = require(manager.CreateProject(args.project), f"Could not create project {args.project!r}.")
    try:
        width, height = args.size
        set_project_dimensions(project, width, height, args.fps)
        pool = require(project.GetMediaPool(), "Could not access the Media Pool.")
        imported = {}
        for path in dict.fromkeys(media):
            clips = require(pool.ImportMedia([str(path)]), f"Resolve could not import {path}.")
            require(len(clips) == 1, f"Resolve returned more than one clip for {path}.")
            imported[path] = clips[0]

        timeline = require(
            pool.CreateTimelineFromClips(args.timeline, [imported[path] for path in media]),
            "Resolve could not create the timeline.",
        )
        require(project.SetCurrentTimeline(timeline), "Resolve could not select the new timeline.")
        video_items = timeline.GetItemListInTrack("video", 1) or []
        require(len(video_items) == len(media), "The timeline is missing one or more requested video clips.")
        require(manager.SaveProject(), "Resolve could not save the project.")

        require(connection.OpenPage("deliver"), "Resolve could not open the Deliver page.")
        select_mp4(project)
        require(project.SetCurrentRenderMode(1), "Resolve could not set Single Clip render mode.")
        require(
            project.SetRenderSettings({
                "SelectAllFrames": True,
                "ExportVideo": True,
                "ExportAudio": True,
                "FormatWidth": width,
                "FormatHeight": height,
                "FrameRate": args.fps,
                "TargetDir": str(output.parent),
                "CustomName": output.stem,
            }),
            "Resolve rejected the render settings.",
        )
        job = require(project.AddRenderJob(), "Resolve could not queue the render.")
        require(manager.SaveProject(), f"Job {job} was queued, but the project could not be saved again.")
    except ResolveError as error:
        raise ResolveError(f"Project {args.project!r} was created. {error}") from error

    print(f"Project: {args.project}")
    print(f"Timeline: {args.timeline} ({len(media)} clips, {width}x{height} at {args.fps} fps)")
    print(f"Queued render job: {job}")
    print(f"Output: {output}")


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = argparse.ArgumentParser(description="Check Resolve scripting or assemble and queue a video.")
    parser.add_argument("--install-dir", type=Path, help="folder containing Resolve.exe")
    parser.add_argument("--console-command", action="store_true", help="print a command for Resolve's Py3 console")
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("check", help="check the scripting connection without editing a project")
    edit = subcommands.add_parser("prepare", help="create a new project, assemble the clips and queue a render")
    edit.add_argument("--project", required=True, help="new project name in the current library folder")
    edit.add_argument("--timeline", default="Assembly", help="name of the new timeline")
    edit.add_argument("--output", required=True, type=Path, help="destination MP4 path")
    edit.add_argument("--size", type=dimensions, default=(1080, 1920), help="timeline size (default 1080x1920)")
    edit.add_argument("--fps", type=int, choices=(24, 25, 30, 48, 50, 60), default=30)
    edit.add_argument("videos", type=Path, nargs="+", help="input video paths in timeline order")
    args = parser.parse_args(argv)

    try:
        if args.command == "prepare":
            media, output = media_and_output(args)
            if args.console_command:
                argv = [
                    "prepare", "--project", args.project, "--timeline", args.timeline,
                    "--size", f"{args.size[0]}x{args.size[1]}", "--fps", str(args.fps),
                    "--output", str(output), "--", *map(str, media),
                ]
        if args.console_command:
            console_args = ["check"] if args.command == "check" else argv
            script = str(Path(__file__).resolve())
            print(
                f"import runpy; runpy.run_path({script!r}, "
                "init_globals={'resolve': globals().get('resolve'), 'bmd': globals().get('bmd')})"
                f"['main']({console_args!r})"
            )
            return 0

        connection, mode = connect(args.install_dir)
        manager = require(connection.GetProjectManager(), "Resolve connected, but the Project Manager is unavailable.")
        print(f"Connected via {mode}: {connection.GetProductName()} {connection.GetVersionString()}")
        if args.command == "prepare":
            prepare_project(connection, manager, args, media, output)
        return 0
    except (OSError, ResolveError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
