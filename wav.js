function startRIFFChunk(file, identifier, length) {
  file.write(identifier);

  var bytes = new Bytes(4);

  bytes[3] = length >>> 24;
  bytes[2] = (length >>> 16) & 0xff;
  bytes[1] = (length >>> 8) & 0xff;
  bytes[0] = length & 0xff;

  file.write(bytes);
}

function writeRIFFChunk(file, identifier, payload) {
  startRIFFChunk(file, identifier, payload.length);
  file.write(payload);
}

function writeWAVEHeader(file, data_length) {
  var payload_length = 4 + 24 + 8 + data_length;

  startRIFFChunk(file, "RIFF", payload_length);

  file.write("WAVE");

  var format = new Bytes(16);

  // Format code: 0x0001 (PCM)
  format[ 0] = 0x01;
  format[ 1] = 0x00;

  // Number of interleaved channels: 0x0002
  format[ 2] = 0x02;
  format[ 3] = 0x00;

  // Sampling rate: 0x0000ac44 (44.1 kHz)
  format[ 4] = 0x44;
  format[ 5] = 0xac;
  format[ 6] = 0x00;
  format[ 7] = 0x00;

  // Data rate: 0x0002b110 (176400 bytes/second)
  format[ 8] = 0x10;
  format[ 9] = 0xb1;
  format[10] = 0x02;
  format[11] = 0x00;

  // Data block size: 0x0008 (8 bytes)
  format[12] = 0x04;
  format[13] = 0x00;

  // Bits per sample: 0x0010 (16 bits)
  format[14] = 0x10;
  format[15] = 0x00;

  writeRIFFChunk(file, "fmt ", format);
  startRIFFChunk(file, "data", data_length);
}

function writeWAVE(file, stream, progress) {
  var bytes_read = 0;

  writeWAVEHeader(file, stream.length);

  while (true) {
    var bytes = stream.read(65536);
    if (!bytes)
      break;
    file.write(bytes);

    if (progress) {
      bytes_read += bytes.length;
      progress(bytes_read, stream.length);
    }
  }
}
