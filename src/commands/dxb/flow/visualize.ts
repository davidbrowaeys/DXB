// _______________This Code was generated using GenAI tool: Codify, Please check for accuracy_______________//
import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org } from '@salesforce/core';
import * as xml2js from 'xml2js';

export type FlowVisualizeResult = {
  diagrams: FlowDiagram[];
  success: boolean;
};

interface FlowDiagram {
  flowName: string;
  flowLabel: string;
  diagram: string;
  outputPath?: string;
}

interface FlowElement {
  name: string;
  label?: string;
  type: string;
  description?: string;
  connector?: { targetReference: string };
  faultConnector?: { targetReference: string };
  defaultConnector?: { targetReference: string };
  nextValueConnector?: { targetReference: string };
  noMoreValuesConnector?: { targetReference: string };
  rules?: FlowRule[];
  scheduledPaths?: FlowScheduledPath[];
  waitEvents?: FlowWaitEvent[];
}

interface FlowRule {
  name: string;
  label?: string;
  conditionLogic?: string;
  connector?: { targetReference: string };
}

interface FlowScheduledPath {
  name: string;
  label?: string;
  connector?: { targetReference: string };
  offsetNumber?: number;
  offsetUnit?: string;
  timeSource?: string;
}

interface FlowWaitEvent {
  name: string;
  label?: string;
  connector?: { targetReference: string };
  conditionLogic?: string;
}

interface ParsedFlow {
  name: string;
  label: string;
  description?: string;
  processType: string;
  status?: string;
  start?: FlowElement;
  elements: Map<string, FlowElement>;
  connectors: FlowConnector[];
  variables?: FlowVariable[];
}

interface FlowConnector {
  from: string;
  to: string;
  label?: string;
  isFault?: boolean;
  isScheduled?: boolean;
}

interface FlowVariable {
  name: string;
  dataType: string;
  isInput?: boolean;
  isOutput?: boolean;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'flow.visualize');

export default class FlowVisualize extends SfCommand<FlowVisualizeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'flow-path': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.flow-path.summary'),
      exclusive: ['flow-dir', 'flow-name'],
    }),
    'flow-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.flow-dir.summary'),
      exclusive: ['flow-path', 'flow-name'],
    }),
    'flow-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.flow-name.summary'),
      exclusive: ['flow-path', 'flow-dir'],
    }),
    'target-org': Flags.string({
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
    }),
    format: Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.format.summary'),
      options: ['html', 'svg', 'png', 'mermaid', 'plantuml'],
      default: 'html',
    }),
    'output-dir': Flags.directory({
      char: 'p',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    'include-labels': Flags.boolean({
      char: 'l',
      summary: messages.getMessage('flags.include-labels.summary'),
      default: true,
    }),
    'show-fault-paths': Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.show-fault-paths.summary'),
      default: true,
    }),
    'show-variables': Flags.boolean({
      char: 'v',
      summary: messages.getMessage('flags.show-variables.summary'),
      default: false,
    }),
    theme: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.theme.summary'),
      options: ['default', 'dark', 'forest', 'neutral'],
      default: 'default',
    }),
  };

  public async run(): Promise<FlowVisualizeResult> {
    const { flags } = await this.parse(FlowVisualize);

    // Validate inputs
    if (!flags['flow-path'] && !flags['flow-dir'] && !flags['flow-name']) {
      throw messages.createError('error.noInput');
    }

    if (flags['flow-name'] && !flags['target-org']) {
      throw messages.createError('error.flowNameRequiresOrg');
    }

    // Check for mermaid-cli if generating images
    if ((flags.format === 'svg' || flags.format === 'png') && !this.isMermaidCliInstalled()) {
      this.warn(
        'mermaid-cli (mmdc) not found. Install with: npm install -g @mermaid-js/mermaid-cli\nFalling back to HTML format.'
      );
      flags.format = 'html';
    }

    const diagrams: FlowDiagram[] = [];

    if (flags['flow-path']) {
      const diagram = await this.processFlowFile(
        flags['flow-path'],
        flags['include-labels'],
        flags['show-fault-paths']
      );
      diagrams.push(diagram);
    } else if (flags['flow-dir']) {
      const flowFiles = fs
        .readdirSync(flags['flow-dir'])
        .filter((f) => f.endsWith('.flow-meta.xml'));

      for (const file of flowFiles) {
        const filePath = path.join(flags['flow-dir'], file);
        const diagram = await this.processFlowFile(filePath, flags['include-labels'], flags['show-fault-paths']);
        diagrams.push(diagram);
      }
    } else if (flags['flow-name']) {
      const diagram = await this.processFlowFromOrg(
        flags['flow-name'],
        flags['target-org']!,
        flags['include-labels'],
        flags['show-fault-paths']
      );
      diagrams.push(diagram);
    }

    // Output diagrams
    if (flags['output-dir']) {
      fs.ensureDirSync(flags['output-dir']);

      for (const diagram of diagrams) {
        const outputPath = await this.outputDiagram(
          diagram,
          flags['output-dir'],
          flags.format,
          flags.theme,
          flags['show-variables']
        );
        diagram.outputPath = outputPath;
        this.log(`Generated: ${outputPath}`);
      }
    } else {
      // Output to stdout (only for text formats)
      for (const diagram of diagrams) {
        if (flags.format === 'html') {
          const html = this.generateHtml(diagram, flags.theme, flags['show-variables']);
          this.log(html);
        } else if (flags.format === 'mermaid' || flags.format === 'plantuml') {
          this.log(`\n## ${diagram.flowLabel} (${diagram.flowName})\n`);
          if (flags.format === 'mermaid') {
            this.log('```mermaid');
          }
          this.log(diagram.diagram);
          if (flags.format === 'mermaid') {
            this.log('```');
          }
        } else {
          this.warn(`Format '${flags.format}' requires --output-dir to save the image file.`);
        }
      }
    }

    return { diagrams, success: true };
  }

  private isMermaidCliInstalled(): boolean {
    try {
      execSync('mmdc --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async outputDiagram(
    diagram: FlowDiagram,
    outputDir: string,
    format: string,
    theme: string,
    showVariables: boolean
  ): Promise<string> {
    const baseName = diagram.flowName;

    switch (format) {
      case 'html': {
        const htmlPath = path.join(outputDir, `${baseName}.html`);
        const html = this.generateHtml(diagram, theme, showVariables);
        fs.writeFileSync(htmlPath, html);
        return htmlPath;
      }
      case 'svg':
      case 'png': {
        const mmdPath = path.join(outputDir, `${baseName}.mmd`);
        const outputPath = path.join(outputDir, `${baseName}.${format}`);
        fs.writeFileSync(mmdPath, diagram.diagram);
        try {
          execSync(`mmdc -i "${mmdPath}" -o "${outputPath}" -t ${theme} -b transparent`, {
            stdio: 'inherit',
          });
          fs.unlinkSync(mmdPath); // Clean up temp file
        } catch (error) {
          this.warn(`Failed to generate ${format}: ${(error as Error).message}`);
          // Fallback to HTML
          const htmlPath = path.join(outputDir, `${baseName}.html`);
          const html = this.generateHtml(diagram, theme, showVariables);
          fs.writeFileSync(htmlPath, html);
          return htmlPath;
        }
        return outputPath;
      }
      case 'mermaid': {
        const mdPath = path.join(outputDir, `${baseName}.md`);
        const content = `# ${diagram.flowLabel}\n\n\`\`\`mermaid\n${diagram.diagram}\n\`\`\`\n`;
        fs.writeFileSync(mdPath, content);
        return mdPath;
      }
      case 'plantuml': {
        const pumlPath = path.join(outputDir, `${baseName}.puml`);
        fs.writeFileSync(pumlPath, diagram.diagram);
        return pumlPath;
      }
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateHtml(diagram: FlowDiagram, theme: string, showVariables: boolean): string {
    const mermaidTheme = theme === 'dark' ? 'dark' : theme === 'forest' ? 'forest' : theme === 'neutral' ? 'neutral' : 'default';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(diagram.flowLabel)} - Flow Visualization</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        :root {
            --bg-color: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
            --text-color: ${theme === 'dark' ? '#eaeaea' : '#333333'};
            --card-bg: ${theme === 'dark' ? '#16213e' : '#f8f9fa'};
            --border-color: ${theme === 'dark' ? '#0f3460' : '#dee2e6'};
            --primary-color: #0d6efd;
            --success-color: #198754;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, var(--primary-color), #6610f2);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2rem; margin-bottom: 8px; }
        .header .subtitle { opacity: 0.9; font-size: 1.1rem; }
        .meta-info {
            display: flex;
            gap: 20px;
            margin-top: 16px;
            flex-wrap: wrap;
        }
        .meta-badge {
            background: rgba(255,255,255,0.2);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        .controls {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
        }
        .controls button {
            padding: 8px 16px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-color);
            color: var(--text-color);
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        .controls button:hover {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }
        .diagram-container {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            overflow: auto;
            min-height: 500px;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
        .legend {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            margin-top: 24px;
        }
        .legend h3 { margin-bottom: 16px; font-size: 1.1rem; }
        .legend-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
        }
        .legend-shape {
            width: 32px;
            height: 24px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: bold;
        }
        .shape-start { background: #90EE90; border: 2px solid #228B22; border-radius: 12px; }
        .shape-decision { background: #FFD700; border: 2px solid #DAA520; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
        .shape-screen { background: #87CEEB; border: 2px solid #4682B4; }
        .shape-record { background: #DDA0DD; border: 2px solid #8B008B; border-radius: 50%; }
        .shape-action { background: #FFA07A; border: 2px solid #FF4500; }
        .shape-loop { background: #98FB98; border: 2px solid #32CD32; }
        .shape-wait { background: #FFB6C1; border: 2px solid #FF69B4; border-radius: 50%; }
        .shape-subflow { background: #B0E0E6; border: 2px solid #5F9EA0; }
        .variables-section {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            margin-top: 24px;
        }
        .variables-section h3 { margin-bottom: 16px; }
        .variables-table {
            width: 100%;
            border-collapse: collapse;
        }
        .variables-table th, .variables-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        .variables-table th { font-weight: 600; }
        .var-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            margin-right: 4px;
        }
        .var-input { background: #d4edda; color: #155724; }
        .var-output { background: #cce5ff; color: #004085; }
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 16px;
            color: ${theme === 'dark' ? '#888' : '#666'};
            font-size: 0.85rem;
        }
        @media print {
            .controls { display: none; }
            body { background: white; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.escapeHtml(diagram.flowLabel)}</h1>
            <div class="subtitle">Flow Visualization</div>
            <div class="meta-info">
                <span class="meta-badge">📋 API Name: ${this.escapeHtml(diagram.flowName)}</span>
            </div>
        </div>

        <div class="controls">
            <button onclick="zoomIn()">🔍+ Zoom In</button>
            <button onclick="zoomOut()">🔍- Zoom Out</button>
            <button onclick="resetZoom()">↺ Reset</button>
            <button onclick="downloadSvg()">⬇️ Download SVG</button>
            <button onclick="downloadPng()">🖼️ Download PNG</button>
            <button onclick="window.print()">🖨️ Print</button>
        </div>

        <div class="diagram-container" id="diagram-container">
            <div class="mermaid" id="mermaid-diagram">
${diagram.diagram}
            </div>
        </div>

        <div class="legend">
            <h3>📖 Element Legend</h3>
            <div class="legend-grid">
                <div class="legend-item"><div class="legend-shape shape-start"></div> Start / End</div>
                <div class="legend-item"><div class="legend-shape shape-decision"></div> Decision</div>
                <div class="legend-item"><div class="legend-shape shape-screen"></div> Screen</div>
                <div class="legend-item"><div class="legend-shape shape-record"></div> Record Operation</div>
                <div class="legend-item"><div class="legend-shape shape-action"></div> Action / Apex</div>
                <div class="legend-item"><div class="legend-shape shape-loop"></div> Loop</div>
                <div class="legend-item"><div class="legend-shape shape-wait"></div> Wait / Pause</div>
                <div class="legend-item"><div class="legend-shape shape-subflow"></div> Subflow</div>
            </div>
        </div>

        <div class="footer">
            Generated by DXB Flow Visualizer • ${new Date().toLocaleString()}
        </div>
    </div>

    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: '${mermaidTheme}',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            securityLevel: 'loose'
        });

        let currentZoom = 1;
        const zoomStep = 0.1;

        function zoomIn() {
            currentZoom += zoomStep;
            applyZoom();
        }

        function zoomOut() {
            currentZoom = Math.max(0.1, currentZoom - zoomStep);
            applyZoom();
        }

        function resetZoom() {
            currentZoom = 1;
            applyZoom();
        }

        function applyZoom() {
            const svg = document.querySelector('#mermaid-diagram svg');
            if (svg) {
                svg.style.transform = 'scale(' + currentZoom + ')';
                svg.style.transformOrigin = 'center top';
            }
        }

        function downloadSvg() {
            const svg = document.querySelector('#mermaid-diagram svg');
            if (!svg) return;
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${diagram.flowName}.svg';
            a.click();
            URL.revokeObjectURL(url);
        }

        function downloadPng() {
            const svg = document.querySelector('#mermaid-diagram svg');
            if (!svg) return;
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width * 2;
                canvas.height = img.height * 2;
                ctx.fillStyle = '${theme === 'dark' ? '#1a1a2e' : '#ffffff'}';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = '${diagram.flowName}.png';
                a.click();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
    </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async processFlowFile(
    filePath: string,
    includeLabels: boolean,
    showFaultPaths: boolean
  ): Promise<FlowDiagram> {
    if (!fs.existsSync(filePath)) {
      throw messages.createError('error.fileNotFound', [filePath]);
    }

    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const flowName = path.basename(filePath).replace('.flow-meta.xml', '');

    return this.generateDiagram(xmlContent, flowName, includeLabels, showFaultPaths);
  }

  private async processFlowFromOrg(
    flowName: string,
    targetOrg: string,
    includeLabels: boolean,
    showFaultPaths: boolean
  ): Promise<FlowDiagram> {
    try {
      const org: Org = await Org.create({ aliasOrUsername: targetOrg });
      const conn: Connection = org.getConnection();

      const result = await conn.metadata.read('Flow', flowName);

      if (!result) {
        throw new Error(`Flow '${flowName}' not found in org`);
      }

      const builder = new xml2js.Builder();
      const xmlContent = builder.buildObject({ Flow: result });

      return await this.generateDiagram(xmlContent, flowName, includeLabels, showFaultPaths);
    } catch (error) {
      throw messages.createError('error.retrieveFailed', [(error as Error).message]);
    }
  }

  private async generateDiagram(
    xmlContent: string,
    flowName: string,
    includeLabels: boolean,
    showFaultPaths: boolean
  ): Promise<FlowDiagram> {
    const parsedFlow = await this.parseFlowXml(xmlContent, flowName, showFaultPaths);
    const diagram = this.generateMermaidDiagram(parsedFlow, includeLabels, showFaultPaths);

    return {
      flowName: parsedFlow.name,
      flowLabel: parsedFlow.label,
      diagram,
    };
  }

  private async parseFlowXml(xmlContent: string, flowName: string, showFaultPaths: boolean): Promise<ParsedFlow> {
    const parser = new xml2js.Parser({ explicitArray: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let flowData: any;

    try {
      const result = await parser.parseStringPromise(xmlContent);
      flowData = result.Flow;
    } catch (error) {
      throw messages.createError('error.invalidFlowXml', [(error as Error).message]);
    }

    const elements = new Map<string, FlowElement>();
    const connectors: FlowConnector[] = [];
    const variables: FlowVariable[] = [];

    // Parse variables
    if (flowData.variables) {
      const vars = Array.isArray(flowData.variables) ? flowData.variables : [flowData.variables];
      for (const v of vars) {
        variables.push({
          name: v.name,
          dataType: v.dataType,
          isInput: v.isInput === 'true',
          isOutput: v.isOutput === 'true',
        });
      }
    }

    // Parse start element
    let startElement: FlowElement | undefined;
    if (flowData.start) {
      const start = flowData.start;
      startElement = {
        name: 'START',
        label: 'Start',
        type: 'start',
        connector: start.connector,
        scheduledPaths: start.scheduledPaths
          ? Array.isArray(start.scheduledPaths)
            ? start.scheduledPaths
            : [start.scheduledPaths]
          : undefined,
      };
      elements.set('START', startElement);

      if (start.connector?.targetReference) {
        connectors.push({ from: 'START', to: start.connector.targetReference });
      }

      // Handle scheduled paths (for scheduled flows)
      if (startElement.scheduledPaths) {
        for (const sp of startElement.scheduledPaths) {
          if (sp.connector?.targetReference) {
            connectors.push({
              from: 'START',
              to: sp.connector.targetReference,
              label: sp.label ?? sp.name,
              isScheduled: true,
            });
          }
        }
      }
    }

    // Parse all flow element types
    const elementTypes = [
      { key: 'decisions', type: 'decision' },
      { key: 'screens', type: 'screen' },
      { key: 'recordCreates', type: 'recordCreate' },
      { key: 'recordUpdates', type: 'recordUpdate' },
      { key: 'recordDeletes', type: 'recordDelete' },
      { key: 'recordLookups', type: 'recordLookup' },
      { key: 'recordRollbacks', type: 'recordRollback' },
      { key: 'assignments', type: 'assignment' },
      { key: 'loops', type: 'loop' },
      { key: 'subflows', type: 'subflow' },
      { key: 'actionCalls', type: 'action' },
      { key: 'apexPluginCalls', type: 'apex' },
      { key: 'collectionProcessors', type: 'collection' },
      { key: 'waits', type: 'wait' },
      { key: 'customErrors', type: 'customError' },
      { key: 'transforms', type: 'transform' },
      { key: 'orchestratedStages', type: 'orchestratedStage' },
      { key: 'steps', type: 'step' },
    ];

    for (const { key, type } of elementTypes) {
      const items = flowData[key];
      if (items) {
        const itemArray = Array.isArray(items) ? items : [items];
        for (const item of itemArray) {
          const element = this.parseFlowElement(item, type);
          elements.set(element.name, element);
          this.addConnectors(element, connectors, showFaultPaths);
        }
      }
    }

    return {
      name: flowName,
      label: flowData.label || flowName,
      description: flowData.description,
      processType: flowData.processType || 'Flow',
      status: flowData.status,
      start: startElement,
      elements,
      connectors,
      variables,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseFlowElement(item: any, type: string): FlowElement {
    const element: FlowElement = {
      name: item.name,
      label: item.label,
      type,
      description: item.description,
      connector: item.connector,
      faultConnector: item.faultConnector,
      defaultConnector: item.defaultConnector,
      nextValueConnector: item.nextValueConnector,
      noMoreValuesConnector: item.noMoreValuesConnector,
    };

    // Parse decision rules
    if (type === 'decision' && item.rules) {
      const rules = Array.isArray(item.rules) ? item.rules : [item.rules];
      element.rules = rules.map(
        (rule: { name: string; label?: string; conditionLogic?: string; connector?: { targetReference: string } }) => ({
          name: rule.name,
          label: rule.label,
          conditionLogic: rule.conditionLogic,
          connector: rule.connector,
        })
      );
    }

    // Parse wait events
    if (type === 'wait' && item.waitEvents) {
      const events = Array.isArray(item.waitEvents) ? item.waitEvents : [item.waitEvents];
      element.waitEvents = events.map(
        (event: { name: string; label?: string; connector?: { targetReference: string }; conditionLogic?: string }) => ({
          name: event.name,
          label: event.label,
          connector: event.connector,
          conditionLogic: event.conditionLogic,
        })
      );
    }

    return element;
  }

  private addConnectors(element: FlowElement, connectors: FlowConnector[], showFaultPaths: boolean): void {
    // Standard connector
    if (element.connector?.targetReference) {
      connectors.push({ from: element.name, to: element.connector.targetReference });
    }

    // Default connector (for decisions)
    if (element.defaultConnector?.targetReference) {
      connectors.push({ from: element.name, to: element.defaultConnector.targetReference, label: 'Default' });
    }

    // Decision rules
    if (element.rules) {
      for (const rule of element.rules) {
        if (rule.connector?.targetReference) {
          connectors.push({ from: element.name, to: rule.connector.targetReference, label: rule.label ?? rule.name });
        }
      }
    }

    // Wait events
    if (element.waitEvents) {
      for (const event of element.waitEvents) {
        if (event.connector?.targetReference) {
          connectors.push({
            from: element.name,
            to: event.connector.targetReference,
            label: event.label ?? event.name,
          });
        }
      }
    }

    // Loop connectors
    if (element.nextValueConnector?.targetReference) {
      connectors.push({ from: element.name, to: element.nextValueConnector.targetReference, label: 'Next Item' });
    }
    if (element.noMoreValuesConnector?.targetReference) {
      connectors.push({ from: element.name, to: element.noMoreValuesConnector.targetReference, label: 'Done' });
    }

    // Fault connector
    if (showFaultPaths && element.faultConnector?.targetReference) {
      connectors.push({ from: element.name, to: element.faultConnector.targetReference, label: 'Fault', isFault: true });
    }
  }

  private generateMermaidDiagram(flow: ParsedFlow, includeLabels: boolean, showFaultPaths: boolean): string {
    const lines: string[] = ['flowchart TD'];

    // Define node shapes based on type
    const nodeShapes: Record<string, (name: string, label: string) => string> = {
      start: (name, label) => `${name}([${label}])`,
      decision: (name, label) => `${name}{${label}}`,
      screen: (name, label) => `${name}[/${label}/]`,
      recordCreate: (name, label) => `${name}[(${label})]`,
      recordUpdate: (name, label) => `${name}[(${label})]`,
      recordDelete: (name, label) => `${name}[(${label})]`,
      recordLookup: (name, label) => `${name}[(${label})]`,
      recordRollback: (name, label) => `${name}[(${label})]`,
      assignment: (name, label) => `${name}[${label}]`,
      loop: (name, label) => `${name}{{${label}}}`,
      subflow: (name, label) => `${name}[[${label}]]`,
      action: (name, label) => `${name}[${label}]`,
      apex: (name, label) => `${name}[${label}]`,
      collection: (name, label) => `${name}[${label}]`,
      wait: (name, label) => `${name}((${label}))`,
      customError: (name, label) => `${name}[/${label}\\]`,
      transform: (name, label) => `${name}[${label}]`,
      orchestratedStage: (name, label) => `${name}[[${label}]]`,
      step: (name, label) => `${name}[${label}]`,
      end: (name, label) => `${name}([${label}])`,
    };

    // Add nodes
    const addedNodes = new Set<string>();

    for (const [name, element] of flow.elements) {
    const label = includeLabels && element.label ? this.sanitizeLabel(element.label) : name;
    const shapeFunc = nodeShapes[element.type] ?? ((n: string, l: string): string => `${n}[${l}]`);
    lines.push(`    ${shapeFunc(this.sanitizeNodeId(name), label)}`);
    addedNodes.add(name);
  }

    // Add END node if there are elements without outgoing connectors
    const elementsWithOutgoing = new Set(flow.connectors.map((c) => c.from));

    for (const [name] of flow.elements) {
      if (!elementsWithOutgoing.has(name) && name !== 'START') {
        if (!addedNodes.has('END')) {
          lines.push('    END([End])');
          addedNodes.add('END');
        }
        flow.connectors.push({ from: name, to: 'END' });
      }
    }

    // Add connectors
    lines.push('');
    for (const connector of flow.connectors) {
      const fromId = this.sanitizeNodeId(connector.from);
      const toId = this.sanitizeNodeId(connector.to);

      if (connector.isFault) {
        if (connector.label) {
          lines.push(`    ${fromId} -.->|${this.sanitizeLabel(connector.label)}| ${toId}`);
        } else {
          lines.push(`    ${fromId} -.-> ${toId}`);
        }
      } else if (connector.isScheduled) {
        if (connector.label) {
          lines.push(`    ${fromId} ==>|${this.sanitizeLabel(connector.label)}| ${toId}`);
        } else {
          lines.push(`    ${fromId} ==> ${toId}`);
        }
      } else if (connector.label) {
        lines.push(`    ${fromId} -->|${this.sanitizeLabel(connector.label)}| ${toId}`);
      } else {
        lines.push(`    ${fromId} --> ${toId}`);
      }
    }

    // Add styling
    lines.push('');
    lines.push('    %% Styling');
    lines.push('    classDef startEnd fill:#90EE90,stroke:#228B22,stroke-width:2px');
    lines.push('    classDef decision fill:#FFD700,stroke:#DAA520,stroke-width:2px');
    lines.push('    classDef screen fill:#87CEEB,stroke:#4682B4,stroke-width:2px');
    lines.push('    classDef record fill:#DDA0DD,stroke:#8B008B,stroke-width:2px');
    lines.push('    classDef action fill:#FFA07A,stroke:#FF4500,stroke-width:2px');
    lines.push('    classDef loop fill:#98FB98,stroke:#32CD32,stroke-width:2px');
    lines.push('    classDef wait fill:#FFB6C1,stroke:#FF69B4,stroke-width:2px');
    lines.push('    classDef subflow fill:#B0E0E6,stroke:#5F9EA0,stroke-width:2px');
    lines.push('    classDef error fill:#FF6B6B,stroke:#DC143C,stroke-width:2px');

    // Apply styles
    const styleMap: Record<string, string> = {
      start: 'startEnd',
      end: 'startEnd',
      decision: 'decision',
      screen: 'screen',
      recordCreate: 'record',
      recordUpdate: 'record',
      recordDelete: 'record',
      recordLookup: 'record',
      recordRollback: 'record',
      loop: 'loop',
      action: 'action',
      apex: 'action',
      subflow: 'subflow',
      wait: 'wait',
      customError: 'error',
    };

    for (const [name, element] of flow.elements) {
      const styleClass = styleMap[element.type];
      if (styleClass) {
        lines.push(`    class ${this.sanitizeNodeId(name)} ${styleClass}`);
      }
    }
    if (addedNodes.has('END')) {
      lines.push('    class END startEnd');
    }

    return lines.join('\n');
  }

  private sanitizeNodeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private sanitizeLabel(label: string): string {
    return label
      .replace(/"/g, "'")
      .replace(/\[/g, '(')
      .replace(/\]/g, ')')
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
// __________________________GenAI: Generated code ends here______________________________//
