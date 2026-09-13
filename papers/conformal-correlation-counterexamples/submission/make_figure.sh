#!/bin/sh
# Export Figure 1 (the TikZ coarsening chain) as a standalone PDF for the submission system.
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re
s=open('ccc.tex').read()
pre=s[:s.index(r'\begin{document}')]
fig=re.search(r'\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}',s,re.S).group(0)
pre=pre.replace(r'\documentclass[11pt]{article}', r'\documentclass{standalone}')
pre=re.sub(r'\\title\{.*?\\date\{[^}]*\}','',pre,flags=re.S)
pre=re.sub(r'\\usepackage\[margin=1in\]\{geometry\}','',pre)
# references inside the figure become plain labels
fig=fig.replace(r'Theorem~\ref{thm:nogo}','Theorem 1').replace(r'Example~\ref{ex:aps}','Example 1').replace(r'Observation~\ref{prop:law}','Observation 1')
open('submission/figure1.tex','w').write(pre+'\n\\begin{document}\n'+fig+'\n\\end{document}\n')
PY
cd submission && pdflatex -interaction=nonstopmode figure1.tex >/dev/null && rm -f figure1.aux figure1.log && echo "wrote submission/figure1.pdf"
