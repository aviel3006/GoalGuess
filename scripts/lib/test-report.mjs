// Tiny test reporter shared by the scripts. Collects results, prints a
// colored summary, and decides the process exit code.
const C = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

export class Report {
  constructor(title) {
    this.title = title;
    this.results = [];
  }

  #push(status, name, detail) {
    this.results.push({ status, name, detail });
    const mark = {
      PASS: `${C.green}PASS${C.reset}`,
      FAIL: `${C.red}FAIL${C.reset}`,
      WARN: `${C.yellow}WARN${C.reset}`,
      SKIP: `${C.gray}SKIP${C.reset}`,
      INFO: `${C.cyan}INFO${C.reset}`,
    }[status];
    console.log(`  ${mark}  ${name}${detail ? `${C.gray} — ${detail}${C.reset}` : ''}`);
  }

  // A security check that is SUPPOSED to be blocked. Pass `blocked` = true
  // when the hostile action was correctly rejected.
  expectBlocked(name, blocked, detail) {
    if (blocked) this.#push('PASS', name, detail || 'correctly blocked');
    else this.#push('FAIL', name, detail || 'NOT blocked — hostile action succeeded');
  }

  // A functional check that is SUPPOSED to succeed.
  expectOk(name, ok, detail) {
    if (ok) this.#push('PASS', name, detail);
    else this.#push('FAIL', name, detail || 'expected success but it failed');
  }

  warn(name, detail) {
    this.#push('WARN', name, detail);
  }

  skip(name, detail) {
    this.#push('SKIP', name, detail);
  }

  info(name, detail) {
    this.#push('INFO', name, detail);
  }

  section(name) {
    console.log(`\n${C.bold}${name}${C.reset}`);
  }

  // Returns a process exit code: 1 if any FAIL, else 0.
  finish() {
    const count = (s) => this.results.filter((r) => r.status === s).length;
    const fails = count('FAIL');
    console.log(
      `\n${C.bold}${this.title}${C.reset}: ` +
        `${C.green}${count('PASS')} pass${C.reset}, ` +
        `${C.red}${fails} fail${C.reset}, ` +
        `${C.yellow}${count('WARN')} warn${C.reset}, ` +
        `${C.gray}${count('SKIP')} skip${C.reset}`
    );
    if (fails > 0) {
      console.log(`\n${C.red}${C.bold}Failures:${C.reset}`);
      for (const r of this.results.filter((x) => x.status === 'FAIL')) {
        console.log(`  ${C.red}- ${r.name}${C.reset}${r.detail ? ` (${r.detail})` : ''}`);
      }
    }
    return fails > 0 ? 1 : 0;
  }
}
