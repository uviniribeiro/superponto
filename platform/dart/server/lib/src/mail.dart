// E-mail por SMTP. Em teste/desenvolvimento (`memory`), guarda as mensagens (e, se configurado, num arquivo JSONL).
import 'dart:convert';
import 'dart:io';

import 'package:mailer/mailer.dart' as m;
import 'package:mailer/smtp_server.dart';

import 'config.dart';

class OutgoingMail {
  OutgoingMail({required this.to, required this.subject, required this.text, required this.html});
  final String to, subject, text, html;
  Map<String, String> toJson() => {'to': to, 'subject': subject, 'text': text, 'html': html};
}

class MailService {
  MailService(this.config);
  final AppConfig config;
  final outbox = <OutgoingMail>[];

  Future<void> send(OutgoingMail mail) async {
    if (config.mailTransport == 'memory') {
      outbox.add(mail);
      final file = config.mailOutboxFile;
      if (file != null) File(file).writeAsStringSync('${jsonEncode(mail.toJson())}\n', mode: FileMode.append, flush: true);
      stdout.writeln('E-mail (memória) para ${mail.to}: ${mail.subject}');
      return;
    }
    final server = SmtpServer(
      config.smtpHost ?? 'localhost',
      port: config.smtpPort,
      ssl: config.smtpPort == 465,
      username: config.smtpUser,
      password: config.smtpPass,
    );
    final from = RegExp(r'^(.*)<([^>]+)>$').firstMatch(config.mailFrom.trim());
    final message = m.Message()
      ..from = from == null ? m.Address(config.mailFrom.trim()) : m.Address(from[2]!.trim(), from[1]!.trim())
      ..recipients.add(mail.to)
      ..subject = mail.subject
      ..text = mail.text
      ..html = mail.html;
    await m.send(message, server);
  }
}

String escapeHtml(String s) => s.replaceAllMapped(RegExp('[&<>"\']'), (x) => '&#${x[0]!.codeUnitAt(0)};');
