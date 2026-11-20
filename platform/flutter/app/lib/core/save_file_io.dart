import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

/// Grava e devolve o caminho do arquivo.
Future<String> saveBytes(Uint8List bytes, String name, {String mime = 'application/octet-stream'}) async {
  Directory? dir;
  try {
    dir = await getDownloadsDirectory();
  } catch (_) {}
  dir ??= await getApplicationDocumentsDirectory();
  final safe = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
  final file = File('${dir.path}${Platform.pathSeparator}$safe');
  await file.writeAsBytes(bytes, flush: true);
  return file.path;
}
