"""Build the two HTML result tables for conformal-forecasting-rnn.html from
  (a) skaters/benchmarks/cfrnn_study_h10.csv   (FRED, CF-style vs laplace intervals)
  (b) results_covid_seed*.json                  (their COVID experiment rerun)
and splice them into the page in place of the {{FRED}} / {{COVID}} markers (or the
previously generated tables, delimited by <!-- FRED --> ... <!-- /FRED -->)."""
import csv, glob, json, os, re, sys, statistics as st
SK = os.path.expanduser("~/github/skaters/benchmarks/cfrnn_study_h10.csv")
COV = sys.argv[1] if len(sys.argv) > 1 else "."
PAGE = "conformal-forecasting-rnn.html"

def fred_table():
    rows = [{k: (float(v) if k != "series" else v) for k, v in r.items()} for r in csv.DictReader(open(SK))]
    N = len(rows); med = st.median
    def m(k): return sum(r[k] for r in rows) / N
    out = [f'<!-- FRED -->\n<p>The skaters benchmark harness runs laplace, a zero-dependency online distributional forecaster, on the FRED daily universe of change series. For this study every series gets laplace at horizon \\(H = 10\\), and at each origin two sets of intervals are built from the same point forecasts, laplace&rsquo;s predictive means. The CF intervals add the CF-RNN quantile of the last 500 resolved absolute residuals at each horizon. The laplace intervals are the quantiles of laplace&rsquo;s own predictive distribution at the same levels. Both are scored at \\(a = \\alpha/H = 0.01\\), the Bonferroni level with joint target 90%, and at \\(a = \\alpha = 0.1\\) per horizon. {N} series, a median of {med([r["n_origins"] for r in rows]):.0f} scored origins per series, scored on the most recent 2,000 changes after a 300-step warm-up. Scores are on each series&rsquo; own scale, so the table reports medians over series and the share of series on which each interval scores better.</p>\n',
           '<div class="tablewrap">\n<table class="phi">\n<tr><th>Level</th><th>Interval</th><th>Interval score, median over series</th><th>Width, median over series</th><th>Coverage per horizon</th><th>Joint coverage</th><th>Series where laplace scores better</th><th>Median score ratio CF / laplace</th></tr>']
    for lv, name in (("bonf", "\\(a = 0.01\\), joint target 90%"), ("marg", "\\(a = 0.1\\), per horizon 90%")):
        ratio = [r[f"CF_{lv}_is"] / r[f"LAP_{lv}_is"] for r in rows]
        wins = 100 * sum(x > 1 for x in ratio) / N
        for mth, label in (("CF", "constant width (CF-RNN)"), ("LAP", "laplace&rsquo;s own quantiles")):
            joint = f'{100*m(f"{mth}_joint_cov"):.1f}%' if lv == "bonf" else "&nbsp;"
            extra = f'<td rowspan="2">{wins:.0f}%</td><td rowspan="2">{med(ratio):.3f}</td>' if mth == "CF" else ""
            out.append(f'<tr><td>{name if mth=="CF" else ""}</td><td>{label}</td><td>{med([r[f"{mth}_{lv}_is"] for r in rows]):.3f}</td><td>{med([r[f"{mth}_{lv}_width"] for r in rows]):.3f}</td><td>{100*m(f"{mth}_{lv}_cov"):.1f}%</td><td>{joint}</td>{extra}</tr>')
    out.append("</table>\n</div>")
    lp = med([r["lap_logpdf"] for r in rows]); cr = med([r["lap_crps"] for r in rows])
    r1 = [r["CF_bonf_is_h1"] / r["LAP_bonf_is_h1"] for r in rows]; r10 = [r[f"CF_bonf_is_h10"] / r[f"LAP_bonf_is_h10"] for r in rows]
    out.append(f'<p>Per horizon at the Bonferroni level, the median score ratio is {med(r1):.3f} at \\(h = 1\\) and {med(r10):.3f} at \\(h = 10\\). The constant width over-covers at the joint level, {100*m("CF_joint_cov"):.1f}% against a 90% target, because ten Bonferroni intervals that never share a state cannot use the correlation between horizons. The same run also scores laplace as a density, at a median held-out log score of {lp:.2f} nats per observation. The constant-width interval has no density to score at all.</p>\n<!-- /FRED -->')
    return "\n".join(out)

def covid_table():
    files = sorted(f for f in glob.glob(os.path.join(COV, "results_covid_seed*.json")) if "partial" not in f)
    R = [json.load(open(f)) for f in files]
    if not R:
        return "<!-- COVID -->\n<p>(pending)</p>\n<!-- /COVID -->"
    n = len(R); k = R[0]["cfrnn_bonf_k"]; ncal = R[0]["cfrnn_n_cal"]
    allmax = all(r["cfrnn_bonf_eps_equals_max_residual"] for r in R)
    def agg(key, f):
        v = [r[key][f] for r in R]; return sum(v) / n, (st.pstdev(v) if n > 1 else 0.0)
    g = lambda k_, f: agg(k_, f)[0]
    per = lambda k_: [r[k_]["IS"] for r in R]
    q, cm, dp = per("QRNN"), per("CFRNN_marg"), per("DPRNN")
    q_best = sum(x < min(y, z) for x, y, z in zip(q, cm, dp))
    dp_beats = sum(x < y for x, y in zip(dp, cm))
    out = [f'<!-- COVID -->\n<p>We reran the COVID-19 experiment with the authors&rsquo; code and hyperparameters, an LSTM with embedding size 20 trained for 1,000 epochs, on daily cases for the {R[0]["n_areas"]} English lower-tier local authorities from the UK Health Security Agency API over the same 150-day window, 100 observed days and 50 to forecast, split {R[0]["split"][0]} training, {R[0]["split"][1]} calibration and {R[0]["split"][2]} test areas in the paper&rsquo;s proportions, over {n} random split{"s" if n>1 else ""}. All three methods share the architecture, the hyperparameters and the training areas, so the only difference between them is how the interval is built. The Bonferroni index is \\(\\lceil {ncal+1} \\times 0.998 \\rceil = {k} > {ncal}\\), and on every split every Bonferroni half-width equalled the largest calibration residual{"" if allmax else " (not on every split)"}. Every interval is scored at the level it claims. {"Means over splits, with standard deviations in parentheses." if n > 1 else ""}</p>',
           '<div class="tablewrap">\n<table class="phi">\n<tr><th>Interval, nominal level</th><th>Interval score</th><th>Width, mean</th><th>Coverage per horizon</th><th>Joint coverage over 50 horizons</th></tr>']
    rowsdef = [("CFRNN_bonf", "CF-RNN, Bonferroni, joint 90% (per horizon 99.8%)"),
               ("CFRNN_marg", "CF-RNN uncorrected, per horizon 90%"),
               ("QRNN", "MQ-RNN, per horizon 90%"),
               ("DPRNN", "DP-RNN, per horizon 90%")]
    sd = lambda v: f' ({v:,.0f})' if n > 1 else ''
    sdp = lambda v: f' ({100*v:.1f})' if n > 1 else ''
    for key, label in rowsdef:
        IS, ISs = agg(key, "IS"); W, _ = agg(key, "width"); C, _ = agg(key, "cov"); J, Js = agg(key, "joint")
        out.append(f'<tr><td>{label}</td><td>{IS:,.0f}{sd(ISs)}</td><td>{W:,.0f}</td><td>{100*C:.1f}%</td><td>{100*J:.1f}%{sdp(Js)}</td></tr>')
    out.append("</table>\n</div>")
    out.append(f'<p>The first row is the paper&rsquo;s method and it is the calibration maximum at every horizon. It reaches {100*g("CFRNN_bonf","joint"):.0f}% joint coverage against a 90% target, so by the paper&rsquo;s criterion it wins, and it costs an interval score of {g("CFRNN_bonf","IS"):,.0f} to get there.</p>')
    out.append(f'<p>The lower three rows all target 90% per horizon and can be compared with each other directly. MQ-RNN, which the paper reports as failing, has the best interval on {q_best} of the {n} split{"s" if n>1 else ""}: {g("QRNN","IS"):,.0f} on average against {g("CFRNN_marg","IS"):,.0f} for the uncorrected CF-RNN. Its coverage is {100*g("QRNN","cov"):.0f}% at a 90% target and the score still prefers it, because its misses are small. DP-RNN covers {100*g("DPRNN","cov"):.0f}% of the time, which the paper reads as total failure, and it still scores better than the uncorrected CF-RNN on {dp_beats} of {n} splits. The uncorrected CF-RNN interval adds a constant to the same LSTM point forecast that MQ-RNN refines with two trained quantiles, and the constant is what costs it.</p>')
    out.append("<!-- /COVID -->")
    return "\n".join(out)


s = open(PAGE).read()
for tag, fn in (("FRED", fred_table), ("COVID", covid_table)):
    new = fn()
    if "{{" + tag + "}}" in s:
        s = s.replace("{{" + tag + "}}", new)
    else:
        s = re.sub(r"<!-- " + tag + " -->.*?<!-- /" + tag + " -->", lambda m: new, s, flags=re.S)
open(PAGE, "w").write(s)
print("tables spliced")
