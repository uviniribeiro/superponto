import 'dart:async';
import 'dart:io';

import 'package:shelf/shelf_io.dart' as io;
import 'package:sp_server/sp_server.dart';
import 'package:sp_server/src/web_static.dart';

Future<void> main() async {
  final AppConfig config;
  try {
    config = AppConfig.load(Platform.environment);
  } on ConfigError catch (e) {
    stderr.writeln(e);
    exit(1);
  }
  final app = buildApp(config);
  final webDir = Platform.environment['WEB_DIR'];
  final handler = webDir == null || webDir.isEmpty ? app.handler : webStatic(webDir, app.handler);
  final server = await io.serve(handler, InternetAddress.anyIPv4, config.port);
  server.autoCompress = true;
  stdout.writeln('SuperPonto API (Dart) em ${config.apiUrl} — porta ${server.port}');
  late final StreamSubscription<ProcessSignal> a, b;
  Future<void> stop(ProcessSignal _) async {
    await a.cancel();
    await b.cancel();
    await server.close();
    await app.close();
    exit(0);
  }
  a = ProcessSignal.sigint.watch().listen(stop);
  b = ProcessSignal.sigterm.watch().listen(stop);
}
