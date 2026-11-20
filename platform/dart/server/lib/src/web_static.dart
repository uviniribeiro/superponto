// Serve o app Flutter (build web) na mesma origem da API, com rota de SPA (index.html para caminhos sem arquivo).
import 'dart:io';

import 'package:shelf/shelf.dart';

const _types = {
  'html': 'text/html; charset=utf-8',
  'js': 'text/javascript; charset=utf-8',
  'mjs': 'text/javascript; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'wasm': 'application/wasm',
  'otf': 'font/otf',
  'ttf': 'font/ttf',
  'woff2': 'font/woff2',
  'frag': 'application/octet-stream',
  'bin': 'application/octet-stream',
  'txt': 'text/plain; charset=utf-8',
};

bool isApiPath(String path) => path.startsWith('v1/') || path == 'v1' || path == 'health' || path.startsWith('docs') || path.startsWith('__test');

Handler webStatic(String dir, Handler api) {
  final root = Directory(dir).absolute.uri.normalizePath().toFilePath();
  final index = File('$root${Platform.pathSeparator}index.html');
  return (Request req) async {
    final path = req.url.path;
    if (isApiPath(path) || (req.method != 'GET' && req.method != 'HEAD')) return api(req);
    final decoded = Uri.decodeComponent(path);
    if (decoded.contains('..') || decoded.contains('\\') || decoded.contains('\x00')) return Response.notFound('');
    var file = File('$root${Platform.pathSeparator}$decoded');
    final isAsset = decoded.isNotEmpty && await file.exists();
    if (!isAsset) file = index;
    if (!await file.exists()) return Response.notFound('App web não encontrado');
    final ext = file.path.split('.').last.toLowerCase();
    final immutable = isAsset && (decoded.startsWith('assets/') || decoded.startsWith('canvaskit/'));
    return Response.ok(
      req.method == 'HEAD' ? null : file.openRead(),
      headers: {
        'content-type': _types[ext] ?? 'application/octet-stream',
        'content-length': '${await file.length()}',
        'cache-control': immutable ? 'public, max-age=604800' : 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        if (!isAsset || ext == 'html') 'x-frame-options': 'DENY',
      },
    );
  };
}
