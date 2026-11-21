// Renovação do login com exclusão mútua entre abas do navegador (evita que duas abas usem o mesmo refresh token).
export 'refresh_lock_io.dart' if (dart.library.js_interop) 'refresh_lock_web.dart';
