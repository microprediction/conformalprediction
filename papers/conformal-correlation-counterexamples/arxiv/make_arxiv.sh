#!/bin/sh
# Build the arXiv submission: a single .tex with the journal-only declaration sections removed,
# the verification script as an ancillary file, and a zip ready to upload.
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re
s=open('ccc.tex').read()
# drop the journal-only sections; keep data availability (as Code) and the AI declaration
s=re.sub(r'\\section\*\{Declaration of competing interest\}.*?(?=\\section\*\{Data availability\})','',s,flags=re.S)
s=s.replace(r'\section*{Data availability}', r'\section*{Code}')
open('arxiv/ccc_arxiv.tex','w').write(s)
ab=re.search(r'\\begin\{abstract\}(.*?)\\end\{abstract\}',s,re.S).group(1).strip()
ab=re.sub(r'\\citet\{perlo2026\}','Perlo, Chiasserini, De Veciana and Malandrino (2026)',ab)
ab=re.sub(r'\\citep\{cotton2026\}','(Cotton 2026)',ab)
ab=re.sub(r'\s*\n\s*',' ',ab).replace(r'\%','%').replace('Cand\\`es','Candes')
open('arxiv/abstract.txt','w').write(ab+'\n')
PY
mkdir -p arxiv/anc && cp check_examples.py arxiv/anc/check_examples.py
cd arxiv && pdflatex -interaction=nonstopmode ccc_arxiv.tex >/dev/null && pdflatex -interaction=nonstopmode ccc_arxiv.tex > build.log 2>&1
echo "errors: $(grep -c '^!' build.log) undefined: $(grep -c 'undefined' build.log) pages: $(pdfinfo ccc_arxiv.pdf | awk '/Pages/{print $2}')"
rm -f build.log ccc_arxiv.aux ccc_arxiv.log ccc_arxiv.out
rm -f ccc_arxiv.zip && zip -q ccc_arxiv.zip ccc_arxiv.tex anc/check_examples.py && ls -la ccc_arxiv.zip | awk '{print $5, $9}'
