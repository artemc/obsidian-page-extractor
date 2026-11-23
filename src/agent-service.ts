// agent-service.ts
// Runs a command-line AI agent (pi, Claude Code) over SSH or locally.
// The prompt goes to stdin, the answer is read from stdout.
import { spawn } from 'child_process';
import { App, Notice } from 'obsidian';
import { AIResponse, PageExtractorSettings } from './types';
import { BaseAIService } from './base-ai-service';

interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}

interface ClaudeJsonResult {
    result?: string;
    is_error?: boolean;
    usage?: { input_tokens?: number; output_tokens?: number };
}

/** Quote a value for a POSIX shell. */
function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Quote an executable path, keeping a leading "~/" expandable as $HOME. */
function quotePath(path: string): string {
    if (path.startsWith('~/')) {
        return `"$HOME"/${shellQuote(path.slice(2))}`;
    }
    return shellQuote(path);
}

export class AgentService extends BaseAIService {
    constructor(
        app: App,
        private settings: PageExtractorSettings,
    ) {
        super(app, settings.aiPromptFile, settings.aiPrompt);
    }

    updateSettings(settings: PageExtractorSettings) {
        this.settings = settings;
        this.promptFile = settings.aiPromptFile;
        this.fallbackPrompt = settings.aiPrompt;
    }

    /** Executable path and arguments for the selected agent. Tools are always disabled. */
    private buildArgv(): { path: string; args: string[] } {
        const s = this.settings;
        if (s.agentName === 'claude') {
            const args = ['-p', '--tools', '', '--no-session-persistence', '--output-format', 'json'];
            if (s.claudeModel.trim()) args.push('--model', s.claudeModel.trim());
            if (s.claudeEffort) args.push('--effort', s.claudeEffort);
            return { path: s.claudePath.trim(), args };
        }
        const args = ['-p', '--no-session', '--no-tools'];
        if (s.piProvider.trim()) args.push('--provider', s.piProvider.trim());
        if (s.piModel.trim()) args.push('--model', s.piModel.trim());
        if (s.piThinking) args.push('--thinking', s.piThinking);
        return { path: s.piPath.trim(), args };
    }

    /**
     * Shell script that runs the agent in a fresh empty directory and removes it afterwards,
     * so the agent never starts inside a project or the home directory.
     */
    private buildScript(): string {
        const { path, args } = this.buildArgv();
        const command = [quotePath(path), ...args.map(shellQuote)].join(' ');
        return `d=$(mktemp -d) || exit 1; trap 'cd /; rmdir "$d" 2>/dev/null' EXIT; trap 'exit 143' HUP INT TERM; cd "$d" || exit 1; ${command}`;
    }

    private run(script: string, input: string): Promise<RunResult> {
        const host = this.settings.agentHost.trim();
        const [cmd, args] = host
            ? ['ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, script]]
            : ['/bin/sh', ['-c', script]];
        const timeoutMs = Math.max(1, this.settings.agentTimeoutSeconds) * 1000;

        return new Promise((resolve, reject) => {
            // Own process group, so a timeout stops the agent itself and not only the shell around it.
            const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], detached: true });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            const timer = window.setTimeout(() => {
                timedOut = true;
                try {
                    if (child.pid) process.kill(-child.pid, 'SIGTERM');
                } catch {
                    child.kill('SIGTERM');
                }
            }, timeoutMs);

            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');
            child.stdout.on('data', (chunk: string) => { stdout += chunk; });
            child.stderr.on('data', (chunk: string) => { stderr += chunk; });
            child.on('error', err => {
                window.clearTimeout(timer);
                reject(err);
            });
            child.on('close', code => {
                window.clearTimeout(timer);
                resolve({ code, stdout, stderr, timedOut });
            });
            // The agent may exit before reading all input; ignore the resulting EPIPE.
            child.stdin.on('error', () => {});
            child.stdin.end(input, 'utf8');
        });
    }

    async analyzeText(text: string): Promise<{ aiResponse: AIResponse | null; debugInfo: Record<string, unknown> }> {
        const agent = this.settings.agentName;
        const host = this.settings.agentHost.trim();
        const timeSent = new Date();
        const debugInfo: Record<string, unknown> = {
            timeSent: timeSent.toISOString(),
            agent,
            host: host || '(local)',
        };

        new Notice(`Running ${agent} ${host ? `on ${host}` : 'locally'}...`);

        try {
            const prompt = await this.getPrompt();
            const fullPrompt = `${prompt}\n\nText to analyze:\n${text}`;
            const script = this.buildScript();
            debugInfo.request = { command: script, prompt: fullPrompt };

            const result = await this.run(script, fullPrompt);

            const timeReceived = new Date();
            debugInfo.timeReceived = timeReceived.toISOString();
            debugInfo.responseTime = timeReceived.getTime() - timeSent.getTime();
            debugInfo.exitCode = result.code;
            if (result.stderr.trim()) debugInfo.stderr = result.stderr.trim();
            debugInfo.response = result.stdout;

            if (result.timedOut) {
                throw new Error(`no answer within ${this.settings.agentTimeoutSeconds} s`);
            }
            if (result.code !== 0) {
                const detail = (result.stderr.trim() || result.stdout.trim()).split('\n').slice(-3).join(' ');
                throw new Error(`exit code ${String(result.code)}${detail ? `: ${detail}` : ''}`);
            }

            let responseText = result.stdout;
            if (agent === 'claude') {
                const data = JSON.parse(result.stdout) as ClaudeJsonResult;
                debugInfo.response = data;
                debugInfo.inputTokens = data.usage?.input_tokens;
                debugInfo.outputTokens = data.usage?.output_tokens;
                if (data.is_error || typeof data.result !== 'string') {
                    throw new Error(`claude error: ${data.result ?? 'no result'}`);
                }
                responseText = data.result;
            }

            if (!responseText.trim()) {
                throw new Error('empty answer');
            }

            try {
                const extractedJson = this.extractJsonFromResponse(responseText);
                const aiResponse = this.parseJsonSafely(extractedJson);
                return { aiResponse, debugInfo };
            } catch (parseError) {
                const message = parseError instanceof Error ? parseError.message : String(parseError);
                console.error('Failed to parse agent response as JSON:', message);
                console.error('Original response text:', responseText);
                new Notice('Agent response could not be parsed. Check console for details.');
                return { aiResponse: null, debugInfo };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Agent analysis failed:', message);
            new Notice(`Agent analysis failed: ${message}`);
            return { aiResponse: null, debugInfo };
        }
    }
}
