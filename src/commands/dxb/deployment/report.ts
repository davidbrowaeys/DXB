import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org } from '@salesforce/core';
import * as xml2js from 'xml2js';

export type DeploymentReportResult = { reportPath?: string; report?: string; success: boolean };

interface DeploymentComponent {
  componentType: string;
  fullName: string;
  success: boolean;
  problem?: string;
  lineNumber?: number;
  created: boolean;
  changed: boolean;
  deleted: boolean;
}

interface TestResult {
  name: string;
  methodName: string;
  outcome: string;
  message?: string;
  time: number;
}

interface CodeCoverage {
  name: string;
  type: string;
  numLocations: number;
  numLocationsNotCovered: number;
  coveragePercent: number;
}

interface CodeAnalyzerViolation {
  rule: string;
  engine: string;
  severity: number;
  file: string;
  startLine: number;
  message: string;
  resources: string;
  codeSnippet?: string;
}

interface RunTestResult {
  numTestsRun: number;
  numFailures: number;
  totalTime: number;
  successes?: TestResult[];
  failures?: TestResult[];
  codeCoverage?: CodeCoverage[];
}

interface DeploymentDetails {
  componentSuccesses?: DeploymentComponent[];
  componentFailures?: DeploymentComponent[];
  runTestResult?: RunTestResult;
  codeAnalyzerViolations?: CodeAnalyzerViolation[];
}

interface DeploymentResult {
  id: string;
  status: string;
  success: boolean;
  done: boolean;
  numberComponentsTotal: number;
  numberComponentsDeployed: number;
  numberComponentErrors: number;
  numberTestsTotal: number;
  numberTestsCompleted: number;
  numberTestErrors: number;
  startDate?: string;
  completedDate?: string;
  details?: DeploymentDetails;
  errorMessage?: string;
}

interface JUnitTestCase {
  name: string;
  classname: string;
  time: number;
  failure?: { message: string };
  error?: { message: string };
}

interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testCases: JUnitTestCase[];
}

interface CoberturaClass {
  name: string;
  filename: string;
  lineRate: number;
  linesValid: number;
  linesCovered: number;
}

interface PackageType {
  name: string;
  members: string[];
}

interface PackageXmlData {
  version: string;
  types: PackageType[];
  totalMembers: number;
}

interface ReportData {
  title: string;
  gen: string;
  id: string;
  status: string;
  success: boolean;
  sc: string;
  sb: string;
  dur: string;
  tc: number;
  dc: number;
  fc: number;
  cs: DeploymentComponent[];
  cf: DeploymentComponent[];
  hcf: boolean;
  ht: boolean;
  tt: number;
  pt: number;
  ft: number;
  tsr: string;
  ts: TestResult[];
  tf: TestResult[];
  htf: boolean;
  ic: boolean;
  cp: string;
  cc: string;
  cov: CodeCoverage[];
  hc: boolean;
  c75: number;
  c50: number;
  c0: number;
  err?: string;
  he: boolean;
  hca: boolean;
  tv: number;
  cv: CodeAnalyzerViolation[];
  hv: CodeAnalyzerViolation[];
  mv: CodeAnalyzerViolation[];
  lv: CodeAnalyzerViolation[];
  ccnt: number;
  hcnt: number;
  mcnt: number;
  lcnt: number;
  pkg?: PackageXmlData;
  hpkg: boolean;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'deployment.report');

function createEmptyResult(): DeploymentResult {
  return {
    id: 'local-' + String(Date.now()),
    status: 'Completed',
    success: true,
    done: true,
    numberComponentsTotal: 0,
    numberComponentsDeployed: 0,
    numberComponentErrors: 0,
    numberTestsTotal: 0,
    numberTestsCompleted: 0,
    numberTestErrors: 0,
    startDate: new Date().toISOString(),
    completedDate: new Date().toISOString(),
    details: {
      componentSuccesses: [],
      componentFailures: [],
      runTestResult: {
        numTestsRun: 0,
        numFailures: 0,
        totalTime: 0,
        successes: [],
        failures: [],
        codeCoverage: [],
      },
      codeAnalyzerViolations: [],
    },
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function parseJUnitFile(fp: string): Promise<JUnitTestSuite[]> {
  if (!fs.existsSync(fp)) {
    throw messages.createError('error.fileNotFound', [fp]);
  }
  try {
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const content = fs.readFileSync(fp, 'utf-8');
    const result = await parser.parseStringPromise(content);

    let suites = result.testsuites?.testsuite ?? result.testsuite;
    if (!suites) return [];
    if (!Array.isArray(suites)) suites = [suites];

    return suites.map(
      (su: {
        name?: string;
        tests?: string;
        failures?: string;
        errors?: string;
        time?: string;
        testcase?: unknown;
      }): JUnitTestSuite => {
        let cases = su.testcase as Array<{
          name?: string;
          classname?: string;
          time?: string;
          failure?: unknown;
          error?: unknown;
        }>;
        if (!cases) cases = [];
        if (!Array.isArray(cases)) cases = [cases];

        const testsCount = parseInt(su.tests ?? '0', 10);
        const failuresCount = parseInt(su.failures ?? '0', 10);
        const errorsCount = parseInt(su.errors ?? '0', 10);
        const timeValue = parseFloat(su.time ?? '0');

        return {
          name: su.name ?? '',
          tests: testsCount || cases.length,
          failures: failuresCount,
          errors: errorsCount,
          time: timeValue,
          testCases: cases.map((tc) => ({
            name: tc.name ?? '',
            classname: tc.classname ?? su.name ?? '',
            time: parseFloat(tc.time ?? '0'),
            failure: tc.failure
              ? {
                  message:
                    typeof tc.failure === 'string'
                      ? tc.failure
                      : (tc.failure as { message?: string }).message ?? '',
                }
              : undefined,
            error: tc.error
              ? {
                  message:
                    typeof tc.error === 'string' ? tc.error : (tc.error as { message?: string }).message ?? '',
                }
              : undefined,
          })),
        };
      }
    );
  } catch (e) {
    throw messages.createError('error.invalidJunit', [(e as Error).message]);
  }
}

async function parseCoberturaFile(fp: string): Promise<CoberturaClass[]> {
  if (!fs.existsSync(fp)) {
    throw messages.createError('error.fileNotFound', [fp]);
  }
  try {
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const content = fs.readFileSync(fp, 'utf-8');
    const result = await parser.parseStringPromise(content);
    const cov = result.coverage;
    if (!cov) return [];

    let pkgs = cov.packages?.package ?? cov.package;
    if (!pkgs) {
      const cls = cov.classes?.class;
      if (cls) {
        pkgs = [{ class: cls }];
      } else {
        return [];
      }
    }
    if (!Array.isArray(pkgs)) pkgs = [pkgs];

    const classes: CoberturaClass[] = [];
    for (const p of pkgs) {
      let cl = p.classes?.class ?? p.class;
      if (!cl) continue;
      if (!Array.isArray(cl)) cl = [cl];

      for (const c of cl) {
        const lr = parseFloat(c['line-rate']) || 0;
        let lv = 0;
        let lc = 0;

        if (c.lines?.line) {
          let ln = c.lines.line;
          if (!Array.isArray(ln)) ln = [ln];
          lv = ln.length;
          lc = ln.filter((l: { hits: string }) => parseInt(l.hits, 10) > 0).length;
        } else {
          lv = 100;
          lc = Math.round(lr * 100);
        }

        classes.push({
          name: c.name ?? '',
          filename: c.filename ?? '',
          lineRate: lr,
          linesValid: lv,
          linesCovered: lc,
        });
      }
    }
    return classes;
  } catch (e) {
    throw messages.createError('error.invalidCobertura', [(e as Error).message]);
  }
}

async function parsePackageXmlFile(fp: string): Promise<PackageXmlData | undefined> {
  if (!fs.existsSync(fp)) {
    return undefined;
  }
  try {
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const content = fs.readFileSync(fp, 'utf-8');
    const result = await parser.parseStringPromise(content);
    const pkg = result.Package;
    if (!pkg) return undefined;

    const version = pkg.version ?? '';
    let types = pkg.types;
    if (!types) return { version, types: [], totalMembers: 0 };
    if (!Array.isArray(types)) types = [types];

    const packageTypes: PackageType[] = [];
    let totalMembers = 0;

    for (const t of types) {
      const name = t.name ?? '';
      let members = t.members;
      if (!members) members = [];
      if (!Array.isArray(members)) members = [members];
      
      packageTypes.push({
        name,
        members: members.map((m: string) => String(m)),
      });
      totalMembers += members.length;
    }

    return {
      version,
      types: packageTypes.sort((a, b) => a.name.localeCompare(b.name)),
      totalMembers,
    };
  } catch {
    return undefined;
  }
}

function getCodeSnippet(filePath: string, lineNumber: number, contextLines: number = 2): string | undefined {
  try {
    // Try to find the file - it might be relative or absolute
    let resolvedPath = filePath;
    
    // If the path doesn't exist as-is, try to find it relative to cwd
    if (!fs.existsSync(resolvedPath)) {
      // Try common Salesforce project paths
      const possiblePaths = [
        filePath,
        path.join(process.cwd(), filePath),
        // Handle paths that might start with force-app or similar
        filePath.replace(/^.*?(force-app)/, '$1'),
        path.join(process.cwd(), filePath.replace(/^.*?(force-app)/, '$1')),
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          resolvedPath = p;
          break;
        }
      }
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return undefined;
    }
    
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length) {
      return undefined;
    }
    
    // Get lines around the error (with context)
    const startLine = Math.max(1, lineNumber - contextLines);
    const endLine = Math.min(lines.length, lineNumber + contextLines);
    
    const snippetLines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineContent = lines[i - 1];
      const isErrorLine = i === lineNumber;
      const lineNum = String(i).padStart(4, ' ');
      
      if (isErrorLine) {
        snippetLines.push(`→ ${lineNum} │ ${lineContent}`);
      } else {
        snippetLines.push(`  ${lineNum} │ ${lineContent}`);
      }
    }
    
    return snippetLines.join('\n');
  } catch {
    return undefined;
  }
}

function parseCodeAnalyzerFile(fp: string): CodeAnalyzerViolation[] {
  if (!fs.existsSync(fp)) {
    throw messages.createError('error.fileNotFound', [fp]);
  }
  try {
    const lines = fs.readFileSync(fp, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]);
    const ruleIdx = headers.indexOf('rule');
    const engineIdx = headers.indexOf('engine');
    const severityIdx = headers.indexOf('severity');
    const fileIdx = headers.indexOf('file');
    const lineIdx = headers.indexOf('startLine');
    const messageIdx = headers.indexOf('message');
    const resourcesIdx = headers.indexOf('resources');

    const violations: CodeAnalyzerViolation[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCsvLine(lines[i]);
      if (vals.length < headers.length) continue;

      const filePath = fileIdx >= 0 ? vals[fileIdx] : '';
      const startLine = lineIdx >= 0 ? parseInt(vals[lineIdx], 10) || 0 : 0;
      
      // Try to read the code snippet from the source file
      const codeSnippet = filePath && startLine > 0 ? getCodeSnippet(filePath, startLine) : undefined;

      violations.push({
        rule: ruleIdx >= 0 ? vals[ruleIdx] : '',
        engine: engineIdx >= 0 ? vals[engineIdx] : '',
        severity: severityIdx >= 0 ? parseInt(vals[severityIdx], 10) || 5 : 5,
        file: filePath,
        startLine,
        message: messageIdx >= 0 ? vals[messageIdx] : '',
        resources: resourcesIdx >= 0 ? vals[resourcesIdx] : '',
        codeSnippet,
      });
    }
    return violations;
  } catch (e) {
    throw messages.createError('error.invalidCodeAnalyzer', [(e as Error).message]);
  }
}

function mergeJUnitResults(d: DeploymentResult, suites: JUnitTestSuite[]): DeploymentResult {
  const successes: TestResult[] = [];
  const failures: TestResult[] = [];
  let totalTests = 0;
  let totalFailures = 0;
  let totalTime = 0;

  for (const s of suites) {
    totalTests += s.tests;
    totalFailures += s.failures + s.errors;
    totalTime += s.time;

    for (const tc of s.testCases) {
      const tr: TestResult = {
        name: tc.classname,
        methodName: tc.name,
        outcome: tc.failure ?? tc.error ? 'Fail' : 'Pass',
        time: tc.time * 1000,
        message: tc.failure?.message ?? tc.error?.message,
      };
      if (tc.failure ?? tc.error) {
        failures.push(tr);
      } else {
        successes.push(tr);
      }
    }
  }

  d.numberTestsTotal += totalTests;
  d.numberTestsCompleted += totalTests;
  d.numberTestErrors += totalFailures;

  if (!d.details) d.details = {};
  if (!d.details.runTestResult) {
    d.details.runTestResult = {
      numTestsRun: 0,
      numFailures: 0,
      totalTime: 0,
      successes: [],
      failures: [],
      codeCoverage: [],
    };
  }

  d.details.runTestResult.numTestsRun += totalTests;
  d.details.runTestResult.numFailures += totalFailures;
  d.details.runTestResult.totalTime += totalTime * 1000;
  d.details.runTestResult.successes = [...(d.details.runTestResult.successes ?? []), ...successes];
  d.details.runTestResult.failures = [...(d.details.runTestResult.failures ?? []), ...failures];

  if (totalFailures > 0) {
    d.success = false;
    d.status = 'Failed';
  }

  return d;
}

function mergeCoberturaResults(d: DeploymentResult, classes: CoberturaClass[]): DeploymentResult {
  const cov: CodeCoverage[] = classes.map((c) => {
    let name = c.name;
    if (c.filename) {
      const match = c.filename.match(/([^/\\]+)\.cls$/);
      if (match) name = match[1];
    }
    return {
      name,
      type: 'ApexClass',
      numLocations: c.linesValid,
      numLocationsNotCovered: c.linesValid - c.linesCovered,
      coveragePercent: Math.round(c.lineRate * 1000) / 10,
    };
  });

  if (!d.details) d.details = {};
  if (!d.details.runTestResult) {
    d.details.runTestResult = {
      numTestsRun: 0,
      numFailures: 0,
      totalTime: 0,
      successes: [],
      failures: [],
      codeCoverage: [],
    };
  }

  d.details.runTestResult.codeCoverage = [...(d.details.runTestResult.codeCoverage ?? []), ...cov];
  return d;
}

function mergeCodeAnalyzerResults(
  d: DeploymentResult,
  violations: CodeAnalyzerViolation[]
): DeploymentResult {
  if (!d.details) d.details = {};
  d.details.codeAnalyzerViolations = [...(d.details.codeAnalyzerViolations ?? []), ...violations];
  return d;
}

function loadResultFromFile(fp: string): DeploymentResult {
  if (!fs.existsSync(fp)) {
    throw messages.createError('error.fileNotFound', [fp]);
  }
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    return normalizeResult(JSON.parse(content) as Record<string, unknown>);
  } catch (e) {
    throw messages.createError('error.invalidJson', [(e as Error).message]);
  }
}

interface RawTestResult {
  name?: string;
  methodName?: string;
  outcome?: string;
  message?: string;
  time?: number;
}

interface RawComponent {
  componentType?: string;
  type?: string;
  fullName?: string;
  filePath?: string;
  name?: string;
  success?: boolean;
  problem?: string;
  lineNumber?: number;
  created?: boolean;
  changed?: boolean;
  deleted?: boolean;
}

interface RawCoverage {
  name?: string;
  type?: string;
  numLocations?: number;
  numLocationsNotCovered?: number;
  coveragePercent?: number;
}

function normalizeResult(r: Record<string, unknown>): DeploymentResult {
  const d = (r.result as Record<string, unknown>) ?? r;

  let cov: CodeCoverage[] = [];
  const details = d.details as Record<string, unknown> | undefined;
  const runTestResult = details?.runTestResult as Record<string, unknown> | undefined;
  const directRunTestResult = d.runTestResult as Record<string, unknown> | undefined;

  const rc = runTestResult?.codeCoverage ?? directRunTestResult?.codeCoverage;
  if (rc) {
    const arr = Array.isArray(rc) ? rc : [rc];
    cov = arr.map((c: RawCoverage) => {
      const nl = c.numLocations ?? 0;
      const nn = c.numLocationsNotCovered ?? 0;
      return {
        name: c.name ?? '',
        type: c.type ?? 'ApexClass',
        numLocations: nl,
        numLocationsNotCovered: nn,
        coveragePercent: c.coveragePercent !== undefined ? c.coveragePercent : nl > 0 ? Math.round(((nl - nn) / nl) * 1000) / 10 : 0,
      };
    });
  }

  const mapTest = (t: RawTestResult, outcome: string): TestResult => ({
    name: t.name ?? '',
    methodName: t.methodName ?? '',
    outcome: t.outcome ?? outcome,
    message: t.message,
    time: t.time ?? 0,
  });

  const rawSuccesses = runTestResult?.successes ?? directRunTestResult?.successes;
  const testSuccesses = rawSuccesses
    ? (Array.isArray(rawSuccesses) ? rawSuccesses : [rawSuccesses]).map((t: RawTestResult) => mapTest(t, 'Pass'))
    : [];

  const rawFailures = runTestResult?.failures ?? directRunTestResult?.failures;
  const testFailures = rawFailures
    ? (Array.isArray(rawFailures) ? rawFailures : [rawFailures]).map((t: RawTestResult) => mapTest(t, 'Fail'))
    : [];

  const rtr = runTestResult ?? directRunTestResult;

  const normalizeComponents = (cs: unknown): DeploymentComponent[] => {
    if (!Array.isArray(cs)) return [];
    return cs.map((c: RawComponent) => ({
      componentType: c.componentType ?? c.type ?? '',
      fullName: c.fullName ?? c.filePath ?? c.name ?? '',
      success: c.success ?? !c.problem,
      problem: c.problem,
      lineNumber: c.lineNumber,
      created: c.created ?? false,
      changed: c.changed ?? false,
      deleted: c.deleted ?? false,
    }));
  };

  const componentSuccesses = details?.componentSuccesses ?? d.deployedSource ?? [];
  const componentFailures = details?.componentFailures ?? d.deploymentErrors ?? [];

  return {
    id: (d.id as string) ?? (d.deployId as string) ?? 'unknown',
    status: (d.status as string) ?? 'Unknown',
    success: (d.success as boolean) ?? d.status === 'Succeeded',
    done: (d.done as boolean) ?? true,
    numberComponentsTotal: (d.numberComponentsTotal as number) ?? (d.numberComponentsDeployed as number) ?? 0,
    numberComponentsDeployed: (d.numberComponentsDeployed as number) ?? 0,
    numberComponentErrors: (d.numberComponentErrors as number) ?? 0,
    numberTestsTotal: (d.numberTestsTotal as number) ?? (rtr?.numTestsRun as number) ?? 0,
    numberTestsCompleted: (d.numberTestsCompleted as number) ?? (rtr?.numTestsRun as number) ?? 0,
    numberTestErrors: (d.numberTestErrors as number) ?? (rtr?.numFailures as number) ?? 0,
    startDate: d.startDate as string | undefined,
    completedDate: d.completedDate as string | undefined,
    details: {
      componentSuccesses: normalizeComponents(componentSuccesses),
      componentFailures: normalizeComponents(componentFailures),
      runTestResult: rtr
        ? {
            numTestsRun: (rtr.numTestsRun as number) ?? 0,
            numFailures: (rtr.numFailures as number) ?? 0,
            totalTime: (rtr.totalTime as number) ?? 0,
            successes: testSuccesses,
            failures: testFailures,
            codeCoverage: cov,
          }
        : undefined,
      codeAnalyzerViolations: [],
    },
    errorMessage: d.errorMessage as string | undefined,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function prepareReportData(r: DeploymentResult, title: string, incCov: boolean, pkgData?: PackageXmlData): ReportData {
  const tr = r.details?.runTestResult;
  const cov = tr?.codeCoverage ?? [];
  const sortedCov = [...cov].sort((a, b) => a.coveragePercent - b.coveragePercent);
  const totalLines = cov.reduce((s, c) => s + c.numLocations, 0);
  const coveredLines = cov.reduce((s, c) => s + (c.numLocations - c.numLocationsNotCovered), 0);
  const coveragePercent = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

  const dur =
    r.startDate && r.completedDate
      ? formatDuration(new Date(r.completedDate).getTime() - new Date(r.startDate).getTime())
      : 'N/A';

  const violations = r.details?.codeAnalyzerViolations ?? [];
  const criticalViolations = violations.filter((x) => x.severity === 1);
  const highViolations = violations.filter((x) => x.severity === 2);
  const mediumViolations = violations.filter((x) => x.severity === 3);
  const lowViolations = violations.filter((x) => x.severity >= 4);

  return {
    title,
    gen: new Date().toISOString(),
    id: r.id,
    status: r.status,
    success: r.success,
    sc: r.success ? 'success' : 'failure',
    sb: r.success ? '✅' : '❌',
    dur,
    tc: r.numberComponentsTotal,
    dc: r.numberComponentsDeployed,
    fc: r.numberComponentErrors,
    cs: r.details?.componentSuccesses ?? [],
    cf: r.details?.componentFailures ?? [],
    hcf: (r.details?.componentFailures?.length ?? 0) > 0,
    ht: (r.numberTestsTotal ?? 0) > 0,
    tt: r.numberTestsTotal,
    pt: r.numberTestsCompleted - r.numberTestErrors,
    ft: r.numberTestErrors,
    tsr: r.numberTestsTotal > 0 ? (((r.numberTestsCompleted - r.numberTestErrors) / r.numberTestsTotal) * 100).toFixed(1) : '0',
    ts: tr?.successes ?? [],
    tf: tr?.failures ?? [],
    htf: (tr?.failures?.length ?? 0) > 0,
    ic: incCov,
    cp: coveragePercent.toFixed(1),
    cc: coveragePercent >= 75 ? 'success' : coveragePercent >= 50 ? 'warning' : 'failure',
    cov: sortedCov,
    hc: sortedCov.length > 0,
    c75: sortedCov.filter((c) => c.coveragePercent >= 75).length,
    c50: sortedCov.filter((c) => c.coveragePercent >= 50 && c.coveragePercent < 75).length,
    c0: sortedCov.filter((c) => c.coveragePercent < 50).length,
    err: r.errorMessage,
    he: !!r.errorMessage,
    hca: violations.length > 0,
    tv: violations.length,
    cv: criticalViolations,
    hv: highViolations,
    mv: mediumViolations,
    lv: lowViolations,
    ccnt: criticalViolations.length,
    hcnt: highViolations.length,
    mcnt: mediumViolations.length,
    lcnt: lowViolations.length,
    pkg: pkgData,
    hpkg: !!pkgData && pkgData.types.length > 0,
  };
}

function getHtmlCss(): string {
  return ':root{--s:#28a745;--f:#dc3545;--w:#ffc107;--p:#007bff;--bg:#f8f9fa;--b:#dee2e6;--cr:#7b1fa2;--hi:#dc3545;--me:#ff9800;--lo:#2196f3}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#333;background:var(--bg);padding:20px}.c{max-width:1200px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);overflow:hidden}.h{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:25px}.h h1{font-size:22px;margin-bottom:8px}.st{display:inline-block;padding:6px 14px;border-radius:20px;font-weight:700;margin-top:12px}.st.success{background:var(--s)}.st.failure{background:var(--f)}.su{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;padding:15px;background:#f1f3f4}.sc{background:#fff;padding:10px;border-radius:6px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.1)}.sc .v{font-size:20px;font-weight:700;color:var(--p)}.sc .l{color:#666;font-size:9px;margin-top:3px}.sc.success .v{color:var(--s)}.sc.failure .v{color:var(--f)}.sc.warning .v{color:var(--w)}.se{padding:15px;border-bottom:1px solid var(--b)}.se h2{font-size:16px;margin-bottom:12px;color:#444}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:6px;text-align:left;border-bottom:1px solid var(--b)}th{background:#f8f9fa;font-weight:600;color:#555}.bd{display:inline-block;padding:2px 5px;border-radius:3px;font-size:9px;font-weight:500}.bd-s{background:#d4edda;color:#155724}.bd-f{background:#f8d7da;color:#721c24}.bd-w{background:#fff3cd;color:#856404}.bd-cr{background:#e1bee7;color:#4a148c}.bd-hi{background:#ffcdd2;color:#b71c1c}.bd-me{background:#ffe0b2;color:#e65100}.bd-lo{background:#bbdefb;color:#0d47a1}.eb{background:#f8d7da;border:1px solid #f5c6cb;border-radius:6px;padding:10px;margin:6px 0}.eb .m{color:#721c24;font-family:monospace;font-size:10px;white-space:pre-wrap;max-height:100px;overflow-y:auto}.pb{height:6px;background:#e9ecef;border-radius:3px;overflow:hidden}.pb .fl{height:100%}.pb .fl.success{background:var(--s)}.pb .fl.warning{background:var(--w)}.pb .fl.failure{background:var(--f)}.cb{display:flex;align-items:center;gap:5px}.cb .br{flex:1;height:12px;background:#e9ecef;border-radius:3px;overflow:hidden}.cb .br .fl{height:100%}.cb .pc{min-width:35px;text-align:right;font-weight:700;font-size:10px}.ft{padding:15px;text-align:center;color:#666;font-size:11px;background:#f8f9fa}.tc{max-height:400px;overflow-y:auto}.fb{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center}.fb label{font-size:11px;color:#555}.fb select,.fb input{font-size:11px;padding:4px 8px;border:1px solid var(--b);border-radius:4px}.fb input[type=text]{width:180px}.cnt{font-size:10px;color:#666;margin-left:8px}.ca-su{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:15px}.ca-card{padding:12px;border-radius:6px;text-align:center;cursor:pointer;transition:all .2s;border:2px solid transparent}.ca-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}.ca-card.active{border-color:#333}.ca-card .ca-v{font-size:24px;font-weight:700}.ca-card .ca-l{font-size:10px;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}.ca-card.cr{background:linear-gradient(135deg,#f3e5f5,#e1bee7)}.ca-card.cr .ca-v{color:#7b1fa2}.ca-card.cr .ca-l{color:#7b1fa2}.ca-card.hi{background:linear-gradient(135deg,#ffebee,#ffcdd2)}.ca-card.hi .ca-v{color:#c62828}.ca-card.hi .ca-l{color:#c62828}.ca-card.me{background:linear-gradient(135deg,#fff3e0,#ffe0b2)}.ca-card.me .ca-v{color:#e65100}.ca-card.me .ca-l{color:#e65100}.ca-card.lo{background:linear-gradient(135deg,#e3f2fd,#bbdefb)}.ca-card.lo .ca-v{color:#1565c0}.ca-card.lo .ca-l{color:#1565c0}.ca-row{border-left:4px solid #ccc}.ca-row.sev-1{border-left-color:#7b1fa2;background:#fce4ec}.ca-row.sev-2{border-left-color:#c62828;background:#ffebee}.ca-row.sev-3{border-left-color:#e65100;background:#fff3e0}.ca-row.sev-4,.ca-row.sev-5{border-left-color:#1565c0;background:#e3f2fd}.ca-msg{font-size:10px;color:#555;margin-top:4px;font-style:italic}.ca-code{background:#2d2d2d;color:#f8f8f2;padding:8px 12px;border-radius:4px;font-family:Consolas,Monaco,monospace;font-size:11px;margin-top:6px;overflow-x:auto;white-space:pre}.ca-code .ln{color:#6272a4;margin-right:12px;user-select:none}.ca-code .hl{background:#44475a;display:block;margin:0 -12px;padding:0 12px}.ca-search{margin-bottom:12px}.ca-search input{width:100%;padding:8px 12px;border:1px solid var(--b);border-radius:4px;font-size:12px}';
}

function getHtmlJs(): string {
  return `function filterCov(){var f=document.getElementById("covFilter").value;document.querySelectorAll("#covTable tr").forEach(function(r){if(r.dataset.cov){var c=parseFloat(r.dataset.cov);r.style.display=(f==="all"||(f==="75"&&c>=75)||(f==="50"&&c>=50&&c<75)||(f==="0"&&c<50))?"":"none"}})}
function filterCA(){var active=document.querySelectorAll(".ca-card.active");var sevs=[];active.forEach(function(c){sevs.push(c.dataset.sev)});var q=(document.getElementById("caSearch")?document.getElementById("caSearch").value:"").toLowerCase();document.querySelectorAll("#caTable tr[data-sev]").forEach(function(r){var sev=r.dataset.sev;var txt=r.textContent.toLowerCase();var sevMatch=sevs.length===0||sevs.includes(sev);var txtMatch=!q||txt.includes(q);r.style.display=(sevMatch&&txtMatch)?"":"none"});updateCACount()}
function toggleCACard(el){el.classList.toggle("active");filterCA()}
function updateCACount(){var visible=document.querySelectorAll("#caTable tr[data-sev]:not([style*='display: none'])").length;var cnt=document.getElementById("caCount");if(cnt)cnt.textContent=visible}
function expandRow(btn){var row=btn.closest("tr");var detail=row.nextElementSibling;if(detail&&detail.classList.contains("ca-detail")){detail.style.display=detail.style.display==="none"?"table-row":"none";btn.textContent=detail.style.display==="none"?"+":"-"}}
function expandPkg(btn){var row=btn.closest("tr");var detail=row.nextElementSibling;if(detail&&detail.classList.contains("pkg-detail")){detail.style.display=detail.style.display==="none"?"table-row":"none";btn.textContent=detail.style.display==="none"?"+":"-"}}
function expandAllPkg(expand){document.querySelectorAll(".pkg-detail").forEach(function(d){d.style.display=expand?"table-row":"none"});document.querySelectorAll(".pkg-expand-btn").forEach(function(b){b.textContent=expand?"-":"+"})}`;
}

function generateHtmlReport(d: ReportData): string {
  const css = getHtmlCss();
  const js = getHtmlJs();

  let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  h += `<title>${d.title}</title><style>${css}</style></head><body><div class="c">`;
  // ============================================
  // SECTION 1: HEADER & SUMMARY
  // ============================================
  h += `<div class="h"><h1>${d.title}</h1>`;
  h += `<div style="opacity:.9;font-size:12px"><div>ID: ${d.id}</div><div>Generated: ${d.gen}</div></div>`;
  h += `<div class="st ${d.sc}">${d.sb} ${d.status}</div></div>`;

  h += '<div class="su">';
  h += `<div class="sc"><div class="v">${String(d.tc)}</div><div class="l">Components</div></div>`;
  h += `<div class="sc success"><div class="v">${String(d.dc)}</div><div class="l">Deployed</div></div>`;
  h += `<div class="sc failure"><div class="v">${String(d.fc)}</div><div class="l">Failed</div></div>`;
  h += `<div class="sc"><div class="v">${d.dur}</div><div class="l">Duration</div></div>`;

  if (d.ht) {
    const testClass = d.ft === 0 ? 'success' : 'failure';
    h += `<div class="sc ${testClass}"><div class="v">${String(d.pt)}/${String(d.tt)}</div><div class="l">Tests</div></div>`;
  }
  if (d.hc) {
    h += `<div class="sc ${d.cc}"><div class="v">${d.cp}%</div><div class="l">Coverage</div></div>`;
  }
  if (d.hca) {
    const caClass = d.ccnt + d.hcnt > 0 ? 'failure' : 'warning';
    h += `<div class="sc ${caClass}"><div class="v">${String(d.tv)}</div><div class="l">CA Issues</div></div>`;
  }
  h += '</div>';

  // ============================================
  // SECTION 2: DELTA PACKAGE.XML
  // ============================================
  if (d.hpkg && d.pkg) {
    h += `<div class="se"><h2>📦 Delta Package <span class="cnt">(${String(d.pkg.totalMembers)} members, ${String(d.pkg.types.length)} types, API v${d.pkg.version})</span></h2>`;
    
    // Expand/Collapse all buttons
    h += '<div style="margin-bottom:10px;display:flex;gap:8px">';
    h += '<button onclick="expandAllPkg(true)" style="border:1px solid #ddd;background:#f8f9fa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">📂 Expand All</button>';
    h += '<button onclick="expandAllPkg(false)" style="border:1px solid #ddd;background:#f8f9fa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">📁 Collapse All</button>';
    h += '</div>';
    
    h += '<div class="tc"><table id="pkgTable"><thead><tr><th style="width:30px"></th><th>Metadata Type</th><th style="text-align:right">Count</th></tr></thead><tbody>';
    
    for (const t of d.pkg.types) {
      // Main row - metadata type with count
      h += '<tr style="background:#f8f9fa;cursor:pointer" onclick="expandPkg(this.querySelector(\'button\'))">';
      h += `<td><button class="pkg-expand-btn" onclick="event.stopPropagation();expandPkg(this)" style="border:none;background:#e9ecef;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold">+</button></td>`;
      h += `<td><span class="bd bd-s" style="font-size:10px">${t.name}</span></td>`;
      h += `<td style="text-align:right;font-weight:600">${String(t.members.length)}</td>`;
      h += '</tr>';
      
      // Detail row - list of members (hidden by default)
      h += '<tr class="pkg-detail" style="display:none"><td colspan="3" style="background:#fff;padding:8px 12px 8px 40px">';
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (const member of t.members) {
        h += `<span style="background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:3px;font-size:10px;font-family:monospace">${member}</span>`;
      }
      h += '</div></td></tr>';
    }
    
    h += '</tbody></table></div></div>';
  }

  // ============================================
  // SECTION 3: DEPLOYMENT RESULTS (Errors & Failures)
  // ============================================
  if (d.he) {
    h += `<div class="se"><h2>❌ Deployment Error</h2><div class="eb"><div class="m">${d.err ?? ''}</div></div></div>`;
  }

  if (d.hcf) {
    h += `<div class="se"><h2>❌ Component Failures (${String(d.cf.length)})</h2><div class="tc"><table><thead><tr><th>Type</th><th>Name</th><th>Problem</th><th>Line</th></tr></thead><tbody>`;
    for (const c of d.cf) {
      h += `<tr><td><span class="bd bd-f">${c.componentType}</span></td><td>${c.fullName}</td><td>${c.problem ?? ''}</td><td>${c.lineNumber !== undefined ? String(c.lineNumber) : '-'}</td></tr>`;
    }
    h += '</tbody></table></div></div>';
  }

  // Show successful components if no failures (deployment succeeded)
  if (!d.hcf && d.cs.length > 0) {
    h += `<div class="se"><h2>✅ Deployed Components (${String(d.cs.length)})</h2><div class="tc" style="max-height:300px"><table><thead><tr><th>Type</th><th>Name</th><th>Action</th></tr></thead><tbody>`;
    for (const c of d.cs) {
      const action = c.created ? 'Created' : c.changed ? 'Changed' : c.deleted ? 'Deleted' : 'Deployed';
      const actionBadge = c.created ? 'bd-s' : c.changed ? 'bd-w' : c.deleted ? 'bd-f' : 'bd-s';
      h += `<tr><td><span class="bd bd-s">${c.componentType}</span></td><td>${c.fullName}</td><td><span class="bd ${actionBadge}">${action}</span></td></tr>`;
    }
    h += '</tbody></table></div></div>';
  }

  // ============================================
  // SECTION 4: CODE COVERAGE
  // ============================================
  if (d.ic && d.hc) {
    h += `<div class="se"><h2>📊 Code Coverage</h2><div style="margin-bottom:10px"><strong>Overall: ${d.cp}%</strong><div class="pb" style="margin-top:5px"><div class="fl ${d.cc}" style="width:${d.cp}%"></div></div></div>`;
    h += `<div style="margin-bottom:10px;font-size:11px;color:#666">🟢 ≥75%: ${String(d.c75)} | 🟡 50-74%: ${String(d.c50)} | 🔴 <50%: ${String(d.c0)}</div>`;
    h += '<div class="tc"><table><thead><tr><th>Class</th><th>Type</th><th>Coverage</th><th>Lines</th></tr></thead><tbody id="covTable">';
    for (const c of d.cov) {
      const badge = c.coveragePercent >= 75 ? 'bd-s' : c.coveragePercent >= 50 ? 'bd-w' : 'bd-f';
      const fill = c.coveragePercent >= 75 ? 'success' : c.coveragePercent >= 50 ? 'warning' : 'failure';
      h += `<tr data-cov="${String(c.coveragePercent)}"><td>${c.name}</td><td>${c.type}</td><td><div class="cb"><div class="br"><div class="fl ${fill}" style="width:${String(c.coveragePercent)}%"></div></div><span class="bd ${badge}">${String(c.coveragePercent)}%</span></div></td><td>${String(c.numLocations - c.numLocationsNotCovered)}/${String(c.numLocations)}</td></tr>`;
    }
    h += '</tbody></table></div></div>';
  }

  // ============================================
  // SECTION 5: TEST RESULTS (JUnit)
  // ============================================
  if (d.ht) {
    const testStatus = d.ft === 0 ? '✅' : '❌';
    const testStatusClass = d.ft === 0 ? 'success' : 'failure';
    h += `<div class="se"><h2>🧪 Test Results <span class="cnt">(${String(d.pt)} passed, ${String(d.ft)} failed)</span></h2>`;
    
    // Test summary bar
    const passRate = d.tt > 0 ? (d.pt / d.tt) * 100 : 0;
    h += `<div style="margin-bottom:10px"><strong>${testStatus} Pass Rate: ${d.tsr}%</strong><div class="pb" style="margin-top:5px"><div class="fl ${testStatusClass}" style="width:${String(passRate)}%"></div></div></div>`;

    // Failed tests first (if any)
    if (d.htf) {
      h += `<h3 style="font-size:13px;margin:15px 0 10px;color:#dc3545">❌ Failed Tests (${String(d.tf.length)})</h3>`;
      h += '<div class="tc"><table><thead><tr><th>Class</th><th>Method</th><th>Message</th></tr></thead><tbody>';
      for (const t of d.tf) {
        h += `<tr><td>${t.name}</td><td>${t.methodName}</td><td><div class="eb" style="margin:0;padding:5px"><div class="m">${t.message ?? ''}</div></div></td></tr>`;
      }
      h += '</tbody></table></div>';
    }

    // Passed tests (collapsible)
    if (d.ts.length > 0) {
      h += `<h3 style="font-size:13px;margin:15px 0 10px;color:#28a745">✅ Passed Tests (${String(d.ts.length)})</h3>`;
      h += '<div class="tc" style="max-height:200px"><table><thead><tr><th>Class</th><th>Method</th><th>Time</th></tr></thead><tbody>';
      for (const t of d.ts) {
        h += `<tr><td>${t.name}</td><td>${t.methodName}</td><td>${String((t.time / 1000).toFixed(2))}s</td></tr>`;
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';
  }

  // ============================================
  // SECTION 6: CODE ANALYZER
  // ============================================
  if (d.hca) {
    const allViolations = [...d.cv, ...d.hv, ...d.mv, ...d.lv].sort((a, b) => a.severity - b.severity);
    h += `<div class="se"><h2>🔍 Code Analyzer<span class="cnt">(<span id="caCount">${String(d.tv)}</span> issues)</span></h2>`;
    
    // Summary cards - clickable for filtering
    h += '<div class="ca-su">';
    h += `<div class="ca-card cr" data-sev="1" onclick="toggleCACard(this)"><div class="ca-v">${String(d.ccnt)}</div><div class="ca-l">🟣 Critical</div></div>`;
    h += `<div class="ca-card hi" data-sev="2" onclick="toggleCACard(this)"><div class="ca-v">${String(d.hcnt)}</div><div class="ca-l">🔴 High</div></div>`;
    h += `<div class="ca-card me" data-sev="3" onclick="toggleCACard(this)"><div class="ca-v">${String(d.mcnt)}</div><div class="ca-l">🟠 Medium</div></div>`;
    h += `<div class="ca-card lo" data-sev="4" onclick="toggleCACard(this)"><div class="ca-v">${String(d.lcnt)}</div><div class="ca-l">🔵 Low</div></div>`;
    h += '</div>';
    
    // Search box
    h += '<div class="ca-search"><input type="text" id="caSearch" placeholder="🔍 Search by rule, file, or message..." onkeyup="filterCA()"></div>';
    
    // Table-based list
    h += '<div class="tc"><table id="caTable"><thead><tr><th style="width:30px"></th><th>Severity</th><th>Rule</th><th>File</th><th>Line</th><th>Engine</th><th>Message</th></tr></thead><tbody>';
    
    for (let i = 0; i < allViolations.length; i++) {
      const v = allViolations[i];
      const sevLabel = v.severity === 1 ? 'Critical' : v.severity === 2 ? 'High' : v.severity === 3 ? 'Medium' : 'Low';
      const sevBadge = v.severity === 1 ? 'bd-cr' : v.severity === 2 ? 'bd-hi' : v.severity === 3 ? 'bd-me' : 'bd-lo';
      const fileName = v.file.split(/[/\\]/).pop() ?? '';
      const shortMsg = v.message.length > 60 ? v.message.substring(0, 60) + '...' : v.message;
      
      // Main row
      h += `<tr class="ca-row sev-${String(v.severity)}" data-sev="${String(v.severity)}">`;
      h += `<td><button onclick="expandRow(this)" style="border:none;background:#eee;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold">+</button></td>`;
      h += `<td><span class="bd ${sevBadge}">${sevLabel}</span></td>`;
      h += `<td style="font-weight:600">${v.rule}</td>`;
      h += `<td>${fileName}</td>`;
      h += `<td>${String(v.startLine)}</td>`;
      h += `<td><span style="font-size:9px;color:#888;background:#f5f5f5;padding:2px 6px;border-radius:3px">${v.engine}</span></td>`;
      h += `<td>${shortMsg}</td>`;
      h += '</tr>';
      
      // Detail row (hidden by default)
      h += `<tr class="ca-detail" style="display:none"><td colspan="7" style="background:#f8f9fa;padding:12px">`;
      h += `<div style="margin-bottom:8px"><strong>Full Message:</strong><div style="margin-top:4px;color:#555">${v.message}</div></div>`;
      
      // Code snippet if available
      if (v.codeSnippet) {
        const escapedSnippet = v.codeSnippet
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/→/g, '<span style="color:#ff79c6;font-weight:bold">→</span>');
        h += `<div style="margin-bottom:8px"><strong>📝 Code:</strong><div class="ca-code">${escapedSnippet}</div></div>`;
      }
      
      h += `<div style="margin-bottom:8px"><strong>File Path:</strong><div style="margin-top:4px;font-family:monospace;font-size:10px;color:#666">${v.file}</div></div>`;
      if (v.resources) {
        h += `<div><a href="${v.resources}" target="_blank" style="color:#1976d2;text-decoration:none;font-size:11px">📖 View Documentation</a></div>`;
      }
      h += '</td></tr>';
    }
    
    h += '</tbody></table></div></div>';
  }

  h += `<div class="ft">Generated by DXB CLI</div></div><script>${js}</script></body></html>`;
  return h;
}

function generateMdReport(d: ReportData): string {
  // ============================================
  // SECTION 1: HEADER & SUMMARY
  // ============================================
  let m = `# ${d.title}\n\n**ID:** ${d.id}\n**Generated:** ${d.gen}\n**Status:** ${d.sb} **${d.status}**\n\n---\n\n## 📋 Summary\n\n| Metric | Value |\n|--------|-------|\n| Components | ${String(d.tc)} |\n| Deployed | ${String(d.dc)} |\n| Failed | ${String(d.fc)} |\n| Duration | ${d.dur} |\n`;

  if (d.ht) {
    m += `| Tests | ${String(d.pt)}/${String(d.tt)} (${d.tsr}%) |\n`;
  }
  if (d.hc) {
    m += `| Coverage | ${d.cp}% |\n`;
  }
  if (d.hca) {
    m += `| CA Issues | ${String(d.tv)} |\n`;
  }

  // ============================================
  // SECTION 2: DELTA PACKAGE.XML
  // ============================================
  if (d.hpkg && d.pkg) {
    m += `\n---\n\n## 📦 Delta Package\n\n**API Version:** ${d.pkg.version}\n**Total Members:** ${String(d.pkg.totalMembers)}\n**Metadata Types:** ${String(d.pkg.types.length)}\n\n| Metadata Type | Count | Members |\n|---------------|-------|----------|\n`;
    for (const t of d.pkg.types) {
      const membersList = t.members.length <= 5 
        ? t.members.join(', ') 
        : t.members.slice(0, 5).join(', ') + ` ... (+${String(t.members.length - 5)} more)`;
      m += `| ${t.name} | ${String(t.members.length)} | ${membersList} |\n`;
    }
  }

  // ============================================
  // SECTION 3: DEPLOYMENT RESULTS (Errors & Failures)
  // ============================================
  if (d.he) {
    m += `\n---\n\n## ❌ Deployment Error\n\n\`\`\`\n${d.err ?? ''}\n\`\`\`\n`;
  }

  if (d.hcf) {
    m += `\n---\n\n## ❌ Component Failures (${String(d.cf.length)})\n\n| Type | Name | Problem | Line |\n|------|------|---------|------|\n`;
    for (const c of d.cf) {
      m += `| ${c.componentType} | ${c.fullName} | ${c.problem ?? '-'} | ${c.lineNumber !== undefined ? String(c.lineNumber) : '-'} |\n`;
    }
  }

  // Show successful components if no failures
  if (!d.hcf && d.cs.length > 0) {
    m += `\n---\n\n## ✅ Deployed Components (${String(d.cs.length)})\n\n| Type | Name | Action |\n|------|------|--------|\n`;
    for (const c of d.cs) {
      const action = c.created ? 'Created' : c.changed ? 'Changed' : c.deleted ? 'Deleted' : 'Deployed';
      m += `| ${c.componentType} | ${c.fullName} | ${action} |\n`;
    }
  }

  // ============================================
  // SECTION 4: CODE COVERAGE
  // ============================================
  if (d.ic && d.hc) {
    m += `\n---\n\n## 📊 Code Coverage\n\n**Overall:** ${d.cp}%\n\n- 🟢 ≥75%: ${String(d.c75)}\n- 🟡 50-74%: ${String(d.c50)}\n- 🔴 <50%: ${String(d.c0)}\n\n| Class | Type | Coverage | Lines |\n|-------|------|----------|-------|\n`;
    for (const c of d.cov) {
      const badge = c.coveragePercent >= 75 ? '🟢' : c.coveragePercent >= 50 ? '🟡' : '🔴';
      m += `| ${c.name} | ${c.type} | ${badge} ${String(c.coveragePercent)}% | ${String(c.numLocations)} |\n`;
    }
  }

  // ============================================
  // SECTION 5: TEST RESULTS (JUnit)
  // ============================================
  if (d.ht) {
    const testStatus = d.ft === 0 ? '✅' : '❌';
    m += `\n---\n\n## 🧪 Test Results\n\n**${testStatus} Pass Rate:** ${d.tsr}% (${String(d.pt)} passed, ${String(d.ft)} failed)\n`;

    // Failed tests first
    if (d.htf) {
      m += `\n### ❌ Failed Tests (${String(d.tf.length)})\n\n| Class | Method | Message |\n|-------|--------|----------|\n`;
      for (const t of d.tf) {
        const msg = t.message ? t.message.substring(0, 60).replace(/\n/g, ' ') + '...' : '-';
        m += `| ${t.name} | ${t.methodName} | ${msg} |\n`;
      }
    }

    // Passed tests
    if (d.ts.length > 0) {
      m += `\n### ✅ Passed Tests (${String(d.ts.length)})\n\n| Class | Method | Time |\n|-------|--------|------|\n`;
      for (const t of d.ts) {
        m += `| ${t.name} | ${t.methodName} | ${(t.time / 1000).toFixed(2)}s |\n`;
      }
    }
  }

  // ============================================
  // SECTION 6: CODE ANALYZER
  // ============================================
  if (d.hca) {
    m += `\n---\n\n## 🔍 Code Analyzer (${String(d.tv)} issues)\n\n- 🟣 Critical: ${String(d.ccnt)}\n- 🔴 High: ${String(d.hcnt)}\n- 🟠 Medium: ${String(d.mcnt)}\n- 🔵 Low: ${String(d.lcnt)}\n\n| Sev | Rule | File | Line | Message |\n|-----|------|------|------|----------|\n`;
    const allViolations = [...d.cv, ...d.hv, ...d.mv, ...d.lv].sort((a, b) => a.severity - b.severity);
    for (const v of allViolations) {
      const badge = v.severity === 1 ? '🟣' : v.severity === 2 ? '🔴' : v.severity === 3 ? '🟠' : '🔵';
      const fileName = v.file.split(/[/\\]/).pop() ?? '';
      const msg = v.message.length > 50 ? v.message.substring(0, 50) + '...' : v.message;
      m += `| ${badge} | ${v.rule} | ${fileName} | ${String(v.startLine)} | ${msg} |\n`;
    }
  }

  m += '\n---\n\n*Generated by DXB CLI*\n';
  return m;
}

export default class DeploymentReport extends SfCommand<DeploymentReportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'job-id': Flags.string({ char: 'i', summary: messages.getMessage('flags.job-id.summary'), exclusive: ['json-file'] }),
    'json-file': Flags.file({ char: 'f', summary: messages.getMessage('flags.json-file.summary'), exclusive: ['job-id'] }),
    'junit-file': Flags.file({ char: 'j', summary: messages.getMessage('flags.junit-file.summary') }),
    'cobertura-file': Flags.file({ char: 'b', summary: messages.getMessage('flags.cobertura-file.summary') }),
    'code-analyzer-file': Flags.file({ char: 'a', summary: messages.getMessage('flags.code-analyzer-file.summary') }),
    'package-xml': Flags.file({ char: 'p', summary: 'Path to package.xml file to include deployed components list' }),
    format: Flags.string({ char: 'r', summary: messages.getMessage('flags.format.summary'), options: ['html', 'markdown'], default: 'html' }),
    'output-dir': Flags.directory({ char: 'd', summary: messages.getMessage('flags.output-dir.summary') }),
    'target-org': Flags.string({ char: 'u', summary: messages.getMessage('flags.target-org.summary') }),
    'include-coverage': Flags.boolean({ char: 'c', summary: messages.getMessage('flags.include-coverage.summary'), default: true }),
    title: Flags.string({ char: 't', summary: messages.getMessage('flags.title.summary'), default: 'Salesforce Deployment Report' }),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<DeploymentReportResult> {
    const { flags } = await this.parse(DeploymentReport);

    if (!flags['job-id'] && !flags['json-file']) {
      throw messages.createError('error.noInput');
    }
    if (flags['job-id'] && !flags['target-org']) {
      throw messages.createError('error.jobIdRequiresOrg');
    }

    let result: DeploymentResult;
    if (flags['job-id'] && flags['target-org']) {
      result = await this.fetchDeploymentResult(flags['job-id'], flags['target-org'], flags['api-version']);
    } else if (flags['json-file']) {
      result = loadResultFromFile(flags['json-file']);
    } else {
      result = createEmptyResult();
    }

    if (flags['junit-file'] && fs.existsSync(flags['junit-file'])) {
      result = mergeJUnitResults(result, await parseJUnitFile(flags['junit-file']));
    }
    if (flags['cobertura-file'] && fs.existsSync(flags['cobertura-file'])) {
      result = mergeCoberturaResults(result, await parseCoberturaFile(flags['cobertura-file']));
    }
    if (flags['code-analyzer-file'] && fs.existsSync(flags['code-analyzer-file'])) {
      result = mergeCodeAnalyzerResults(result, parseCodeAnalyzerFile(flags['code-analyzer-file']));
    }

    let pkgData: PackageXmlData | undefined;
    if (flags['package-xml'] && fs.existsSync(flags['package-xml'])) {
      pkgData = await parsePackageXmlFile(flags['package-xml']);
    }

    const report = this.generateReport(result, flags.format, flags.title, flags['include-coverage'], pkgData);

    if (flags['output-dir']) {
      const ext = flags.format === 'html' ? 'html' : 'md';
      const reportPath = path.join(flags['output-dir'], `deployment-report.${ext}`);
      fs.ensureDirSync(flags['output-dir']);
      fs.writeFileSync(reportPath, report);
      this.log(`Report: ${reportPath}`);
      return { reportPath, success: true };
    }

    this.log(report);
    return { report, success: true };
  }

  private async fetchDeploymentResult(jobId: string, targetOrg: string, apiVersion?: string): Promise<DeploymentResult> {
    try {
      const org = await Org.create({ aliasOrUsername: targetOrg });
      const conn: Connection = org.getConnection(apiVersion);
      const deployResult = await conn.metadata.checkDeployStatus(jobId, true);
      return normalizeResult(deployResult as unknown as Record<string, unknown>);
    } catch (e) {
      throw messages.createError('error.fetchFailed', [(e as Error).message]);
    }
  }

  private generateReport(r: DeploymentResult, fmt: string, title: string, incCov: boolean, pkgData?: PackageXmlData): string {
    const data = prepareReportData(r, title, incCov, pkgData);
    return fmt === 'html' ? generateHtmlReport(data) : generateMdReport(data);
  }
}
