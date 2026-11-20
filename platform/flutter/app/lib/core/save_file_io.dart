import 'dart:io';
import 'dart:convert';
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

/// Grava o HTML para impressão (abra no navegador e imprima/salve em PDF).
Future<String> printHtml(String html, String name) => saveBytes(Uint8List.fromList(utf8.encode(html)), name, mime: 'text/html');
