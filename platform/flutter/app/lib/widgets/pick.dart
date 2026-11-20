// Escolher um arquivo do aparelho e ler os bytes.
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

Future<(Uint8List, String)?> pickFile(List<String> extensions) async {
  final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: extensions);
  if (f == null) return null;
  return (await f.readAsBytes(), f.name);
}
