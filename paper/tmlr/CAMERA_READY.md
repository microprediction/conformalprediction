# TMLR camera-ready de-anonymization

> **Submitted to TMLR on 2026-06-05.** Forum: https://openreview.net/forum?id=qvKkzxZe02
> (regular submission, anonymized PDF + `supplementary_material.zip`).

Apply these on acceptance, then recompile (`pdflatex; bibtex; pdflatex; pdflatex`).
Everything below is in `paper/tmlr/`. The submission (anonymous) version is the current state;
these edits flip it to the accepted, de-anonymized version.

## 1. Switch the style to accepted mode + add the OpenReview/date macros

In `marginally-useful.tex`, change

```
\usepackage{tmlr} % anonymous submission mode (authors auto-hidden)
```

to

```
\usepackage[accepted]{tmlr}
\def\month{MM}      % month of acceptance
\def\year{2026}     % year of acceptance
\def\openreview{\url{https://openreview.net/forum?id=qvKkzxZe02}}  % assigned forum id (submission #9532)
```

(For an arXiv/preprint posting instead, use `\usepackage[preprint]{tmlr}`.)

## 2. Restore the author block

```
\author{\name Anonymous \email anonymous@example.com \\
        \addr Anonymous Institution}
```

to

```
\author{\name Peter Cotton \email peter.cotton@microprediction.com \\
        \addr Microprediction}
```

## 3. Restore the real bibliography (un-anonymize the software citation)

The submission copy anonymized `cotton_timemachines`. Just overwrite with the main bib:

```
cp ../references.bib references.bib
```

## 4. Restore the reproducibility URLs

```
Code, figures, and an
interactive companion are provided as supplementary material; public URLs are omitted for
double-blind review.
```

to

```
All code, figures, and the interactive companion are at
\url{https://conformalprediction.net} (source:
\url{https://github.com/microprediction/conformalprediction}).
```

## 5. (Optional) Restore the named forecaster in Section "Exchangeability ..."

```
The same holds for an off-the-shelf probabilistic forecaster. A streaming online
forecaster that emits a predictive mean and standard deviation \citep{cotton_timemachines}
has the best non-oracle interval score
```

to

```
The same holds for an off-the-shelf probabilistic forecaster. The author's
\texttt{skaters} \citep{cotton_timemachines}, a streaming forecaster that emits a
predictive mean and standard deviation online, has the best non-oracle interval score
```

and, a few lines later,

```
volatility. The forecaster is deliberately simple (a fast moving average for the level
composed with a slow moving average of the
residuals for the spread), which sharpens the point:
```

to

```
volatility. The forecaster is deliberately simple (the \texttt{thinking\_fast\_and\_slow}
skater composes a fast moving average for the level with a slow moving average of the
residuals for the spread), which sharpens the point:
```

### 5b. Restore the named forecaster in Table 1 (the time-series benchmark)

The same anonymization renamed `skaters` to "Streaming forecaster" in three places in the
Table 1 (`tab:ts`) block. Restore them too, to match item 5. In the caption,

```
the method emits a density. Forecasters that model the conditional spread
(the streaming forecaster, EWMA-vol) lead on the proper score; conformalizing the best one re-levels
```

to

```
the method emits a density. Forecasters that model the conditional spread
(\texttt{skaters}, EWMA-vol) lead on the proper score; conformalizing the best one re-levels
```

and the two table rows,

```
Streaming forecaster (Gaussian)          & prob.  & 0.891 & 0.700 & \phantom{0}6.57  & 0.86 \\
```
```
Streaming forecaster + split conformal   & CP     & 0.602 & 0.204 & 11.95            & ---  \\
```

to

```
\texttt{skaters} (Gaussian)              & prob.  & 0.891 & 0.700 & \phantom{0}6.57  & 0.86 \\
```
```
\texttt{skaters} + split conformal       & CP     & 0.602 & 0.204 & 11.95            & ---  \\
```

(The "\quad + normalized conformal" row needs no change; it never named the forecaster.)
Sanity check after: `pdftotext marginally-useful.pdf - | grep -c skaters` should be 3.

## 6. (Optional) Acknowledgments / Author Contributions

The TMLR template allows unnumbered `\subsubsection*{Acknowledgments}` and
`\subsubsection*{Author Contributions}` before the bibliography; add only after acceptance.

## Verify

- Header should now read the title (not "Under review as submission to TMLR").
- `pdftotext marginally-useful.pdf - | grep -i "anonymous"` returns nothing.
- 0 undefined citations/references; figures present.
