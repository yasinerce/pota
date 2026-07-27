#!/usr/bin/env bash
# SRI hash üretici.
#
# NEDEN ELLE: cdnjs'in "Copy SRI hash" düğmesiyle verdiği değerin dosyayla
# eşleşmediğine dair açık hata kayıtları var (cdnjs/cdnjs#14124). Yanlış hash,
# hash olmamasından beterdir — tarayıcı kaynağı tamamen bloke eder. Kendin üret.
set -euo pipefail
URL="${1:-https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js}"
H=$(curl -sL "$URL" | openssl dgst -sha384 -binary | openssl base64 -A)
echo "integrity=\"sha384-$H\" crossorigin=\"anonymous\""
echo
echo "Tam etiket:"
echo "<script src=\"$URL\" integrity=\"sha384-$H\" crossorigin=\"anonymous\"></script>"
