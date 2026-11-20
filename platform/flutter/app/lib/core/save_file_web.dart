import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

Future<String> saveBytes(Uint8List bytes, String name, {String mime = 'application/octet-stream'}) async {
  final blob = web.Blob([bytes.toJS].toJS, web.BlobPropertyBag(type: mime));
  final url = web.URL.createObjectURL(blob);
  final a = web.HTMLAnchorElement()
    ..href = url
    ..download = name;
  web.document.body?.append(a);
  a.click();
  a.remove();
  web.URL.revokeObjectURL(url);
  return name;
}

/// Abre um documento HTML numa nova aba e chama a impressão (o navegador oferece "Salvar como PDF").
Future<String> printHtml(String html, String name) async {
  final blob = web.Blob([html.toJS].toJS, web.BlobPropertyBag(type: 'text/html;charset=utf-8'));
  final url = web.URL.createObjectURL(blob);
  web.window.open(url, '_blank');
  return name;
}
