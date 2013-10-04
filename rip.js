Module.load("cddb.js");
Module.load("wav.js");
Module.load("argparse.js");

var disc_options = {};

var parser = new ArgumentParser();

parser.addArgument("--device", "-d");
parser.addArgument("--outdir", "-o", { defaultValue: OS.Process.getcwd() });
parser.addArgument("--performer", "-P");
parser.addArgument("--title", "-T");
parser.addArgument("--track", "-t", { action: "append" });
parser.addArgument("--paranoia", "-p", { action: "store_true" });

var result = parser.parseArguments();

if ("device" in result)
  disc_options.device = result.device;

if (!IO.File.isDirectory(result.outdir)) {
  writeln("No such directory: %s", result.outdir);
  OS.Process.exit(1);
}

var disc = new CDIO.Disc(disc_options);
var performer = null, album_title = null, tracks = null;

if ("performer" in result)
  performer = result.performer;
if ("title" in result)
  album_title = result.title;
if ("track" in result) {
  tracks = {};
  result.track.forEach(function (number) {
    tracks[parseInt(number) - 1] = true;
  });
}

var mode;

if (result.paranoia)
  mode = "paranoia";
else
  mode = "cdda";

var information;

scoped(new CDDB("freedb.freedb.org", 8880), function () {
  try {
    information = this.getDiscInformation(disc);

    var match = /^(.*) \/ (.*)$/.exec(information["DTITLE"]);

    performer = match[1];
    album_title = match[2];
  } catch (error) {
    writeln("CDDB lookup failed: %s", error.message);
  }
});

if (!performer || !album_title) {
  writeln("No performer/title: use --performer/--title to override, please.");
  OS.Process.exit(1);
}

writeln("Performer:   %s", performer);
writeln("Album title: %s", album_title);
writeln();

var performer_path = IO.Path.join(result.outdir, performer);
var album_path = IO.Path.join(performer_path, album_title);

if (!IO.File.isDirectory(performer_path)) {
  IO.File.mkdir(performer_path);
  if (!IO.File.isDirectory(album_path))
    IO.File.mkdir(album_path);
}

disc.tracks.forEach(function (track, index) {
  if (tracks && !(index in tracks))
    return;

  var track_title = information[format("TTITLE%d", index)];
  var track_filename = format("%02d - %s.wav", index + 1, track_title);

  scoped(new IO.File(IO.Path.join(album_path, track_filename), "w"), function () {
    var file = this;

    scoped(track.open(mode), function () {
      var stream = this;

      writeWAVE(file, stream, function (bytes_read, bytes_total) {
        write("\x1b[2K\rTrack %02d: %3.1f %%", index + 1, 100 * (bytes_read / bytes_total));
      });

      writeln("\x1b[2K\rTrack %02d: %s", index + 1, track_title);
    });
  });
});
