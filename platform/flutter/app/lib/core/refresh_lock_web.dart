import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// Web Locks API: só uma aba por vez renova o token; as outras esperam e leem o token novo.
Future<T> withRefreshLock<T>(Future<T> Function() f) async {
  final done = Completer<T>();
  JSPromise<JSAny?> granted(JSAny? _) => (() async {
    try {
      done.complete(await f());
    } catch (e, s) {
      done.completeError(e, s);
    }
    return null;
  })().toJS;
  try {
    await web.window.navigator.locks.request('superponto-refresh', granted.toJS).toDart;
  } catch (_) {
    // Navegador sem Web Locks: segue sem o bloqueio.
    if (!done.isCompleted) return f();
  }
  return done.future;
}
