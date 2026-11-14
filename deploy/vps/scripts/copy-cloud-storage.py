#!/usr/bin/env python3
"""
Copia os arquivos do Storage do Supabase Cloud (fotos de funcionários, logos, fotos de
marcação, exportações) para o Storage da VPS, mantendo buckets e caminhos.

Uso (na VPS, dentro de deploy/vps):
    ./scripts/copy-cloud-storage.py --source-url https://SEU_PROJETO.supabase.co \
        --source-key CHAVE_SERVICE_ROLE_DO_CLOUD

A chave service_role do Cloud fica em Configurações do projeto > API. O destino é lido do .env.
Arquivos já existentes no destino são sobrescritos; pode ser executado mais de uma vez.
Somente biblioteca padrão do Python 3.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PAGE = 1000


def read_env(path):
    values = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key] = value
    return values


class Storage:
    def __init__(self, base_url, key):
        self.base = base_url.rstrip("/") + "/storage/v1"
        self.headers = {"apikey": key, "Authorization": "Bearer " + key}

    def _request(self, method, path, body=None, headers=None, raw=False):
        req = urllib.request.Request(self.base + path, data=body, method=method)
        for k, v in {**self.headers, **(headers or {})}.items():
            req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
            return (data, resp.headers.get("Content-Type")) if raw else json.loads(data or b"null")

    def buckets(self):
        return self._request("GET", "/bucket")

    def list(self, bucket, prefix=""):
        offset = 0
        while True:
            body = json.dumps({"prefix": prefix, "limit": PAGE, "offset": offset,
                               "sortBy": {"column": "name", "order": "asc"}}).encode()
            items = self._request("POST", "/object/list/" + urllib.parse.quote(bucket), body,
                                  {"Content-Type": "application/json"}) or []
            for item in items:
                path = (prefix + "/" if prefix else "") + item["name"]
                if item.get("id") is None:  # pasta
                    yield from self.list(bucket, path)
                else:
                    yield path
            if len(items) < PAGE:
                return
            offset += PAGE

    def download(self, bucket, path):
        return self._request("GET", "/object/%s/%s" % (urllib.parse.quote(bucket), urllib.parse.quote(path)), raw=True)

    def upload(self, bucket, path, data, content_type):
        self._request("POST", "/object/%s/%s" % (urllib.parse.quote(bucket), urllib.parse.quote(path)), data,
                      {"Content-Type": content_type or "application/octet-stream", "x-upsert": "true"})

    def ensure_bucket(self, bucket):
        body = json.dumps({"id": bucket["id"], "name": bucket["name"], "public": bucket.get("public", False)}).encode()
        try:
            self._request("POST", "/bucket", body, {"Content-Type": "application/json"})
        except urllib.error.HTTPError as exc:
            if exc.code not in (400, 409):  # já existe
                raise


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parser = argparse.ArgumentParser(description="Copia o Storage do Supabase Cloud para a VPS")
    parser.add_argument("--source-url", required=True, help="URL do projeto no Cloud (https://xxxx.supabase.co)")
    parser.add_argument("--source-key", required=True, help="chave service_role do projeto no Cloud")
    parser.add_argument("--target-url", help="padrão: gateway local da VPS")
    parser.add_argument("--target-key", help="padrão: SERVICE_ROLE_KEY do .env")
    parser.add_argument("--bucket", action="append", help="copiar só este bucket (pode repetir)")
    args = parser.parse_args()

    env = read_env(os.path.join(here, ".env")) if os.path.exists(os.path.join(here, ".env")) else {}
    target_url = args.target_url or "http://127.0.0.1:%s" % env.get("API_GW_HTTP_PORT", "8000")
    target_key = args.target_key or env.get("SERVICE_ROLE_KEY")
    if not target_key:
        sys.exit("Chave do destino não encontrada (.env ou --target-key).")

    source, target = Storage(args.source_url, args.source_key), Storage(target_url, target_key)
    copied = failed = 0
    for bucket in source.buckets():
        if args.bucket and bucket["id"] not in args.bucket:
            continue
        target.ensure_bucket(bucket)
        print("Bucket %s" % bucket["id"])
        for path in source.list(bucket["id"]):
            try:
                data, ctype = source.download(bucket["id"], path)
                target.upload(bucket["id"], path, data, ctype)
                copied += 1
                if copied % 50 == 0:
                    print("  %d arquivos copiados..." % copied)
            except Exception as exc:  # segue com os demais
                failed += 1
                print("  falha em %s/%s: %s" % (bucket["id"], path, exc))
    print("Concluído: %d arquivo(s) copiado(s), %d falha(s)." % (copied, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
