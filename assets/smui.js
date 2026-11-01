/* ============================================================
   SMUI runtime — vanilla JS port of the smui terminal kit
   (theme switch, retro progress, ascii bars, dot leaders,
    boot sequence, terminal cli). No dependencies.
   ============================================================ */
(function () {
    'use strict';

    var THEME_KEY = 'smui-theme';

    /* ---------- Theme ---------- */
    var Theme = {
        get: function () {
            return localStorage.getItem(THEME_KEY) || 'dark';
        },
        apply: function (t) {
            var root = document.documentElement;
            root.classList.toggle('dark', t === 'dark');
            root.style.colorScheme = t;
            localStorage.setItem(THEME_KEY, t);
        },
        toggle: function () {
            this.apply(this.get() === 'dark' ? 'light' : 'dark');
        },
        init: function () {
            // ?theme=dark|light overrides the stored preference (shareable links)
            var param = new URLSearchParams(location.search).get('theme');
            this.apply(param === 'light' || param === 'dark' ? param : this.get());
            document.querySelectorAll('.theme-btn').forEach(function (btn) {
                btn.addEventListener('click', function () { Theme.toggle(); });
            });
        }
    };

    /* ---------- Retro progress: [██████░░░░] 62% ---------- */
    function ramp(frac) {
        if (frac > 0.66) return '█';
        if (frac > 0.33) return '▓';
        if (frac > 0.10) return '▒';
        if (frac > 0.03) return '░';
        return '';
    }

    function renderRetro(el) {
        var value = Math.min(100, Math.max(0, parseFloat(el.dataset.value) || 0));
        var width = Math.max(4, parseInt(el.dataset.width || '18', 10));
        var pctText = el.dataset.pct != null ? el.dataset.pct : value + '%';
        var n = (value / 100) * width;
        var full = Math.round(n);
        var frac = ramp(n - full);
        var empty = Math.max(0, width - full - frac.length);
        var html =
            '<span class="rp-frame">[</span>' +
            '<span class="rp-fill">' + '█'.repeat(full) + frac + '</span>' +
            '<span class="rp-empty">' + '░'.repeat(empty) + '</span>' +
            '<span class="rp-frame">]</span> ' +
            '<span class="rp-pct">' + pctText + '</span>';
        if ('active' in el.dataset) html += ' <span class="rp-cursor">█</span>';
        el.innerHTML = html;
    }

    function renderAllRetro(scope) {
        (scope || document).querySelectorAll('.retro[data-value]').forEach(renderRetro);
    }

    /* ---------- Dot leaders ---------- */
    function fillDots(scope) {
        (scope || document).querySelectorAll('.leader-dots').forEach(function (el) {
            el.textContent = '.'.repeat(160);
        });
    }

    /* ---------- Shared metrics ---------- */
    // Source Code Pro's 0.6em advance quantizes to whole pixels (8px at 13px);
    // measure it live so charts and bars tile and fit exactly.
    function charW() {
        var s = document.createElement('span');
        s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;' +
            'font:400 13px "Source Code Pro", monospace';
        s.textContent = '██████████░░░░░░0123456789:/ ';
        document.body.appendChild(s);
        var w = s.getBoundingClientRect().width / s.textContent.length;
        s.remove();
        return w || 7.8;
    }

    /* ---------- ASCII bar chart ---------- */
    function renderChart(el) {
        var data;
        try {
            data = JSON.parse(el.dataset.chart);
        } catch (e) {
            return;
        }
        var labelLen = 0, valLen = 0, max = 0;
        data.forEach(function (d) {
            if (d.value > max) max = d.value;
            var l = d.label.length;
            if (l > labelLen) labelLen = l;
            var v = String(d.display != null ? d.display : d.value).length;
            if (v > valLen) valLen = v;
        });

        var width = el.dataset.width;
        if (width === 'auto' || el.dataset.autoWidth === '1') {
            el.dataset.autoWidth = '1';
            var cs = getComputedStyle(el);
            var avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            width = Math.max(6, Math.floor(avail / charW()) - labelLen - valLen - 3);
            el.dataset.width = width;
        } else {
            width = Math.max(4, parseInt(width || '20', 10));
        }

        var html = data.map(function (d) {
            var n = max > 0 ? (d.value / max) * width : 0;
            var full = Math.round(n);
            var frac = ramp(n - full);
            var empty = Math.max(0, width - full - frac.length);
            return (
                '<span class="ax-label">' + d.label.padEnd(labelLen, ' ') + '</span> ' +
                '<span class="ax-bar"' + (d.tone ? ' style="color:var(--aurora-' + d.tone + ')"' : '') + '>' +
                '█'.repeat(full) + frac + '</span>' +
                '<span class="ax-axis">' + '░'.repeat(empty) + '</span> ' +
                '<span class="ax-value">' + (d.display != null ? d.display : d.value) + '</span>'
            );
        }).join('\n');
        var axisLen = labelLen + 1 + width + 1 + valLen;
        el.innerHTML = html + '\n<span class="ax-axis">' + '└' + '─'.repeat(axisLen) + '┘</span>';
    }

    function renderAllCharts(scope) {
        (scope || document).querySelectorAll('.ascii[data-chart]').forEach(renderChart);
    }

    /* ---------- Boot sequence ---------- */
    function boot(el, lines) {
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var shown = false;
        try { shown = sessionStorage.getItem('smui-boot') === '1'; } catch (e) { shown = true; }

        function finish() {
            try { sessionStorage.setItem('smui-boot', '1'); } catch (e) { /* private mode */ }
            el.classList.add('done');
            setTimeout(function () { el.remove(); }, 500);
            document.removeEventListener('keydown', onKey);
        }

        function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
        }

        el.addEventListener('click', finish);
        document.addEventListener('keydown', onKey);

        if (reduced || shown) {
            finish();
            return;
        }

        el.hidden = false;
        var i = 0;
        (function next() {
            if (i >= lines.length) {
                setTimeout(finish, 500);
                return;
            }
            var line = lines[i++];
            var row = document.createElement('div');
            row.className = 'boot-line';
            if (line.ok) {
                row.innerHTML = escapeHtml(line.text) + ' <span class="ok">[ OK ]</span>';
            } else if (line.fail) {
                row.innerHTML = escapeHtml(line.text) + ' <span class="fail">[FAIL]</span>';
            } else {
                row.textContent = line.text;
            }
            el.insertBefore(row, el.querySelector('.skip'));
            setTimeout(next, line.delay || 130);
        })();
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- Terminal CLI ---------- */
    function cli(container, opts) {
        var prompt = opts.prompt || 'smui';
        var commands = opts.commands || {};

        commands.help = commands.help || {
            desc: 'list available commands',
            run: function () {
                var names = Object.keys(commands).sort();
                var width = names.reduce(function (m, n) { return Math.max(m, n.length); }, 0);
                return ['available commands:'].concat(names.map(function (n) {
                    return '  ' + n.padEnd(width + 2, ' ') + (commands[n].desc || '');
                }));
            }
        };
        commands.clear = commands.clear || {
            desc: 'clear the screen',
            run: function () { output.innerHTML = ''; return null; }
        };

        container.classList.add('cli');

        var output = document.createElement('div');
        output.className = 'cli-output';

        var row = document.createElement('div');
        row.className = 'cli-input-row';
        row.innerHTML =
            '<span class="prompt"></span>' +
            '<span class="cli-mirror"></span>' +
            '<span class="cli-cursor">█</span>' +
            '<input class="cli-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input">';
        container.appendChild(output);
        container.appendChild(row);

        var input = row.querySelector('.cli-input');
        var mirror = row.querySelector('.cli-mirror');
        row.querySelector('.prompt').textContent = prompt + ' >';
        container.addEventListener('click', function () { input.focus(); });

        function print(text, kind) {
            var line = document.createElement('div');
            line.className = 'cli-line';
            line.dataset.kind = kind || 'muted';
            line.textContent = text;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        }

        (opts.welcome || []).forEach(function (w) { print(w.text, w.kind); });

        var history = [];
        var hIdx = -1;

        function run(raw) {
            var line = raw.trim();
            print(prompt + ' > ' + line, 'echo');
            if (!line) return;
            history.push(line);
            hIdx = history.length;
            var parts = line.split(/\s+/);
            var name = parts[0].toLowerCase();
            var cmd = commands[name];
            if (!cmd) {
                print('command not found: ' + name + ' — type \'help\'', 'error');
                return;
            }
            var out = cmd.run(parts.slice(1));
            if (Array.isArray(out)) {
                out.forEach(function (l) {
                    if (typeof l === 'string') print(l, 'muted');
                    else print(l.text, l.kind);
                });
            } else if (typeof out === 'string') {
                print(out, 'muted');
            }
        }

        input.addEventListener('input', function () {
            mirror.textContent = input.value;
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                run(input.value);
                input.value = '';
                mirror.textContent = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (hIdx > 0) { hIdx--; input.value = history[hIdx] || ''; mirror.textContent = input.value; }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (hIdx < history.length) {
                    hIdx++;
                    input.value = history[hIdx] || '';
                    mirror.textContent = input.value;
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                var prefix = input.value.trim().toLowerCase();
                if (!prefix) return;
                var match = Object.keys(commands).filter(function (n) { return n.indexOf(prefix) === 0; });
                if (match.length === 1) {
                    input.value = match[0] + ' ';
                    mirror.textContent = input.value;
                } else if (match.length > 1) {
                    print(match.join('  '), 'muted');
                }
            }
        });
    }

    /* ---------- Export + init ---------- */
    window.SMUI = {
        theme: Theme,
        retro: renderAllRetro,
        chart: renderAllCharts,
        dots: fillDots,
        boot: boot,
        cli: cli,
        charW: charW
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        Theme.init();
        renderAllRetro();
        renderAllCharts();
        fillDots();

        // "go to top" links: the nav is sticky and always visible, so the
        // browser treats the #top anchor as already in view and never scrolls
        document.querySelectorAll('a[href="#top"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        // auto-width charts re-flow on resize and after the webfont swaps in
        var t;
        window.addEventListener('resize', function () {
            clearTimeout(t);
            t = setTimeout(function () {
                document.querySelectorAll('.ascii[data-chart]').forEach(renderChart);
            }, 150);
        });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                document.querySelectorAll('.ascii[data-chart]').forEach(renderChart);
            });
        }
    }
})();
