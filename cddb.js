function system(cmdline) {
  var process = new OS.Process(cmdline, { shell: true });
  return process.call();
}

function CDDB(host, port) {
  this.socket = new IO.Socket("internet", "stream");
  this.socket.connect(IO.SocketAddress.internet(host, port));
  this.buffered = new IO.Buffered(this.socket);

  this.readResponse(
    CDDB.expectCode(201));
  this.executeCommand(
    ["cddb", "hello", OS.Process.getenv("USER"),
     system("hostname --fqdn").trim(), "rip.js", "v1.0"],
    CDDB.expectCode(200));
  this.executeCommand(
    ["proto", "6"],
    CDDB.expectCode(201));
}

CDDB.prototype.readResponse = function () {
  var response = this.buffered.readln().trim();
  var match = /(\d+) ([\s\S]*)$/.exec(response);

  if (!match)
    throw Error(format("unexpected response: %r", response));

  return { code: parseInt(match[1]), message: match[2] };
}

CDDB.prototype.readLine = function () {
  var line = this.buffered.readln().trim();
  if (line == ".")
    return null;
  return line;
}

CDDB.prototype.executeCommand = function (args, callback) {
  this.socket.send(args.join(" ") + "\r\n");

  var response = this.readResponse();
  if (callback)
    return callback(response);
  else
    return response;
}

CDDB.expectCode = function (code, callback) {
  function checkCode(response) {
    if (code != response.code)
      throw Error(format("wrong code: wanted %d, got %r", code, response));
    if (callback)
      return callback(response);
    return response;
  }

  return checkCode;
}

CDDB.calculateDiscId = function (disc) {
  var checksum = 0;

  function sum(n) {
    var result = 0;
    while (n) {
      result += n % 10;
      n = Math.floor(n / 10);
    }
    return result;
  }

  disc.tracks.forEach(
    function (track) {
      var offset_seconds = Math.floor((track.firstSector + 150) / 75);
      checksum += sum(offset_seconds);
    });

  checksum &= 0xff;

  var total_sectors = disc.leadOutSector - disc.tracks[0].firstSector;
  var total_seconds = Math.floor(total_sectors / 75);
  var total_tracks = disc.tracks.length;
  var result = [format("%02x%04x%02x", checksum, total_seconds, total_tracks),
               total_tracks];

  disc.tracks.forEach(
    function (track) {
      result.push(track.firstSector + 150);
    });

  result.push(total_seconds + 4);

  return result;
}

CDDB.prototype.close = function () {
  this.executeCommand(["quit"], CDDB.expectCode(230));
  this.socket.shutdown("both");
  this.socket.close();
}

CDDB.prototype.getDiscInformation = function (disc) {
  var disc_id = CDDB.calculateDiscId(disc);

  var query_result = this.executeCommand(
    ["cddb", "query"].concat(disc_id),
    CDDB.expectCode(200));
  var match = /^([^ ]+)/.exec(query_result.message);
  var category = match[1];

  var read_result = this.executeCommand(
    ["cddb", "read", category, disc_id[0]],
    CDDB.expectCode(210));

  var information = {}, line;
  while (line = this.readLine()) {
    if (/^#/.test(line))
      continue;
    var match = /^(\w+)=(.*)$/.exec(line);
    if (match && match[2])
      information[match[1]] = match[2];
  }

  return information;
}

/*
scoped(new CDDB("freedb.freedb.org", 8880), function () {
  writeln("%r", this.getDiscInformation(new CDIO.Disc()));
});
*/
