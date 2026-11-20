# SuperPonto — app Flutter

Um código para **web, Android, iOS, Windows, macOS e Linux**, com o visual liquid glass e os mesmos
tokens de cor e logo da identidade (tema escuro e claro).

## Rodar

```bash
flutter pub get
flutter run -d chrome --dart-define=API_URL=http://localhost:3000
```

- **Web**: por padrão usa a mesma origem que serviu o app. Em produção o servidor Dart serve o build
  (`flutter build web --release --no-web-resources-cdn`) apontando `WEB_DIR` para `build/web`.
- **Apps nativos**: o endereço da API vem do build (`--dart-define=API_URL=https://...`); na tela de login
  dá para trocar o servidor.

## Estrutura

- `lib/core`: cliente da API (Bearer + refresh rotativo, organização ativa), tokens do tema, vidro, logo,
  formatação brasileira, CSV.
- `lib/shell`: casco (barra lateral/gaveta) e menu por permissões.
- `lib/pages`: as 52 telas (mesmos caminhos da versão web).
- `assets/content`: manual e conformidade (gerados a partir de `apps/web/src/content`).

## Verificar

```bash
flutter analyze --fatal-infos
flutter test
```
